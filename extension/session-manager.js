import {
  DEFAULT_BRIDGE_URL,
  bridgeHeaders,
  getSettings,
  isPlatformUrl,
  normalizeBaseUrl,
  normalizeBridgeToken,
  normalizePlatformMatches,
  platformLabelForUrl,
} from "./settings.js"

export function createSessionManager() {
  const sessionsByTab = new Map()
  const pollers = new Map()
  const pendingTabRecovery = new Map()
  const lastInjectionAtByTab = new Map()
  let controllerPoller = null
  let controllerPollerRoute = ""
  let controllerSession = null
  let cachedPlatformMatches = null
  let toolRequestHandler = null

  function getPlatformMatches() {
    return cachedPlatformMatches
  }

  function setToolRequestHandler(handler) {
    toolRequestHandler = typeof handler === "function" ? handler : null
  }

  function forgetTab(tabId) {
    sessionsByTab.delete(tabId)
    pollers.get(tabId)?.abort()
    pollers.delete(tabId)
  }

  async function registerBrowserController(reason = "heartbeat") {
    const settings = await getSettings()
    cachedPlatformMatches = settings.platformMatches
    const browserSessionId = await getBrowserControllerId()
    const session = {
      browserSessionId,
      kind: "browser_controller",
      userId: settings.localUserId || "",
      displayName: settings.localUserName || "",
      tabId: null,
      windowId: null,
      url: "browser://yunti-runtime",
      title: "Yunti Browser Runtime",
      client: normalizeClientInfo(getBackgroundClientInfo()),
      auth: {
        state: "browser_controller",
        loggedIn: true,
        reason,
        checkedAt: new Date().toISOString(),
        checkedBy: "background_controller",
      },
      registeredAt: controllerSession?.registeredAt || new Date().toISOString(),
    }
    controllerSession = session
    await postBridge("/sessions/register", session).catch(() => null)
    startControllerPolling(session, settings)
    return { ok: true, session }
  }

  async function getBrowserControllerId() {
    const stored = await chrome.storage.local.get(["browserControllerId"])
    const existing = String(stored.browserControllerId || "").trim()
    if (existing) return existing
    const id = `yunti-browser-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
    await chrome.storage.local.set({ browserControllerId: id }).catch(() => {})
    return id
  }

  function startControllerPolling(session, settings) {
    const routeKey = `${settings.bridgeUrl}|${session.browserSessionId}`
    if (controllerPoller && controllerPollerRoute === routeKey) return
    if (controllerPoller) {
      controllerPoller.abort()
      controllerPoller = null
    }
    const controller = new AbortController()
    controllerPoller = controller
    controllerPollerRoute = routeKey
    const loop = async () => {
      while (!controller.signal.aborted) {
        try {
          await postBridge("/sessions/register", controllerSession || session).catch(() => null)
          const settings = await getSettings()
          cachedPlatformMatches = settings.platformMatches
          const url = `${settings.bridgeUrl}/extension/poll?browserSessionId=${encodeURIComponent(
            session.browserSessionId
          )}&timeoutMs=25000`
          const response = await fetch(url, {
            signal: controller.signal,
            headers: bridgeHeaders(settings),
          })
          const event = await response.json()
          if (event?.type === "tool_request" && toolRequestHandler) {
            await toolRequestHandler(null, controllerSession || session, event)
          }
        } catch {
          if (!controller.signal.aborted) await delay(1500)
        }
      }
      if (controllerPoller === controller) {
        controllerPoller = null
        controllerPollerRoute = ""
      }
    }
    void loop()
  }

  async function activateTab(tabId) {
    const session = sessionsByTab.get(tabId)
    if (!session) return
    await postBridge("/sessions/activate", {
      browserSessionId: session.browserSessionId,
      userId: session.userId || "",
    }).catch(() => {})
  }

  async function ensureAllTabsRegistered(options = {}) {
    const settings = await getSettings()
    cachedPlatformMatches = settings.platformMatches
    const tabs = await chrome.tabs.query({})
    const results = await Promise.allSettled(
      tabs.map((tab) => ensureTabRegistered(tab.id, { ...options, tab, settings }))
    )
    return {
      ok: true,
      reason: options.reason || "manual",
      checked: tabs.length,
      recovered: results.filter((result) => result.value?.registered || result.value?.injected)
        .length,
      skipped: results.filter((result) => result.value?.skipped).length,
      failed: results.filter((result) => result.status === "rejected" || result.value?.ok === false)
        .length,
    }
  }

  async function ensureTabRegistered(tabId, options = {}) {
    if (!Number.isFinite(Number(tabId))) {
      return { ok: false, skipped: true, reason: "missing_tab_id" }
    }
    const key = Number(tabId)
    if (pendingTabRecovery.has(key)) return pendingTabRecovery.get(key)
    const promise = recoverTabRegistration(key, options).finally(() => {
      pendingTabRecovery.delete(key)
    })
    pendingTabRecovery.set(key, promise)
    return promise
  }

  async function recoverTabRegistration(tabId, options = {}) {
    const settings = options.settings || (await getSettings())
    cachedPlatformMatches = settings.platformMatches
    const tab = options.tab || (await chrome.tabs.get(tabId).catch(() => null))
    if (!isInjectableTab(tab, settings)) {
      return { ok: true, skipped: true, reason: "unsupported_tab" }
    }
    if (sessionsByTab.has(tabId)) {
      await refreshTabRegistration(tabId).catch(() => null)
      return { ok: true, registered: true, reason: "already_registered" }
    }
    const ping = await refreshTabRegistration(tabId).catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }))
    if (ping?.ok) {
      return { ok: true, registered: true, reason: "content_script_present" }
    }
    const lastInjectionAt = lastInjectionAtByTab.get(tabId) || 0
    if (Date.now() - lastInjectionAt < 5000) {
      return { ok: true, skipped: true, reason: "recently_injected" }
    }
    const injected = await injectContentScripts(tabId).catch((error) => ({
      ok: false,
      error: error?.message || String(error),
    }))
    if (!injected?.ok) {
      return { ok: false, reason: "inject_failed", error: injected?.error || "inject failed" }
    }
    lastInjectionAtByTab.set(tabId, Date.now())
    await delay(50)
    await refreshTabRegistration(tabId).catch(() => null)
    return { ok: true, injected: true, reason: options.reason || "auto_recovery" }
  }

  function isInjectableTab(tab, settings) {
    if (!tab?.id) return false
    if (tab.discarded) return false
    return isPlatformUrl(tab.url, settings)
  }

  async function refreshTabRegistration(tabId) {
    return chrome.tabs.sendMessage(tabId, { type: "yunti_refresh_registration" })
  }

  async function injectContentScripts(tabId) {
    if (!chrome.scripting?.executeScript) {
      return { ok: false, error: "chrome.scripting permission is unavailable" }
    }
    if (chrome.scripting.insertCSS) {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"],
      })
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["dom-observer.js"],
    })
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    })
    return { ok: true }
  }

  async function handleMessage(message, sender) {
    switch (message?.type) {
      case "yunti_content_ready":
        return registerContentSession(sender.tab, message.page)
      case "yunti_is_supported_page":
        return checkSupportedPage(message.page)
      case "yunti_panel_get_state":
        return getPanelState()
      case "yunti_panel_save_settings":
        await chrome.storage.local.set({
          localUserName: "local",
          localUserId: "local",
          bridgeUrl: normalizeBaseUrl(
            message.settings?.bridgeUrl || DEFAULT_BRIDGE_URL
          ),
          bridgeToken: normalizeBridgeToken(message.settings?.bridgeToken || ""),
          agentType: "browser_agent",
          platformMatches: normalizePlatformMatches(
            message.settings?.platformMatches
          ),
        })
        return getPanelState()
      case "yunti_panel_refresh_active":
        return refreshActiveTab()
      default:
        return { ok: false, error: `unknown message: ${message?.type}` }
    }
  }

  async function registerContentSession(tab, page) {
    const settings = await getSettings()
    cachedPlatformMatches = settings.platformMatches
    if (!tab?.id || !isPlatformUrl(page?.url, settings)) {
      return { ok: false, error: "not an Yunti tab" }
    }
    const browserSessionId =
      sessionsByTab.get(tab.id)?.browserSessionId ||
      `yunti-${tab.id}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
    const session = {
      browserSessionId,
      userId: settings.localUserId || "",
      displayName: settings.localUserName || "",
      tabId: tab.id,
      windowId: tab.windowId,
      url: page.url,
      title: page.title || tab.title || platformLabelForUrl(page.url),
      client: normalizeClientInfo({
        ...getBackgroundClientInfo(),
        ...(page.client || {}),
      }),
      auth: normalizePageAuth(page.auth, "content_script_register"),
      registeredAt: new Date().toISOString(),
    }
    sessionsByTab.set(tab.id, session)
    await postBridge("/sessions/register", session).catch(() => null)
    startPolling(tab.id)
    return { ok: true, session, settings }
  }

  async function checkSupportedPage(page) {
    const settings = await getSettings()
    cachedPlatformMatches = settings.platformMatches
    return {
      ok: true,
      supported: isPlatformUrl(page?.url, settings),
      settings,
    }
  }

  async function startPolling(tabId) {
    if (pollers.has(tabId)) return
    const controller = new AbortController()
    pollers.set(tabId, controller)
    const loop = async () => {
      while (!controller.signal.aborted) {
        const session = sessionsByTab.get(tabId)
        if (!session) break
        try {
          const settings = await getSettings()
          cachedPlatformMatches = settings.platformMatches
          await postBridge("/sessions/register", session).catch(() => null)
          const url = `${settings.bridgeUrl}/extension/poll?browserSessionId=${encodeURIComponent(
            session.browserSessionId
          )}&timeoutMs=25000`
          const response = await fetch(url, {
            signal: controller.signal,
            headers: bridgeHeaders(settings),
          })
          const event = await response.json()
          if (event?.type === "tool_request" && toolRequestHandler) {
            await toolRequestHandler(tabId, session, event)
          }
        } catch {
          if (!controller.signal.aborted) await delay(1500)
        }
      }
      pollers.delete(tabId)
    }
    void loop()
  }

  async function forwardConsoleEvent(session, tabId, method, params = {}) {
    let level = "log"
    let text = ""
    let source = "console-api"
    let stackTrace = ""
    let args = []
    let url = ""
    let lineNumber = null
    let columnNumber = null

    if (method === "Runtime.consoleAPICalled") {
      source = "console-api"
      level = String(params.type || "log").toLowerCase()
      args = (params.args || []).map((arg) => {
        if (arg.type === "string") return String(arg.value || "")
        if (arg.type === "number" || arg.type === "boolean") {
          return String(arg.value)
        }
        if (arg.type === "undefined") return "undefined"
        if (arg.type === "null") return "null"
        if (arg.type === "object" && arg.description) return arg.description
        return arg.type || "unknown"
      })
      text = args.filter((arg) => typeof arg === "string").join(" ") || args.join(" ")
      stackTrace = formatConsoleStackTrace(params.stackTrace)
    } else if (method === "Log.entryAdded") {
      source = "other"
      const entry = params.entry || {}
      level = String(entry.level || "verbose").toLowerCase()
      text = String(entry.text || "").slice(0, 2000)
      url = entry.url || ""
      lineNumber = entry.lineNumber ?? null
      columnNumber = entry.columnNumber ?? null
      if (entry.stackTrace) stackTrace = formatConsoleStackTrace(entry.stackTrace)
    }

    await postBridge("/extension/console-event", {
      browserSessionId: session.browserSessionId,
      tabId,
      level,
      text: text.slice(0, 2000),
      source,
      stackTrace,
      args,
      url,
      lineNumber,
      columnNumber,
      timestamp: new Date().toISOString(),
    }).catch(() => {})
  }

  async function postBridge(path, body) {
    const settings = await getSettings()
    cachedPlatformMatches = settings.platformMatches
    const response = await fetch(`${settings.bridgeUrl}${path}`, {
      method: "POST",
      headers: bridgeHeaders(settings),
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`bridge HTTP ${response.status}`)
    return response.json()
  }

  async function getPanelState() {
    const settings = await getSettings()
    cachedPlatformMatches = settings.platformMatches
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const activeSession = activeTab?.id
      ? sessionsByTab.get(activeTab.id) || null
      : null
    let bridge = null
    try {
      const userId = encodeURIComponent(settings.localUserId || "")
      const healthUrl = userId
        ? `${settings.bridgeUrl}/health?userId=${userId}`
        : `${settings.bridgeUrl}/health`
      const response = await fetch(healthUrl, {
        headers: bridgeHeaders(settings),
      })
      bridge = await response.json()
    } catch {
      bridge = { ok: false }
    }
    return {
      ok: true,
      settings,
      activeTab: activeTab
        ? {
            id: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
            windowId: activeTab.windowId,
          }
        : null,
      activeSession,
      bridge,
    }
  }

  async function refreshActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return { ok: false, error: "no active tab" }
    await ensureTabRegistered(tab.id, { tab, reason: "popup_refresh" }).catch(() => null)
    return getPanelState()
  }

  return {
    sessionsByTab,
    pollers,
    activateTab,
    ensureAllTabsRegistered,
    ensureTabRegistered,
    forgetTab,
    forwardConsoleEvent,
    getPlatformMatches,
    handleMessage,
    postBridge,
    registerBrowserController,
    setToolRequestHandler,
    startPolling,
  }
}

function formatConsoleStackTrace(stackTrace) {
  if (!stackTrace?.callFrames) return ""
  return stackTrace.callFrames
    .map(
      (frame) =>
        `${frame.functionName || "(anonymous)"} (${frame.url || ""}:${frame.lineNumber}:${frame.columnNumber})`
    )
    .join("\n")
}

function normalizePageAuth(auth, source = "unknown") {
  if (!auth || typeof auth !== "object") {
    return {
      state: "missing_from_content_script",
      loggedIn: false,
      reason: "Content script did not report page state; Yunti will try automatic registration recovery before asking for a page refresh",
      checkedAt: new Date().toISOString(),
      checkedBy: source,
    }
  }
  return {
    state: String(auth.state || "unknown"),
    loggedIn: Boolean(auth.loggedIn),
    reason: String(auth.reason || ""),
    checkedAt: auth.checkedAt || new Date().toISOString(),
    checkedBy: String(auth.checkedBy || source),
    status: auth.status ?? null,
    apiAuthError: auth.apiAuthError || "",
    userName: auth.userName ? String(auth.userName).slice(0, 120) : "",
  }
}

function normalizeClientInfo(client) {
  const value = client && typeof client === "object" ? client : {}
  return {
    family: normalizeBrowserFamily(value.family || value.userAgent),
    extensionVersion: String(value.extensionVersion || "").slice(0, 80),
    userAgent: String(value.userAgent || "").slice(0, 500),
    platform: String(value.platform || "").slice(0, 120),
    language: String(value.language || "").slice(0, 80),
  }
}

function getBackgroundClientInfo() {
  return {
    extensionVersion: chrome.runtime?.getManifest?.().version || "",
    userAgent: String(globalThis.navigator?.userAgent || ""),
    platform: String(globalThis.navigator?.platform || ""),
    language: String(globalThis.navigator?.language || ""),
  }
}

function normalizeBrowserFamily(value) {
  const text = String(value || "").toLowerCase()
  if (text === "edge" || /edg\//i.test(text)) return "edge"
  if (text === "chrome" || /chrome\//i.test(text) || /chromium\//i.test(text)) {
    return "chrome"
  }
  if (text === "brave" || /brave\//i.test(text)) return "brave"
  if (text === "opera" || /opr\//i.test(text)) return "opera"
  if (text === "firefox" || /firefox\//i.test(text)) return "firefox"
  if (text === "safari" || /safari\//i.test(text)) return "safari"
  return "unknown"
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
