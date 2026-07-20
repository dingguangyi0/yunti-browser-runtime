#!/usr/bin/env node
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const mcpServerPath = join(rootDir, "mcp", "server.js")
const skillPath = join(rootDir, "skills", "yunti-browser-runtime")
const bridgePort = process.env.YUNTI_BROWSER_BRIDGE_PORT || "48887"
const bridgeTokenConfigured = Boolean(String(process.env.YUNTI_BROWSER_BRIDGE_TOKEN || "").trim())
const supportedAgents = ["codex", "claude-code", "cursor", "cline"]

function parseArgs(argv) {
  const result = { agent: "codex", format: "json" }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--agent") {
      result.agent = argv[i + 1] || result.agent
      i += 1
      continue
    }
    if (arg.startsWith("--agent=")) {
      result.agent = arg.slice("--agent=".length)
      continue
    }
    if (arg === "--human") result.format = "human"
    if (arg === "--json") result.format = "json"
  }
  result.agent = String(result.agent || "codex").trim().toLowerCase()
  return result
}

function mcpServerConfig() {
  const env = {
    YUNTI_BROWSER_BRIDGE_PORT: bridgePort,
  }
  if (bridgeTokenConfigured) {
    env.YUNTI_BROWSER_BRIDGE_TOKEN = "<set the same local bridge token>"
  }
  return {
    command: "node",
    args: [mcpServerPath],
    env,
  }
}

function agentConfig(agent) {
  const server = mcpServerConfig()
  switch (agent) {
    case "codex":
    case "claude-code":
    case "cursor":
    case "cline":
      return {
        mcpServers: {
          "yunti-browser-runtime": server,
        },
      }
    default:
      return {
        mcpServers: {
          "yunti-browser-runtime": server,
        },
      }
  }
}

function buildConfig(agent) {
  const skillInstallCommand =
    agent === "codex"
      ? `mkdir -p ~/.codex/skills && cp -R "${skillPath}" ~/.codex/skills/`
      : null
  return {
    ok: supportedAgents.includes(agent),
    agent,
    supportedAgents,
    projectRoot: rootDir,
    mcpServerPath,
    bridge: {
      port: bridgePort,
      tokenEnv: "YUNTI_BROWSER_BRIDGE_TOKEN",
      tokenConfigured: bridgeTokenConfigured,
      tokenInstruction: bridgeTokenConfigured
        ? "Token is configured in the current environment; copy the same secret into your agent and extension settings without committing it."
        : "Local loopback bridge auth is disabled by default; set YUNTI_BROWSER_BRIDGE_TOKEN only when you want to require a local token.",
    },
    skill: {
      sourcePath: skillPath,
      installCommand: skillInstallCommand,
      installHint: skillInstallCommand
        ? "Run installCommand, then start a new agent session so the updated skill is loaded."
        : "Copy sourcePath into this agent's skills directory if it supports SKILL.md packages; otherwise add SKILL.md to the agent's project or system instructions.",
    },
    config: agentConfig(agent),
  }
}

function humanOutput(payload) {
  return [
    `Yunti Browser Runtime MCP config for ${payload.agent}`,
    "",
    JSON.stringify(payload.config, null, 2),
    "",
    `Project root: ${payload.projectRoot}`,
    `MCP server: ${payload.mcpServerPath}`,
    `Bridge port: ${payload.bridge.port} (started automatically by the MCP server)`,
    `Token: ${payload.bridge.tokenInstruction}`,
    `Skill source: ${payload.skill.sourcePath}`,
    payload.skill.installCommand
      ? `Skill install: ${payload.skill.installCommand}`
      : `Skill install: ${payload.skill.installHint}`,
    payload.ok ? "" : `Unsupported agent "${payload.agent}". Supported: ${payload.supportedAgents.join(", ")}`,
  ]
    .filter((line, index, lines) => line || lines[index - 1] !== "")
    .join("\n")
}

const args = parseArgs(process.argv.slice(2))
const payload = buildConfig(args.agent)

if (args.format === "human") {
  console.log(humanOutput(payload))
} else {
  console.log(JSON.stringify(payload, null, 2))
}

if (!payload.ok) process.exitCode = 1
