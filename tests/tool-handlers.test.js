import test from "node:test"
import assert from "node:assert/strict"
import { createToolDispatcher } from "../extension/tool-handlers.js"

function createDispatcherHarness(options = {}) {
  const posted = []
  const sentMessages = []
  const cdpCommands = []
  const contentToolResponses = options.contentToolResponses || {}
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
        if (Object.prototype.hasOwnProperty.call(contentToolResponses, message.tool)) {
          const response = contentToolResponses[message.tool]
          return typeof response === "function" ? response(message) : response
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
      action: "click",
      target: { uid: "yunti-1", x: 60, y: 40 },
      ok: true,
      recoverable: false,
      nextStepHint: "Click dispatched. Observe again or read page state to verify the intended change.",
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

test("dispatcher preserves current action result shapes", async () => {
  const harness = createDispatcherHarness({
    observations: [
      {
        observationId: "obs-actions",
        browserSessionId: "tab-1",
        uidMapVersion: "observe-v1",
        elements: [
          {
            uid: "yunti-click",
            role: "button",
            name: "Submit",
            rect: { x: 10, y: 20, width: 100, height: 40 },
          },
          {
            uid: "yunti-input",
            role: "textbox",
            name: "Search",
            rect: { x: 30, y: 90, width: 160, height: 30 },
          },
        ],
      },
    ],
    contentToolResponses: {
      yunti_scroll: {
        scrolled: true,
        deltaX: 0,
        deltaY: 600,
        target: "document",
        before: { left: 0, top: 0 },
        after: { left: 0, top: 600 },
      },
    },
  })
  const session = { browserSessionId: "tab-1", userId: "local", url: "https://example.test/" }

  try {
    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-observe",
      tool: "yunti_observe_page",
      arguments: { redaction: "balanced" },
    })

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-click",
      tool: "yunti_click",
      arguments: { uid: "yunti-click" },
    })
    assert.deepEqual(harness.posted.at(-1).result, {
      clicked: true,
      uid: "yunti-click",
      x: 60,
      y: 40,
      browserSessionId: "tab-1",
      action: "click",
      target: { uid: "yunti-click", x: 60, y: 40 },
      ok: true,
      recoverable: false,
      nextStepHint: "Click dispatched. Observe again or read page state to verify the intended change.",
    })

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-hover",
      tool: "yunti_hover",
      arguments: { uid: "yunti-click" },
    })
    assert.deepEqual(harness.posted.at(-1).result, {
      hovered: true,
      uid: "yunti-click",
      x: 60,
      y: 40,
      browserSessionId: "tab-1",
      action: "hover",
      target: { uid: "yunti-click", x: 60, y: 40 },
      ok: true,
      recoverable: false,
      nextStepHint: "Hover dispatched. Observe again or read page state to verify menus, tooltips, or hover-only controls.",
    })

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-fill",
      tool: "yunti_fill",
      arguments: { uid: "yunti-input", value: "hi" },
    })
    assert.deepEqual(harness.posted.at(-1).result, {
      filled: true,
      uid: "yunti-input",
      method: "keyboard",
      value: "hi",
      browserSessionId: "tab-1",
      action: "fill",
      target: { uid: "yunti-input", method: "keyboard" },
      ok: true,
      recoverable: false,
      nextStepHint: "Fill dispatched. Observe again, read page state, or evaluate the field value to verify the intended change.",
    })

    await harness.dispatcher.executeToolRequest(123, session, {
      id: "req-scroll",
      tool: "yunti_scroll",
      arguments: { deltaY: 600 },
    })
    assert.deepEqual(harness.posted.at(-1).result, {
      scrolled: true,
      deltaX: 0,
      deltaY: 600,
      target: "document",
      before: { left: 0, top: 0 },
      after: { left: 0, top: 600 },
    })
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
      action: "click",
      target: { uid: "yunti-2", x: 230, y: 95 },
      ok: true,
      recoverable: false,
      nextStepHint: "Click dispatched. Observe again or read page state to verify the intended change.",
    })
  } finally {
    harness.restore()
  }
})
