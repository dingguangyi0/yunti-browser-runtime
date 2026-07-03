;(function installYuntiDomObserver(globalScope) {
  const DEFAULT_MAX_ELEMENTS = 200
  const DEFAULT_MAX_TEXT_LENGTH = 12000
  const MAX_ELEMENTS = 500
  const MAX_TEXT_LENGTH = 60000
  const INTERACTIVE_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    "[contenteditable='']",
    "[role='button']",
    "[role='link']",
    "[role='textbox']",
    "[role='combobox']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
    "[role='menuitem']",
    "[role='tab']",
    "[onclick]",
  ].join(",")

  const SENSITIVE_KEY_RE =
    /password|passwd|pwd|token|secret|auth|cookie|session|api[-_]?key|credential|jwt|bearer|private[-_]?key|otp|验证码|密码|令牌/i
  const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
  const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i
  const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  const LONG_RANDOM_RE = /\b[A-Za-z0-9_-]{32,}\b/

  function observePage(args = {}) {
    const mode = args.mode === "fullPage" ? "fullPage" : "viewport"
    const maxElements = clampInteger(args.maxElements, 1, MAX_ELEMENTS, DEFAULT_MAX_ELEMENTS)
    const maxTextLength = clampInteger(args.maxTextLength, 0, MAX_TEXT_LENGTH, DEFAULT_MAX_TEXT_LENGTH)
    const includeHidden = Boolean(args.includeHidden)
    const includeTextTree = args.includeTextTree !== false
    const includeRects = args.includeRects !== false
    const redaction = normalizeRedaction(args.redaction)
    const redactions = {
      mode: redaction,
      count: 0,
      categories: [],
      screenshotRedacted: false,
    }

    const scope = mode === "fullPage" ? "fullPage" : "viewport"
    const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR))
    const elements = []
    const textLines = []
    let uidCounter = 0

    for (const element of candidates) {
      if (elements.length >= maxElements) break
      if (isYuntiWidgetElement(element)) continue
      const visible = isVisible(element)
      if (!includeHidden && !visible) continue
      if (scope === "viewport" && visible && !isInViewport(element)) continue
      if (scope === "viewport" && !visible && !includeHidden) continue

      uidCounter += 1
      const uid = `yunti-${uidCounter}`
      const item = describeElement(element, uid, {
        includeRects,
        redaction,
        redactions,
        visible,
      })
      elements.push(item)
      if (includeTextTree) textLines.push(formatTextTreeLine(item))
    }

    const textTree = includeTextTree ? truncateText(textLines.filter(Boolean).join("\n"), maxTextLength) : undefined
    const scrollableContainers = collectScrollableContainers({
      includeRects,
      maxElements: Math.min(50, maxElements),
      redaction,
      redactions,
    })
    const hints = buildHints(elements, scrollableContainers)
    const warnings = []
    if (redaction === "off") warnings.push("DOM observation redaction is off; use only for explicit local debugging.")
    if (document.readyState === "loading") hints.push("Page is still loading; wait and observe again before acting.")

    return {
      observationId: `obs-${Date.now()}`,
      browserSessionId: globalScope.__YUNTI_BROWSER_SESSION_ID__ || null,
      capturedAt: new Date().toISOString(),
      uidMapVersion: "observe-v1",
      page: {
        url: redactUrl(location.href, redaction, redactions),
        title: truncateText(document.title || "", 300),
        origin: location.origin,
        readyState: document.readyState,
      },
      viewport: {
        width: Math.round(globalScope.innerWidth || 0),
        height: Math.round(globalScope.innerHeight || 0),
        devicePixelRatio: Number(globalScope.devicePixelRatio || 1),
      },
      scroll: getDocumentScroll(),
      elements,
      elementCount: elements.length,
      textTree,
      scrollableContainers,
      limits: {
        mode,
        maxElements,
        maxTextLength,
        includeHidden,
        truncatedElements: candidates.length > elements.length,
        truncatedText: Boolean(includeTextTree && textLines.join("\n").length > maxTextLength),
      },
      redactions: finalizeRedactions(redactions),
      hints,
      warnings,
    }
  }

  function describeElement(element, uid, options) {
    const tag = element.tagName.toLowerCase()
    const role = element.getAttribute("role") || inferRole(element)
    const label = findLabel(element)
    const text = compactText(element.innerText || element.textContent || "", 240)
    const name = compactText(
      element.getAttribute("aria-label") ||
        label ||
        element.getAttribute("title") ||
        element.getAttribute("name") ||
        element.getAttribute("placeholder") ||
        text,
      240
    )
    const type = element.getAttribute("type") || (element.isContentEditable ? "contenteditable" : undefined)
    const valueInfo = getValuePreview(element, options.redaction, options.redactions)
    const rect = options.includeRects ? rectInfo(element) : undefined
    const scrollable = isScrollable(element)
    const fieldState = getFieldState(element, options)

    return cleanObject({
      uid,
      role,
      tag,
      name,
      text,
      label,
      placeholder: safeAttribute(element, "placeholder", options),
      valuePreview: valueInfo.valuePreview,
      valueRedacted: valueInfo.valueRedacted,
      type,
      hrefPreview: element instanceof HTMLAnchorElement ? redactUrl(element.href, options.redaction, options.redactions) : undefined,
      rect,
      visible: options.visible,
      disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
      editable: isEditable(element),
      readOnly: fieldState.readOnly,
      fillable: fieldState.fillable,
      fillBlockReason: fieldState.fillBlockReason,
      options: fieldState.options,
      checked: "checked" in element ? Boolean(element.checked) : undefined,
      selected: "selected" in element ? Boolean(element.selected) : undefined,
      scrollable,
      containerUid: undefined,
    })
  }

  function collectScrollableContainers(options) {
    const containers = []
    let uidCounter = 0
    for (const element of Array.from(document.querySelectorAll("body *"))) {
      if (containers.length >= options.maxElements) break
      if (isYuntiWidgetElement(element) || !isVisible(element) || !isScrollable(element)) continue
      uidCounter += 1
      containers.push(cleanObject({
        uid: `scroll-${uidCounter}`,
        tag: element.tagName.toLowerCase(),
        name: compactText(element.getAttribute("aria-label") || element.getAttribute("title") || element.id || "", 160),
        rect: options.includeRects ? rectInfo(element) : undefined,
        scrollTop: Math.round(element.scrollTop || 0),
        scrollLeft: Math.round(element.scrollLeft || 0),
        scrollHeight: Math.round(element.scrollHeight || 0),
        scrollWidth: Math.round(element.scrollWidth || 0),
        clientHeight: Math.round(element.clientHeight || 0),
        clientWidth: Math.round(element.clientWidth || 0),
        canScrollVertical: element.scrollHeight > element.clientHeight,
        canScrollHorizontal: element.scrollWidth > element.clientWidth,
        pixelsAbove: Math.round(element.scrollTop || 0),
        pixelsBelow: Math.max(0, Math.round((element.scrollHeight || 0) - (element.clientHeight || 0) - (element.scrollTop || 0))),
        pixelsLeft: Math.round(element.scrollLeft || 0),
        pixelsRight: Math.max(0, Math.round((element.scrollWidth || 0) - (element.clientWidth || 0) - (element.scrollLeft || 0))),
      }))
    }
    return containers
  }

  function getDocumentScroll() {
    const scrollingElement = document.scrollingElement || document.documentElement
    const x = Math.round(globalScope.scrollX || scrollingElement.scrollLeft || 0)
    const y = Math.round(globalScope.scrollY || scrollingElement.scrollTop || 0)
    const viewportWidth = Math.round(globalScope.innerWidth || scrollingElement.clientWidth || 0)
    const viewportHeight = Math.round(globalScope.innerHeight || scrollingElement.clientHeight || 0)
    const pageWidth = Math.round(Math.max(scrollingElement.scrollWidth || 0, document.documentElement.scrollWidth || 0))
    const pageHeight = Math.round(Math.max(scrollingElement.scrollHeight || 0, document.documentElement.scrollHeight || 0))
    const pixelsBelow = Math.max(0, pageHeight - viewportHeight - y)
    const pixelsRight = Math.max(0, pageWidth - viewportWidth - x)
    return {
      x,
      y,
      pageWidth,
      pageHeight,
      pixelsAbove: y,
      pixelsBelow,
      pixelsLeft: x,
      pixelsRight,
      pagesAbove: viewportHeight ? Number((y / viewportHeight).toFixed(2)) : 0,
      pagesBelow: viewportHeight ? Number((pixelsBelow / viewportHeight).toFixed(2)) : 0,
    }
  }

  function getValuePreview(element, redaction, redactions) {
    if (!("value" in element)) return {}
    const key = [
      element.getAttribute("type"),
      element.getAttribute("name"),
      element.getAttribute("id"),
      element.getAttribute("autocomplete"),
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
    ].filter(Boolean).join(" ")
    const rawValue = String(element.value || "")
    if (!rawValue) return { valuePreview: "", valueRedacted: false }
    if (shouldRedact(key, rawValue, redaction)) {
      recordRedaction(redactions, categoryFor(key, rawValue))
      return { valuePreview: "[REDACTED]", valueRedacted: true }
    }
    return { valuePreview: truncateText(rawValue, 120), valueRedacted: false }
  }

  function safeAttribute(element, attr, options) {
    const value = element.getAttribute(attr)
    if (!value) return undefined
    const key = `${attr} ${element.getAttribute("name") || ""} ${element.getAttribute("id") || ""}`
    if (shouldRedact(key, value, options.redaction)) {
      recordRedaction(options.redactions, categoryFor(key, value))
      return "[REDACTED]"
    }
    return truncateText(value, 160)
  }

  function shouldRedact(key, value, redaction) {
    if (redaction === "off") return false
    const haystack = `${key || ""} ${value || ""}`
    if (SENSITIVE_KEY_RE.test(haystack)) return true
    if (JWT_RE.test(haystack) || BEARER_RE.test(haystack) || PRIVATE_KEY_RE.test(haystack)) return true
    if (LONG_RANDOM_RE.test(String(value || ""))) return true
    return redaction === "strict" && String(value || "").length >= 16
  }

  function categoryFor(key, value) {
    const haystack = `${key || ""} ${value || ""}`
    if (/password|passwd|pwd|密码/i.test(haystack)) return "password"
    if (/cookie|session/i.test(haystack)) return "session"
    if (/api[-_]?key|token|secret|auth|jwt|bearer|private[-_]?key|令牌/i.test(haystack)) return "token"
    if (/otp|验证码/i.test(haystack)) return "otp"
    return "credential_like"
  }

  function recordRedaction(redactions, category) {
    redactions.count += 1
    if (!redactions.categories.includes(category)) redactions.categories.push(category)
  }

  function finalizeRedactions(redactions) {
    return {
      mode: redactions.mode,
      count: redactions.count,
      categories: redactions.categories.sort(),
      valuesRedacted: redactions.count > 0,
      screenshotRedacted: false,
    }
  }

  function redactUrl(url, redaction, redactions) {
    if (redaction === "off") return truncateText(url, 2000)
    try {
      const parsed = new URL(url)
      for (const key of Array.from(parsed.searchParams.keys())) {
        const values = parsed.searchParams.getAll(key)
        parsed.searchParams.delete(key)
        for (const value of values) {
          if (shouldRedact(key, value, redaction)) {
            recordRedaction(redactions, categoryFor(key, value))
            parsed.searchParams.append(key, "[REDACTED]")
          } else {
            parsed.searchParams.append(key, truncateText(value, 120))
          }
        }
      }
      return truncateText(parsed.toString(), 2000)
    } catch {
      return truncateText(String(url || ""), 2000)
    }
  }

  function inferRole(element) {
    const tag = element.tagName.toLowerCase()
    if (tag === "a") return "link"
    if (tag === "button") return "button"
    if (tag === "textarea") return "textbox"
    if (tag === "select") return "combobox"
    if (tag === "input") {
      const type = String(element.getAttribute("type") || "text").toLowerCase()
      if (type === "checkbox") return "checkbox"
      if (type === "radio") return "radio"
      if (type === "range") return "slider"
      if (type === "button" || type === "submit" || type === "reset") return "button"
      return "textbox"
    }
    if (element.isContentEditable) return "textbox"
    return tag
  }

  function isEditable(element) {
    const tag = element.tagName.toLowerCase()
    if (element.isContentEditable) return true
    if (tag === "select" || tag === "textarea") return true
    if (tag !== "input") return false
    return !isBlockedInputType(element)
  }

  function getFieldState(element, options) {
    const tag = element.tagName.toLowerCase()
    const disabled = Boolean(element.disabled || element.getAttribute("aria-disabled") === "true")
    const readOnly = Boolean(element.readOnly || element.getAttribute("aria-readonly") === "true")
    const editable = isEditable(element)
    const visible = options.visible !== false
    const fillable = Boolean(visible && editable && !disabled && !readOnly)
    const optionsSummary = tag === "select" ? getSelectOptions(element, options) : undefined
    return cleanObject({
      readOnly,
      fillable,
      fillBlockReason: fillable ? undefined : getFillBlockReason({ element, visible, editable, disabled, readOnly }),
      options: optionsSummary,
    })
  }

  function getFillBlockReason({ element, visible, editable, disabled, readOnly }) {
    if (!visible) return "hidden-or-not-visible"
    if (disabled) return "disabled"
    if (readOnly) return "readonly"
    if (!editable && isBlockedInputType(element)) return "not-editable-input-type"
    if (!editable) return "not-editable"
    return undefined
  }

  function isBlockedInputType(element) {
    if (element.tagName.toLowerCase() !== "input") return false
    const type = String(element.getAttribute("type") || "text").toLowerCase()
    return ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type)
  }

  function getSelectOptions(element, options) {
    const optionElements = Array.from(element.options || [])
    if (!optionElements.length) return undefined
    return optionElements.slice(0, 50).map((option) => {
      const rawValue = String(option.value || "")
      const text = compactText(option.text || option.textContent || "", 120)
      const key = `select option ${element.getAttribute("name") || ""} ${element.getAttribute("id") || ""}`
      let value = truncateText(rawValue, 120)
      let valueRedacted = false
      if (shouldRedact(key, rawValue, options.redaction)) {
        recordRedaction(options.redactions, categoryFor(key, rawValue))
        value = "[REDACTED]"
        valueRedacted = true
      }
      return cleanObject({
        value,
        text,
        selected: Boolean(option.selected),
        disabled: Boolean(option.disabled),
        valueRedacted,
      })
    })
  }

  function findLabel(element) {
    if (element.id && globalScope.CSS?.escape) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
      if (label) return compactText(label.innerText || label.textContent || "", 160)
    }
    return compactText(element.closest?.("label")?.innerText || element.closest?.("label")?.textContent || "", 160)
  }

  function formatTextTreeLine(item) {
    const attrs = [
      item.role ? `role=${item.role}` : "",
      item.name ? `name="${item.name}"` : "",
      item.valueRedacted ? "value=[REDACTED]" : item.valuePreview ? `value="${item.valuePreview}"` : "",
      item.disabled ? "disabled" : "",
    ].filter(Boolean).join(" ")
    const tag = item.tag || "element"
    return `[${item.uid}]<${tag}${attrs ? ` ${attrs}` : ""}>${item.text || item.name || ""}</${tag}>`
  }

  function buildHints(elements, scrollableContainers) {
    const hints = []
    if (!elements.length) hints.push("No visible interactive elements found; wait, scroll, switch tabs, or use screenshot/CDP for recovery.")
    const scroll = getDocumentScroll()
    if (scroll.pixelsBelow > 0) hints.push("Page has content below the viewport; scroll before assuming an element is missing.")
    if (scrollableContainers.length) hints.push("Scrollable containers detected; a later action may need container-aware scrolling.")
    return hints
  }

  function isYuntiWidgetElement(element) {
    return Boolean(element.closest?.("#yunti-browser-runtime-widget"))
  }

  function isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return false
    const style = globalScope.getComputedStyle ? globalScope.getComputedStyle(element) : null
    if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect()
    const width = globalScope.innerWidth || document.documentElement.clientWidth || 0
    const height = globalScope.innerHeight || document.documentElement.clientHeight || 0
    return rect.bottom >= 0 && rect.right >= 0 && rect.top <= height && rect.left <= width
  }

  function isScrollable(element) {
    if (!element) return false
    const style = globalScope.getComputedStyle ? globalScope.getComputedStyle(element) : null
    const overflowY = style?.overflowY || ""
    const overflowX = style?.overflowX || ""
    return (
      (/(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight) ||
      (/(auto|scroll)/.test(overflowX) && element.scrollWidth > element.clientWidth)
    )
  }

  function rectInfo(element) {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
  }

  function compactText(text, maxLength) {
    return truncateText(String(text || "").replace(/\s+/g, " ").trim(), maxLength) || undefined
  }

  function truncateText(text, maxLength) {
    const value = String(text || "")
    return value.length > maxLength ? value.slice(0, maxLength) : value
  }

  function clampInteger(value, min, max, fallback) {
    const number = Number(value)
    if (!Number.isFinite(number)) return fallback
    return Math.max(min, Math.min(max, Math.floor(number)))
  }

  function normalizeRedaction(value) {
    const mode = String(value || "balanced")
    return mode === "strict" || mode === "off" ? mode : "balanced"
  }

  function cleanObject(value) {
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined && item !== null && item !== "") out[key] = item
    }
    return out
  }

  globalScope.YuntiBrowserRuntimeObserver = {
    observePage,
    _private: {
      shouldRedact,
      redactUrl,
    },
  }
})(globalThis)
