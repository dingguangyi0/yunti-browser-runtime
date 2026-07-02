import { createCdpController } from "./cdp.js"
import { installNetworkMonitor } from "./network-monitor.js"
import { createSessionManager } from "./session-manager.js"
import { createToolDispatcher } from "./tool-handlers.js"

const sessionManager = createSessionManager()
const {
  forwardConsoleEvent,
  postBridge,
  pollers,
  sessionsByTab,
  startPolling,
} = sessionManager

const cdp = createCdpController({
  sessionsByTab,
  pollers,
  postBridge,
  startPolling,
  forwardConsoleEvent,
})

const { detachCdpTab, installCdpEventForwarder } = cdp
const { executeToolRequest } = createToolDispatcher({
  sessionsByTab,
  pollers,
  postBridge,
  startPolling,
  cdp,
})

sessionManager.setToolRequestHandler(executeToolRequest)

installNetworkMonitor({
  sessionsByTab,
  postBridge,
  getPlatformMatches: sessionManager.getPlatformMatches,
})
installCdpEventForwarder()

chrome.tabs.onRemoved.addListener((tabId) => {
  void detachCdpTab(tabId, null, "tab_removed").catch(() => {})
  sessionManager.forgetTab(tabId)
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void sessionManager.activateTab(tabId)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void sessionManager.handleMessage(message, sender).then(sendResponse, (error) =>
    sendResponse({ ok: false, error: error?.message || String(error) })
  )
  return true
})
