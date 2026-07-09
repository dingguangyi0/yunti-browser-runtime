import test from "node:test"
import assert from "node:assert/strict"
import { createSessionManager } from "../extension/session-manager.js"

function installChromeMock(options = {}) {
  const tabs = options.tabs || []
  const messages = []
  const scripts = []
  const styles = []
  const reachableTabs = new Set(options.reachableTabs || [])
  const previousChrome = globalThis.chrome
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true }),
  })
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
        }),
        set: async () => {},
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
    scripts,
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
