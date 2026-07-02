#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import packageJson from "../package.json" with { type: "json" }

const registry = process.env.YUNTI_BROWSER_NPM_REGISTRY || "https://registry.npmjs.org/"

function normalizeRepositoryUrl(value) {
  const raw = typeof value === "string" ? value : value?.url
  return String(raw || "")
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
}

function cleanNpmError(output) {
  return String(output || "")
    .split("\n")
    .filter((line) => !line.includes("A complete log of this run can be found in:"))
    .join("\n")
    .trim()
}

function npmView(spec) {
  try {
    const output = execFileSync(
      "npm",
      ["view", spec, "--json", `--registry=${registry}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    ).trim()
    return {
      ok: true,
      data: JSON.parse(output || "{}"),
    }
  } catch (error) {
    const output = cleanNpmError(`${error.stdout || ""}\n${error.stderr || ""}`)
    return {
      ok: false,
      unpublished: output.includes("E404"),
      error: output || error.message,
    }
  }
}

const spec = `${packageJson.name}@${packageJson.version}`
const result = npmView(spec)
const data = result.data || {}

function comparePublishedValue(actual, expected) {
  if (!result.ok) {
    return {
      ok: false,
      skipped: true,
      reason: "package version is not published",
      expected,
    }
  }
  return {
    ok: actual === expected,
    expected,
    actual,
  }
}

const checks = {
  published: {
    ok: result.ok,
    registry,
    spec,
    unpublished: result.unpublished || undefined,
    error: result.ok ? undefined : result.error,
  },
  name: comparePublishedValue(data.name, packageJson.name),
  version: comparePublishedValue(data.version, packageJson.version),
  repository: comparePublishedValue(
    normalizeRepositoryUrl(data.repository),
    normalizeRepositoryUrl(packageJson.repository)
  ),
  homepage: comparePublishedValue(data.homepage, packageJson.homepage),
  bugs: comparePublishedValue(data.bugs?.url, packageJson.bugs?.url),
  tarball: result.ok
    ? {
        ok: typeof data.dist?.tarball === "string" && data.dist.tarball.includes(`${packageJson.name}-`),
        actual: data.dist?.tarball,
      }
    : {
        ok: false,
        skipped: true,
        reason: "package version is not published",
      },
}

const ok = Object.values(checks).every((check) => check.ok)
const report = {
  ok,
  checkedAt: new Date().toISOString(),
  package: {
    name: packageJson.name,
    version: packageJson.version,
  },
  checks,
  nextSteps: ok
    ? []
    : [
        "Publish the package with npm run release:publish, or wait for the npm registry to reflect the just-published version.",
        "If metadata differs, update package.json before publishing a follow-up version.",
      ],
}

console.log(JSON.stringify(report, null, 2))
if (!ok) process.exitCode = 1
