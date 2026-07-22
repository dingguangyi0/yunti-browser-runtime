#!/usr/bin/env node
import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { handleJsonRpc, startBridgeServer } from "../mcp/server.js"
import packageJson from "../package.json" with { type: "json" }
import { startBenchmarkFixtureServer } from "./benchmark/fixture-server.js"
import { benchmarkScenarios, summarizeBenchmarkScenarios } from "./benchmark/manifest.js"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const extensionDir = join(rootDir, "extension")
const runAll = process.argv.includes("--all")
const listOnly = process.argv.includes("--list")
const jsonOnly = process.argv.includes("--json")
let activeScenarioMetrics = null

async function main() {
  if (listOnly) {
      const payload = {
        ok: true,
        phase: "P8.1-complete-suite",
      summary: summarizeBenchmarkScenarios(),
      scenarios: benchmarkScenarios,
    }
    if (jsonOnly) {
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
    } else {
      process.stdout.write("P8.0 benchmark scenarios: " + payload.summary.total + "\n")
      process.stdout.write("Implemented now: " + payload.summary.implemented + "\n")
      process.stdout.write("Planned: " + payload.summary.planned + "\n")
      process.stdout.write("Guarded-write scenarios: " + payload.summary.guardedWrites + "\n")
    }
    return
  }

  const selectedScenarios = runAll
    ? benchmarkScenarios
    : benchmarkScenarios.filter((scenario) => scenario.status === "implemented")

  if (!selectedScenarios.length) {
    process.stderr.write("No benchmark scenarios selected.\n")
    process.exit(1)
  }

  const playwright = await loadPlaywright()
  const artifactDir = await createArtifactDir()
  const fixtureServer = await startBenchmarkFixtureServer()
  const bridge = await startBridgeServer({
    host: "127.0.0.1",
    port: 0,
    sessionTtlMs: 120_000,
  })
  const bridgePort = bridge.server.address().port
  const bridgeUrl = "http://127.0.0.1:" + bridgePort
  const userDataDir = await mkdtemp(join(tmpdir(), "yunti-benchmark-profile-"))

  let context = null
  let page = null

  try {
    context = await playwright.chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        "--disable-extensions-except=" + extensionDir,
        "--load-extension=" + extensionDir,
      ],
    })

    const worker = await getExtensionWorker(context)
    await worker.evaluate(
      ({ bridgeUrl: runtimeBridgeUrl }) =>
        chrome.storage.local.set({
          bridgeUrl: runtimeBridgeUrl,
          bridgeToken: "",
          platformMatches: ["*"],
          localUserId: "local",
          localUserName: "local",
        }),
      { bridgeUrl }
    )

    page = await context.newPage()
    await page.goto(fixtureServer.url("/form-controls.html"))
    const browserSessionId = await waitForBrowserSession(bridgeUrl)
    const results = []

    for (const scenario of selectedScenarios) {
      const metrics = createScenarioMetrics(scenario)
      const startMs = Date.now()
      activeScenarioMetrics = metrics
      try {
        const run = () => runScenario({ scenario, browserSessionId, bridge, fixtureServer, page, metrics })
        if (scenario.repeatCount === 1) await recordAttempt(metrics, run)
        else await run()
        metrics.ok = true
        metrics.durationMs = Date.now() - startMs
      } catch (error) {
        metrics.ok = false
        metrics.durationMs = Date.now() - startMs
        metrics.failureClass = classifyError(error)
        metrics.notes = String(error?.stack || error)
        await persistFailureArtifact({ artifactDir, scenarioId: scenario.id, error, bridge, page })
      } finally {
        activeScenarioMetrics = null
      }
      results.push(metrics)
    }

    const summary = buildSummary(results, selectedScenarios)
    await writeSummaryArtifacts({ artifactDir, summary, results })
    const ok = summary.successCount === summary.selectedScenarioCount && summary.duplicateWrites === 0
    process.stdout.write(JSON.stringify({ ok, artifactDir, summary }, null, 2) + "\n")
    assert.equal(summary.successCount, summary.selectedScenarioCount, "One or more benchmark scenarios failed")
    assert.equal(summary.duplicateWrites, 0, "Benchmark detected duplicate writes")
  } finally {
    await context?.close().catch(() => {})
    await fixtureServer.close().catch(() => {})
    await new Promise((resolvePromise) => bridge.server.close(resolvePromise))
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

function createScenarioMetrics(scenario) {
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    category: scenario.category,
    backend: "mixed",
    ok: false,
    failureClass: null,
    recovered: false,
    duplicateWrite: false,
    durationMs: 0,
    observeCount: 0,
    totalObservedElements: 0,
    totalObservationBytes: 0,
    estimatedObservationTokens: 0,
    attempts: [],
    toolCalls: [],
    notes: "",
  }
}

async function recordAttempt(metrics, run) {
  const startedAt = Date.now()
  let ok = false
  try {
    const result = await run()
    ok = true
    return result
  } finally {
    metrics.attempts.push({
      attempt: metrics.attempts.length + 1,
      ok,
      durationMs: Date.now() - startedAt,
    })
  }
}

async function runScenario(context) {
  const runner = scenarioRunners[context.scenario.id]
  if (!runner) {
    throw new Error("Scenario " + context.scenario.id + " is selected but not implemented in the runner")
  }
  await runner(context)
}

const scenarioRunners = {
  async A01({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_fill", {
      browserSessionId,
      selector: "#name",
      value: "Benchmark User",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ value: document.querySelector('#name').value })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "Benchmark User" })
    metrics.backend = "content-script+evaluate"
  },
  async A02({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_fill", {
      browserSessionId,
      selector: "#notes",
      value: "Benchmark notes",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ value: document.querySelector('#notes').value })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "Benchmark notes" })
    metrics.backend = "content-script+evaluate"
  },
  async A03({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_fill", {
      browserSessionId,
      selector: "#editable",
      value: "Editable benchmark",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ value: document.querySelector('#editable').innerText.trim() })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "Editable benchmark" })
    metrics.backend = "content-script+evaluate"
  },
  async A04({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_select", {
      browserSessionId,
      selector: "#plan",
      value: "pro",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ value: document.querySelector('#plan').value })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "pro" })
    metrics.backend = "content-script+evaluate"
  },
  async A05({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_select", {
      browserSessionId,
      selector: "#plan",
      text: "Basic",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ value: document.querySelector('#plan').value })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "basic" })
    metrics.backend = "content-script+evaluate"
  },
  async A06({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#agree",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ checked: document.querySelector('#agree').checked })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { checked: true })
    metrics.backend = "content-script+evaluate"
  },
  async A07({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#tier-gold",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ value: document.querySelector('#tier-gold').checked ? 'gold' : (document.querySelector('#tier-silver').checked ? 'silver' : '') })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "gold" })
    metrics.backend = "content-script+evaluate"
  },
  async A08({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    await callTool(bridge, "yunti_fill", {
      browserSessionId,
      selector: "#name",
      value: "Saved Name",
    })
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    const saveButton = observation.elements.find((element) => element.uid && element.name === "Save form")
    assert.ok(saveButton?.uid, "Save button uid not found")
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      uid: saveButton.uid,
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ saved: document.querySelector('#result').textContent, saves: window.__saveCount || 0 })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { saved: "Saved Name", saves: 1 })
    metrics.backend = "observe+content-script+evaluate"
  },
  async B09({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/async-ui.html"))
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#render",
    })
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      text: "Rendered later",
      timeoutMs: 4000,
    })
    assert.equal(waited.ok, true)
    metrics.backend = "content-script+cdp-wait"
  },
  async B10({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/async-ui.html"))
    const clicked = await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#delayed-enable",
      timeoutMs: 2000,
    })
    assert.equal(clicked.ok, true)
    assert.ok(Number(clicked.actionability?.waitedMs || 0) >= 200)
    const state = await evaluateJson(bridge, browserSessionId, `({ result: document.querySelector('#result').textContent })`)
    assert.deepEqual(state, { result: "Delayed enabled clicked" })
    metrics.backend = "content-script-actionability+evaluate"
  },
  async B11({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/async-ui.html"))
    const clicked = await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#spinner-submit",
      timeoutMs: 2000,
    })
    assert.equal(clicked.ok, true)
    const state = await evaluateJson(bridge, browserSessionId, `({ spinnerGone: !document.querySelector('#spinner'), result: document.querySelector('#result').textContent })`)
    assert.deepEqual(state, { spinnerGone: true, result: "Submitted after spinner" })
    metrics.backend = "content-script-actionability+evaluate"
  },
  async B12({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/async-ui.html"))
    await callTool(bridge, "yunti_fill", {
      browserSessionId,
      selector: "#search",
      value: "benchmark",
    })
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      text: "Result for benchmark",
      timeoutMs: 4000,
    })
    assert.equal(waited.ok, true)
    metrics.backend = "content-script+cdp-wait"
  },
  async B13({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/async-ui.html"))
    await callTool(bridge, "yunti_click", { browserSessionId, selector: "#navigate-later" })
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      urlContains: "state=ready",
      timeoutMs: 3000,
    })
    assert.equal(waited.ok, true)
    assert.equal(waited.condition, "urlContains")
    metrics.backend = "content-script+tab-url-wait"
  },
  async B14({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/async-ui.html"))
    const clicked = await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#overlay-target",
      timeoutMs: 2500,
    })
    assert.equal(clicked.ok, true)
    assert.ok(Number(clicked.actionability?.waitedMs || 0) >= 500)
    const state = await evaluateJson(bridge, browserSessionId, `({ result: document.querySelector('#result').textContent })`)
    assert.deepEqual(state, { result: "Overlay target clicked" })
    metrics.backend = "content-script-actionability+evaluate"
  },
  async C15({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/nested-scroll.html"))
    await callTool(bridge, "yunti_scroll", {
      browserSessionId,
      dy: 1100,
    })
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#document-target",
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ result: document.querySelector('#result').textContent })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { result: "Document target clicked" })
    metrics.backend = "content-script+evaluate"
  },
  async C16({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/nested-scroll.html"))
    await callTool(bridge, "yunti_scroll", { browserSessionId, deltaY: 1400 })
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      mode: "fullPage",
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    const panel = observation.scrollableContainers.find((container) => container.name === "Row 1 Row 2 Row 3 Row 4 Row 5 Row 6 Row 7 Row 8 Deep target")
      || observation.scrollableContainers[0]
    assert.ok(panel?.uid, "Nested scroll panel uid not found")
    const scrolled = await callTool(bridge, "yunti_scroll", {
      browserSessionId,
      uid: panel.uid,
      deltaY: 900,
    })
    assert.equal(scrolled.moved, true)
    await callTool(bridge, "yunti_click", { browserSessionId, selector: "#deep-target" })
    const state = await evaluateJson(bridge, browserSessionId, `({ result: document.querySelector('#result').textContent, panelTop: document.querySelector('#panel').scrollTop })`)
    assert.equal(state.result, "Deep target clicked")
    assert.ok(state.panelTop > 0)
    metrics.backend = "observe+uid-scroll+content-script"
  },
  async C17({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/nested-scroll.html"))
    await callTool(bridge, "yunti_scroll", { browserSessionId, deltaY: 10000 })
    const boundary = await callTool(bridge, "yunti_scroll", { browserSessionId, deltaY: 10000 })
    assert.equal(boundary.moved, false)
    assert.equal(boundary.recoverable, true)
    assert.match(boundary.recoveryHint?.reason || "", /boundary|no-(?:scroll-)?movement/)
    metrics.backend = "content-script-scroll-diagnostics"
    metrics.recovered = true
  },
  async C18({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/nested-scroll.html"))
    const scrolled = await callTool(bridge, "yunti_scroll", {
      browserSessionId,
      x: 20,
      y: 80,
      deltaY: 500,
    })
    assert.equal(scrolled.moved, true)
    assert.equal(scrolled.coordinateFallbackHint?.reason, "coordinate-scroll-document-fallback")
    const state = await evaluateJson(bridge, browserSessionId, `({ top: window.scrollY })`)
    assert.ok(state.top > 0)
    metrics.backend = "coordinate-scroll-document-fallback"
    metrics.recovered = true
  },
  async D19({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/tab-opener.html"))
    const child = await callTool(bridge, "yunti_new_page", {
      browserSessionId,
      url: fixtureServer.url("/form-controls.html?opened=D19"),
      active: false,
    })
    assert.equal(child.ready, true)
    try {
      const targets = await callTool(bridge, "yunti_list_browser_targets", { browserSessionId })
      assert.ok(targets.pages.some((target) => target.tabId === child.tabId))
    } finally {
      await callTool(bridge, "yunti_close_page", { browserSessionId: child.browserSessionId })
    }
    metrics.backend = "controller-tabs"
  },
  async D20({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/tab-opener.html"))
    const child = await callTool(bridge, "yunti_new_page", {
      browserSessionId,
      url: fixtureServer.url("/form-controls.html?opened=D20"),
      active: true,
    })
    assert.equal(child.ready, true)
    try {
      await callTool(bridge, "yunti_select_page", { browserSessionId })
      const snapshot = await callTool(bridge, "yunti_get_page_snapshot", {
        browserSessionId,
        mode: "light",
      })
      assert.equal(snapshot.url, fixtureServer.url("/tab-opener.html"))
      assert.equal(snapshot.title, "Benchmark Tab Opener")
    } finally {
      await callTool(bridge, "yunti_close_page", { browserSessionId: child.browserSessionId })
    }
    metrics.backend = "controller-tab-selection"
  },
  async D21({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/tab-opener.html"))
    const targetUrl = fixtureServer.url("/form-controls.html?navigated=D21")
    const navigated = await callTool(bridge, "yunti_navigate_page", {
      browserSessionId,
      url: targetUrl,
      action: "url",
    })
    assert.equal(navigated.browserSessionId, browserSessionId)
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      urlContains: "navigated=D21",
      timeoutMs: 5000,
    })
    assert.equal(waited.ok, true)
    const state = await evaluateJson(bridge, browserSessionId, `({ title: document.title, url: location.href })`)
    assert.deepEqual(state, { title: "Benchmark Form Controls", url: targetUrl })
    metrics.backend = "tab-navigation+stable-route"
  },
  async D22({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html?controller=D22"))
    const targets = await callTool(bridge, "yunti_list_browser_targets", { browserSessionId })
    const target = targets.pages.find((candidate) => String(candidate.url).includes("controller=D22"))
    assert.ok(target?.tabId, "Controller target not found")
    const routeBrowserSessionId = target.routeBrowserSessionId || targets.browserSessionId
    assert.ok(routeBrowserSessionId, "Controller route id not found")
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId: routeBrowserSessionId,
      tabId: target.tabId,
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    assert.equal(observation.page?.title, "Benchmark Form Controls")
    assert.ok(observation.elementCount > 0)
    metrics.backend = "controller-explicit-tab-route"
    metrics.recovered = true
  },
  async E23({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/rerender.html"))
    const before = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      redaction: "balanced",
    })
    recordObservation(metrics, before)
    const replaceButton = before.elements.find((element) => element.uid && element.name === "Replace buttons")
    assert.ok(replaceButton?.uid, "Replace buttons uid not found")
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      uid: replaceButton.uid,
    })
    const after = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      redaction: "balanced",
    })
    recordObservation(metrics, after)
    const actionButton = after.elements.find((element) => element.uid && element.name === "Action B")
    assert.ok(actionButton?.uid, "Action B uid not found after rerender")
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      uid: actionButton.uid,
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ version: window.__currentVersion || 'unknown', count: window.__actionCount || 0 })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { version: "B", count: 1 })
    metrics.backend = "observe-rerender-observe"
  },
  async E24({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/rerender.html"))
    const before = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      redaction: "balanced",
    })
    recordObservation(metrics, before)
    const actionA = before.elements.find((element) => element.uid && element.name === "Action A")
    assert.ok(actionA?.uid, "Action A uid not found")
    await callTool(bridge, "yunti_click", { browserSessionId, selector: "#rerender" })
    const after = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      redaction: "balanced",
    })
    recordObservation(metrics, after)
    assert.ok(after.elements.some((element) => element.name === "Action B"))
    const staleResult = await callTool(bridge, "yunti_click", {
      browserSessionId,
      uid: actionA.uid,
    })
    assert.equal(staleResult.ok, false)
    const state = await evaluateJson(bridge, browserSessionId, `({ version: window.__currentVersion, count: window.__actionCount })`)
    assert.deepEqual(state, { version: "B", count: 0 })
    metrics.backend = "observe-stale-uid-diagnostics"
    metrics.recovered = true
  },
  async E25({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html?tab-route=E25"))
    const targets = await callTool(bridge, "yunti_list_browser_targets", { browserSessionId })
    const target = targets.pages.find((candidate) => String(candidate.url).includes("tab-route=E25"))
    assert.ok(target?.tabId, "Page target not found for tabId recovery")
    const observation = await callTool(bridge, "yunti_observe_page", {
      tabId: target.tabId,
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    assert.equal(observation.page?.title, "Benchmark Form Controls")
    assert.ok(observation.elementCount > 0)
    metrics.backend = "automatic-tab-route-recovery"
    metrics.recovered = true
  },
  async E26({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/form-controls.html"))
    const targets = await callTool(bridge, "yunti_list_browser_targets", { browserSessionId })
    const pageTarget = targets.pages.find((target) => target.url === fixtureServer.url("/form-controls.html"))
    assert.ok(pageTarget, "Page target not found for legacy recovery scenario")
    const recoveredObservation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId: "yunti-" + pageTarget.tabId + "-expired-legacy-session",
      redaction: "balanced",
    })
    recordObservation(metrics, recoveredObservation)
    assert.equal(recoveredObservation.browserSessionId, browserSessionId)
    assert.equal(recoveredObservation.page?.title, "Benchmark Form Controls")
    assert.ok(Number(recoveredObservation.elementCount || 0) >= 1)
    metrics.backend = "controller-recovery"
    metrics.recovered = true
  },
  async F27({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/iframe-host.html"))
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      mode: "fullPage",
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    const childAction = observation.elements.find((element) => element.uid && element.name === "Child action")
    assert.ok(childAction?.uid, "Iframe child action uid not found")
    await callTool(bridge, "yunti_click", { browserSessionId, uid: childAction.uid })
    const state = await evaluateJson(bridge, browserSessionId, `({ result: document.querySelector('#child-frame').contentDocument.querySelector('#child-result').textContent })`)
    assert.deepEqual(state, { result: "Child clicked" })
    metrics.backend = "observe+same-origin-iframe-action"
  },
  async F28({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/iframe-host.html"))
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      mode: "fullPage",
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    const childAction = observation.elements.find((element) => element.uid && element.name === "Child async action")
    assert.ok(childAction?.uid, "Iframe async action uid not found")
    await callTool(bridge, "yunti_click", { browserSessionId, uid: childAction.uid })
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      text: "Iframe async ready",
      timeoutMs: 3000,
    })
    assert.equal(waited.ok, true)
    assert.equal(waited.condition, "text")
    metrics.backend = "same-origin-iframe-action+deep-wait"
  },
  async F29({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/shadow-root.html"))
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      mode: "fullPage",
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    const save = observation.elements.find((element) => element.uid && element.name === "Shadow save")
    assert.ok(save?.uid, "Shadow save uid not found")
    await callTool(bridge, "yunti_click", { browserSessionId, uid: save.uid })
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      text: "Saved:",
      timeoutMs: 2000,
    })
    assert.equal(waited.ok, true)
    const state = await evaluateJson(bridge, browserSessionId, `({ result: document.querySelector('#shadow-host').shadowRoot.querySelector('#shadow-result').textContent })`)
    assert.deepEqual(state, { result: "Saved: " })
    metrics.backend = "observe+open-shadow-action"
  },
  async F30({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/shadow-root.html"))
    const observation = await callTool(bridge, "yunti_observe_page", {
      browserSessionId,
      mode: "fullPage",
      redaction: "balanced",
    })
    recordObservation(metrics, observation)
    const input = observation.elements.find((element) => element.uid && element.name === "Shadow input")
    const save = observation.elements.find((element) => element.uid && element.name === "Shadow save")
    assert.ok(input?.uid, "Shadow input uid not found")
    assert.ok(save?.uid, "Shadow save uid not found")
    await callTool(bridge, "yunti_fill", { browserSessionId, uid: input.uid, value: "Deep value" })
    await callTool(bridge, "yunti_click", { browserSessionId, uid: save.uid })
    const state = await evaluateJson(bridge, browserSessionId, `(() => { const root = document.querySelector('#shadow-host').shadowRoot; return { value: root.querySelector('#shadow-input').value, result: root.querySelector('#shadow-result').textContent }; })()`)
    assert.deepEqual(state, { value: "Deep value", result: "Saved: Deep value" })
    metrics.backend = "observe+open-shadow-fill"
  },
  async G31({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/upload-download.html"))
    const uploadPath = join(rootDir, "tests", "fixtures", "benchmark", "download.txt")
    await callTool(bridge, "yunti_upload_file", {
      browserSessionId,
      selector: "#upload",
      filePaths: [uploadPath],
    })
    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression: "JSON.stringify({ files: document.querySelector('#upload').files.length, name: document.querySelector('#upload').files[0]?.name || '' })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { files: 1, name: "download.txt" })
    metrics.backend = "cdp-upload+evaluate"
  },
  async G32({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/upload-download.html"))
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 })
    await callTool(bridge, "yunti_click", { browserSessionId, selector: "#download" })
    const download = await downloadPromise
    assert.equal(download.suggestedFilename(), "download.txt")
    assert.equal(await download.failure(), null)
    metrics.backend = "content-script-download+playwright-signal"
  },
  async G33({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/upload-download.html"))
    await callTool(bridge, "yunti_click", { browserSessionId, selector: "#visual-action" })
    const screenshot = await callTool(bridge, "yunti_take_screenshot", {
      browserSessionId,
      format: "png",
    })
    assert.equal(screenshot.format, "png")
    assert.equal(screenshot.mimeType, "image/png")
    assert.ok(screenshot.imageBase64Length > 1000)
    const state = await evaluateJson(bridge, browserSessionId, `({ result: document.querySelector('#visual-result').textContent, background: getComputedStyle(document.body).backgroundColor })`)
    assert.deepEqual(state, { result: "Visual state changed", background: "rgb(224, 247, 250)" })
    metrics.backend = "content-script+cdp-screenshot"
  },
  async G34({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    await page.goto(fixtureServer.url("/upload-download.html"))
    await callTool(bridge, "yunti_cdp_send_command", {
      browserSessionId,
      method: "Runtime.enable",
      params: {},
    })
    await callTool(bridge, "yunti_cdp_send_command", {
      browserSessionId,
      method: "Network.enable",
      params: {},
    })
    await callTool(bridge, "yunti_clear_console_messages", { browserSessionId })
    await callTool(bridge, "yunti_clear_network_requests", { browserSessionId })
    await callTool(bridge, "yunti_click", { browserSessionId, selector: "#diagnostic-action" })
    const missing = await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#missing-diagnostic-target",
      timeoutMs: 150,
    })
    assert.equal(missing.ok, false)
    const waited = await callTool(bridge, "yunti_wait_for", {
      browserSessionId,
      text: "Diagnostic status 503",
      timeoutMs: 3000,
    })
    assert.equal(waited.ok, true)
    const consoleMessages = await pollTool(bridge, "yunti_list_console_messages", {
      browserSessionId,
      limit: 100,
    }, (result) => result.events?.some((event) => String(event.text).includes("YUNTI_BENCHMARK_DIAGNOSTIC")))
    const networkRequests = await pollTool(bridge, "yunti_list_network_requests", {
      browserSessionId,
      urlContains: "/api/diagnostic-failure",
      limit: 100,
    }, (result) => result.events?.some((event) => Number(event.statusCode) === 503))
    assert.ok(consoleMessages.events.some((event) => String(event.text).includes("YUNTI_BENCHMARK_DIAGNOSTIC")))
    assert.ok(networkRequests.events.some((event) => Number(event.statusCode) === 503))
    metrics.backend = "content-script+cdp-diagnostics"
  },
  async H35({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await recordAttempt(metrics, async () => {
        await page.goto(fixtureServer.url("/guarded-submit.html"))
        await callTool(bridge, "yunti_click", {
          browserSessionId,
          selector: "#submit",
        })
        const waited = await callTool(bridge, "yunti_wait_for", {
          browserSessionId,
          text: "Submitted 1",
          timeoutMs: 4000,
        })
        assert.equal(waited.ok, true)
        const evaluated = await callTool(bridge, "yunti_evaluate_script", {
          browserSessionId,
          expression: "JSON.stringify({ count: window.__submitCount, values: window.__submittedValues })",
        })
        const parsed = JSON.parse(evaluated.value)
        assert.deepEqual(parsed, { count: 1, values: [1] })
      })
    }
    metrics.backend = "content-script+cdp-wait+evaluate"
    metrics.recovered = false
    metrics.duplicateWrite = false
  },
  async H36({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await recordAttempt(metrics, async () => {
        await page.goto(fixtureServer.url("/guarded-submit.html"))
        await callTool(bridge, "yunti_click", { browserSessionId, selector: "#async-submit" })
        const waited = await callTool(bridge, "yunti_wait_for", {
          browserSessionId,
          text: "Async submitted 1",
          timeoutMs: 4000,
        })
        assert.equal(waited.ok, true)
        const state = await evaluateJson(bridge, browserSessionId, `({ count: window.__asyncSubmitCount, text: document.querySelector('#async-result').textContent })`)
        assert.deepEqual(state, { count: 1, text: "Async submitted 1" })
      })
    }
    metrics.backend = "guarded-async-write+wait"
    metrics.duplicateWrite = false
  },
  async H37({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await recordAttempt(metrics, async () => {
        await page.goto(fixtureServer.url("/guarded-submit.html"))
        const before = await callTool(bridge, "yunti_observe_page", {
          browserSessionId,
          redaction: "balanced",
        })
        recordObservation(metrics, before)
        const submit = before.elements.find((element) => element.uid && element.name === "Drift submit once")
        assert.ok(submit?.uid, "Drift submit uid not found")
        await callTool(bridge, "yunti_click", { browserSessionId, uid: submit.uid })
        const after = await callTool(bridge, "yunti_observe_page", {
          browserSessionId,
          redaction: "balanced",
        })
        recordObservation(metrics, after)
        const staleResult = await callTool(bridge, "yunti_click", {
          browserSessionId,
          uid: submit.uid,
        })
        assert.equal(staleResult.ok, false)
        const waited = await callTool(bridge, "yunti_wait_for", {
          browserSessionId,
          text: "Drift submitted 1",
          timeoutMs: 3000,
        })
        assert.equal(waited.ok, true)
        const state = await evaluateJson(bridge, browserSessionId, `({ count: window.__driftSubmitCount })`)
        assert.deepEqual(state, { count: 1 })
      })
    }
    metrics.backend = "guarded-write+target-drift"
    metrics.recovered = true
    metrics.duplicateWrite = false
  },
  async H38({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await recordAttempt(metrics, async () => {
        await page.goto(fixtureServer.url("/guarded-submit.html"))
        await callTool(bridge, "yunti_click", { browserSessionId, selector: "#timeout-submit" })
        const timedOut = await callTool(bridge, "yunti_wait_for", {
          browserSessionId,
          text: "Timeout submitted 1",
          timeoutMs: 200,
        })
        assert.equal(timedOut.ok, false)
        assert.equal(timedOut.code, "WAIT_TIMEOUT")
        await page.waitForTimeout(1200)
        const state = await evaluateJson(bridge, browserSessionId, `({ count: window.__timeoutSubmitCount, text: document.querySelector('#timeout-result').textContent })`)
        assert.deepEqual(state, { count: 1, text: "Timeout submitted 1" })
      })
    }
    metrics.backend = "guarded-write+timeout-fail-closed"
    metrics.recovered = true
    metrics.duplicateWrite = false
  },
}

function recordObservation(metrics, observation) {
  const serialized = JSON.stringify(observation)
  metrics.observeCount += 1
  metrics.totalObservedElements += Number(observation?.elementCount || 0)
  metrics.totalObservationBytes += Buffer.byteLength(serialized, "utf8")
  metrics.estimatedObservationTokens += Math.ceil(Buffer.byteLength(serialized, "utf8") / 4)
}

async function evaluateJson(bridge, browserSessionId, expression) {
  const evaluated = await callTool(bridge, "yunti_evaluate_script", {
    browserSessionId,
    expression: `JSON.stringify(${expression})`,
  })
  return JSON.parse(evaluated.value)
}

async function pollTool(bridge, name, args, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  let latest = null
  while (Date.now() < deadline) {
    latest = await callTool(bridge, name, args)
    if (predicate(latest)) return latest
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Timed out polling ${name}: ${JSON.stringify(latest)}`)
}

function buildSummary(results, selectedScenarios) {
  const successCount = results.filter((result) => result.ok).length
  const duplicateWrites = results.filter((result) => result.duplicateWrite).length
  const scenarioDurations = results.map((result) => result.durationMs).sort((a, b) => a - b)
  const attemptDurations = results.flatMap((result) => result.attempts.map((attempt) => attempt.durationMs)).sort((a, b) => a - b)
  const toolDurations = results.flatMap((result) => result.toolCalls.map((toolCall) => toolCall.durationMs)).sort((a, b) => a - b)
  const bytes = results.map((result) => result.totalObservationBytes).sort((a, b) => a - b)
  const tokens = results.map((result) => result.estimatedObservationTokens).sort((a, b) => a - b)
  const perTool = Object.values(results.flatMap((result) => result.toolCalls).reduce((accumulator, toolCall) => {
    const item = accumulator[toolCall.tool] || { tool: toolCall.tool, calls: 0, failures: 0, durations: [] }
    item.calls += 1
    if (!toolCall.ok) item.failures += 1
    item.durations.push(toolCall.durationMs)
    accumulator[toolCall.tool] = item
    return accumulator
  }, {})).map((item) => ({
    tool: item.tool,
    calls: item.calls,
    failures: item.failures,
    p50DurationMs: percentile(item.durations.sort((a, b) => a - b), 0.5),
    p95DurationMs: percentile(item.durations, 0.95),
    maxDurationMs: item.durations.at(-1) || 0,
  })).sort((a, b) => b.maxDurationMs - a.maxDurationMs)
  return {
    phase: "P8.1-complete-suite",
    metricVersion: 2,
    baselineVersion: packageJson.version,
    selectedScenarioCount: results.length,
    successCount,
    successRate: results.length ? successCount / results.length : 0,
    duplicateWrites,
    attemptCount: attemptDurations.length,
    toolCallCount: toolDurations.length,
    p50AttemptDurationMs: percentile(attemptDurations, 0.5),
    p95AttemptDurationMs: percentile(attemptDurations, 0.95),
    maxAttemptDurationMs: attemptDurations.at(-1) || 0,
    p50ToolCallDurationMs: percentile(toolDurations, 0.5),
    p95ToolCallDurationMs: percentile(toolDurations, 0.95),
    maxToolCallDurationMs: toolDurations.at(-1) || 0,
    p50ScenarioDurationMs: percentile(scenarioDurations, 0.5),
    p95ScenarioDurationMs: percentile(scenarioDurations, 0.95),
    maxScenarioDurationMs: scenarioDurations.at(-1) || 0,
    medianObservationBytes: percentile(bytes, 0.5),
    p95ObservationBytes: percentile(bytes, 0.95),
    medianObservationTokens: percentile(tokens, 0.5),
    p95ObservationTokens: percentile(tokens, 0.95),
    failureClasses: results.reduce((accumulator, result) => {
      const key = result.failureClass || "none"
      accumulator[key] = (accumulator[key] || 0) + 1
      return accumulator
    }, {}),
    perTool,
    implementedScenarioSummary: summarizeBenchmarkScenarios(selectedScenarios),
  }
}

async function writeSummaryArtifacts({ artifactDir, summary, results }) {
  await mkdir(artifactDir, { recursive: true })
  await writeFile(join(artifactDir, "summary.json"), JSON.stringify(summary, null, 2))
  await writeFile(join(artifactDir, "summary.md"), [
    "# Yunti Benchmark Summary",
    "",
    "- Baseline version: " + summary.baselineVersion,
    "- Selected scenarios: " + summary.selectedScenarioCount,
    "- Success rate: " + (summary.successRate * 100).toFixed(1) + "%",
    "- Duplicate writes: " + summary.duplicateWrites,
    "- Attempts: " + summary.attemptCount,
    "- Tool calls: " + summary.toolCallCount,
    "- Attempt latency p50/p95/max: " + summary.p50AttemptDurationMs + "/" + summary.p95AttemptDurationMs + "/" + summary.maxAttemptDurationMs + " ms",
    "- Tool-call latency p50/p95/max: " + summary.p50ToolCallDurationMs + "/" + summary.p95ToolCallDurationMs + "/" + summary.maxToolCallDurationMs + " ms",
    "- Scenario latency p50/p95/max: " + summary.p50ScenarioDurationMs + "/" + summary.p95ScenarioDurationMs + "/" + summary.maxScenarioDurationMs + " ms",
    "- Median observation bytes: " + summary.medianObservationBytes,
    "- p95 observation bytes: " + summary.p95ObservationBytes,
    "",
    "Scenario totals preserve end-to-end workload cost. Attempt and tool-call latency are reported separately so repeated guarded-write scenarios do not distort operational p95.",
  ].join("\n"))
  await writeFile(
    join(artifactDir, "scenario-results.jsonl"),
    results.map((result) => JSON.stringify(result)).join("\n") + "\n"
  )
}

async function persistFailureArtifact({ artifactDir, scenarioId, error, bridge, page }) {
  const failureDir = join(artifactDir, "failures", scenarioId)
  await mkdir(failureDir, { recursive: true })
  await writeFile(join(failureDir, "error.log"), error?.stack || String(error))
  if (page) {
    await page.screenshot({ path: join(failureDir, "failure.png"), fullPage: true }).catch(() => {})
  }
  await writeFile(
    join(failureDir, "bridge-state.json"),
    JSON.stringify(bridge.hub?.consoleState({
      userId: "local",
      runtimeVersion: packageJson.version,
      expectedExtensionVersion: packageJson.version,
    }) || {}, null, 2)
  ).catch(() => {})
}

async function loadPlaywright() {
  try {
    return await import("playwright")
  } catch {
    process.stderr.write("Install Playwright and Chromium before running benchmark:baseline.\n")
    process.exit(1)
  }
}

async function createArtifactDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const artifactDir = join(rootDir, ".artifacts", "benchmark", timestamp)
  await mkdir(artifactDir, { recursive: true })
  return artifactDir
}

async function getExtensionWorker(context) {
  const existing = context.serviceWorkers()[0]
  if (existing) return existing
  return context.waitForEvent("serviceworker", { timeout: 10_000 })
}

async function waitForBrowserSession(bridgeUrl) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const response = await fetch(bridgeUrl + "/health?userId=local")
    const health = await response.json()
    const sessions = Array.isArray(health.sessions) ? health.sessions : []
    const active = sessions.find((session) => session.active && session.kind !== "browser_controller")
      || sessions.find((session) => session.kind !== "browser_controller")
    if (active?.browserSessionId) return active.browserSessionId
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error("Timed out waiting for extension page registration")
}

async function callTool(bridge, name, args) {
  const startedAt = Date.now()
  const toolCall = { tool: name, ok: false, durationMs: 0 }
  try {
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1_000_000),
        method: "tools/call",
        params: { name, arguments: args },
      },
      bridge
    )
    const responseText = response?.result?.content?.[0]?.text || ""
    assert.equal(response?.result?.isError, undefined, responseText)
    toolCall.ok = true
    const value = response.result.structuredContent ?? JSON.parse(responseText)
    const image = response.result.content?.find((item) => item.type === "image")
    return image && value && typeof value === "object"
      ? { ...value, imageBase64Length: image.data?.length || 0 }
      : value
  } finally {
    toolCall.durationMs = Date.now() - startedAt
    activeScenarioMetrics?.toolCalls.push(toolCall)
  }
}

function classifyError(error) {
  const text = String(error?.message || error || "")
  if (/Timed out|timeout/i.test(text)) return "timeout"
  if (/stale|missing|not found|uid/i.test(text)) return "target-missing"
  if (/bridge|session|transport|poll/i.test(text)) return "transport"
  if (/assert/i.test(text)) return "assertion"
  return "unknown"
}

function percentile(values, ratio) {
  if (!values.length) return 0
  const index = Math.max(0, Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1))
  return values[index]
}

await main()
