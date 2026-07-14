import test from "node:test"
import assert from "node:assert/strict"
import { createSessionManager } from "../extension/session-manager.js"

function installChromeMock(options = {}) {
  const tabs = options.tabs || []
  const messages = []
  const scripts = []
  const styles = []
  const requests = []
  const stored = { ...(options.storage || {}) }
  const reachableTabs = new Set(options.reachableTabs || [])
  const previousChrome = globalThis.chrome
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    requests.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : null,
    })
    if (String(url).includes("/extension/poll")) {
      return new Promise((resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        })
      })
    }
    return {
      ok: true,
      json: async () => ({ ok: true }),
    }
  }
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.2.1" }),
    },
    storage: {
      local: {
        get: async () => ({
          bridgeUrl: "http://127.0.0.1:48887",
          bridgeToken: "",
          localUserName: "local",
          localUserId: "local",
          platformMatches: ["*"],
          ...stored,
        }),
        set: async (patch) => {
          Object.assign(stored, patch)
        },
      },
    },
    tabs: {
      query: async (query = {}) => {
        if (query.active) return tabs.filter((tab) => tab.active)
        return tabs
      },
      get: async (tabId) => {
        const tab = tabs.find((item) => item.id === tabId)
        if (!tab) throw new Error(`No tab ${tabId}`)
        return tab
      },
      sendMessage: async (tabId, message) => {
        messages.push({ tabId, message })
        if (!reachableTabs.has(tabId)) throw new Error("Could not establish connection")
        return { ok: true }
      },
    },
    scripting: {
      insertCSS: async (details) => {
        styles.push(details)
      },
      executeScript: async (details) => {
        scripts.push(details)
      },
    },
  }
  return {
    messages,
    requests,
    scripts,
    stored,
    styles,
    restore() {
      globalThis.chrome = previousChrome
      globalThis.fetch = previousFetch
    },
  }
}

test("ensureAllTabsRegistered injects content scripts into existing http pages", async () => {
  const mock = installChromeMock({
    tabs: [
      { id: 1, url: "https://example.test/", title: "Example", windowId: 1 },
      { id: 2, url: "chrome://extensions/", title: "Extensions", windowId: 1 },
    ],
  })
  try {
    const manager = createSessionManager()
    const result = await manager.ensureAllTabsRegistered({ reason: "test" })

    assert.equal(result.checked, 2)
    assert.equal(result.recovered, 1)
    assert.equal(result.skipped, 1)
    assert.deepEqual(mock.styles.map((item) => item.files), [["content.css"]])
    assert.deepEqual(mock.scripts.map((item) => item.files), [
      ["dom-observer.js"],
      ["content.js"],
    ])
    assert.equal(mock.messages.filter((item) => item.tabId === 1).length, 2)
  } finally {
    mock.restore()
  }
})

test("registerBrowserController maintains a browser-level route without a tab", async () => {
  const mock = installChromeMock()
  try {
    const manager = createSessionManager()
    const result = await manager.registerBrowserController("test")

    assert.equal(result.ok, true)
    assert.equal(result.session.kind, "browser_controller")
    assert.equal(result.session.tabId, null)
    assert.equal(result.session.windowId, null)
    assert.ok(result.session.browserSessionId.startsWith("yunti-browser-"))
    assert.equal(mock.stored.browserControllerId, result.session.browserSessionId)
    await new Promise((resolve) => setImmediate(resolve))

    const registerRequests = mock.requests.filter((request) =>
      request.url.endsWith("/sessions/register")
    )
    assert.ok(registerRequests.length >= 1)
    assert.equal(registerRequests[0].body.kind, "browser_controller")
    assert.equal(registerRequests[0].body.tabId, null)
    assert.ok(
      mock.requests.some((request) =>
        request.url.includes("/extension/poll?browserSessionId=")
      )
    )
  } finally {
    mock.restore()
  }
})

test("registerBrowserController restarts polling when bridge URL changes", async () => {
  const mock = installChromeMock()
  try {
    const manager = createSessionManager()
    await manager.registerBrowserController("initial")
    await new Promise((resolve) => setImmediate(resolve))

    await globalThis.chrome.storage.local.set({ bridgeUrl: "http://127.0.0.1:49999" })
    await manager.registerBrowserController("bridge_changed")
    await new Promise((resolve) => setImmediate(resolve))

    assert.ok(
      mock.requests.some((request) =>
        request.url.startsWith("http://127.0.0.1:48887/extension/poll?")
      )
    )
    assert.ok(
      mock.requests.some((request) =>
        request.url.startsWith("http://127.0.0.1:49999/extension/poll?")
      )
    )
  } finally {
    mock.restore()
  }
})

test("ensureAllTabsRegistered does not inject when content script answers", async () => {
  const mock = installChromeMock({
    reachableTabs: [1],
    tabs: [{ id: 1, url: "https://example.test/", title: "Example", windowId: 1 }],
  })
  try {
    const manager = createSessionManager()
    const result = await manager.ensureAllTabsRegistered({ reason: "test" })

    assert.equal(result.checked, 1)
    assert.equal(result.recovered, 1)
    assert.equal(mock.styles.length, 0)
    assert.equal(mock.scripts.length, 0)
    assert.equal(mock.messages.length, 1)
  } finally {
    mock.restore()
  }
})

test("refreshActiveTab falls back to injection when active tab is not registered", async () => {
  const mock = installChromeMock({
    tabs: [{ id: 7, active: true, url: "https://example.test/", title: "Example", windowId: 1 }],
  })
  try {
    const manager = createSessionManager()
    const state = await manager.handleMessage({ type: "yunti_panel_refresh_active" }, {})

    assert.equal(state.ok, true)
    assert.equal(state.activeTab.id, 7)
    assert.deepEqual(mock.scripts.map((item) => item.files), [
      ["dom-observer.js"],
      ["content.js"],
    ])
  } finally {
    mock.restore()
  }
})
