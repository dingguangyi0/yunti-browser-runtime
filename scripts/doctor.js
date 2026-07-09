#!/usr/bin/env node
import http from "node:http"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const bridgeUrl = normalizeBaseUrl(
  process.env.YUNTI_BROWSER_BRIDGE_URL || "http://127.0.0.1:48887"
)
const routeUserId = process.env.YUNTI_BROWSER_USER_ID || "local"
const bridgeToken = String(process.env.YUNTI_BROWSER_BRIDGE_TOKEN || "").trim()
const bridgeTokenHeader = "x-yunti-browser-token"
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const mcpServerPath = join(rootDir, "mcp", "server.js")
const skillPath = join(rootDir, "skills", "yunti-browser-runtime", "SKILL.md")

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "")
}

function nodeVersionStatus() {
  const major = Number(process.versions.node.split(".")[0])
  return {
    ok: Number.isFinite(major) && major >= 22,
    version: process.version,
    required: ">=22",
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, {
      headers: bridgeToken ? { [bridgeTokenHeader]: bridgeToken } : {},
    }, (res) => {
      let body = ""
      res.setEncoding("utf8")
      res.on("data", (chunk) => {
        body += chunk
      })
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body || "{}") })
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on("error", reject)
    req.setTimeout(3000, () => {
      req.destroy(new Error("bridge health check timed out"))
    })
  })
}

async function checkBridge() {
  try {
    const health = await getJson(
      `${bridgeUrl}/health?userId=${encodeURIComponent(routeUserId)}`
    )
    const authorized = health.json?.authorized !== false
    const authRequired = health.json?.auth?.required !== false && Boolean(health.json?.auth?.required)
    const sessions = Array.isArray(health.json?.sessions) ? health.json.sessions : []
    const activeSessionId = health.json?.activeSessionId || null
    return {
      ok: health.status === 200 && authorized,
      reachable: health.status === 200,
      authorized,
      authRequired,
      status: health.status,
      url: bridgeUrl,
      consoleUrl: `${bridgeUrl}/console`,
      tokenConfigured: Boolean(bridgeToken),
      tokenHeader: bridgeTokenHeader,
      userId: routeUserId,
      sessionCount: Number(health.json?.sessionCount || sessions.length || 0),
      visibleSessionCount: sessions.length,
      activeSessionId,
      activeSession: sessions.find((session) => session.browserSessionId === activeSessionId) || null,
      extensionConnected: sessions.length > 0,
      raw: health.json,
    }
  } catch (error) {
    return {
      ok: false,
      reachable: false,
      authorized: false,
      authRequired: Boolean(bridgeToken),
      url: bridgeUrl,
      consoleUrl: `${bridgeUrl}/console`,
      tokenConfigured: Boolean(bridgeToken),
      tokenHeader: bridgeTokenHeader,
      userId: routeUserId,
      error: error.message,
      sessionCount: 0,
      visibleSessionCount: 0,
      activeSessionId: null,
      activeSession: null,
      extensionConnected: false,
    }
  }
}

function checkFile(path) {
  return {
    ok: existsSync(path),
    path,
  }
}

function buildNextSteps(checks) {
  const steps = []
  if (!checks.node.ok) {
    steps.push("Install Node.js 22 or newer, then rerun npm run doctor.")
  }
  if (!checks.bridge.reachable) {
    steps.push("Start the local bridge with npm run bridge.")
  }
  if (checks.bridge.reachable && checks.bridge.authRequired && !checks.bridge.authorized) {
    steps.push("Set YUNTI_BROWSER_BRIDGE_TOKEN to the token used by the running bridge.")
    steps.push("Save the same token in the extension popup.")
  }
  if (checks.bridge.ok && !checks.bridge.extensionConnected) {
    steps.push("Load or reload the extension and open an http/https page; Yunti will auto-register accessible tabs.")
    steps.push("If no page appears after a few seconds, refresh the target page as a fallback.")
    steps.push(`Open the optional local console for live status: ${checks.bridge.consoleUrl}.`)
  }
  if (!checks.mcpServer.ok) {
    steps.push(`Restore the MCP server file at ${checks.mcpServer.path}.`)
  }
  if (!checks.skill.ok) {
    steps.push(`Restore the agent skill at ${checks.skill.path}.`)
  }
  return steps
}

function humanSummary(report) {
  const lines = [
    `Yunti Browser Runtime doctor: ${report.ok ? "OK" : "needs attention"}`,
    `- Node: ${report.checks.node.version} (${report.checks.node.ok ? "ok" : "requires >=22"})`,
    `- Bridge: ${report.checks.bridge.reachable ? report.checks.bridge.url : "not reachable"}`,
    `- Console: ${report.checks.bridge.reachable ? report.checks.bridge.consoleUrl : "not available until bridge starts"}`,
    `- Token: ${report.checks.bridge.authRequired ? report.checks.bridge.authorized ? "valid" : "missing or invalid" : "not required for local loopback"}`,
    `- Sessions: ${report.checks.bridge.visibleSessionCount} visible, active ${report.checks.bridge.activeSessionId || "none"}`,
    `- Extension: ${report.checks.bridge.extensionConnected ? "connected" : "not detected"}`,
    `- MCP server: ${report.checks.mcpServer.ok ? "found" : "missing"}`,
    `- Skill: ${report.checks.skill.ok ? "found" : "missing"}`,
  ]
  if (report.nextSteps.length) {
    lines.push("Next steps:")
    for (const step of report.nextSteps) lines.push(`- ${step}`)
  }
  return lines.join("\n")
}

const checks = {
  node: nodeVersionStatus(),
  bridge: await checkBridge(),
  mcpServer: checkFile(mcpServerPath),
  skill: checkFile(skillPath),
}
const nextSteps = buildNextSteps(checks)
const report = {
  ok: checks.node.ok && checks.bridge.ok && checks.mcpServer.ok && checks.skill.ok,
  checkedAt: new Date().toISOString(),
  checks,
  nextSteps,
}

console.log(JSON.stringify(report, null, 2))
console.error(humanSummary(report))
if (!report.ok) process.exitCode = 1
