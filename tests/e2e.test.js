import test from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { BRIDGE_TOKEN_HEADER, handleJsonRpc, startBridgeServer } from "../mcp/server.js"

const runE2e = process.env.YUNTI_E2E === "1"
const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)))
const extensionDir = join(rootDir, "extension")

test("real browser extension bridge smoke", { skip: runE2e ? false : "set YUNTI_E2E=1 to run real-browser smoke test" }, async (t) => {
  const playwright = await loadPlaywright(t)
  if (!playwright) return

  const artifactDir = await mkdtemp(join(tmpdir(), "yunti-browser-e2e-"))
  const bridgeToken = "e2e-token"
  const bridge = await startBridgeServer({
    host: "127.0.0.1",
    port: 0,
    bridgeToken,
    sessionTtlMs: 120_000,
  })
  const bridgePort = bridge.server.address().port
  const bridgeUrl = `http://127.0.0.1:${bridgePort}`
  const pageServer = await startTestPageServer()
  const userDataDir = await mkdtemp(join(tmpdir(), "yunti-browser-profile-"))
  let context = null
  let page = null

  try {
    context = await playwright.chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ],
    })

    const worker = await getExtensionWorker(context)
    await worker.evaluate(
      ({ bridgeUrl: runtimeBridgeUrl, bridgeToken: runtimeBridgeToken }) =>
        chrome.storage.local.set({
          bridgeUrl: runtimeBridgeUrl,
          bridgeToken: runtimeBridgeToken,
          platformMatches: ["*"],
          localUserId: "local",
          localUserName: "local",
        }),
      { bridgeUrl, bridgeToken }
    )

    page = await context.newPage()
    await page.goto(pageServer.url)
    const browserSessionId = await waitForBrowserSession(bridgeUrl, bridgeToken)

    const targets = await callTool(bridge, "yunti_list_browser_targets", { browserSessionId })
    assert.ok(targets.total >= 1)
    assert.ok(targets.pages.some((target) => target.url === pageServer.url))

    const snapshot = await callTool(bridge, "yunti_get_page_snapshot", {
      browserSessionId,
      mode: "detailed",
    })
    assert.equal(snapshot.browserSessionId, browserSessionId)
    assert.match(snapshot.visibleText, /Yunti E2E Smoke/)

    await callTool(bridge, "yunti_fill", {
      browserSessionId,
      selector: "#name",
      value: "Yunti",
    })
    await callTool(bridge, "yunti_click", {
      browserSessionId,
      selector: "#go",
    })

    const evaluated = await callTool(bridge, "yunti_evaluate_script", {
      browserSessionId,
      expression:
        "JSON.stringify({ value: document.querySelector('#name').value, clicked: window.__clicked || 0 })",
    })
    assert.deepEqual(JSON.parse(evaluated.value), { value: "Yunti", clicked: 1 })
  } catch (error) {
    if (page) {
      await page.screenshot({ path: join(artifactDir, "failure.png"), fullPage: true }).catch(() => {})
    }
    await writeFile(join(artifactDir, "error.log"), error?.stack || String(error))
    t.diagnostic(`E2E artifacts: ${artifactDir}`)
    throw error
  } finally {
    await context?.close().catch(() => {})
    await pageServer.close()
    await new Promise((resolvePromise) => bridge.server.close(resolvePromise))
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
})

async function loadPlaywright(t) {
  try {
    return await import("playwright")
  } catch {
    t.skip("install Playwright and Chromium before running YUNTI_E2E=1 npm run test:e2e")
    return null
  }
}

async function getExtensionWorker(context) {
  const existing = context.serviceWorkers()[0]
  if (existing) return existing
  return context.waitForEvent("serviceworker", { timeout: 10_000 })
}

async function startTestPageServer() {
  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Yunti E2E Smoke</title></head>
  <body>
    <h1>Yunti E2E Smoke</h1>
    <label>Name <input id="name" /></label>
    <button id="go">Click me</button>
    <output id="result"></output>
    <script>
      window.__clicked = 0;
      document.querySelector("#go").addEventListener("click", () => {
        window.__clicked += 1;
        document.querySelector("#result").textContent = document.querySelector("#name").value;
      });
    </script>
  </body>
</html>`
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(html)
  })
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise))
  const port = server.address().port
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  }
}

async function waitForBrowserSession(bridgeUrl, bridgeToken) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const response = await fetch(`${bridgeUrl}/health?userId=local`, {
      headers: { [BRIDGE_TOKEN_HEADER]: bridgeToken },
    })
    const health = await response.json()
    const active = health.sessions?.find((session) => session.active) || health.sessions?.[0]
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
