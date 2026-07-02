#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import https from "node:https"
import packageJson from "../package.json" with { type: "json" }

const timeoutMs = Number(process.env.YUNTI_BROWSER_METADATA_CHECK_TIMEOUT_MS || 15000)

function normalizeRepositoryUrl(value) {
  return String(value || "")
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
}

function requestHead(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: "HEAD", timeout: timeoutMs }, (res) => {
      const location = res.headers.location
      if (
        location &&
        [301, 302, 303, 307, 308].includes(Number(res.statusCode))
      ) {
        resolve(requestHead(new URL(location, url).toString()))
        return
      }
      resolve({
        ok: Number(res.statusCode) >= 200 && Number(res.statusCode) < 400,
        status: Number(res.statusCode),
        url,
      })
    })
    req.on("timeout", () => {
      req.destroy(new Error("request timed out"))
    })
    req.on("error", (error) => {
      resolve({ ok: false, status: 0, url, error: error.message })
    })
    req.end()
  })
}

function npmViewPackage(name) {
  try {
    const version = execFileSync("npm", ["view", name, "version", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
    return {
      ok: true,
      published: true,
      version: JSON.parse(version || "null"),
    }
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}`
    if (output.includes("E404")) {
      return {
        ok: true,
        published: false,
        note: "Package is not currently published; this is acceptable for a first release if the name is intended.",
      }
    }
    return {
      ok: false,
      published: false,
      error: output.trim() || error.message,
    }
  }
}

const repositoryUrl = normalizeRepositoryUrl(packageJson.repository?.url)
const homepageUrl = String(packageJson.homepage || "").trim()
const bugsUrl = String(packageJson.bugs?.url || "").trim()

const checks = {
  repository: await requestHead(repositoryUrl),
  homepage: await requestHead(homepageUrl.replace(/#.*$/, "")),
  bugs: await requestHead(bugsUrl),
  npm: npmViewPackage(packageJson.name),
}

const ok = checks.repository.ok && checks.homepage.ok && checks.bugs.ok && checks.npm.ok
const report = {
  ok,
  checkedAt: new Date().toISOString(),
  package: {
    name: packageJson.name,
    version: packageJson.version,
    repository: packageJson.repository,
    homepage: packageJson.homepage,
    bugs: packageJson.bugs,
  },
  checks,
  nextSteps: ok
    ? []
    : [
        "Create or publicize the GitHub repository, or update repository/homepage/bugs in package.json to real public URLs.",
        "If this is the first npm release, npm E404 for the package name can be accepted.",
      ],
}

console.log(JSON.stringify(report, null, 2))
if (!ok) process.exitCode = 1
