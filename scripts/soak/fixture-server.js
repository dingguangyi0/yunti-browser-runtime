import http from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const soakFixtureRoot = resolve(
  fileURLToPath(new URL("./fixtures/", import.meta.url))
)

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

export async function startSoakFixtureServer() {
  const acceptedWriteKeys = new Set()
  let duplicateWriteAttempts = 0
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1")
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204)
        response.end()
        return
      }
      if (url.pathname === "/api/queue") {
        const cycle = Number(url.searchParams.get("cycle") || 0)
        const load = Number(url.searchParams.get("load") || 0)
        sendJson(response, 200, {
          items: Array.from({ length: 12 }, (_, index) => ({
            id: `SOAK-${cycle}-${index + 1}`,
            status: index % 3 === 0 ? "waiting" : index % 3 === 1 ? "running" : "complete",
            owner: `operator-${(index + cycle) % 5}`,
            value: cycle * 100 + load * 10 + index,
          })),
        })
        return
      }
      if (url.pathname === "/api/save" && request.method === "POST") {
        const body = await readRequestBody(request)
        const payload = JSON.parse(body || "{}")
        const key = String(payload.key || "")
        const duplicate = acceptedWriteKeys.has(key)
        if (duplicate) duplicateWriteAttempts += 1
        if (key) acceptedWriteKeys.add(key)
        sendJson(response, 200, {
          accepted: duplicate ? 0 : 1,
          duplicate,
          key,
          totalAccepted: acceptedWriteKeys.size,
        })
        return
      }
      if (url.pathname === "/api/state") {
        sendJson(response, 200, {
          ok: true,
          acceptedWriteCount: acceptedWriteKeys.size,
          acceptedWriteKeys: [...acceptedWriteKeys],
          duplicateWriteAttempts,
        })
        return
      }

      const pathname = url.pathname === "/" ? "/complex-app.html" : url.pathname
      const filePath = resolve(join(soakFixtureRoot, pathname.replace(/^\/+/u, "")))
      if (!filePath.startsWith(soakFixtureRoot)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" })
        response.end("Forbidden")
        return
      }
      const body = await readFile(filePath)
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      })
      response.end(body)
    } catch (error) {
      if (error?.code === "ENOENT") {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
        response.end("Not found")
        return
      }
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
      response.end(error?.stack || String(error))
    }
  })

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise))
  const port = server.address().port
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    url(pathname = "/complex-app.html") {
      return `http://127.0.0.1:${port}${pathname}`
    },
    async state() {
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)
      return response.json()
    },
    close() {
      return new Promise((resolvePromise) => server.close(resolvePromise))
    },
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(value))
}

function readRequestBody(request) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    let size = 0
    request.on("data", (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error("request body exceeds 1 MB"))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")))
    request.on("error", reject)
  })
}
