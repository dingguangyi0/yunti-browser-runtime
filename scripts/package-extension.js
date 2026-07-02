#!/usr/bin/env node
import { mkdir, rm } from "node:fs/promises"
import { createWriteStream } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import packageJson from "../package.json" with { type: "json" }

const execFileAsync = promisify(execFile)
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const extensionDir = join(rootDir, "extension")
const distDir = join(rootDir, "dist")
const version = packageJson.version || "0.0.0"
const zipName = `yunti-browser-runtime-extension-${version}.zip`
const zipPath = join(distDir, zipName)
const allowedFiles = [
  "background.js",
  "cdp.js",
  "content.css",
  "dom-observer.js",
  "content.js",
  "network-monitor.js",
  "manifest.json",
  "popup.css",
  "popup.html",
  "popup.js",
  "session-manager.js",
  "settings.js",
  "tool-handlers.js",
]

async function zipWithSystemZip() {
  await execFileAsync("zip", ["-X", "-q", zipPath, ...allowedFiles], {
    cwd: extensionDir,
  })
}

async function writeMinimalZip() {
  const chunks = []
  const central = []
  let offset = 0

  for (const name of allowedFiles) {
    const data = await import("node:fs/promises").then((fs) =>
      fs.readFile(join(extensionDir, name))
    )
    const nameBytes = Buffer.from(name)
    const crc = crc32(data)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(nameBytes.length, 26)
    localHeader.writeUInt16LE(0, 28)
    chunks.push(localHeader, nameBytes, data)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(data.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    central.push(centralHeader, nameBytes)
    offset += localHeader.length + nameBytes.length + data.length
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(allowedFiles.length, 8)
  end.writeUInt16LE(allowedFiles.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  await new Promise((resolvePromise, reject) => {
    const stream = createWriteStream(zipPath)
    stream.on("error", reject)
    stream.on("finish", resolvePromise)
    for (const chunk of [...chunks, ...central, end]) stream.write(chunk)
    stream.end()
  })
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

await mkdir(distDir, { recursive: true })
await rm(zipPath, { force: true })

try {
  await zipWithSystemZip()
} catch {
  await writeMinimalZip()
}

const { stat, readFile } = await import("node:fs/promises")
const data = await readFile(zipPath)
const info = {
  ok: true,
  zipPath,
  version,
  files: allowedFiles,
  sizeBytes: (await stat(zipPath)).size,
  sha256: createHash("sha256").update(data).digest("hex"),
}

console.log(JSON.stringify(info, null, 2))
