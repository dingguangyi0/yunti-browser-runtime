#!/usr/bin/env node
import { cp, access, mkdir, readFile, rm } from "node:fs/promises"
import { constants } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import packageJson from "../package.json" with { type: "json" }

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceSkillDir = join(rootDir, "skills", "yunti-browser-runtime")
const printConfigPath = join(rootDir, "scripts", "print-config.js")
const supportedAgents = ["codex", "claude-code", "cursor", "cline"]

function parseArgs(argv) {
  const result = { agent: "codex", format: "human", installSkill: true, force: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--agent") {
      result.agent = argv[i + 1] || result.agent
      i += 1
    } else if (arg.startsWith("--agent=")) result.agent = arg.slice(8)
    else if (arg === "--json") result.format = "json"
    else if (arg === "--human") result.format = "human"
    else if (arg === "--no-skill") result.installSkill = false
    else if (arg === "--install-skill") result.installSkill = true
    else if (arg === "--force") result.force = true
    else if (arg === "--check-only") {
      result.installSkill = false
      result.checkOnly = true
    } else if (arg === "--help" || arg === "-h") result.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  result.agent = String(result.agent || "codex").trim().toLowerCase()
  if (result.checkOnly) result.installSkill = false
  return result
}

function runPrintConfig(agent) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [printConfigPath, "--agent", agent, "--json"], {
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
    child.on("close", (code) => {
      try {
        resolvePromise({ config: JSON.parse(stdout), exitCode: code ?? 0, stderr })
      } catch (error) {
        reject(new Error(`print-config returned invalid JSON: ${error.message}`))
      }
    })
  })
}

function skillTarget(agent) {
  if (agent === "codex") return join(homedir(), ".codex", "skills", "yunti-browser-runtime")
  return null
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function skillState(target) {
  if (!target) return { state: "manual", target: null }
  const sourceFile = join(sourceSkillDir, "SKILL.md")
  const targetFile = join(target, "SKILL.md")
  if (!(await fileExists(targetFile))) return { state: "missing", target }
  const [source, installed] = await Promise.all([readFile(sourceFile, "utf8"), readFile(targetFile, "utf8")])
  return { state: source === installed ? "current" : "outdated", target }
}

async function installSkill(target, force) {
  const current = await skillState(target)
  if (current.state === "current") return { ...current, changed: false }
  if (current.state === "outdated" && !force) {
    return {
      ...current,
      changed: false,
      conflict: true,
      message: "An existing skill differs from the packaged skill; rerun with --force to replace it.",
    }
  }
  await mkdir(dirname(target), { recursive: true })
  if (current.state === "outdated" && force) await rm(target, { recursive: true, force: true })
  await cp(sourceSkillDir, target, { recursive: true, force: false, errorOnExist: false })
  return { state: "current", target, changed: true }
}

function humanOutput(payload) {
  const lines = [
    `Yunti Browser Runtime setup for ${payload.agent}`,
    `- Runtime: ${packageJson.version}`,
    `- MCP config: ${payload.config.config?.ok ? "ready to add" : "unsupported agent"}`,
    `- Skill: ${payload.skill.state}${payload.skill.target ? ` at ${payload.skill.target}` : " (follow the printed source path)"}`,
  ]
  if (payload.skill.changed) lines.push("- Skill action: installed")
  if (payload.skill.conflict) lines.push(`- Skill action: not changed (${payload.skill.message})`)
  lines.push("", JSON.stringify(payload.config.config, null, 2))
  lines.push("", `Extension directory: ${payload.extensionDir}`)
  lines.push("Browser extension installation still requires Chrome Web Store/Edge Add-ons or one browser-side Load unpacked confirmation.")
  if (payload.config.config.skill?.installHint) lines.push(`Skill note: ${payload.config.config.skill.installHint}`)
  return lines.join("\n")
}

function printHelp() {
  console.log(`Yunti Browser Runtime setup

Usage:
  yunti-browser-runtime setup [--agent codex] [--json|--human]
  yunti-browser-runtime setup --agent codex --check-only
  yunti-browser-runtime setup --agent codex --force

The command is idempotent. Codex skill installation is enabled by default;
use --no-skill or --check-only to make it read-only. Existing differing skills
are never overwritten unless --force is explicit. MCP config is printed but
not written into private Agent settings.`)
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }
  if (!supportedAgents.includes(args.agent)) {
    throw new Error(`Unsupported agent "${args.agent}". Supported: ${supportedAgents.join(", ")}`)
  }
  const config = await runPrintConfig(args.agent)
  const target = skillTarget(args.agent)
  const before = await skillState(target)
  const skill = args.installSkill && target ? await installSkill(target, args.force) : before
  const payload = {
    ok: config.config.ok && !skill.conflict,
    agent: args.agent,
    packageVersion: packageJson.version,
    checkOnly: Boolean(args.checkOnly),
    config,
    skill,
    extensionDir: join(rootDir, "extension"),
    nextSteps: [
      "Add the printed MCP server block to the current Agent, then start a new Agent session.",
      "Install the extension from Chrome Web Store/Edge Add-ons, or load the printed extension directory once in the browser.",
      "Run yunti-browser-runtime status after the Agent starts the MCP server.",
    ],
  }
  if (args.format === "json") console.log(JSON.stringify(payload, null, 2))
  else console.log(humanOutput(payload))
  if (!payload.ok) process.exitCode = 1
} catch (error) {
  console.error(`Setup failed: ${error.message}`)
  process.exitCode = 1
}
