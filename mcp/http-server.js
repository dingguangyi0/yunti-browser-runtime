import http from "node:http"
import {
  BridgeHub,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_TOOL_TIMEOUT_MS,
  normalizeRouteUserId,
} from "./bridge-hub.js"

export const DEFAULT_HOST =
  process.env.YUNTI_BROWSER_BRIDGE_HOST || "127.0.0.1"
export const DEFAULT_PORT = Number(process.env.YUNTI_BROWSER_BRIDGE_PORT || 48887)
export const BRIDGE_TOKEN_HEADER = "x-yunti-browser-token"
const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1",
  "http://localhost",
  "http://[::1]",
  "chrome-extension://*",
  "moz-extension://*",
]
const RELAY_URL = normalizeBaseUrl(process.env.YUNTI_BROWSER_RELAY_URL || "")
const RELAY_TOKEN = process.env.YUNTI_BROWSER_RELAY_TOKEN || ""
const SERVER_NAME = process.env.YUNTI_BROWSER_SERVER_NAME || "Yunti Browser Runtime"
const _ROUTE_USER_ID = process.env.YUNTI_BROWSER_USER_ID || "local"
const _ROUTE_USER_NAME = process.env.YUNTI_BROWSER_USER_NAME || "local"
const MAX_JSON_BYTES = 2 * 1024 * 1024
const SESSION_CLEANUP_INTERVAL_MS = Number(
  process.env.YUNTI_BROWSER_SESSION_CLEANUP_INTERVAL_MS || 15_000
)
const PROTECTED_BRIDGE_PATHS = new Set([
  "/sessions",
  "/sessions/register",
  "/sessions/activate",
  "/extension/poll",
  "/extension/result",
  "/extension/network-event",
  "/extension/cdp-event",
  "/extension/console-event",
  "/mcp/request",
  "/mcp/local-tool",
])

function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
}

function normalizeBridgeToken(value) {
  return String(value || "").trim()
}

function parseAllowedOrigins(value = process.env.YUNTI_BROWSER_BRIDGE_ALLOW_ORIGINS) {
  const raw = String(value || "").trim()
  if (!raw) return DEFAULT_ALLOWED_ORIGINS
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isLocalHttpOrigin(origin) {
  try {
    const url = new URL(origin)
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)
    )
  } catch {
    return false
  }
}

function originMatchesPattern(origin, pattern) {
  if (!origin) return true
  const pat = String(pattern || "").trim()
  if (!pat) return false
  if (pat === "*") return true
  if (pat === "chrome-extension://*") return origin.startsWith("chrome-extension://")
  if (pat === "moz-extension://*") return origin.startsWith("moz-extension://")
  if (pat.endsWith("://*")) return origin.startsWith(pat.slice(0, -1))
  if (origin === pat) return true
  return isLocalHttpOrigin(origin) && isLocalHttpOrigin(pat)
}

function isAllowedOrigin(origin, allowOrigins) {
  if (!origin) return true
  return allowOrigins.some((pattern) => originMatchesPattern(origin, pattern))
}

function isLoopbackHost(host) {
  const value = String(host || "").trim().toLowerCase()
  return value === "127.0.0.1" || value === "localhost" || value === "::1" || value === "[::1]"
}

function bridgeCorsHeaders(req, allowOrigins) {
  const origin = String(req.headers.origin || "")
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": `content-type, ${BRIDGE_TOKEN_HEADER}`,
    vary: "Origin",
  }
  if (isAllowedOrigin(origin, allowOrigins)) {
    headers["access-control-allow-origin"] = origin || "null"
  }
  return headers
}

function sendJson(req, res, statusCode, value, { allowOrigins = DEFAULT_ALLOWED_ORIGINS } = {}) {
  const body = JSON.stringify(value)
  res.writeHead(statusCode, bridgeCorsHeaders(req, allowOrigins))
  res.end(body)
}

function bridgeRequestToken(req) {
  const headerValue = req.headers[BRIDGE_TOKEN_HEADER]
  if (Array.isArray(headerValue)) return normalizeBridgeToken(headerValue[0])
  if (headerValue) return normalizeBridgeToken(headerValue)
  const authorization = String(req.headers.authorization || "")
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match ? normalizeBridgeToken(match[1]) : ""
}

function isAuthorizedBridgeRequest(req, bridgeToken, authRequired = true) {
  if (!authRequired) return true
  const token = normalizeBridgeToken(bridgeToken)
  return Boolean(token && bridgeRequestToken(req) === token)
}

function authInfo(authRequired) {
  return {
    required: Boolean(authRequired),
    header: BRIDGE_TOKEN_HEADER,
  }
}

function healthWithAuth(value, authRequired) {
  return {
    ...value,
    authorized: true,
    auth: authInfo(authRequired),
  }
}

function limitedHealth(authRequired) {
  return {
    ok: true,
    name: "yunti-browser-runtime-bridge",
    authorized: false,
    auth: authInfo(authRequired),
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks = []
    req.on("data", (chunk) => {
      total += chunk.length
      if (total > MAX_JSON_BYTES) {
        reject(new Error("request body too large"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8")
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

export async function startBridgeServer({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  bridgeToken = null,
  allowOrigins = parseAllowedOrigins(),
  sessionTtlMs = DEFAULT_SESSION_TTL_MS,
} = {}) {
  const configuredBridgeToken = normalizeBridgeToken(
    bridgeToken ?? process.env.YUNTI_BROWSER_BRIDGE_TOKEN
  )
  const authRequired = Boolean(configuredBridgeToken)
  if (!authRequired && !isLoopbackHost(host)) {
    throw new Error(
      "YUNTI_BROWSER_BRIDGE_TOKEN is required when binding the bridge to a non-loopback host"
    )
  }
  const activeBridgeToken = configuredBridgeToken
  const hub = new BridgeHub({ sessionTtlMs })
  const cleanupTimer = setInterval(() => {
    hub.cleanupExpiredSessions()
  }, Math.max(5_000, SESSION_CLEANUP_INTERVAL_MS))
  cleanupTimer.unref?.()
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${port}`)
      const authorized = isAuthorizedBridgeRequest(req, activeBridgeToken, authRequired)

      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "")
        sendJson(req, res, isAllowedOrigin(origin, allowOrigins) ? 200 : 403, { ok: true }, { allowOrigins })
        return
      }

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(
          req,
          res,
          200,
          authorized
            ? healthWithAuth(hub.health({ userId: url.searchParams.get("userId") }), authRequired)
            : limitedHealth(authRequired),
          { allowOrigins }
        )
        return
      }

      if (PROTECTED_BRIDGE_PATHS.has(url.pathname) && !authorized) {
        sendJson(
          req,
          res,
          401,
          {
            ok: false,
            error: `missing or invalid ${BRIDGE_TOKEN_HEADER}`,
            auth: authInfo(authRequired),
          },
          { allowOrigins }
        )
        return
      }

      if (req.method === "GET" && url.pathname === "/sessions") {
        const userId = url.searchParams.get("userId")
        const sessions = hub.listSessions({ userId })
        const activeSessionId = normalizeRouteUserId(userId)
          ? hub.activeSessionByUser.get(normalizeRouteUserId(userId)) || null
          : null
        sendJson(req, res, 200, { sessions, activeSessionId, sessionCount: hub.sessions.size }, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/sessions/register") {
        const body = await readJson(req)
        const session = hub.registerSession(body)
        sendJson(req, res, 200, { ok: true, session }, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/sessions/activate") {
        const body = await readJson(req)
        const session = hub.activateSession(String(body.browserSessionId || ""), body)
        sendJson(req, res, 200, { ok: true, session }, { allowOrigins })
        return
      }

      if (req.method === "GET" && url.pathname === "/extension/poll") {
        const browserSessionId = String(url.searchParams.get("browserSessionId") || "").trim()
        const timeoutMs = Number(url.searchParams.get("timeoutMs") || 25_000)
        if (!browserSessionId) {
          sendJson(req, res, 400, { error: "browserSessionId is required" }, { allowOrigins })
          return
        }
        const event = await hub.poll(browserSessionId, timeoutMs)
        sendJson(req, res, 200, event, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/extension/result") {
        const body = await readJson(req)
        const outcome = hub.submitResult(body)
        sendJson(req, res, outcome.accepted ? 200 : 404, outcome, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/extension/network-event") {
        const body = await readJson(req)
        const outcome = hub.recordNetworkEvent(body)
        sendJson(req, res, outcome.accepted ? 200 : 400, outcome, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/extension/cdp-event") {
        const body = await readJson(req)
        const outcome = hub.recordCdpEvent(body)
        sendJson(req, res, outcome.accepted ? 200 : 400, outcome, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/extension/console-event") {
        const body = await readJson(req)
        const outcome = hub.recordConsoleEvent(body)
        sendJson(req, res, outcome.accepted ? 200 : 400, outcome, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/mcp/local-tool") {
        const body = await readJson(req)
        const result = await hub.callBridgeLocalTool(String(body.tool || ""), body.arguments ?? {})
        sendJson(req, res, 200, { ok: true, result }, { allowOrigins })
        return
      }

      if (req.method === "POST" && url.pathname === "/mcp/request") {
        const body = await readJson(req)
        const result = await hub.callTool(
          String(body.tool || ""),
          body.arguments ?? {},
          Number(body.timeoutMs || DEFAULT_TOOL_TIMEOUT_MS)
        )
        sendJson(req, res, 200, { ok: true, result }, { allowOrigins })
        return
      }

      sendJson(req, res, 404, { error: "not found" }, { allowOrigins })
    } catch (error) {
      sendJson(req, res, 500, {
        error: error instanceof Error ? error.message : String(error),
      }, { allowOrigins })
    }
  })

  const mode = await new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve("proxy")
      } else {
        reject(error)
      }
    })
    server.listen(port, host, () => resolve("owner"))
  })

  if (mode === "proxy") {
    clearInterval(cleanupTimer)
    server.close()
    return { mode: "proxy", host, port, bridgeToken: configuredBridgeToken, authRequired, allowOrigins, hub: null, server: null }
  }
  return { mode: "owner", host, port, bridgeToken: activeBridgeToken, authRequired, allowOrigins, hub, server }
}
