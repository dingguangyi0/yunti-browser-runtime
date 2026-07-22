import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { TOOLS } from "../mcp/tools.js"
import {
  DEFAULT_SOAK_DURATION_MS,
  MIN_QUALIFYING_SOAK_DURATION_MS,
  SOAK_EXPECTED_TOOLS,
  SOAK_TOOL_PHASES,
  summarizeSoakCoverage,
} from "../scripts/soak/plan.js"

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)))

test("soak acceptance defaults to at least 15 minutes", () => {
  assert.equal(MIN_QUALIFYING_SOAK_DURATION_MS, 15 * 60 * 1000)
  assert.ok(DEFAULT_SOAK_DURATION_MS >= MIN_QUALIFYING_SOAK_DURATION_MS)
})

test("soak coverage contract includes every published MCP tool exactly once", () => {
  const available = TOOLS.map((tool) => tool.name).sort()
  const planned = [...SOAK_EXPECTED_TOOLS].sort()
  assert.equal(new Set(planned).size, planned.length)
  assert.deepEqual(planned, available)
  assert.deepEqual(summarizeSoakCoverage(planned, available), {
    expectedCount: available.length,
    coveredCount: available.length,
    covered: available,
    missing: [],
    unexpected: [],
    complete: true,
  })
})

test("soak plan separates discovery, interaction, lifecycle, diagnostics, and reversible state", () => {
  assert.deepEqual(Object.keys(SOAK_TOOL_PHASES), [
    "discovery",
    "interaction",
    "pageLifecycle",
    "diagnostics",
    "reversibleState",
  ])
  for (const tools of Object.values(SOAK_TOOL_PHASES)) assert.ok(tools.length >= 5)
})

test("soak fixture contains complex interaction surfaces", async () => {
  const html = await readFile(join(rootDir, "scripts", "soak", "fixtures", "complex-app.html"), "utf8")
  for (const expected of [
    "case-form",
    "queue-body",
    "scroll-panel",
    "drag-card",
    "drop-zone",
    "shadow-host",
    "child-frame",
    "upload",
    "prompt-action",
  ]) {
    assert.match(html, new RegExp(`id=["']${expected}["']`))
  }
})

test("extension network diagnostics cover both HTTP intranets and HTTPS pages", async () => {
  const source = await readFile(join(rootDir, "extension", "network-monitor.js"), "utf8")
  assert.match(source, /"http:\/\/\*\/\*"/)
  assert.match(source, /"https:\/\/\*\/\*"/)
})

test("soak runner retains repeated screenshots and enforces tail latency budgets", async () => {
  const source = await readFile(join(rootDir, "scripts", "soak-test.js"), "utf8")
  assert.match(source, /SCREENSHOT_EVERY_CYCLES = 10/)
  assert.match(source, /MAX_P95_CALL_DURATION_MS = 500/)
  assert.match(source, /MAX_CALL_DURATION_MS = 10000/)
  assert.match(source, /slowestCalls/)
  assert.match(source, /perTool/)
})
