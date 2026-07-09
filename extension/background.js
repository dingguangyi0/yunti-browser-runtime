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
  ensureAllTabsRegistered: sessionManager.ensureAllTabsRegistered,
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
  void sessionManager.ensureTabRegistered(tabId, { reason: "tab_activated" }).catch(() => {})
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return
  void sessionManager.ensureTabRegistered(tabId, {
    tab,
    reason: "tab_updated_complete",
  }).catch(() => {})
})

chrome.runtime.onInstalled.addListener(() => {
  void sessionManager.ensureAllTabsRegistered({ reason: "extension_installed" }).catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  void sessionManager.ensureAllTabsRegistered({ reason: "browser_startup" }).catch(() => {})
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void sessionManager.handleMessage(message, sender).then(sendResponse, (error) =>
    sendResponse({ ok: false, error: error?.message || String(error) })
  )
  return true
})

void sessionManager.ensureAllTabsRegistered({ reason: "background_started" }).catch(() => {})
