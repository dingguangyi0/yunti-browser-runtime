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

async function main() {
  if (listOnly) {
    const payload = {
      ok: true,
      phase: "P8.0-foundation",
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
      try {
        await runScenario({ scenario, browserSessionId, bridge, fixtureServer, page, metrics })
        metrics.ok = true
        metrics.durationMs = Date.now() - startMs
      } catch (error) {
        metrics.ok = false
        metrics.durationMs = Date.now() - startMs
        metrics.failureClass = classifyError(error)
        metrics.notes = String(error?.stack || error)
        await persistFailureArtifact({ artifactDir, scenarioId: scenario.id, error, bridge, page })
      }
      results.push(metrics)
    }

    const summary = buildSummary(results, selectedScenarios)
    await writeSummaryArtifacts({ artifactDir, summary, results })
    process.stdout.write(JSON.stringify({ ok: true, artifactDir, summary }, null, 2) + "\n")
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
    notes: "",
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
  async H35({ browserSessionId, bridge, fixtureServer, page, metrics }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
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
    }
    metrics.backend = "content-script+cdp-wait+evaluate"
    metrics.recovered = false
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

function buildSummary(results, selectedScenarios) {
  const successCount = results.filter((result) => result.ok).length
  const duplicateWrites = results.filter((result) => result.duplicateWrite).length
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b)
  const bytes = results.map((result) => result.totalObservationBytes).sort((a, b) => a - b)
  const tokens = results.map((result) => result.estimatedObservationTokens).sort((a, b) => a - b)
  return {
    phase: "P8.0-foundation",
    baselineVersion: packageJson.version,
    selectedScenarioCount: results.length,
    successCount,
    successRate: results.length ? successCount / results.length : 0,
    duplicateWrites,
    p50DurationMs: percentile(durations, 0.5),
    p95DurationMs: percentile(durations, 0.95),
    medianObservationBytes: percentile(bytes, 0.5),
    p95ObservationBytes: percentile(bytes, 0.95),
    medianObservationTokens: percentile(tokens, 0.5),
    p95ObservationTokens: percentile(tokens, 0.95),
    failureClasses: results.reduce((accumulator, result) => {
      const key = result.failureClass || "none"
      accumulator[key] = (accumulator[key] || 0) + 1
      return accumulator
    }, {}),
    implementedScenarioSummary: summarizeBenchmarkScenarios(selectedScenarios),
  }
}

async function writeSummaryArtifacts({ artifactDir, summary, results }) {
  await mkdir(artifactDir, { recursive: true })
  await writeFile(join(artifactDir, "summary.json"), JSON.stringify(summary, null, 2))
  await writeFile(join(artifactDir, "summary.md"), [
    "# Yunti Benchmark Foundation Summary",
    "",
    "- Baseline version: " + summary.baselineVersion,
    "- Selected scenarios: " + summary.selectedScenarioCount,
    "- Success rate: " + (summary.successRate * 100).toFixed(1) + "%",
    "- Duplicate writes: " + summary.duplicateWrites,
    "- p50 duration: " + summary.p50DurationMs + " ms",
    "- p95 duration: " + summary.p95DurationMs + " ms",
    "- Median observation bytes: " + summary.medianObservationBytes,
    "- p95 observation bytes: " + summary.p95ObservationBytes,
    "",
    "This foundation run covers currently implemented scenarios only.",
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
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1_000_000),
      method: "tools/call",
      params: { name, arguments: args },
    },
    bridge
  )
  const text = response?.result?.content?.[0]?.text || ""
  assert.equal(response?.result?.isError, undefined, text)
  return response.result.structuredContent ?? JSON.parse(text)
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
