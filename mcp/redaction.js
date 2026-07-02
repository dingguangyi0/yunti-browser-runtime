const SENSITIVE_KEY_RE =
  /cookie|authorization|token|secret|password|passwd|pwd|sid|session|ticket|tgc|captcha|验证码|密码/i

export function clampNumber(value, min, max, fallback = min) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

export function truncateText(value, max = 1000) {
  return String(value ?? "").slice(0, max)
}

export function redactValue(key, value) {
  if (SENSITIVE_KEY_RE.test(String(key))) return "[REDACTED]"
  return truncateText(value, 500)
}

export function redactLikelySecrets(text) {
  return truncateText(text, 1500).replace(
    /(cookie|authorization|token|secret|password|passwd|pwd|sid|session|ticket|tgc|captcha)(["'\s:=]+)([^"',\s}&]+)/gi,
    "$1$2[REDACTED]"
  )
}

export function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""))
    for (const key of [...url.searchParams.keys()]) {
      const values = url.searchParams.getAll(key)
      url.searchParams.delete(key)
      for (const value of values) url.searchParams.append(key, redactValue(key, value))
    }
    return url.toString()
  } catch {
    return truncateText(rawUrl, 1000)
  }
}

export function sanitizeRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const out = {}
  if (typeof body.kind === "string") out.kind = truncateText(body.kind, 80)
  if (Array.isArray(body.fieldNames)) {
    out.fieldNames = body.fieldNames.map((x) => truncateText(x, 120)).filter(Boolean)
  }
  if (body.formData && typeof body.formData === "object" && !Array.isArray(body.formData)) {
    out.formData = {}
    for (const [key, value] of Object.entries(body.formData)) {
      out.formData[truncateText(key, 120)] = redactValue(key, value)
    }
  }
  if (Number.isFinite(Number(body.rawBytes))) out.rawBytes = Number(body.rawBytes)
  if (typeof body.preview === "string") out.preview = redactLikelySecrets(body.preview)
  return Object.keys(out).length ? out : null
}

export function sanitizeNetworkEvent(input, id) {
  return {
    id,
    browserSessionId: truncateText(input.browserSessionId, 160),
    tabId: Number.isFinite(Number(input.tabId)) ? Number(input.tabId) : null,
    requestId: truncateText(input.requestId, 160),
    url: sanitizeUrl(input.url),
    method: truncateText(input.method || "GET", 20).toUpperCase(),
    type: truncateText(input.type, 80),
    initiator: truncateText(input.initiator, 300),
    documentUrl: input.documentUrl ? sanitizeUrl(input.documentUrl) : "",
    statusCode: Number.isFinite(Number(input.statusCode)) ? Number(input.statusCode) : null,
    ok: typeof input.ok === "boolean" ? input.ok : null,
    fromCache: typeof input.fromCache === "boolean" ? input.fromCache : null,
    error: input.error ? truncateText(input.error, 500) : "",
    startedAt: truncateText(input.startedAt, 80),
    completedAt: truncateText(input.completedAt, 80),
    durationMs: Number.isFinite(Number(input.durationMs)) ? Math.round(Number(input.durationMs)) : null,
    requestBody: sanitizeRequestBody(input.requestBody),
    capturedBy: "extension.webRequest",
  }
}

export function normalizeCdpEvent(input, id) {
  return {
    id,
    browserSessionId: truncateText(input.browserSessionId, 160),
    tabId: Number.isFinite(Number(input.tabId)) ? Number(input.tabId) : null,
    method: truncateText(input.method, 200),
    params:
      input.params && typeof input.params === "object" && !Array.isArray(input.params)
        ? input.params
        : {},
    receivedAt: truncateText(input.receivedAt || new Date().toISOString(), 80),
    capturedBy: "extension.chrome.debugger",
  }
}
