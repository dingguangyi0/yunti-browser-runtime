const SENSITIVE_KEY_RE =
  /cookie|authorization|token|secret|password|passwd|pwd|sid|session|ticket|tgc|captcha|验证码|密码/i
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
const LONG_RANDOM_RE = /\b[A-Za-z0-9_-]{32,}\b/g
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g
const PAYMENT_CARD_RE = /(?:^|[^\d])((?:\d[ -]?){13,19})(?=$|[^\d])/g
const ADDRESS_RE =
  /\b\d{1,6}\s+[\p{L}0-9 .'-]{2,}\s+(street|st|road|rd|avenue|ave|lane|ln|boulevard|blvd|drive|dr|way|court|ct)\b|[\p{Script=Han}]{1,20}(省|市|区|县|路|街|号楼|单元|室)/giu

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
  return redactLikelySensitiveText(text, 1500)
}

export function redactLikelySensitiveText(text, max = 1500) {
  const redacted = truncateText(text, max)
    .replace(PRIVATE_KEY_RE, "[REDACTED_PRIVATE_KEY]")
    .replace(JWT_RE, "[REDACTED_JWT]")
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(
      /(cookie|authorization|token|secret|password|passwd|pwd|sid|session|ticket|tgc|captcha|api[-_]?key)(["'\s:=]+)([^"',\s}&]+)/gi,
      "$1$2[REDACTED]"
    )
    .replace(LONG_RANDOM_RE, "[REDACTED_TOKEN]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(PAYMENT_CARD_RE, (match, digitsPart) => {
      const digits = String(digitsPart || "").replace(/\D/g, "")
      if (!isPaymentCardLike(digits)) return match
      return match.replace(digitsPart, "[REDACTED_PAYMENT_CARD]")
    })
    .replace(PHONE_RE, "[REDACTED_PHONE]")
    .replace(ADDRESS_RE, "[REDACTED_ADDRESS]")
  return redacted.replace(
    /\b(authorization|cookie|token|secret|password|passwd|pwd|sid|session|ticket|tgc|captcha|api[-_]?key)(["'\s:=]+)\[REDACTED\](?:\s+\[REDACTED(?:_[A-Z]+)?\])+/gi,
    "$1$2[REDACTED]"
  )
}

function isPaymentCardLike(digits) {
  return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)
}

function passesLuhn(digits) {
  let sum = 0
  let shouldDouble = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
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
  if (typeof body.preview === "string") out.preview = redactLikelySensitiveText(body.preview)
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
