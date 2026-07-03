import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

class FakeElement {
  constructor(tagName, attrs = {}, options = {}) {
    this.tagName = tagName.toUpperCase()
    this.nodeType = 1
    this.id = attrs.id || ""
    this.className = attrs.className || ""
    this.attrs = { ...attrs }
    this.innerText = options.innerText || ""
    this.textContent = options.textContent || this.innerText || ""
    this.parentElement = options.parentElement || null
    this.children = options.children || []
    this.style = options.style || { display: "block", visibility: "visible", opacity: "1" }
    this.scrollLeft = options.scrollLeft || 0
    this.scrollTop = options.scrollTop || 0
    this.scrollWidth = options.scrollWidth || 100
    this.scrollHeight = options.scrollHeight || 100
    this.clientWidth = options.clientWidth || 100
    this.clientHeight = options.clientHeight || 100
    this.rect = options.rect || { x: 0, y: 0, width: 100, height: 100 }
    for (const child of this.children) child.parentElement = this
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

  scrollBy({ left = 0, top = 0 }) {
    this.scrollLeft += Number(left || 0)
    this.scrollTop += Number(top || 0)
  }
}

function createContentHarness({ elementFromPoint, documentScrollTop = 0 } = {}) {
  const body = new FakeElement("body")
  const documentElement = new FakeElement("html", {}, {
    scrollTop: documentScrollTop,
    scrollHeight: 2000,
    clientHeight: 600,
  })
  const scrollingElement = new FakeElement("html", {}, {
    scrollTop: documentScrollTop,
    scrollHeight: 2000,
    clientHeight: 600,
  })
  const document = {
    title: "Scroll Test",
    body,
    documentElement,
    scrollingElement,
    forms: [],
    querySelector: () => null,
    querySelectorAll: () => [],
    elementFromPoint: elementFromPoint || (() => null),
  }
  const context = {
    document,
    location: new URL("https://example.test/scroll"),
    navigator: { userAgent: "Chrome/123", platform: "macOS", language: "en-US" },
    window: { innerWidth: 800, innerHeight: 600, confirm: () => true },
    Node: { ELEMENT_NODE: 1 },
    CSS: { escape: (value) => String(value) },
    Map,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    getComputedStyle: (element) => element.style || {},
    chrome: {
      runtime: {
        onMessage: { addListener: () => {} },
        sendMessage: async (message) => {
          if (message?.type === "yunti_is_supported_page") return { supported: true }
          if (message?.type === "yunti_content_ready") {
            return { ok: true, session: { browserSessionId: "tab-1", auth: { loggedIn: false } } }
          }
          return { ok: true }
        },
      },
    },
  }
  context.window.window = context.window
  context.window.document = document
  context.window.getComputedStyle = context.getComputedStyle
  vm.createContext(context)
  const source = readFileSync(resolve("extension/content.js"), "utf8")
  vm.runInContext(source, context, { filename: "extension/content.js" })
  return context
}

test("content scroll reports coordinate container hit metadata", () => {
  const item = new FakeElement("button", {}, { innerText: "Load more" })
  const panel = new FakeElement("div", { id: "results" }, {
    children: [item],
    style: { display: "block", visibility: "visible", opacity: "1", overflowY: "auto", overflowX: "hidden" },
    scrollTop: 120,
    scrollHeight: 900,
    clientHeight: 300,
  })
  const context = createContentHarness({ elementFromPoint: () => item })

  const result = context.scrollPage({ x: 50, y: 120, deltaY: 200 })

  assert.equal(result.scrolled, true)
  assert.equal(result.target.selector, "#results")
  assert.deepEqual(plain(result.before), { left: 0, top: 120 })
  assert.deepEqual(plain(result.after), { left: 0, top: 320 })
  assert.deepEqual(plain(result.coordinateTarget), {
    x: 50,
    y: 120,
    found: true,
    element: {
      selector: "div > button",
      tag: "button",
      id: null,
      className: null,
      text: "Load more",
    },
  })
  assert.equal(result.scrollContainerFound, true)
  assert.equal(result.coordinateScrollFallback, undefined)
})

test("content scroll reports coordinate document fallback metadata", () => {
  const context = createContentHarness({ elementFromPoint: () => null, documentScrollTop: 40 })

  const result = context.scrollPage({ x: 999, y: -10, deltaY: 160 })

  assert.equal(result.scrolled, true)
  assert.equal(result.target, "document")
  assert.deepEqual(plain(result.before), { left: 0, top: 40 })
  assert.deepEqual(plain(result.after), { left: 0, top: 200 })
  assert.deepEqual(plain(result.coordinateTarget), {
    x: 799,
    y: 0,
    found: false,
  })
  assert.equal(result.scrollContainerFound, false)
  assert.equal(result.coordinateScrollFallback, "document")
})
