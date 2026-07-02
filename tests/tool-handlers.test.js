import test from "node:test"
import assert from "node:assert/strict"
import { createToolDispatcher } from "../extension/tool-handlers.js"

function createDispatcherHarness(options = {}) {
  const posted = []
  const sentMessages = []
  const cdpCommands = []
  const originalChrome = globalThis.chrome
  const observations = options.observations || [
    {
      observationId: "obs-1",
      browserSessionId: "tab-1",
      uidMapVersion: "observe-v1",
      elements: [
        {
          uid: "yunti-1",
          role: "button",
          name: "Submit",
          rect: { x: 10, y: 20, width: 100, height: 40 },
        },
      ],
      textTree: "[yunti-1]<button>Submit</button>",
    },
  ]
  let observeIndex = 0

  globalThis.chrome = {
    tabs: {
      sendMessage: async (tabId, message) => {
        sentMessages.push({ tabId, message })
        if (message.tool === "yunti_observe_page") {
          const observation = observations[Math.min(observeIndex, observations.length - 1)]
          observeIndex += 1
          return observation
        }
        throw new Error(`unexpected content message: ${message.tool}`)
      },
    },
  }

  const dispatcher = createToolDispatcher({
    sessionsByTab: new Map(),
    pollers: new Map(),
    postBridge: async (_path, body) => {
      posted.push(body)
    },
    startPolling: () => {},
    cdp: {
      chromeDebuggerSendCommand: async (_target, method, params) => {
        cdpCommands.push({ method, params })
        return {}
      },
      delayCdp: async () => {},
      detachCdpTab: async () => ({}),
      ensureCdpAttached: async () => {},
      getBrowserTarget: async () => ({}),
      listBrowserTargets: async () => ({}),
      sendCdpCommand: async () => ({}),
      startPerformanceTrace: async () => ({}),
      stopPerformanceTrace: async () => ({}),
    },
  })

  return {
    cdpCommands,
    dispatcher,
    posted,
    restore: () => {
      globalThis.chrome = originalChrome
    },
    sentMessages,
  }
}

test("observe uid map feeds existing uid-based click path", async () => {
  const harness = createDispatcherHarness()
  const session = { browserSessionId: "tab-1", userId: "local", url: "https://example.test/" }

  try {
    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-observe",
      tool: "yunti_observe_page",
      arguments: { redaction: "balanced" },
    })
    assert.equal(harness.posted.at(-1).ok, true)
    assert.equal(harness.posted.at(-1).result.elements[0].uid, "yunti-1")

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-click",
      tool: "yunti_click",
      arguments: { uid: "yunti-1" },
    })

    const clickResult = harness.posted.at(-1)
    assert.equal(clickResult.ok, true)
    assert.deepEqual(clickResult.result, {
      clicked: true,
      uid: "yunti-1",
      x: 60,
      y: 40,
      browserSessionId: "tab-1",
    })
    assert.deepEqual(
      harness.cdpCommands.filter((command) => command.method === "Input.dispatchMouseEvent").map((command) => command.params.type),
      ["mousePressed", "mouseReleased"]
    )
    assert.equal(
      harness.sentMessages.filter((item) => item.message.tool === "yunti_observe_page").length,
      1
    )
  } finally {
    harness.restore()
  }
})

test("missing uid now points agents back to observe or snapshot", async () => {
  const harness = createDispatcherHarness()
  const session = { browserSessionId: "tab-1", userId: "local", url: "https://example.test/" }

  try {
    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-click",
      tool: "yunti_click",
      arguments: { uid: "missing" },
    })

    const result = harness.posted.at(-1)
    assert.equal(result.ok, false)
    assert.match(result.error, /yunti_observe_page or yunti_take_snapshot/)
  } finally {
    harness.restore()
  }
})

test("latest observation replaces stale uid map", async () => {
  const harness = createDispatcherHarness({
    observations: [
      {
        observationId: "obs-1",
        browserSessionId: "tab-1",
        uidMapVersion: "observe-v1",
        elements: [
          {
            uid: "yunti-1",
            role: "button",
            name: "Old button",
            rect: { x: 10, y: 20, width: 100, height: 40 },
          },
        ],
      },
      {
        observationId: "obs-2",
        browserSessionId: "tab-1",
        uidMapVersion: "observe-v1",
        elements: [
          {
            uid: "yunti-2",
            role: "button",
            name: "New button",
            rect: { x: 200, y: 80, width: 60, height: 30 },
          },
        ],
      },
    ],
  })
  const session = { browserSessionId: "tab-1", userId: "local", url: "https://example.test/" }

  try {
    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-observe-1",
      tool: "yunti_observe_page",
      arguments: { redaction: "balanced" },
    })
    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-observe-2",
      tool: "yunti_observe_page",
      arguments: { redaction: "balanced" },
    })

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-old-click",
      tool: "yunti_click",
      arguments: { uid: "yunti-1" },
    })
    const staleResult = harness.posted.at(-1)
    assert.equal(staleResult.ok, false)
    assert.match(staleResult.error, /yunti_observe_page or yunti_take_snapshot/)

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-new-click",
      tool: "yunti_click",
      arguments: { uid: "yunti-2" },
    })
    const clickResult = harness.posted.at(-1)
    assert.equal(clickResult.ok, true)
    assert.deepEqual(clickResult.result, {
      clicked: true,
      uid: "yunti-2",
      x: 230,
      y: 95,
      browserSessionId: "tab-1",
    })
  } finally {
    harness.restore()
  }
})
