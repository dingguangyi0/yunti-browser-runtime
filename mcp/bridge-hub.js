import { randomUUID } from "node:crypto"
import { forgetLearningMemory, getLearningMemory, rememberLearning } from "./memory.js"
import {
  clampNumber,
  normalizeCdpEvent,
  sanitizeNetworkEvent,
  sanitizeUrl,
  truncateText,
} from "./redaction.js"
import { toolUsageHints } from "./tools.js"

export const DEFAULT_TOOL_TIMEOUT_MS = 30_000
const MAX_NETWORK_EVENTS = 1000
const MAX_CDP_EVENTS = 2000
const MAX_CONSOLE_MESSAGES = 1000
const MAX_MEMORY_ITEMS = 500
export const DEFAULT_SESSION_TTL_MS = Number(
  process.env.YUNTI_BROWSER_SESSION_TTL_MS || 90_000
)

function isoNow(ms = Date.now()) {
  return new Date(ms).toISOString()
}

export function sessionRecoveryHint() {
  return "Call yunti_list_browser_targets to refresh the live route inventory and use the latest browserSessionId."
}

export function staleSessionError(browserSessionId, reason = "stale or disconnected") {
  return new Error(
    `Yunti browser session is stale or disconnected: ${browserSessionId}. Reason: ${reason}. ${sessionRecoveryHint()}`
  )
}

function stripBrowserSessionId(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args ?? {}
  const next = { ...args }
  delete next.browserSessionId
  delete next.userId
  delete next.userName
  return next
}

export function normalizeRouteUserId(value) {
  const userId = String(value || "").trim()
  return userId && userId !== "anonymous" ? userId : ""
}

export function requireRouteUserId(args = {}, operation = "Yunti browser tool") {
  const userId = normalizeRouteUserId(args?.userId)
  if (!userId) {
    throw new Error(`${operation}: userId is required for Yunti browser isolation`)
  }
  return userId
}
export class BridgeHub {
  constructor({ sessionTtlMs = DEFAULT_SESSION_TTL_MS } = {}) {
    this.sessions = new Map()
    this.pendingRequests = new Map()
    this.networkEvents = []
    this.cdpEvents = []
    this.consoleMessages = []
    this.nextNetworkEventId = 1
    this.nextCdpEventId = 1
    this.nextConsoleMsgId = 1
    this.activeSessionId = null
    this.activeSessionByUser = new Map()
    this.sessionTtlMs = Math.max(5_000, Number(sessionTtlMs) || DEFAULT_SESSION_TTL_MS)
  }

  sessionExpiresAt(now = Date.now()) {
    return now + this.sessionTtlMs
  }

  refreshSession(session, now = Date.now(), patch = {}) {
    const meta = session.meta || {}
    session.updatedAt = now
    session.expiresAt = this.sessionExpiresAt(now)
    session.staleReason = ""
    session.meta = {
      ...meta,
      ...patch,
      lastSeenAt: isoNow(now),
      expiresAt: isoNow(session.expiresAt),
      staleReason: "",
      updatedAt: isoNow(now),
    }
    return session
  }

  markSessionStale(browserSessionId, reason = "disconnected") {
    const session = this.sessions.get(browserSessionId)
    if (!session) return null
    session.staleReason = reason
    session.meta = {
      ...session.meta,
      staleReason: reason,
      staleAt: isoNow(),
    }
    this.sessions.delete(browserSessionId)
    if (this.activeSessionId === browserSessionId) this.activeSessionId = null
    for (const [userId, activeSessionId] of this.activeSessionByUser.entries()) {
      if (activeSessionId === browserSessionId) this.activeSessionByUser.delete(userId)
    }
    for (const poller of session.pollers.splice(0)) {
      poller({ type: "noop", id: randomUUID(), stale: true, reason })
    }
    return session.meta
  }

  cleanupExpiredSessions(now = Date.now()) {
    const expired = []
    for (const [browserSessionId, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt <= now) {
        expired.push({
          browserSessionId,
          reason: "session heartbeat expired",
          meta: this.markSessionStale(browserSessionId, "session heartbeat expired"),
        })
      }
    }
    return expired
  }

  getLiveSession(browserSessionId) {
    const session = this.sessions.get(browserSessionId)
    if (!session) return null
    if (session.expiresAt && session.expiresAt <= Date.now()) {
      this.markSessionStale(browserSessionId, "session heartbeat expired")
      return null
    }
    return session
  }

  registerSession(meta) {
    this.cleanupExpiredSessions()
    const browserSessionId = String(meta.browserSessionId || "").trim()
    if (!browserSessionId) throw new Error("browserSessionId is required")
    const routeUserId = requireRouteUserId(meta, "browser session registration")
    const existing = this.sessions.get(browserSessionId) || {
      browserSessionId,
      queue: [],
      pollers: [],
      meta: {},
      updatedAt: 0,
      expiresAt: 0,
      staleReason: "",
    }
    const now = Date.now()
    this.refreshSession(existing, now, {
      ...meta,
      browserSessionId,
      userId: routeUserId,
      registeredAt: meta.registeredAt || existing.meta.registeredAt || isoNow(now),
    })
    this.sessions.set(browserSessionId, existing)
    this.activeSessionId = browserSessionId
    const userId = normalizeRouteUserId(existing.meta.userId)
    if (userId) this.activeSessionByUser.set(userId, browserSessionId)
    return existing.meta
  }

  activateSession(browserSessionId, args = {}) {
    this.cleanupExpiredSessions()
    const session = this.getLiveSession(browserSessionId)
    if (!session) {
      throw staleSessionError(browserSessionId, "not registered or heartbeat expired")
    }
    const meta = session.meta
    const routeUserId = requireRouteUserId(args, "browser session activation")
    if (normalizeRouteUserId(meta.userId) !== routeUserId) {
      throw new Error(`browser session is not owned by userId: ${routeUserId}`)
    }
    this.refreshSession(session, Date.now(), {
      lastActivatedAt: isoNow(),
    })
    this.activeSessionId = browserSessionId
    const userId = normalizeRouteUserId(meta.userId)
    if (userId) this.activeSessionByUser.set(userId, browserSessionId)
    return session.meta
  }

  listSessions(args = {}) {
    this.cleanupExpiredSessions()
    const userId = normalizeRouteUserId(args.userId)
    const sessions = [...this.sessions.values()].filter((session) => {
      if (!userId) return false
      return normalizeRouteUserId(session.meta?.userId) === userId
    })
    return sessions.map((session) => ({
      ...session.meta,
      queuedRequests: session.queue.length,
      pollers: session.pollers.length,
      networkEvents: this.networkEvents.filter(
        (event) => event.browserSessionId === session.browserSessionId
      ).length,
      cdpEvents: this.cdpEvents.filter(
        (event) => event.browserSessionId === session.browserSessionId
      ).length,
      active: session.browserSessionId === this.activeSessionId,
    }))
  }

  health(args = {}) {
    this.cleanupExpiredSessions()
    const userId = normalizeRouteUserId(args.userId)
    const sessions = this.listSessions({ userId })
    const activeSessionId = userId
      ? this.activeSessionByUser.get(userId) || null
      : null
    return {
      ok: true,
      name: "yunti-browser-runtime-bridge",
      activeSessionId,
      sessions,
      sessionCount: this.sessions.size,
    }
  }

  sessionIdsForUser(userId) {
    this.cleanupExpiredSessions()
    const routeUserId = normalizeRouteUserId(userId)
    if (!routeUserId) return new Set()
    return new Set(
      [...this.sessions.values()]
        .filter((session) => normalizeRouteUserId(session.meta?.userId) === routeUserId)
        .map((session) => session.browserSessionId)
    )
  }

  listPages(args = {}) {
    this.cleanupExpiredSessions()
    const userId = requireRouteUserId(args, "yunti_list_pages")
    const activeSessionId = this.activeSessionByUser.get(userId) || null
    const sessions = [...this.sessions.values()].filter((session) => {
      return normalizeRouteUserId(session.meta?.userId) === userId
    })
    const pages = sessions.map((session) => {
      const meta = session.meta || {}
      return {
        browserSessionId: session.browserSessionId,
        url: meta.url || "",
        title: meta.title || "",
        tabId: meta.tabId ?? null,
        windowId: meta.windowId ?? null,
        active: session.browserSessionId === activeSessionId,
        userId: meta.userId || "",
        displayName: meta.displayName || "",
        registeredAt: meta.registeredAt || meta.updatedAt || "",
      }
    })
    return { pages, activeSessionId }
  }

  selectPage(browserSessionId, args = {}) {
    this.cleanupExpiredSessions()
    const session = this.getLiveSession(browserSessionId)
    if (!browserSessionId || !session) {
      throw staleSessionError(browserSessionId, "not registered or heartbeat expired")
    }
    const meta = session.meta
    const routeUserId = requireRouteUserId(args, "yunti_select_page")
    if (normalizeRouteUserId(meta.userId) !== routeUserId) {
      throw new Error(`browser session is not owned by userId: ${routeUserId}`)
    }
    this.refreshSession(session, Date.now(), {
      lastActivatedAt: isoNow(),
    })
    this.activeSessionId = browserSessionId
    const userId = normalizeRouteUserId(meta.userId)
    if (userId) this.activeSessionByUser.set(userId, browserSessionId)
    return {
      browserSessionId,
      url: meta.url || "",
      title: meta.title || "",
      tabId: meta.tabId ?? null,
      active: true,
      userId: meta.userId || "",
    }
  }

  resolveSessionId(args) {
    this.cleanupExpiredSessions()
    const userId =
      args && typeof args === "object" && !Array.isArray(args)
        ? requireRouteUserId(args, "Yunti browser session routing")
        : requireRouteUserId({}, "Yunti browser session routing")
    const explicit =
      args && typeof args === "object" && !Array.isArray(args)
        ? String(args.browserSessionId || "").trim()
        : ""
    if (explicit) {
      const session = this.getLiveSession(explicit)
      if (!session) {
        throw staleSessionError(explicit, "not registered or heartbeat expired")
      }
      if (normalizeRouteUserId(session.meta?.userId) !== userId) {
        throw new Error(`browser session is not owned by userId: ${userId}`)
      }
      return explicit
    }
    const userSessionId = this.activeSessionByUser.get(userId)
    if (!userSessionId) {
      throw new Error(`No Yunti browser tab is connected for userId: ${userId}. ${sessionRecoveryHint()}`)
    }
    const session = this.getLiveSession(userSessionId)
    if (!session) {
      throw staleSessionError(userSessionId, "active route heartbeat expired")
    }
    if (normalizeRouteUserId(session.meta?.userId) !== userId) {
      throw new Error(`browser session is not owned by userId: ${userId}`)
    }
    return userSessionId
  }

  async callTool(tool, args = {}, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
    const browserSessionId = this.resolveSessionId(args)
    const session = this.sessions.get(browserSessionId)
    const requestId = randomUUID()
    const payload = {
      type: "tool_request",
      id: requestId,
      tool,
      arguments: stripBrowserSessionId(args),
      createdAt: new Date().toISOString(),
    }

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Timed out waiting for browser tool result: ${tool}`))
      }, timeoutMs)
      this.pendingRequests.set(requestId, { resolve, reject, timer, browserSessionId, tool })
    })

    const poller = session.pollers.shift()
    if (poller) {
      poller(payload)
    } else {
      session.queue.push(payload)
    }
    return promise
  }

  recordNetworkEvent(input) {
    this.cleanupExpiredSessions()
    const event = sanitizeNetworkEvent(input || {}, this.nextNetworkEventId++)
    if (!event.browserSessionId) return { accepted: false, error: "browserSessionId is required" }
    if (!this.getLiveSession(event.browserSessionId)) {
      return { accepted: false, error: staleSessionError(event.browserSessionId).message }
    }
    this.networkEvents.push(event)
    if (this.networkEvents.length > MAX_NETWORK_EVENTS) {
      this.networkEvents.splice(0, this.networkEvents.length - MAX_NETWORK_EVENTS)
    }
    return { accepted: true, event }
  }

  recordCdpEvent(input) {
    this.cleanupExpiredSessions()
    const event = normalizeCdpEvent(input || {}, this.nextCdpEventId++)
    if (!event.browserSessionId) return { accepted: false, error: "browserSessionId is required" }
    if (!event.method) return { accepted: false, error: "method is required" }
    if (!this.getLiveSession(event.browserSessionId)) {
      return { accepted: false, error: staleSessionError(event.browserSessionId).message }
    }
    this.cdpEvents.push(event)
    if (this.cdpEvents.length > MAX_CDP_EVENTS) {
      this.cdpEvents.splice(0, this.cdpEvents.length - MAX_CDP_EVENTS)
    }
    return { accepted: true, event }
  }

  listNetworkEvents(args = {}) {
    const limit = clampNumber(args.limit || 100, 1, 500, 100)
    const sinceId = Number(args.sinceId || 0)
    const method = String(args.method || "").trim().toUpperCase()
    const urlContains = String(args.urlContains || "").trim().toLowerCase()
    const browserSessionIds = args.allSessions
      ? this.sessionIdsForUser(requireRouteUserId(args, "yunti_get_network_log"))
      : new Set([this.resolveSessionId(args)])
    let events = this.networkEvents
    events = events.filter((event) => browserSessionIds.has(event.browserSessionId))
    if (Number.isFinite(sinceId) && sinceId > 0) {
      events = events.filter((event) => event.id > sinceId)
    }
    if (method) events = events.filter((event) => event.method === method)
    if (urlContains) {
      events = events.filter((event) => String(event.url || "").toLowerCase().includes(urlContains))
    }
    const total = events.length
    events = events.slice(-limit)
    return { events, total, returned: events.length }
  }

  clearNetworkEvents(args = {}) {
    if (args.allSessions) {
      const browserSessionIds = this.sessionIdsForUser(requireRouteUserId(args, "yunti_clear_network_log"))
      const before = this.networkEvents.length
      this.networkEvents = this.networkEvents.filter(
        (event) => !browserSessionIds.has(event.browserSessionId)
      )
      return { deleted: before - this.networkEvents.length }
    }
    const browserSessionId = this.resolveSessionId(args)
    const before = this.networkEvents.length
    this.networkEvents = this.networkEvents.filter((event) => event.browserSessionId !== browserSessionId)
    return { deleted: before - this.networkEvents.length }
  }

  getNetworkRequest(args = {}) {
    const id = Number(args.eventId)
    if (!Number.isFinite(id)) throw new Error("eventId is required")
    const browserSessionId = this.resolveSessionId(args)
    const event = this.networkEvents.find(e => e.id === id)
    if (!event) throw new Error(`network request not found: ${id}`)
    if (event.browserSessionId !== browserSessionId) {
      throw new Error(`network request not found for browserSessionId: ${browserSessionId}`)
    }
    return event
  }

  listCdpEvents(args = {}) {
    const limit = clampNumber(args.limit || 100, 1, 500, 100)
    const sinceId = Number(args.sinceId || 0)
    const method = String(args.method || "").trim()
    const browserSessionIds = args.allSessions
      ? this.sessionIdsForUser(requireRouteUserId(args, "yunti_get_cdp_events"))
      : new Set([this.resolveSessionId(args)])
    let events = this.cdpEvents
    events = events.filter((event) => browserSessionIds.has(event.browserSessionId))
    if (Number.isFinite(sinceId) && sinceId > 0) {
      events = events.filter((event) => event.id > sinceId)
    }
    if (method) events = events.filter((event) => event.method === method)
    const total = events.length
    events = events.slice(-limit)
    return { events, total, returned: events.length }
  }

  clearCdpEvents(args = {}) {
    if (args.allSessions) {
      const browserSessionIds = this.sessionIdsForUser(requireRouteUserId(args, "yunti_clear_cdp_events"))
      const before = this.cdpEvents.length
      this.cdpEvents = this.cdpEvents.filter(
        (event) => !browserSessionIds.has(event.browserSessionId)
      )
      return { deleted: before - this.cdpEvents.length }
    }
    const browserSessionId = this.resolveSessionId(args)
    const before = this.cdpEvents.length
    this.cdpEvents = this.cdpEvents.filter((event) => event.browserSessionId !== browserSessionId)
    return { deleted: before - this.cdpEvents.length }
  }

  recordConsoleEvent(input) {
    this.cleanupExpiredSessions()
    const event = {
      id: this.nextConsoleMsgId++,
      browserSessionId: truncateText(input.browserSessionId || "", 160),
      tabId: Number.isFinite(Number(input.tabId)) ? Number(input.tabId) : null,
      level: ["error", "warning", "info", "debug", "log", "verbose"].includes(input.level) ? input.level : "log",
      text: truncateText(String(input.text || ""), 2000),
      source: ["console-api", "javascript", "network", "other"].includes(input.source) ? input.source : "other",
      url: input.url ? sanitizeUrl(input.url) : "",
      lineNumber: Number.isFinite(Number(input.lineNumber)) ? Number(input.lineNumber) : null,
      columnNumber: Number.isFinite(Number(input.columnNumber)) ? Number(input.columnNumber) : null,
      stackTrace: input.stackTrace ? truncateText(String(input.stackTrace), 4000) : "",
      args: Array.isArray(input.args) ? input.args.slice(0, 20).map(a => truncateText(String(a), 500)) : [],
      timestamp: input.timestamp || new Date().toISOString(),
    }
    if (!event.browserSessionId) return { accepted: false, error: "browserSessionId is required" }
    if (!this.getLiveSession(event.browserSessionId)) {
      return { accepted: false, error: staleSessionError(event.browserSessionId).message }
    }
    this.consoleMessages.push(event)
    if (this.consoleMessages.length > MAX_CONSOLE_MESSAGES) {
      this.consoleMessages.splice(0, this.consoleMessages.length - MAX_CONSOLE_MESSAGES)
    }
    return { accepted: true, event }
  }

  listConsoleMessages(args = {}) {
    const limit = clampNumber(args.limit || 100, 1, 500, 100)
    const sinceId = Number(args.sinceId || 0)
    const level = String(args.level || "").trim().toLowerCase()
    const source = String(args.source || "").trim().toLowerCase()
    const browserSessionIds = args.allSessions
      ? this.sessionIdsForUser(requireRouteUserId(args, "yunti_list_console_messages"))
      : new Set([this.resolveSessionId(args)])

    let events = this.consoleMessages
    events = events.filter(e => browserSessionIds.has(e.browserSessionId))
    if (Number.isFinite(sinceId) && sinceId > 0) {
      events = events.filter(e => e.id > sinceId)
    }
    if (level) events = events.filter(e => e.level === level)
    if (source) events = events.filter(e => e.source === source)
    const total = events.length
    events = events.slice(-limit).reverse()
    return { events, total, returned: events.length }
  }

  getConsoleMessage(args = {}) {
    const id = Number(args.msgId)
    if (!Number.isFinite(id)) throw new Error("msgId is required")
    const browserSessionId = this.resolveSessionId(args)
    const msg = this.consoleMessages.find(e => e.id === id)
    if (!msg) throw new Error(`console message not found: ${id}`)
    if (msg.browserSessionId !== browserSessionId) {
      throw new Error(`console message not found for browserSessionId: ${browserSessionId}`)
    }
    return msg
  }

  clearConsoleMessages(args = {}) {
    if (args.allSessions) {
      const browserSessionIds = this.sessionIdsForUser(requireRouteUserId(args, "yunti_clear_console_messages"))
      const before = this.consoleMessages.length
      this.consoleMessages = this.consoleMessages.filter(
        e => !browserSessionIds.has(e.browserSessionId)
      )
      return { deleted: before - this.consoleMessages.length }
    }
    const browserSessionId = this.resolveSessionId(args)
    const before = this.consoleMessages.length
    this.consoleMessages = this.consoleMessages.filter(e => e.browserSessionId !== browserSessionId)
    return { deleted: before - this.consoleMessages.length }
  }

  async callBridgeLocalTool(tool, args = {}) {
    switch (tool) {
      case "yunti_select_page":
        return this.selectPage(String(args.browserSessionId || ""), args)
      case "yunti_get_network_log":
        return this.listNetworkEvents(args)
      case "yunti_list_network_requests":
        return this.listNetworkEvents(args)
      case "yunti_get_network_request":
        return this.getNetworkRequest(args)
      case "yunti_clear_network_log":
      case "yunti_clear_network_requests":
        return this.clearNetworkEvents(args)
      case "yunti_get_cdp_events":
        return this.listCdpEvents(args)
      case "yunti_clear_cdp_events":
        return this.clearCdpEvents(args)
      case "yunti_list_console_messages":
        return this.listConsoleMessages(args)
      case "yunti_get_console_message":
        return this.getConsoleMessage(args)
      case "yunti_clear_console_messages":
        return this.clearConsoleMessages(args)
      case "yunti_remember_learning":
        return rememberLearning(args)
      case "yunti_get_learning_memory":
        return getLearningMemory(args)
      case "yunti_forget_learning_memory":
        return forgetLearningMemory(args)
      case "yunti_get_tool_usage_hints":
        return toolUsageHints(args)
      default:
        throw new Error(`unknown bridge-local tool: ${tool}`)
    }
  }

  async poll(browserSessionId, timeoutMs = 25_000) {
    this.cleanupExpiredSessions()
    const session = this.getLiveSession(browserSessionId)
    if (!session) {
      throw staleSessionError(browserSessionId, "not registered or heartbeat expired")
    }
    this.refreshSession(session)
    if (session.queue.length > 0) return session.queue.shift()

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        session.pollers = session.pollers.filter((poller) => poller !== finish)
        resolve({ type: "noop", id: randomUUID() })
      }, Math.max(1000, Math.min(timeoutMs, 30_000)))
      const finish = (value) => {
        clearTimeout(timer)
        resolve(value)
      }
      session.pollers.push(finish)
    })
  }

  submitResult({ browserSessionId, requestId, ok, result, error }) {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return { accepted: false }
    if (browserSessionId && pending.browserSessionId !== browserSessionId) {
      return { accepted: false, error: "browserSessionId mismatch" }
    }
    clearTimeout(pending.timer)
    this.pendingRequests.delete(requestId)
    if (ok) {
      pending.resolve(result ?? null)
    } else {
      pending.reject(new Error(error || "Browser tool failed"))
    }
    return { accepted: true }
  }
}
