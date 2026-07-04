#!/usr/bin/env node
import readline from "node:readline"
import { pathToFileURL } from "node:url"
import { DEFAULT_TOOL_TIMEOUT_MS, normalizeRouteUserId, requireRouteUserId } from "./bridge-hub.js"
import {
  BRIDGE_TOKEN_HEADER,
  DEFAULT_HOST,
  startBridgeServer,
} from "./http-server.js"
import { jsonRpcErr, jsonRpcOk, toolError, toolOk } from "./json-rpc.js"
import { forgetLearningMemory, getLearningMemory, rememberLearning } from "./memory.js"
import {
  BRIDGE_LOCAL_TOOLS,
  BROWSER_SCOPED_TOOLS,
  MEMORY_LOCAL_TOOLS,
  META_LOCAL_TOOLS,
  TOOLS,
  toolUsageHints,
} from "./tools.js"

export { TOOLS } from "./tools.js"
export { BridgeHub, DEFAULT_SESSION_TTL_MS } from "./bridge-hub.js"
export {
  BRIDGE_TOKEN_HEADER,
  DEFAULT_HOST,
  DEFAULT_PORT,
  startBridgeServer,
} from "./http-server.js"

const RELAY_URL = normalizeBaseUrl(process.env.YUNTI_BROWSER_RELAY_URL || "")
const RELAY_TOKEN = process.env.YUNTI_BROWSER_RELAY_TOKEN || ""
const SERVER_NAME = process.env.YUNTI_BROWSER_SERVER_NAME || "Yunti Browser Runtime"
const _ROUTE_USER_ID = process.env.YUNTI_BROWSER_USER_ID || "local"
const _ROUTE_USER_NAME = process.env.YUNTI_BROWSER_USER_NAME || "local"

function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
}

function normalizeBridgeToken(value) {
  return String(value || "").trim()
}

function withRouteUser(args = {}) {
  const next = args && typeof args === "object" && !Array.isArray(args) ? { ...args } : {}
  if (!next.userId) {
    const routeUserId = normalizeRouteUserId(_ROUTE_USER_ID)
    if (routeUserId) next.userId = routeUserId
  }
  if (!next.userName && _ROUTE_USER_NAME) next.userName = _ROUTE_USER_NAME
  return next
}

function preflightBrowserToolScope(tool, args = {}) {
  if (!BROWSER_SCOPED_TOOLS.has(tool)) return
  requireRouteUserId(args, tool)
}

function bridgeRequestHeaders(bridgeToken = "") {
  const headers = { "content-type": "application/json" }
  const token = normalizeBridgeToken(bridgeToken)
  if (token) headers[BRIDGE_TOKEN_HEADER] = token
  return headers
}

async function proxyToolRequest(port, tool, args, timeoutMs, bridgeToken = "") {
  const routedArgs = withRouteUser(args)
  const response = await fetch(`http://${DEFAULT_HOST}:${port}/mcp/request`, {
    method: "POST",
    headers: bridgeRequestHeaders(bridgeToken),
    body: JSON.stringify({ tool, arguments: routedArgs, timeoutMs }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `bridge HTTP ${response.status}`)
  }
  return data?.result ?? null
}

async function proxyBridgeLocalToolRequest(port, tool, args, bridgeToken = "") {
  const routedArgs = withRouteUser(args)
  const response = await fetch(`http://${DEFAULT_HOST}:${port}/mcp/local-tool`, {
    method: "POST",
    headers: bridgeRequestHeaders(bridgeToken),
    body: JSON.stringify({ tool, arguments: routedArgs }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `bridge HTTP ${response.status}`)
  }
  return data?.result ?? null
}

async function relayToolRequest(tool, args, timeoutMs) {
  const routedArgs = withRouteUser(args)
  const response = await fetch(`${RELAY_URL}/mcp/request`, {
    method: "POST",
    headers: relayHeaders(),
    body: JSON.stringify({ tool, arguments: routedArgs, timeoutMs }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `relay HTTP ${response.status}`)
  }
  return data?.result ?? null
}

async function relayBridgeLocalToolRequest(tool, args) {
  const routedArgs = withRouteUser(args)
  const response = await fetch(`${RELAY_URL}/mcp/local-tool`, {
    method: "POST",
    headers: relayHeaders(),
    body: JSON.stringify({ tool, arguments: routedArgs }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `relay HTTP ${response.status}`)
  }
  return data?.result ?? null
}

function relayHeaders() {
  const headers = { "content-type": "application/json" }
  if (RELAY_TOKEN) headers.authorization = `Bearer ${RELAY_TOKEN}`
  return headers
}

async function callTool(bridge, tool, args) {
  args = withRouteUser(args)
  preflightBrowserToolScope(tool, args)
  if (META_LOCAL_TOOLS.has(tool)) {
    return toolUsageHints(args)
  }
  if (MEMORY_LOCAL_TOOLS.has(tool)) {
    if (bridge?.mode === "owner") return bridge.hub.callBridgeLocalTool(tool, args)
    if (bridge?.mode === "proxy") return proxyBridgeLocalToolRequest(bridge.port, tool, args, bridge.bridgeToken)
    return callMemoryLocalTool(tool, args)
  }
  if (RELAY_URL) {
    if (BRIDGE_LOCAL_TOOLS.has(tool)) return relayBridgeLocalToolRequest(tool, args)
    return relayToolRequest(tool, args, DEFAULT_TOOL_TIMEOUT_MS)
  }
  if (BRIDGE_LOCAL_TOOLS.has(tool)) {
    if (bridge.mode === "owner") return bridge.hub.callBridgeLocalTool(tool, args)
    return proxyBridgeLocalToolRequest(bridge.port, tool, args, bridge.bridgeToken)
  }
  if (bridge.mode === "owner") {
    return bridge.hub.callTool(tool, args)
  }
  return proxyToolRequest(bridge.port, tool, args, DEFAULT_TOOL_TIMEOUT_MS, bridge.bridgeToken)
}

async function callMemoryLocalTool(tool, args = {}) {
  switch (tool) {
    case "yunti_get_tool_usage_hints":
      return toolUsageHints(args)
    case "yunti_remember_learning":
      return rememberLearning(args)
    case "yunti_get_learning_memory":
      return getLearningMemory(args)
    case "yunti_forget_learning_memory":
      return forgetLearningMemory(args)
    default:
      throw new Error(`unknown memory-local tool: ${tool}`)
  }
}

export async function handleJsonRpc(req, bridge) {
  if (!req || typeof req !== "object") return jsonRpcErr(null, -32600, "invalid request")
  if (req.id === undefined || req.id === null) return null

  if (req.method === "initialize") {
    return jsonRpcOk(req.id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: SERVER_NAME, version: "1.0.0" },
      capabilities: { tools: {} },
    })
  }

  if (req.method === "tools/list") {
    return jsonRpcOk(req.id, { tools: TOOLS })
  }

  if (req.method === "tools/call") {
    const name = req.params?.name
    const args = req.params?.arguments ?? {}
    if (!TOOLS.some((tool) => tool.name === name)) {
      return jsonRpcErr(req.id, -32602, `unknown tool: ${name}`)
    }
    try {
      const result = await callTool(bridge, name, args)
      return jsonRpcOk(req.id, toolOk(result))
    } catch (error) {
      return jsonRpcOk(
        req.id,
        toolError(
          error instanceof Error ? error.message : String(error),
          "Open an internal platform page with the Yunti Browser Runtime extension loaded, then try again."
        )
      )
    }
  }

  return jsonRpcErr(req.id, -32601, `method not found: ${req.method}`)
}

export async function runStdio() {
  const bridge = RELAY_URL ? { mode: "relay", host: "", port: 0, hub: null } : await startBridgeServer()
  if (RELAY_URL) {
    console.error(`[yunti-browser-runtime] relay ${RELAY_URL}`)
  } else {
    console.error(
      `[yunti-browser-runtime] bridge ${bridge.mode} on http://${bridge.host}:${bridge.port}`
    )
    console.error(`[yunti-browser-runtime] console http://${bridge.host}:${bridge.port}/console`)
    if (bridge.mode === "owner") {
      if (bridge.authRequired) {
        console.error(
          `[yunti-browser-runtime] bridge token header ${BRIDGE_TOKEN_HEADER}: ${bridge.bridgeToken}`
        )
      } else {
        console.error("[yunti-browser-runtime] bridge auth disabled for local loopback")
        console.error("[yunti-browser-runtime] set YUNTI_BROWSER_BRIDGE_TOKEN to require a local token")
      }
    } else if (!bridge.bridgeToken) {
      console.error(
        `[yunti-browser-runtime] proxy mode will connect without a bridge token; set YUNTI_BROWSER_BRIDGE_TOKEN if the running bridge requires one`
      )
    }
  }

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
  for await (const rawLine of rl) {
    const line = rawLine.trim()
    if (!line) continue
    let req
    try {
      req = JSON.parse(line)
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify(jsonRpcErr(null, -32700, `parse error: ${error.message}`))}\n`
      )
      continue
    }
    const response = await handleJsonRpc(req, bridge)
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`)
  }
}

export async function runBridgeOnly() {
  const bridge = await startBridgeServer()
  console.error(
    `[yunti-browser-runtime] bridge ${bridge.mode} on http://${bridge.host}:${bridge.port}`
  )
  console.error(`[yunti-browser-runtime] console http://${bridge.host}:${bridge.port}/console`)
  if (bridge.mode === "owner") {
    if (bridge.authRequired) {
      console.error(
        `[yunti-browser-runtime] bridge token header ${BRIDGE_TOKEN_HEADER}: ${bridge.bridgeToken}`
      )
    } else {
      console.error("[yunti-browser-runtime] bridge auth disabled for local loopback")
      console.error("[yunti-browser-runtime] set YUNTI_BROWSER_BRIDGE_TOKEN to require a local token")
    }
  } else if (!bridge.bridgeToken) {
    console.error(
      `[yunti-browser-runtime] proxy mode will connect without a bridge token; set YUNTI_BROWSER_BRIDGE_TOKEN if the running bridge requires one`
    )
  }
  await new Promise(() => {})
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runner = process.env.YUNTI_BROWSER_BRIDGE_ONLY === "1" ? runBridgeOnly : runStdio
  runner().catch((error) => {
    console.error("[yunti-browser-runtime] fatal:", error)
    process.exit(1)
  })
}
