#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const coveragePath = join(rootDir, "docs", "ACTION_RESULT_COVERAGE.md")
const text = readFileSync(coveragePath, "utf8")

const requiredRows = {
  yunti_click: {
    success: ["uid", "coordinate", "selector"],
    failure: ["stale uid", "missing uid"],
    compatibility: ["clicked", "browserSessionId"],
  },
  yunti_hover: {
    success: ["uid", "coordinate", "selector"],
    failure: ["stale uid", "missing uid"],
    compatibility: ["hovered", "browserSessionId"],
  },
  yunti_fill: {
    success: ["uid keyboard", "uid select", "uid contenteditable", "selector"],
    failure: ["non-editable", "disabled", "readonly", "value not applied"],
    compatibility: ["filled", "browserSessionId"],
  },
  yunti_select: {
    success: ["selector value", "uid value", "uid text"],
    failure: ["option miss", "disabled option", "non-select target"],
    compatibility: ["selected", "browserSessionId"],
  },
  yunti_fill_form: {
    success: ["aggregate success", "partial failure"],
    failure: ["per-field"],
    compatibility: ["filled", "failed", "results"],
  },
  yunti_wait_for: {
    success: ["text", "selector", "urlContains"],
    failure: ["timeout"],
    compatibility: ["found", "waitedMs", "browserSessionId"],
  },
  yunti_scroll: {
    success: ["document", "uid container", "coordinate container"],
    failure: ["uid missing", "no movement", "partial movement"],
    compatibility: ["scrolled", "before", "after"],
  },
  yunti_type_text: {
    success: ["uid", "selector"],
    failure: ["stale uid", "missing uid"],
    compatibility: ["typed", "browserSessionId"],
  },
  yunti_press_key: {
    success: ["uid", "selector"],
    failure: ["stale uid", "missing uid"],
    compatibility: ["pressed", "browserSessionId"],
  },
  yunti_upload_file: {
    success: ["uid", "selector"],
    failure: ["stale uid", "missing uid"],
    compatibility: ["uploaded", "fileCount", "browserSessionId"],
  },
  yunti_drag: {
    success: ["coordinate"],
    failure: ["coordinate argument validation"],
    compatibility: ["dragged", "browserSessionId"],
  },
}

function normalize(value) {
  return String(value || "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseMatrixRows(markdown) {
  const rows = new Map()
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("| `yunti_")) continue
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => normalize(cell))
    if (cells.length < 5) continue
    rows.set(cells[0], {
      tool: cells[0],
      success: cells[1],
      failure: cells[2],
      compatibility: cells[3],
      remaining: cells[4],
    })
  }
  return rows
}

function includesAll(value, terms) {
  const haystack = normalize(value).toLowerCase()
  return terms.filter((term) => !haystack.includes(term.toLowerCase()))
}

const rows = parseMatrixRows(text)
const errors = []

for (const [tool, expectation] of Object.entries(requiredRows)) {
  const row = rows.get(tool)
  if (!row) {
    errors.push(`missing coverage row for ${tool}`)
    continue
  }

  for (const [column, terms] of Object.entries(expectation)) {
    const missing = includesAll(row[column], terms)
    if (missing.length) {
      errors.push(`${tool} ${column} column missing: ${missing.join(", ")}`)
    }
  }

  for (const [column, value] of Object.entries(row)) {
    if (column === "tool") continue
    if (!value || /\b(TBD|TODO|unknown)\b/i.test(value)) {
      errors.push(`${tool} ${column} column is incomplete: ${value || "(empty)"}`)
    }
  }
}

const requiredSnippets = [
  "Last audited phase: P6.2.7",
  "npm run check:action-results",
  "npm run release:check",
  "Real browser closure: Pending",
  "YUNTI_E2E=1 npm run test:e2e",
]

for (const snippet of requiredSnippets) {
  if (!text.includes(snippet)) {
    errors.push(`coverage gate missing snippet: ${snippet}`)
  }
}

if (errors.length) {
  console.error("Action result coverage check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.error(`Action result coverage check passed (${rows.size} rows).`)
