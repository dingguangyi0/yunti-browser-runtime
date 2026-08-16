#!/usr/bin/env node
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import packageJson from "../package.json" with { type: "json" }

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const doctorPath = join(rootDir, "scripts", "doctor.js")

function parseArgs(argv) {
  const result = { format: "human", strict: false }
  for (const arg of argv) {
    if (arg === "--json") result.format = "json"
    else if (arg === "--human") result.format = "human"
    else if (arg === "--strict") result.strict = true
    else if (arg === "--help" || arg === "-h") result.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return result
}

function runDoctor() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [doctorPath], {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`doctor terminated by ${signal}`))
        return
      }
      try {
        resolvePromise({ report: JSON.parse(stdout), doctorExitCode: code ?? 0, stderr })
      } catch (error) {
        reject(new Error(`doctor returned invalid JSON: ${error.message}`))
      }
    })
  })
}

function deriveState(report) {
  const checks = report?.checks || {}
  const bridge = checks.bridge || {}
  if (!checks.node?.ok || !checks.mcpServer?.ok || !checks.skill?.ok) return "needs_setup"
  if (!bridge.reachable) return "bridge_offline"
  if (bridge.authRequired && !bridge.authorized) return "bridge_unauthorized"
  if (bridge.extensionConnected && !bridge.compatibility?.ok) return "version_mismatch"
  if (!bridge.extensionConnected) return "runtime_ready"
  if (!bridge.pageConnected) return "controller_online"
  return "page_ready"
}

function compactStatus(report, doctorExitCode) {
  const checks = report?.checks || {}
  const bridge = checks.bridge || {}
  const state = deriveState(report)
  return {
    ok: state === "page_ready",
    state,
    checkedAt: report?.checkedAt || new Date().toISOString(),
    runtime: {
      version: packageJson.version,
      node: checks.node?.version || process.version,
      nodeOk: Boolean(checks.node?.ok),
      mcpServer: Boolean(checks.mcpServer?.ok),
      skill: Boolean(checks.skill?.ok),
    },
    bridge: {
      url: bridge.url || null,
      reachable: Boolean(bridge.reachable),
      authorized: bridge.reachable ? Boolean(bridge.authorized) : null,
      tokenRequired: Boolean(bridge.authRequired),
      compatibilityOk: bridge.reachable ? Boolean(bridge.compatibility?.ok) : null,
    },
    browser: {
      controllerConnected: Boolean(bridge.extensionConnected),
      controllerCount: Number(bridge.controllerCount || 0),
      pageCount: Number(bridge.pageSessionCount || 0),
      visibleTargetCount: Number(bridge.visibleSessionCount || 0),
      activePage: bridge.activeSessionId || null,
    },
    nextSteps: Array.isArray(report?.nextSteps) ? report.nextSteps : [],
    doctorExitCode,
  }
}

function humanOutput(status) {
  const labels = {
    page_ready: "READY",
    controller_online: "CONTROLLER ONLINE",
    runtime_ready: "RUNTIME READY",
    bridge_offline: "BRIDGE OFFLINE",
    bridge_unauthorized: "BRIDGE UNAUTHORIZED",
    version_mismatch: "VERSION MISMATCH",
    needs_setup: "NEEDS SETUP",
  }
  const lines = [
    `Yunti Browser Runtime status: ${labels[status.state] || status.state}`,
    `- Runtime: ${status.runtime.version}; Node ${status.runtime.node} (${status.runtime.nodeOk ? "ok" : "requires >=22"})`,
    `- Bridge: ${status.bridge.reachable ? status.bridge.url : "not reachable"}${status.bridge.tokenRequired ? status.bridge.authorized ? " (token valid)" : " (token required)" : " (local token not required)"}`,
    `- Browser: ${status.browser.controllerConnected ? `${status.browser.controllerCount} controller, ${status.browser.pageCount} page route(s)` : "controller not detected"}`,
    `- MCP/skill: ${status.runtime.mcpServer ? "MCP present" : "MCP missing"}; ${status.runtime.skill ? "skill present" : "skill missing"}`,
  ]
  if (status.nextSteps.length) {
    lines.push("Next steps:")
    for (const step of status.nextSteps) lines.push(`- ${step}`)
  }
  return lines.join("\n")
}

function printHelp() {
  console.log(`Yunti Browser Runtime status

Usage:
  yunti-browser-runtime status [--human|--json] [--strict]

The command is read-only. It reuses doctor checks and reports one state:
page_ready, controller_online, runtime_ready, bridge_offline,
bridge_unauthorized, version_mismatch, or needs_setup.

--strict exits non-zero unless a live page route is ready.`)
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }
  const { report, doctorExitCode } = await runDoctor()
  const status = compactStatus(report, doctorExitCode)
  if (args.format === "json") console.log(JSON.stringify(status, null, 2))
  else console.log(humanOutput(status))
  if (args.strict && !status.ok) process.exitCode = 1
} catch (error) {
  console.error(`Status failed: ${error.message}`)
  process.exitCode = 1
}
