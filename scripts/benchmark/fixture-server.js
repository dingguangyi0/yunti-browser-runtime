import http from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const fixtureRoot = resolve(fileURLToPath(new URL("../../tests/fixtures/benchmark/", import.meta.url)))

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

function resolveFixturePath(pathname = "/") {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname.endsWith("/") ? pathname + "index.html" : pathname
  const unsafe = normalizedPath.replace(/^\/+/u, "")
  const absolutePath = resolve(join(fixtureRoot, unsafe))
  if (!absolutePath.startsWith(fixtureRoot)) return null
  return absolutePath
}

function renderIndex() {
  return [
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <title>Yunti Benchmark Fixtures</title>",
    "  </head>",
    "  <body>",
    "    <h1>Yunti Benchmark Fixtures</h1>",
    "    <ul>",
    "      <li><a href=\"/form-controls.html\">form-controls.html</a></li>",
    "      <li><a href=\"/async-ui.html\">async-ui.html</a></li>",
    "      <li><a href=\"/nested-scroll.html\">nested-scroll.html</a></li>",
    "      <li><a href=\"/tab-opener.html\">tab-opener.html</a></li>",
    "      <li><a href=\"/rerender.html\">rerender.html</a></li>",
    "      <li><a href=\"/iframe-host.html\">iframe-host.html</a></li>",
    "      <li><a href=\"/shadow-root.html\">shadow-root.html</a></li>",
    "      <li><a href=\"/upload-download.html\">upload-download.html</a></li>",
    "      <li><a href=\"/guarded-submit.html\">guarded-submit.html</a></li>",
    "      <li><a href=\"/download.txt\">download.txt</a></li>",
    "    </ul>",
    "  </body>",
    "</html>",
  ].join("\n")
}

export async function startBenchmarkFixtureServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1")
      if (url.pathname === "/favicon.ico") {
        res.writeHead(204)
        res.end()
        return
      }

      if (url.pathname === "/download.txt") {
        res.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": "attachment; filename=\"download.txt\"",
        })
        res.end("Yunti benchmark download payload\n")
        return
      }

      if (url.pathname === "/api/diagnostic-failure") {
        res.writeHead(503, { "content-type": "application/json; charset=utf-8" })
        res.end(JSON.stringify({ ok: false, error: "benchmark diagnostic failure" }))
        return
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        res.end(renderIndex())
        return
      }

      const filePath = resolveFixturePath(normalize(url.pathname))
      if (!filePath) {
        res.writeHead(403, { "content-type": "text/plain; charset=utf-8" })
        res.end("Forbidden")
        return
      }

      const body = await readFile(filePath)
      const extension = extname(filePath)
      res.writeHead(200, { "content-type": contentTypes[extension] || "application/octet-stream" })
      res.end(body)
    } catch (error) {
      if (error?.code === "ENOENT") {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
        res.end("Not found")
        return
      }
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
      res.end(error?.stack || String(error))
    }
  })

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise))
  const port = server.address().port
  return {
    fixtureRoot,
    port,
    server,
    baseUrl: "http://127.0.0.1:" + port,
    url(pathname = "/") {
      return "http://127.0.0.1:" + port + pathname
    },
    close() {
      return new Promise((resolvePromise) => server.close(resolvePromise))
    },
  }
}
