import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { benchmarkScenarios, summarizeBenchmarkScenarios } from "../scripts/benchmark/manifest.js"
import { startBenchmarkFixtureServer } from "../scripts/benchmark/fixture-server.js"

test("benchmark manifest defines at least 30 scenarios with unique ids", () => {
  assert.ok(benchmarkScenarios.length >= 30)
  const ids = new Set(benchmarkScenarios.map((scenario) => scenario.id))
  assert.equal(ids.size, benchmarkScenarios.length)
})

test("benchmark manifest marks guarded-write scenarios with repeat count 20", () => {
  const guardedWrites = benchmarkScenarios.filter((scenario) => scenario.guardedWrite)
  assert.ok(guardedWrites.length >= 4)
  for (const scenario of guardedWrites) assert.equal(scenario.repeatCount, 20)
})

test("benchmark manifest exposes a complete 38-scenario suite", () => {
  const summary = summarizeBenchmarkScenarios()
  assert.equal(summary.total, 38)
  assert.equal(summary.implemented, 38)
  assert.equal(summary.planned, 0)
  assert.ok(summary.categories.includes("core-form"))
  for (const scenario of benchmarkScenarios) {
    assert.ok(Array.isArray(scenario.primaryTools) && scenario.primaryTools.length >= 1)
  }
})

test("benchmark runner covers every manifest scenario and reports metric version 2", async () => {
  const source = await readFile(new URL("../scripts/benchmark-baseline.js", import.meta.url), "utf8")
  for (const scenario of benchmarkScenarios) {
    assert.match(source, new RegExp(`\\n  async ${scenario.id}\\(`), `missing runner for ${scenario.id}`)
  }
  for (const field of [
    "metricVersion: 2",
    "p95AttemptDurationMs",
    "p95ToolCallDurationMs",
    "p95ScenarioDurationMs",
  ]) {
    assert.match(source, new RegExp(field))
  }
})

test("benchmark fixture server serves index, html fixtures, and download payload", async () => {
  const server = await startBenchmarkFixtureServer()
  try {
    const index = await fetch(server.url("/"))
    const html = await index.text()
    assert.equal(index.status, 200)
    assert.match(html, /Yunti Benchmark Fixtures/)
    const formControls = await fetch(server.url("/form-controls.html"))
    const formHtml = await formControls.text()
    assert.equal(formControls.status, 200)
    assert.match(formHtml, /Form Controls/)
    assert.match(formHtml, /Save form/)
    const download = await fetch(server.url("/download.txt"))
    const text = await download.text()
    assert.equal(download.status, 200)
    assert.match(text, /benchmark download payload/)
  } finally {
    await server.close()
  }
})
