#!/usr/bin/env node
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const command = process.argv[2] || "mcp"
const passThroughArgs = process.argv.slice(3)

const commands = {
  mcp: {
    script: join(rootDir, "mcp", "server.js"),
    env: {},
  },
  bridge: {
    script: join(rootDir, "mcp", "server.js"),
    env: { YUNTI_BROWSER_BRIDGE_ONLY: "1" },
  },
  console: {
    script: join(rootDir, "mcp", "server.js"),
    env: { YUNTI_BROWSER_BRIDGE_ONLY: "1" },
  },
  doctor: {
    script: join(rootDir, "scripts", "doctor.js"),
    env: {},
  },
  "print-config": {
    script: join(rootDir, "scripts", "print-config.js"),
    env: {},
  },
  "package-extension": {
    script: join(rootDir, "scripts", "package-extension.js"),
    env: {},
  },
  "soak-test": {
    script: join(rootDir, "scripts", "soak-test.js"),
    env: {},
  },
}

if (command === "--help" || command === "-h" || command === "help") {
  printHelp()
  process.exit(0)
}

if (command === "--version" || command === "-v") {
  const packageJson = await import("../package.json", { with: { type: "json" } })
  console.log(packageJson.default.version)
  process.exit(0)
}

const selected = commands[command]
if (!selected) {
  console.error(`Unknown command: ${command}`)
  printHelp()
  process.exit(1)
}

const child = spawn(process.execPath, [selected.script, ...passThroughArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...selected.env,
  },
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

function printHelp() {
  console.log(`Yunti Browser Runtime

Usage:
  yunti-browser-runtime [command] [args]

Commands:
  mcp                Start the stdio MCP server (default)
  bridge             Start only the local HTTP bridge
  console            Start the bridge and print the optional local console URL
  doctor             Run install and bridge diagnostics
  print-config       Print MCP configuration for an agent
  package-extension  Build the browser extension zip
  soak-test          Run the 15-minute full-tool browser endurance test

Examples:
  yunti-browser-runtime
  yunti-browser-runtime bridge
  yunti-browser-runtime console
  yunti-browser-runtime doctor
  yunti-browser-runtime print-config -- --agent codex --human
  yunti-browser-runtime package-extension`)
}
