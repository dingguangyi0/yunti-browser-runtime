import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import test from "node:test"

const execFileAsync = promisify(execFile)
const cliPath = join(process.cwd(), "bin", "yunti-browser-runtime.js")

async function runCli(args, env = {}) {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      maxBuffer: 1024 * 1024,
    })
    return { ...result, code: 0 }
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      code: error.code,
    }
  }
}

test("CLI help exposes setup and status commands", async () => {
  const result = await runCli(["--help"])
  assert.equal(result.code, 0)
  assert.match(result.stdout, /status\s+Show compact runtime/)
  assert.match(result.stdout, /setup\s+Install the packaged skill/)
})

test("status returns a compact state without raw browser payloads", async () => {
  const result = await runCli(["status", "--json"])
  assert.equal(result.code, 0)
  const payload = JSON.parse(result.stdout)
  assert.match(
    payload.state,
    /^(page_ready|controller_online|runtime_ready|bridge_offline|bridge_unauthorized|version_mismatch|needs_setup)$/
  )
  assert.equal(typeof payload.runtime.version, "string")
  assert.equal(typeof payload.bridge.reachable, "boolean")
  assert.equal(typeof payload.browser.controllerConnected, "boolean")
  assert.equal("raw" in payload, false)
})

test("setup check-only does not write the Codex skill", async () => {
  const home = await mkdtemp(join(tmpdir(), "yunti-setup-check-"))
  try {
    const result = await runCli(
      ["setup", "--agent", "codex", "--check-only", "--install-skill", "--json"],
      { HOME: home }
    )
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout)
    assert.equal(payload.checkOnly, true)
    assert.equal(payload.skill.state, "missing")
    await assert.rejects(readFile(join(home, ".codex", "skills", "yunti-browser-runtime", "SKILL.md")))
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test("setup refuses to overwrite a differing Codex skill unless forced", async () => {
  const home = await mkdtemp(join(tmpdir(), "yunti-setup-conflict-"))
  const skillFile = join(home, ".codex", "skills", "yunti-browser-runtime", "SKILL.md")
  try {
    await runCli(["setup", "--agent", "codex", "--json"], { HOME: home })
    const customSkill = `${await readFile(skillFile, "utf8")}\ncustom local instruction\n`
    await writeFile(skillFile, customSkill)

    const refused = await runCli(["setup", "--agent", "codex", "--json"], { HOME: home })
    assert.equal(refused.code, 1)
    assert.equal(JSON.parse(refused.stdout).skill.conflict, true)
    assert.equal(await readFile(skillFile, "utf8"), customSkill)

    const forced = await runCli(["setup", "--agent", "codex", "--force", "--json"], { HOME: home })
    assert.equal(forced.code, 0)
    assert.equal(JSON.parse(forced.stdout).skill.changed, true)
    assert.doesNotMatch(await readFile(skillFile, "utf8"), /custom local instruction/)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test("setup installs the Codex skill idempotently", async () => {
  const home = await mkdtemp(join(tmpdir(), "yunti-setup-install-"))
  try {
    const first = await runCli(["setup", "--agent", "codex", "--json"], { HOME: home })
    assert.equal(first.code, 0)
    const firstPayload = JSON.parse(first.stdout)
    assert.equal(firstPayload.skill.changed, true)

    const second = await runCli(["setup", "--agent", "codex", "--json"], { HOME: home })
    assert.equal(second.code, 0)
    const secondPayload = JSON.parse(second.stdout)
    assert.equal(secondPayload.skill.state, "current")
    assert.equal(secondPayload.skill.changed, false)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test("setup keeps non-Codex skill destinations explicit", async () => {
  const result = await runCli(["setup", "--agent", "claude-code", "--json", "--no-skill"])
  assert.equal(result.code, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.skill.state, "manual")
  assert.equal(payload.skill.target, null)
})
