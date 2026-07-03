import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

class FakeElement {
  constructor(tagName, attrs = {}, options = {}) {
    this.tagName = tagName.toUpperCase()
    this.attrs = { ...attrs }
    this.id = attrs.id || ""
    this.value = options.value || ""
    this.innerText = options.innerText || ""
    this.textContent = options.textContent || this.innerText || ""
    this.disabled = Boolean(options.disabled)
    this.readOnly = Boolean(options.readOnly)
    this.checked = Boolean(options.checked)
    this.selected = Boolean(options.selected)
    this.options = options.options || []
    this.isContentEditable = attrs.contenteditable === "true" || attrs.contenteditable === ""
    this.rect = options.rect || { x: 0, y: 0, width: 100, height: 24 }
    this.style = options.style || { display: "block", visibility: "visible", opacity: "1" }
    this.scrollTop = options.scrollTop || 0
    this.scrollLeft = options.scrollLeft || 0
    this.scrollHeight = options.scrollHeight || this.rect.height
    this.scrollWidth = options.scrollWidth || this.rect.width
    this.clientHeight = options.clientHeight || this.rect.height
    this.clientWidth = options.clientWidth || this.rect.width
  }

  getAttribute(name) {
    return this.attrs[name] ?? null
  }

  getBoundingClientRect() {
    return {
      ...this.rect,
      left: this.rect.x,
      top: this.rect.y,
      right: this.rect.x + this.rect.width,
      bottom: this.rect.y + this.rect.height,
    }
  }

  closest() {
    return null
  }
}

class FakeAnchorElement extends FakeElement {
  constructor(attrs = {}, options = {}) {
    super("a", attrs, options)
    this.href = attrs.href || ""
  }
}

function createDocument(elements, options = {}) {
  const documentElement = {
    scrollWidth: options.pageWidth || 1024,
    scrollHeight: options.pageHeight || 768,
    clientWidth: options.viewportWidth || 800,
    clientHeight: options.viewportHeight || 600,
  }
  const labels = new Map(Object.entries(options.labels || {}))
  return {
    title: options.title || "Yunti Test",
    readyState: options.readyState || "complete",
    documentElement,
    scrollingElement: {
      ...documentElement,
      scrollLeft: options.scrollX || 0,
      scrollTop: options.scrollY || 0,
    },
    body: {},
    querySelector(selector) {
      const labelFor = selector.match(/^label\[for="(.+)"\]$/)?.[1]
      if (labelFor && labels.has(labelFor)) {
        return { innerText: labels.get(labelFor), textContent: labels.get(labelFor) }
      }
      return null
    },
    querySelectorAll(selector) {
      if (selector === "body *") return elements
      return elements.filter(isInteractiveFakeElement)
    },
  }
}

function isInteractiveFakeElement(element) {
  const tag = element.tagName.toLowerCase()
  return (
    ["a", "button", "input", "select", "textarea"].includes(tag) ||
    element.getAttribute("role") ||
    element.getAttribute("onclick") ||
    element.getAttribute("contenteditable") !== null
  )
}

function loadObserver({ document, location, viewport = {}, sessionId = "tab-1" }) {
  const source = readFileSync(resolve("extension/dom-observer.js"), "utf8")
  const context = {
    document,
    location,
    URL,
    HTMLAnchorElement: FakeAnchorElement,
    globalThis: null,
    innerWidth: viewport.width || 800,
    innerHeight: viewport.height || 600,
    scrollX: viewport.scrollX || 0,
    scrollY: viewport.scrollY || 0,
    devicePixelRatio: 1,
    __YUNTI_BROWSER_SESSION_ID__: sessionId,
    CSS: { escape: (value) => String(value) },
    getComputedStyle: (element) => element.style || {},
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(source, context, { filename: "extension/dom-observer.js" })
  return context.YuntiBrowserRuntimeObserver
}

function elementNames(observation) {
  return Array.from(observation.elements, (element) => element.name)
}

test("DOM observer returns fresh uids, text tree, and balanced redaction", () => {
  const elements = [
    new FakeElement("input", { id: "keyword", name: "keyword", placeholder: "Search" }, {
      value: "blue widgets",
      rect: { x: 20, y: 20, width: 180, height: 32 },
    }),
    new FakeElement("input", { id: "password", name: "password", type: "password" }, {
      value: "demo-password-value",
      rect: { x: 20, y: 70, width: 180, height: 32 },
    }),
    new FakeElement("input", { id: "apiKey", name: "api_key", type: "hidden" }, {
      value: "exampleApiKeyValue",
      rect: { x: 0, y: 0, width: 0, height: 0 },
      style: { display: "none", visibility: "hidden", opacity: "1" },
    }),
    new FakeElement("button", {}, {
      innerText: "查询",
      rect: { x: 220, y: 20, width: 80, height: 32 },
    }),
    new FakeAnchorElement(
      { href: "https://example.test/detail?token=example-token-value&id=42" },
      { innerText: "详情", rect: { x: 20, y: 120, width: 80, height: 24 } }
    ),
  ]
  const document = createDocument(elements, {
    labels: { keyword: "关键词" },
    pageHeight: 1200,
    viewportHeight: 600,
  })
  const observer = loadObserver({
    document,
    location: new URL("https://example.test/search?session=example-session-value&q=ok"),
    viewport: { width: 800, height: 600 },
  })

  const observation = observer.observePage({ includeHidden: true, redaction: "balanced" })

  assert.equal(observation.browserSessionId, "tab-1")
  assert.equal(observation.uidMapVersion, "observe-v1")
  assert.equal(observation.elements[0].uid, "yunti-1")
  assert.equal(observation.elements[0].name, "关键词")
  assert.equal(observation.elements[0].editable, true)
  assert.equal(observation.elements[0].fillable, true)
  assert.equal(observation.elements[1].valuePreview, "[REDACTED]")
  assert.equal(observation.elements[1].valueRedacted, true)
  assert.equal(observation.elements[2].valuePreview, "[REDACTED]")
  assert.equal(observation.elements[2].visible, false)
  assert.equal(observation.elements[2].fillBlockReason, "hidden-or-not-visible")
  assert.match(observation.textTree, /\[yunti-1\]<input/)
  assert.match(observation.textTree, /\[yunti-4\]<button/)
  assert.equal(observation.redactions.mode, "balanced")
  assert.ok(observation.redactions.categories.includes("password"))
  assert.ok(observation.redactions.categories.includes("token"))
  assert.equal(observation.redactions.screenshotRedacted, false)
  assert.equal(JSON.stringify(observation).includes("demo-password-value"), false)
  assert.equal(JSON.stringify(observation).includes("exampleApiKeyValue"), false)
  assert.equal(JSON.stringify(observation).includes("example-session-value"), false)
})

test("DOM observer returns document and container scroll metadata", () => {
  const scrollContainer = new FakeElement("div", { id: "results" }, {
    rect: { x: 10, y: 90, width: 360, height: 280 },
    style: { display: "block", visibility: "visible", opacity: "1", overflowY: "auto", overflowX: "hidden" },
    scrollTop: 120,
    scrollHeight: 920,
    clientHeight: 280,
  })
  const elements = [
    new FakeElement("button", {}, {
      innerText: "Load more",
      rect: { x: 20, y: 20, width: 100, height: 32 },
    }),
    scrollContainer,
  ]
  const document = createDocument(elements, {
    pageWidth: 900,
    pageHeight: 1800,
    viewportWidth: 800,
    viewportHeight: 600,
    scrollY: 300,
  })
  const observer = loadObserver({
    document,
    location: new URL("https://example.test/list"),
    viewport: { width: 800, height: 600, scrollY: 300 },
  })

  const observation = observer.observePage({ maxElements: 10 })

  assert.equal(observation.scroll.y, 300)
  assert.equal(observation.scroll.pixelsBelow, 900)
  assert.equal(observation.scroll.pagesBelow, 1.5)
  assert.equal(observation.scrollableContainers.length, 1)
  assert.equal(observation.scrollableContainers[0].uid, "scroll-1")
  assert.equal(observation.scrollableContainers[0].pixelsBelow, 520)
  assert.ok(observation.hints.some((hint) => /content below/.test(hint)))
  assert.ok(observation.hints.some((hint) => /Scrollable containers/.test(hint)))
})

test("DOM observer excludes hidden and offscreen elements by default", () => {
  const elements = [
    new FakeElement("button", {}, {
      innerText: "Visible action",
      rect: { x: 20, y: 20, width: 120, height: 32 },
    }),
    new FakeElement("button", {}, {
      innerText: "Hidden action",
      rect: { x: 20, y: 70, width: 120, height: 32 },
      style: { display: "none", visibility: "hidden", opacity: "1" },
    }),
    new FakeElement("button", {}, {
      innerText: "Below fold",
      rect: { x: 20, y: 900, width: 120, height: 32 },
    }),
  ]
  const observer = loadObserver({
    document: createDocument(elements, { pageHeight: 1200, viewportHeight: 600 }),
    location: new URL("https://example.test/actions"),
    viewport: { width: 800, height: 600 },
  })

  const viewportObservation = observer.observePage()
  assert.deepEqual(elementNames(viewportObservation), ["Visible action"])
  assert.equal(viewportObservation.limits.mode, "viewport")
  assert.ok(viewportObservation.hints.some((hint) => /content below/.test(hint)))

  const fullPageObservation = observer.observePage({ mode: "fullPage" })
  assert.deepEqual(elementNames(fullPageObservation), ["Visible action", "Below fold"])
  assert.equal(fullPageObservation.limits.mode, "fullPage")

  const hiddenObservation = observer.observePage({ mode: "fullPage", includeHidden: true })
  assert.deepEqual(elementNames(hiddenObservation), [
    "Visible action",
    "Hidden action",
    "Below fold",
  ])
  assert.equal(hiddenObservation.elements.find((element) => element.name === "Hidden action").visible, false)
})

test("DOM observer handles redaction edge modes conservatively", () => {
  const tokenValue = "Bearer abcdefghijklmnopqrstuvwxyz1234567890"
  const longRandom = "fixture_1234567890abcdefghijklmnopqrstuvwxyzABCDEF"
  const elements = [
    new FakeElement("input", { id: "auth", name: "authorization" }, {
      value: tokenValue,
      rect: { x: 20, y: 20, width: 260, height: 32 },
    }),
    new FakeElement("input", { id: "ordinary", name: "query" }, {
      value: "ordinary business text",
      rect: { x: 20, y: 70, width: 260, height: 32 },
    }),
    new FakeElement("input", { id: "strict", name: "reference" }, {
      value: "sixteen-char-ref",
      rect: { x: 20, y: 120, width: 260, height: 32 },
    }),
    new FakeElement("input", { id: "random", name: "note" }, {
      value: longRandom,
      rect: { x: 20, y: 170, width: 260, height: 32 },
    }),
  ]
  const document = createDocument(elements)
  const location = new URL("https://example.test/settings?api_key=secret-api-key-value&safe=1")
  const observer = loadObserver({ document, location })

  const balanced = observer.observePage({ redaction: "balanced" })
  const balancedText = JSON.stringify(balanced)
  assert.equal(balanced.elements.find((element) => element.uid === "yunti-1").valuePreview, "[REDACTED]")
  assert.equal(balanced.elements.find((element) => element.uid === "yunti-2").valuePreview, "ordinary business text")
  assert.equal(balanced.elements.find((element) => element.uid === "yunti-4").valuePreview, "[REDACTED]")
  assert.equal(balancedText.includes(tokenValue), false)
  assert.equal(balancedText.includes(longRandom), false)
  assert.equal(balancedText.includes("secret-api-key-value"), false)
  assert.ok(balanced.redactions.categories.includes("token"))

  const strict = observer.observePage({ redaction: "strict" })
  assert.equal(strict.elements.find((element) => element.uid === "yunti-2").valuePreview, "[REDACTED]")
  assert.equal(strict.elements.find((element) => element.uid === "yunti-3").valuePreview, "[REDACTED]")

  const off = observer.observePage({ redaction: "off" })
  assert.equal(off.elements.find((element) => element.uid === "yunti-1").valuePreview, tokenValue.slice(0, 120))
  assert.equal(off.redactions.count, 0)
  assert.ok(off.warnings.some((warning) => /redaction is off/i.test(warning)))
})

test("DOM observer reports field fillability and select option summaries", () => {
  const elements = [
    new FakeElement("input", { id: "enabled", name: "enabled" }, {
      value: "ready",
      rect: { x: 20, y: 20, width: 220, height: 32 },
    }),
    new FakeElement("input", { id: "locked", name: "locked" }, {
      value: "locked",
      readOnly: true,
      rect: { x: 20, y: 70, width: 220, height: 32 },
    }),
    new FakeElement("button", { type: "submit" }, {
      innerText: "Submit",
      rect: { x: 20, y: 120, width: 100, height: 32 },
    }),
    new FakeElement("select", { id: "plan", name: "plan" }, {
      rect: { x: 20, y: 170, width: 220, height: 32 },
      options: [
        { value: "basic", text: "Basic", selected: true },
        { value: "enterprise", text: "Enterprise" },
      ],
    }),
  ]
  const observer = loadObserver({
    document: createDocument(elements),
    location: new URL("https://example.test/form"),
  })

  const observation = observer.observePage()
  const enabled = observation.elements.find((element) => element.name === "enabled")
  const locked = observation.elements.find((element) => element.name === "locked")
  const button = observation.elements.find((element) => element.name === "Submit")
  const plan = observation.elements.find((element) => element.name === "plan")

  assert.equal(enabled.editable, true)
  assert.equal(enabled.fillable, true)
  assert.equal(locked.readOnly, true)
  assert.equal(locked.fillable, false)
  assert.equal(locked.fillBlockReason, "readonly")
  assert.equal(button.editable, false)
  assert.equal(button.fillable, false)
  assert.equal(button.fillBlockReason, "not-editable")
  assert.equal(plan.editable, true)
  assert.equal(plan.fillable, true)
  assert.deepEqual(JSON.parse(JSON.stringify(plan.options)), [
    { value: "basic", text: "Basic", selected: true, disabled: false, valueRedacted: false },
    { value: "enterprise", text: "Enterprise", selected: false, disabled: false, valueRedacted: false },
  ])
})
