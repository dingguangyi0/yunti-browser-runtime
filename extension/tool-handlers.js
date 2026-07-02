export function createToolDispatcher({
  sessionsByTab,
  pollers,
  postBridge,
  startPolling,
  cdp,
}) {
  const {
    chromeDebuggerSendCommand,
    delayCdp,
    detachCdpTab,
    ensureCdpAttached,
    getBrowserTarget,
    listBrowserTargets,
    sendCdpCommand,
    startPerformanceTrace,
    stopPerformanceTrace,
  } = cdp

  async function executeToolRequest(tabId, session, event) {
    let result
    let ok = true
    let error = null
    try {
      if (event.tool === "yunti_capture_visible_tab") {
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(session.windowId, {
            format: "png",
          })
          result = {
            dataUrl,
            mimeType: "image/png",
            method: "tabs.captureVisibleTab",
            browserSessionId: session.browserSessionId,
            url: session.url,
            title: session.title || "",
            capturedAt: new Date().toISOString(),
          }
        } catch (permError) {
          // Fall back to CDP Page.captureScreenshot when activeTab
          // permission is not available (e.g. tool call via relay without
          // direct user interaction on the extension)
          await ensureCdpAttached(tabId, "1.3")
          const shot = await chromeDebuggerSendCommand(
            { tabId },
            "Page.captureScreenshot",
            { format: "png" }
          )
          const dataUrl = `data:image/png;base64,${shot?.data || ""}`
          result = {
            dataUrl,
            mimeType: "image/png",
            method: "cdp.Page.captureScreenshot",
            browserSessionId: session.browserSessionId,
            url: session.url,
            title: session.title || "",
            capturedAt: new Date().toISOString(),
          }
        }
      } else if (event.tool === "yunti_cdp_send_command") {
        result = await sendCdpCommand(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_list_browser_targets" || event.tool === "yunti_list_pages") {
        result = await listBrowserTargets(session)
      } else if (event.tool === "yunti_get_browser_target") {
        result = await getBrowserTarget(session, event.arguments || {})
      } else if (event.tool === "yunti_cdp_detach") {
        result = await detachCdpTab(tabId, session, "tool_request")
      } else if (event.tool === "yunti_navigate_page") {
        result = await navigatePage(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_take_screenshot") {
        result = await takeScreenshot(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_evaluate_script") {
        result = await evaluateScript(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_take_snapshot") {
        result = await takeSnapshot(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_observe_page") {
        result = await observePage(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_click") {
        result = await clickByUid(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_hover") {
        result = await hoverByUid(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_fill") {
        result = await fillByUid(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_fill_form") {
        result = await fillForm(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_wait_for") {
        result = await waitForCondition(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_handle_dialog") {
        result = await handleDialog(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_resize_page") {
        result = await resizePage(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_emulate") {
        result = await emulateDevice(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_performance_start_trace") {
        result = await startPerformanceTrace(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_performance_stop_trace") {
        result = await stopPerformanceTrace(tabId, session)
      } else if (event.tool === "yunti_new_page") {
        result = await newPage(session, event.arguments || {})
      } else if (event.tool === "yunti_close_page") {
        result = await closePage(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_drag") {
        result = await performDrag(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_upload_file") {
        result = await uploadFile(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_type_text") {
        result = await typeTextByUid(tabId, session, event.arguments || {})
      } else if (event.tool === "yunti_press_key") {
        result = await pressKeyByUid(tabId, session, event.arguments || {})
      } else {
        result = await chrome.tabs.sendMessage(tabId, {
          type: "yunti_execute_tool",
          tool: event.tool,
          arguments: event.arguments || {},
        })
      }
    } catch (err) {
      ok = false
      error = err instanceof Error ? err.message : String(err)
    }
  
    await postBridge("/extension/result", {
      browserSessionId: session.browserSessionId,
      requestId: event.id,
      ok,
      result,
      error,
    }).catch(() => {})
  }
  
  async function navigatePage(tabId, session, args = {}) {
    const action = String(args.action || "url").trim()
    const url = String(args.url || "").trim()
  
    if (action === "reload") {
      await chrome.tabs.reload(tabId)
      return { navigated: true, action: "reload", tabId, browserSessionId: session.browserSessionId }
    }
  
    if (action === "back" || action === "forward") {
      await ensureCdpAttached(tabId, "1.3")
      let history
      try {
        history = await chromeDebuggerSendCommand(
          { tabId },
          "Page.getNavigationHistory",
          {}
        )
      } catch (error) {
        return navigateHistoryViaRuntime(
          tabId,
          session,
          action,
          `Page.getNavigationHistory failed: ${error?.message || String(error)}`
        )
      }
      const entries = history?.entries || []
      const currentIndex = history?.currentIndex ?? -1
      const targetIndex = action === "back" ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= entries.length) {
        return navigateHistoryViaRuntime(
          tabId,
          session,
          action,
          `no CDP history entry at index ${targetIndex}`
        )
      }
      try {
        await chromeDebuggerSendCommand(
          { tabId },
          "Page.navigateToHistoryEntry",
          { entryId: entries[targetIndex].id }
        )
        return {
          navigated: true,
          action,
          tabId,
          url: entries[targetIndex].url,
          browserSessionId: session.browserSessionId,
          method: "Page.navigateToHistoryEntry",
        }
      } catch (error) {
        return navigateHistoryViaRuntime(
          tabId,
          session,
          action,
          `Page.navigateToHistoryEntry failed: ${error?.message || String(error)}`
        )
      }
    }
  
    // action === "url" (default)
    if (!url) throw new Error("url is required for navigate action 'url'")
    await chrome.tabs.update(tabId, { url })
    return { navigated: true, action: "url", url, tabId, browserSessionId: session.browserSessionId }
  }
  
  async function navigateHistoryViaRuntime(tabId, session, action, reason) {
    const method = action === "back" ? "back" : "forward"
    try {
      await chromeDebuggerSendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: `window.history.${method}(); true`,
          returnByValue: true,
        }
      )
    } catch (error) {
      throw new Error(
        `Cannot navigate ${action}: ${reason}; Runtime.evaluate window.history.${method}() failed: ${error?.message || String(error)}`
      )
    }
    return {
      navigated: true,
      action,
      tabId,
      browserSessionId: session.browserSessionId,
      method: `Runtime.evaluate(window.history.${method})`,
      fallback: true,
      fallbackReason: reason,
    }
  }
  
  async function takeScreenshot(tabId, session, args = {}) {
    const format = String(args.format || "png").trim() === "jpeg" ? "jpeg" : "png"
    const quality = format === "jpeg" ? clampQuality(args.quality) : undefined
    const fullPage = Boolean(args.fullPage)
    const clip = normalizeClip(args.clip)
  
    await ensureCdpAttached(tabId, "1.3")
  
    if (fullPage) {
      // Get full page dimensions
      const metrics = await chromeDebuggerSendCommand(
        { tabId },
        "Page.getLayoutMetrics",
        {}
      )
      const cssContentSize = metrics?.cssContentSize || metrics?.contentSize || {}
      const width = cssContentSize.width || 1280
      const height = cssContentSize.height || 720
  
      await chromeDebuggerSendCommand(
        { tabId },
        "Emulation.setDeviceMetricsOverride",
        { width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 1, mobile: false }
      )
    }
  
    const params = { format }
    if (quality !== undefined) params.quality = quality
    if (clip) {
      params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: clip.scale ?? 1 }
    }
    if (fullPage) {
      params.captureBeyondViewport = true
    }
  
    let shot
    try {
      shot = await chromeDebuggerSendCommand({ tabId }, "Page.captureScreenshot", params)
    } finally {
      if (fullPage) {
        await chromeDebuggerSendCommand(
          { tabId },
          "Emulation.clearDeviceMetricsOverride",
          {}
        ).catch(() => {})
      }
    }
  
    const mimeType = `image/${format}`
    const dataUrl = `data:${mimeType};base64,${shot?.data || ""}`
    return {
      dataUrl,
      mimeType,
      browserSessionId: session.browserSessionId,
      format,
      fullPage,
      capturedAt: new Date().toISOString(),
    }
  }
  
  function clampQuality(value) {
    const num = Number(value)
    return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 80
  }
  
  function normalizeClip(value) {
    if (!value || typeof value !== "object") return null
    const x = Number(value.x)
    const y = Number(value.y)
    const width = Number(value.width)
    const height = Number(value.height)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null
    const scale = Number.isFinite(Number(value.scale)) && Number(value.scale) > 0 ? Number(value.scale) : 1
    return { x, y, width, height, scale }
  }
  
  async function evaluateScript(tabId, session, args = {}) {
    const expression = String(args.expression || "").trim()
    if (!expression) throw new Error("expression is required")
    const awaitPromise = Boolean(args.awaitPromise)
    const maxLength = Number.isFinite(Number(args.maxLength)) && Number(args.maxLength) > 0
      ? Math.min(Number(args.maxLength), 100000)
      : 10000
  
    await ensureCdpAttached(tabId, "1.3")
  
    const result = await chromeDebuggerSendCommand(
      { tabId },
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise }
    )
  
    if (result?.exceptionDetails) {
      const text = result.exceptionDetails.text || result.exceptionDetails.exception?.description || "Script error"
      throw new Error(text)
    }
  
    const value = result?.result?.value
    const type = result?.result?.type || typeof value
    const serialized = serializeResult(value, maxLength)
  
    return {
      value: serialized,
      type,
      truncated: typeof value === "string" && value.length > maxLength,
      browserSessionId: session.browserSessionId,
    }
  }
  
  function serializeResult(value, maxLength) {
    if (value === undefined || value === null) return value
    if (typeof value === "string") {
      return value.length > maxLength ? value.slice(0, maxLength) + "..." : value
    }
    if (typeof value === "number" || typeof value === "boolean") return value
    try {
      const json = JSON.stringify(value)
      return json.length > maxLength ? json.slice(0, maxLength) + "..." : json
    } catch {
      return String(value).slice(0, maxLength)
    }
  }
  
  // Latest page uid state from yunti_observe_page or yunti_take_snapshot.
  const pageUidStore = new Map()
  
  async function takeSnapshot(tabId, session, args = {}) {
    const maxElements = Number.isFinite(Number(args.maxElements))
      ? Math.max(1, Math.min(500, Number(args.maxElements)))
      : 200
    const includeHidden = Boolean(args.includeHidden)
  
    await ensureCdpAttached(tabId, "1.3")
  
    let elements = []
    try {
      const axTree = await chromeDebuggerSendCommand(
        { tabId },
        "Accessibility.getFullAXTree",
        {}
      )
      elements = flattenAXTree(axTree?.nodes || [], maxElements, includeHidden)
    } catch {
      // Accessibility tree unavailable, fall back to DOM
      elements = await domFallbackSnapshot(tabId, maxElements)
    }
  
    storePageUidMap(session, "snapshot", elements)
  
    return {
      browserSessionId: session.browserSessionId,
      url: session.url || "",
      title: session.title || "",
      elements,
      elementCount: elements.length,
      snapshotId: `snap-${Date.now()}`,
    }
  }

  async function observePage(tabId, session, args = {}) {
    const observation = await chrome.tabs.sendMessage(tabId, {
      type: "yunti_execute_tool",
      tool: "yunti_observe_page",
      arguments: args,
    })
    if (Array.isArray(observation?.elements)) {
      storePageUidMap(session, "observe", observation.elements, {
        observationId: observation.observationId,
        uidMapVersion: observation.uidMapVersion,
      })
    }
    return observation
  }

  function storePageUidMap(session, source, elements, meta = {}) {
    const uidMap = {}
    for (const el of elements || []) {
      if (!el?.uid) continue
      uidMap[el.uid] = { ...el, source }
    }
    pageUidStore.set(session.browserSessionId, {
      source,
      uidMap,
      storedAt: Date.now(),
      ...meta,
    })
  }
  
  function flattenAXTree(nodes, maxElements, includeHidden) {
    const elements = []
    let uidCounter = 0
  
    function walk(nodeList) {
      for (const node of nodeList) {
        if (elements.length >= maxElements) return
        const el = axNodeToElement(node, ++uidCounter, includeHidden)
        if (el) elements.push(el)
        if (node.children) walk(node.children)
        if (node.childIds) {
          // childIds reference other nodes in the tree by backendDOMNodeId
        }
      }
    }
  
    walk(Array.isArray(nodes) ? nodes : [])
    return elements
  }
  
  function axNodeToElement(node, uid, includeHidden) {
    const role = String(node.role?.value || "").toLowerCase()
    if (!role) return null
  
    const name = String(node.name?.value || "").trim()
    const description = String(node.description?.value || "").trim()
  
    // Skip non-interactive and hidden elements
    const isInteractive = /button|link|textbox|combobox|listbox|checkbox|radio|menuitem|tab|switch|slider|spinbutton|option|treeitem|gridcell|rowheader|columnheader/i.test(role)
    const isStructural = /heading|list|listitem|table|row|cell|group|region|banner|main|navigation|article|section|status|alert/i.test(role)
    const hasName = name.length > 0
  
    if (!isInteractive && !isStructural && !hasName) return null
    if (!includeHidden) {
      const hidden = node.properties?.find(p => p.name === "hidden")?.value?.value
      if (hidden === true) return null
    }
  
    return {
      uid: `yunti-${uid}`,
      role,
      name,
      description: description || undefined,
      backendNodeId: node.backendDOMNodeId,
      nodeId: node.nodeId,
      childCount: (node.children?.length || 0),
      properties: summarizeAXProperties(node.properties),
    }
  }
  
  function summarizeAXProperties(properties) {
    if (!Array.isArray(properties)) return undefined
    const out = {}
    for (const prop of properties) {
      if (prop.name === "hidden" || prop.name === "focusable" || prop.name === "focused" ||
          prop.name === "disabled" || prop.name === "checked" || prop.name === "selected" ||
          prop.name === "expanded" || prop.name === "haspopup" || prop.name === "required" ||
          prop.name === "invalid" || prop.name === "level" || prop.name === "valuemin" ||
          prop.name === "valuemax" || prop.name === "valuenow" || prop.name === "valuetext" ||
          prop.name === "multiselectable" || prop.name === "readonly") {
        out[prop.name] = prop.value?.value ?? prop.value ?? true
      }
    }
    return Object.keys(out).length ? out : undefined
  }
  
  async function domFallbackSnapshot(tabId, maxElements) {
    const result = await chromeDebuggerSendCommand(
      { tabId },
      "Runtime.evaluate",
      {
        expression: `(() => {
          const elements = [];
          const interactive = 'a,button,input,select,textarea,[role="button"],[role="link"],[role="textbox"],[role="combobox"],[role="checkbox"],[role="radio"],[onclick]';
          const all = document.querySelectorAll(interactive);
          for (let i = 0; i < Math.min(all.length, ${maxElements}); i++) {
            const el = all[i];
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
            elements.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || undefined,
              name: (el.getAttribute('name') || '').slice(0, 100) || undefined,
              text: (el.textContent || '').trim().slice(0, 200) || undefined,
              type: el.type || undefined,
              placeholder: (el.placeholder || '').slice(0, 100) || undefined,
              href: el.href || undefined,
              role: el.getAttribute('role') || undefined,
              ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 200) || undefined,
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
              disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
            });
          }
          return elements;
        })()`,
        returnByValue: true,
      }
    )
    const rawElements = result?.result?.value || []
    return rawElements.map((el, i) => ({
      uid: `yunti-${i + 1}`,
      role: el.role || el.tag || "element",
      name: el.ariaLabel || el.text || el.name || el.placeholder || el.id || "",
      tag: el.tag,
      id: el.id,
      type: el.type,
      placeholder: el.placeholder,
      href: el.href,
      rect: el.rect,
      disabled: el.disabled,
    }))
  }
  
  async function clickByUid(tabId, session, args = {}) {
    const uid = String(args.uid || "").trim()
    if (uid) {
      return clickViaSnapshotUid(tabId, session, uid)
    }
    const x = Number(args.x)
    const y = Number(args.y)
    if (Number.isFinite(x) || Number.isFinite(y)) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("yunti_click coordinate mode requires both x and y. Use yunti_click_at with x/y, or call yunti_take_snapshot and pass uid.")
      }
      return clickAtCoordinate(tabId, session, x, y)
    }
    if (!String(args.selector || "").trim()) {
      throw new Error("yunti_click requires uid, selector, or both x and y. Call yunti_take_snapshot to get uid, pass a CSS selector, or use yunti_click_at for coordinate-only clicks.")
    }
    // Fall back to content script for selector-based click
    return chrome.tabs.sendMessage(tabId, {
      type: "yunti_execute_tool",
      tool: "yunti_click",
      arguments: args,
    })
  }
  
  async function hoverByUid(tabId, session, args = {}) {
    const uid = String(args.uid || "").trim()
    if (uid) {
      return hoverViaSnapshotUid(tabId, session, uid)
    }
    const x = Number(args.x)
    const y = Number(args.y)
    if (Number.isFinite(x) || Number.isFinite(y)) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("yunti_hover coordinate mode requires both x and y. Call yunti_take_snapshot to get uid, pass selector, or provide both coordinates.")
      }
      await mouseMove(tabId, x, y)
      const roundedX = Math.round(x)
      const roundedY = Math.round(y)
      return {
        hovered: true,
        x: roundedX,
        y: roundedY,
        browserSessionId: session.browserSessionId,
        method: "coordinate",
        action: "hover",
        target: { method: "coordinate", x: roundedX, y: roundedY },
        ok: true,
        recoverable: false,
        nextStepHint: "Coordinate hover dispatched. Observe again, read page state, or use a fresh uid when possible to verify menus, tooltips, or hover-only controls.",
      }
    }
    const selector = String(args.selector || "").trim()
    if (!selector) {
      throw new Error("yunti_hover requires uid, selector, or both x and y. Call yunti_take_snapshot to get uid or pass a CSS selector.")
    }
    const point = await resolveSelectorCenter(tabId, selector)
    await mouseMove(tabId, point.x, point.y)
    const roundedX = Math.round(point.x)
    const roundedY = Math.round(point.y)
    return {
      hovered: true,
      selector,
      x: roundedX,
      y: roundedY,
      browserSessionId: session.browserSessionId,
      method: "selector",
      action: "hover",
      target: { selector, method: "selector", x: roundedX, y: roundedY },
      ok: true,
      recoverable: false,
      nextStepHint: "Selector hover dispatched. Observe again, read page state, or use a fresh uid when possible to verify menus, tooltips, or hover-only controls.",
    }
  }
  
  async function fillByUid(tabId, session, args = {}) {
    validateFillArgs(args)
    const uid = String(args.uid || "").trim()
    const value = String(args.value)
    if (uid) {
      const { x, y } = await resolveUidCenter(tabId, session, uid)
      await mouseClick(tabId, x, y, 1)
      await delayCdp(100)
      // Clear existing value
      const elements = await chromeDebuggerSendCommand(
        { tabId },
        "Runtime.evaluate",
        { expression: `(() => {
          const el = document.elementFromPoint(${x}, ${y});
          if (!el) return 'not found';
          const tag = el.tagName.toLowerCase();
          if (tag === 'select') {
            const opts = Array.from(el.options);
            return { tag: 'select', options: opts.map(o => ({ value: o.value, text: o.text.slice(0, 80) })), selectedIndex: el.selectedIndex };
          }
          if (el.isContentEditable) {
            el.textContent = '';
          } else if (tag === 'input' || tag === 'textarea') {
            el.focus();
            el.select();
          }
          return { tag, type: el.type, contentEditable: el.isContentEditable };
        })()`,
          returnByValue: true,
        }
      )
      const elInfo = elements?.result?.value
  
      if (elInfo === "not found") throw new Error(`No element found at uid ${uid} coordinates`)
  
      // Handle select element
      if (elInfo?.tag === "select") {
        const targetOption = elInfo.options?.find(
          o => o.value === value || o.text === value
        )
        if (targetOption) {
          await chromeDebuggerSendCommand(
            { tabId },
            "Runtime.evaluate",
            {
              expression: `(() => {
                const el = document.elementFromPoint(${x}, ${y});
                if (el) el.value = ${JSON.stringify(targetOption.value)};
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
              })()`,
            }
          )
          return {
            filled: true,
            uid,
            method: "select",
            value: targetOption.value,
            browserSessionId: session.browserSessionId,
            action: "fill",
            target: { uid, method: "select" },
            ok: true,
            recoverable: false,
            nextStepHint: "Select value dispatched. Observe again, read page state, or evaluate the select value to verify the intended change.",
          }
        }
        throw new Error(`Option '${value}' not found in select at uid ${uid}. Use yunti_take_snapshot to inspect the select element or pass an available option value/text.`)
      }
  
      // Type text via CDP Input.dispatchKeyEvent
      const text = value
      for (const char of text) {
        await chromeDebuggerSendCommand(
          { tabId },
          "Input.dispatchKeyEvent",
          { type: "char", text: char, unmodifiedText: char }
        )
      }
      return {
        filled: true,
        uid,
        method: "keyboard",
        value: text,
        browserSessionId: session.browserSessionId,
        action: "fill",
        target: { uid, method: "keyboard" },
        ok: true,
        recoverable: false,
        nextStepHint: "Fill dispatched. Observe again, read page state, or evaluate the field value to verify the intended change.",
      }
    }
  
    return chrome.tabs.sendMessage(tabId, {
      type: "yunti_execute_tool",
      tool: "yunti_fill",
      arguments: args,
    })
  }

  function validateFillArgs(args = {}) {
    if (!Object.prototype.hasOwnProperty.call(args, "value") || args.value === undefined || args.value === null) {
      throw new Error("yunti_fill requires value. Pass { value: \"...\", uid: \"yunti-...\" } after yunti_take_snapshot, or pass value with a CSS selector.")
    }
    const uid = String(args.uid || "").trim()
    const selector = String(args.selector || "").trim()
    const hasX = Number.isFinite(Number(args.x))
    const hasY = Number.isFinite(Number(args.y))
    if (hasX || hasY) {
      throw new Error("yunti_fill does not support coordinate-only targeting. Call yunti_take_snapshot and pass uid, or pass selector with value.")
    }
    if (!uid && !selector) {
      throw new Error("yunti_fill requires uid or selector with value. Call yunti_take_snapshot to get uid, or pass a CSS selector.")
    }
  }
  
  async function clickViaSnapshotUid(tabId, session, uid) {
    const { x, y } = await resolveUidCenter(tabId, session, uid)
    await mouseClick(tabId, x, y, 1)
    const roundedX = Math.round(x)
    const roundedY = Math.round(y)
    return {
      clicked: true,
      uid,
      x: roundedX,
      y: roundedY,
      browserSessionId: session.browserSessionId,
      action: "click",
      target: { uid, x: roundedX, y: roundedY },
      ok: true,
      recoverable: false,
      nextStepHint: "Click dispatched. Observe again or read page state to verify the intended change.",
    }
  }
  
  async function hoverViaSnapshotUid(tabId, session, uid) {
    const { x, y } = await resolveUidCenter(tabId, session, uid)
    await mouseMove(tabId, x, y)
    const roundedX = Math.round(x)
    const roundedY = Math.round(y)
    return {
      hovered: true,
      uid,
      x: roundedX,
      y: roundedY,
      browserSessionId: session.browserSessionId,
      action: "hover",
      target: { uid, x: roundedX, y: roundedY },
      ok: true,
      recoverable: false,
      nextStepHint: "Hover dispatched. Observe again or read page state to verify menus, tooltips, or hover-only controls.",
    }
  }
  
  async function clickAtCoordinate(tabId, session, x, y) {
    await mouseClick(tabId, x, y, 1)
    const roundedX = Math.round(x)
    const roundedY = Math.round(y)
    return {
      clicked: true,
      x: roundedX,
      y: roundedY,
      browserSessionId: session.browserSessionId,
      method: "coordinate",
      action: "click",
      target: { method: "coordinate", x: roundedX, y: roundedY },
      ok: true,
      recoverable: false,
      nextStepHint: "Coordinate click dispatched. Observe again, read page state, or use a fresh uid when possible to verify the intended change.",
    }
  }
  
  async function resolveSelectorCenter(tabId, selector) {
    await ensureCdpAttached(tabId, "1.3")
    const escapedSelector = JSON.stringify(selector)
    const result = await chromeDebuggerSendCommand(
      { tabId },
      "Runtime.evaluate",
      {
        expression: `(() => {
          const element = document.querySelector(${escapedSelector});
          if (!element) return { ok: false, error: "Element not found: " + ${escapedSelector} };
          const rect = element.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            return { ok: false, error: "Element is hidden or has no size: " + ${escapedSelector} };
          }
          element.scrollIntoView({ block: "center", inline: "center" });
          const next = element.getBoundingClientRect();
          return {
            ok: true,
            x: next.left + next.width / 2,
            y: next.top + next.height / 2,
          };
        })()`,
        returnByValue: true,
      }
    )
    const value = result?.result?.value
    if (!value?.ok) {
      throw new Error(value?.error || `Element not found: ${selector}`)
    }
    return { x: Number(value.x), y: Number(value.y) }
  }
  
  async function resolveUidCenter(tabId, session, uid) {
    const uidState = pageUidStore.get(session.browserSessionId)
    const uidMap = uidState?.uidMap
    if (!uidMap || !uidMap[uid]) {
      throw new Error(
        `uid ${uid} not found in the latest page uid map. Run yunti_observe_page or yunti_take_snapshot again before retrying.`
      )
    }
    const el = uidMap[uid]
  
    if (el.rect && el.rect.width > 0 && el.rect.height > 0) {
      return {
        x: el.rect.x + el.rect.width / 2,
        y: el.rect.y + el.rect.height / 2,
      }
    }
  
    // Resolve coordinates via CDP DOM.getBoxModel using backendNodeId
    if (el.backendNodeId) {
      await ensureCdpAttached(tabId, "1.3")
      const boxModel = await chromeDebuggerSendCommand(
        { tabId },
        "DOM.getBoxModel",
        { backendNodeId: el.backendNodeId }
      )
      const content = boxModel?.model?.content
      if (content && content.length >= 4) {
        const x = (content[0] + content[4]) / 2
        const y = (content[1] + content[5]) / 2
        return { x, y }
      }
    }
  
    throw new Error(`Cannot resolve coordinates for uid ${uid}. Element may be off-screen, hidden, or stale. Run yunti_observe_page again before retrying.`)
  }
  
  async function mouseClick(tabId, x, y, clickCount = 1) {
    await ensureCdpAttached(tabId, "1.3")
    const button = "left"
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mousePressed", x, y, button, clickCount,
    })
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x, y, button, clickCount,
    })
  }
  
  async function mouseMove(tabId, x, y) {
    await ensureCdpAttached(tabId, "1.3")
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseMoved", x, y,
    })
  }
  
  async function fillForm(tabId, session, args = {}) {
    const fields = Array.isArray(args.fields) ? args.fields : []
    if (!fields.length) throw new Error("fields array is required")
  
    let filled = 0
    let failed = 0
    const results = []
  
    for (const field of fields) {
      try {
        const uid = String(field.uid || "").trim()
        if (uid) {
          await fillByUid(tabId, session, { uid, value: String(field.value || "") })
        } else {
          await chrome.tabs.sendMessage(tabId, {
            type: "yunti_execute_tool",
            tool: "yunti_fill",
            arguments: { selector: field.selector, value: field.value },
          })
        }
        filled++
        results.push({ uid: field.uid, selector: field.selector, ok: true })
      } catch (err) {
        failed++
        results.push({ uid: field.uid, selector: field.selector, ok: false, error: err?.message || String(err) })
      }
    }
  
    return { filled, failed, results, browserSessionId: session.browserSessionId }
  }
  
  async function waitForCondition(tabId, session, args = {}) {
    const timeoutMs = Number.isFinite(Number(args.timeoutMs))
      ? Math.max(100, Math.min(30000, Number(args.timeoutMs)))
      : 5000
    const text = String(args.text || "").trim()
    const selector = String(args.selector || "").trim()
    const urlContains = String(args.urlContains || "").trim()
  
    if (!text && !selector && !urlContains) {
      throw new Error("At least one of text, selector, or urlContains is required")
    }
  
    await ensureCdpAttached(tabId, "1.3")
    const startTime = Date.now()
  
    while (Date.now() - startTime < timeoutMs) {
      if (urlContains) {
        const tab = await chrome.tabs.get(tabId)
        if (tab.url && tab.url.includes(urlContains)) {
          return { found: true, condition: "urlContains", value: urlContains, waitedMs: Date.now() - startTime, browserSessionId: session.browserSessionId }
        }
      }
  
      if (text || selector) {
        const expression = `(() => {
          ${selector ? `const el = document.querySelector(${JSON.stringify(selector)}); if (el) { const rect = el.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) return { found: 'selector', selector: ${JSON.stringify(selector)} }; }` : ""}
          ${text ? `if (document.body && document.body.innerText && document.body.innerText.includes(${JSON.stringify(text)})) return { found: 'text', text: ${JSON.stringify(text)} };` : ""}
          return null;
        })()`
  
        const result = await chromeDebuggerSendCommand(
          { tabId },
          "Runtime.evaluate",
          { expression, returnByValue: true }
        )
  
        if (result?.result?.value) {
          return { found: true, ...result.result.value, waitedMs: Date.now() - startTime, browserSessionId: session.browserSessionId }
        }
      }
  
      await delayCdp(200)
    }
  
    return { found: false, waitedMs: timeoutMs, browserSessionId: session.browserSessionId }
  }
  
  async function handleDialog(tabId, session, args = {}) {
    const action = String(args.action || "accept").trim()
    if (action !== "accept" && action !== "dismiss") throw new Error("action must be 'accept' or 'dismiss'")
    const promptText = action === "accept" ? String(args.promptText || "") : undefined
  
    await ensureCdpAttached(tabId, "1.3")
    await chromeDebuggerSendCommand(
      { tabId },
      "Page.handleJavaScriptDialog",
      { accept: action === "accept", promptText }
    )
    return { handled: true, action, browserSessionId: session.browserSessionId }
  }
  
  async function resizePage(tabId, session, args = {}) {
    const width = Number.isFinite(Number(args.width)) ? Math.round(Number(args.width)) : null
    const height = Number.isFinite(Number(args.height)) ? Math.round(Number(args.height)) : null
    const deviceScaleFactor = Number.isFinite(Number(args.deviceScaleFactor)) && Number(args.deviceScaleFactor) > 0
      ? Number(args.deviceScaleFactor) : 1
  
    if (!width && !height) throw new Error("width and/or height is required")
  
    await ensureCdpAttached(tabId, "1.3")
    const params = { deviceScaleFactor, mobile: false }
    if (width) params.width = width
    if (height) params.height = height
    await chromeDebuggerSendCommand({ tabId }, "Emulation.setDeviceMetricsOverride", params)
    return { resized: true, width, height, deviceScaleFactor, browserSessionId: session.browserSessionId }
  }
  
  async function emulateDevice(tabId, session, args = {}) {
    await ensureCdpAttached(tabId, "1.3")
  
    if (args.clear) {
      await chromeDebuggerSendCommand({ tabId }, "Emulation.clearDeviceMetricsOverride", {})
      // Use userAgent: "" to clear UA override — Chrome requires explicit param
      await chromeDebuggerSendCommand({ tabId }, "Emulation.setUserAgentOverride", { userAgent: "" })
      // Use -1 for unlimited throughput (0 = zero bandwidth)
      await chromeDebuggerSendCommand({ tabId }, "Network.emulateNetworkConditions", {
        offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: "none",
      })
      // Also clear CPU throttling
      await chromeDebuggerSendCommand({ tabId }, "Emulation.setCPUThrottlingRate", { rate: 1 })
      return { emulated: false, cleared: true, browserSessionId: session.browserSessionId }
    }
  
    const deviceOverrides = resolveDeviceOverrides(args.deviceName)
  
    // Viewport
    if (args.viewport || deviceOverrides) {
      const vp = args.viewport || deviceOverrides || {}
      const w = Number.isFinite(Number(vp.width)) ? Math.round(Number(vp.width)) : 375
      const h = Number.isFinite(Number(vp.height)) ? Math.round(Number(vp.height)) : 812
      const dsf = Number.isFinite(Number(vp.deviceScaleFactor)) && Number(vp.deviceScaleFactor) > 0
        ? Number(vp.deviceScaleFactor) : 2
      await chromeDebuggerSendCommand({ tabId }, "Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: dsf, mobile: true,
      })
    }
  
    // User agent
    if (args.userAgent || deviceOverrides?.userAgent) {
      await chromeDebuggerSendCommand({ tabId }, "Emulation.setUserAgentOverride", {
        userAgent: args.userAgent || deviceOverrides.userAgent,
      })
    }
  
    // CPU throttle
    if (Number.isFinite(Number(args.cpuThrottleRate)) && Number(args.cpuThrottleRate) > 1) {
      await chromeDebuggerSendCommand({ tabId }, "Emulation.setCPUThrottlingRate", {
        rate: Number(args.cpuThrottleRate),
      })
    }
  
    // Network conditions
    if (args.networkConditions && args.networkConditions !== "none") {
      const conditions = NETWORK_CONDITIONS[args.networkConditions] || NETWORK_CONDITIONS.slow3g
      await chromeDebuggerSendCommand({ tabId }, "Network.emulateNetworkConditions", {
        offline: false, ...conditions,
      })
    }
  
    return { emulated: true, deviceName: args.deviceName || null, browserSessionId: session.browserSessionId }
  }
  
  const DEVICE_PRESETS = {
    "iPhone 12": { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15" },
    "iPhone SE": { width: 375, height: 667, deviceScaleFactor: 2, mobile: true },
    "Pixel 5": { width: 393, height: 851, deviceScaleFactor: 2.75, mobile: true, userAgent: "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36" },
    "iPad": { width: 810, height: 1080, deviceScaleFactor: 2, mobile: true },
    "iPad Pro": { width: 1024, height: 1366, deviceScaleFactor: 2, mobile: true },
  }
  
  const NETWORK_CONDITIONS = {
    offline: { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: "none" },
    slow3g: { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 20000, connectionType: "cellular3g" },
    fast3g: { offline: false, latency: 563, downloadThroughput: 180000, uploadThroughput: 45000, connectionType: "cellular3g" },
    slow4g: { offline: false, latency: 100, downloadThroughput: 1750000, uploadThroughput: 500000, connectionType: "cellular4g" },
  }
  
  function resolveDeviceOverrides(deviceName) {
    if (!deviceName) return null
    const key = String(deviceName).trim()
    return DEVICE_PRESETS[key] || DEVICE_PRESETS[Object.keys(DEVICE_PRESETS).find(k => k.toLowerCase() === key.toLowerCase())] || null
  }
  
  async function newPage(parentSession = null, args = {}) {
    const url = String(args.url || "").trim()
    const active = args.active !== false
    const tab = await chrome.tabs.create({ url: url || undefined, active })
    const browserSessionId = `yunti-${tab.id}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
    const session = {
      browserSessionId,
      userId: parentSession?.userId || "",
      displayName: parentSession?.displayName || "",
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url || url,
      title: tab.title || "",
      registeredAt: new Date().toISOString(),
    }
    sessionsByTab.set(tab.id, session)
    await postBridge("/sessions/register", session).catch(() => null)
    startPolling(tab.id)
    return { created: true, browserSessionId, tabId: tab.id, windowId: tab.windowId, url: tab.url || url, title: tab.title || "" }
  }
  
  async function closePage(tabId, session, args = {}) {
    if (args.tabId !== undefined || args.targetId !== undefined) {
      throw new Error("yunti_close_page only closes the registered page identified by browserSessionId. To close by tabId or targetId, call yunti_cdp_send_command with method Target.closeTarget and top-level tabId or targetId.")
    }
    const connectedTabs = [...sessionsByTab.keys()]
    if (connectedTabs.length <= 1) {
      throw new Error("Cannot close the last connected tab")
    }
    await detachCdpTab(tabId, session, "page_closed").catch(() => {})
    await chrome.tabs.remove(tabId)
    sessionsByTab.delete(tabId)
    pollers.get(tabId)?.abort()
    pollers.delete(tabId)
    return { closed: true, browserSessionId: session.browserSessionId, tabId }
  }
  
  async function performDrag(tabId, session, args = {}) {
    const fromX = Number(args.fromX)
    const fromY = Number(args.fromY)
    const toX = Number(args.toX)
    const toY = Number(args.toY)
    if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) {
      throw new Error("fromX, fromY, toX, toY are required and must be numbers")
    }
    const steps = Number.isFinite(Number(args.steps)) ? Math.max(1, Math.min(50, Math.round(Number(args.steps)))) : 10
  
    await ensureCdpAttached(tabId, "1.3")
    const button = "left"
  
    // Mouse press at start
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mousePressed", x: fromX, y: fromY, button, clickCount: 1,
    })
  
    // Move through intermediate points
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1)
      const x = fromX + (toX - fromX) * t
      const y = fromY + (toY - fromY) * t
      await chromeDebuggerSendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseMoved", x, y, button, buttons: 1,
      })
      await delayCdp(16) // ~60fps
    }
  
    // Mouse release at end
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x: toX, y: toY, button, clickCount: 1,
    })
  
    return { dragged: true, from: { x: Math.round(fromX), y: Math.round(fromY) }, to: { x: Math.round(toX), y: Math.round(toY) }, steps, browserSessionId: session.browserSessionId }
  }
  
  async function uploadFile(tabId, session, args = {}) {
    const filePaths = Array.isArray(args.filePaths) ? args.filePaths.filter(p => typeof p === "string") : []
    if (!filePaths.length) throw new Error("filePaths array is required")
  
    const uid = String(args.uid || "").trim()
    const selector = String(args.selector || "").trim()
  
    await ensureCdpAttached(tabId, "1.3")
  
    let backendNodeId = null
    if (uid) {
      const { x, y } = await resolveUidCenter(tabId, session, uid)
      const nodeResult = await chromeDebuggerSendCommand({ tabId }, "DOM.getNodeForLocation", { x: Math.round(x), y: Math.round(y) })
      backendNodeId = nodeResult?.backendNodeId
    } else if (selector) {
      const docResult = await chromeDebuggerSendCommand({ tabId }, "DOM.getDocument", {})
      const rootNodeId = docResult?.root?.nodeId
      if (rootNodeId) {
        const queryResult = await chromeDebuggerSendCommand({ tabId }, "DOM.querySelector", { nodeId: rootNodeId, selector })
        if (queryResult?.nodeId) {
          const nodeResult = await chromeDebuggerSendCommand({ tabId }, "DOM.describeNode", { nodeId: queryResult.nodeId })
          backendNodeId = nodeResult?.node?.backendNodeId
        }
      }
    }
  
    if (!backendNodeId) throw new Error("Cannot resolve file input element. Provide a valid uid from yunti_take_snapshot or a CSS selector.")
  
    await chromeDebuggerSendCommand({ tabId }, "DOM.setFileInputFiles", {
      files: filePaths,
      backendNodeId,
    })
  
    return { uploaded: true, fileCount: filePaths.length, filePaths, browserSessionId: session.browserSessionId }
  }
  
  async function typeTextByUid(tabId, session, args = {}) {
    const uid = String(args.uid || "").trim()
    if (!uid) {
      // Fall back to content script for selector/coordinate-based typing
      return chrome.tabs.sendMessage(tabId, {
        type: "yunti_execute_tool",
        tool: "yunti_type_text",
        arguments: args,
      })
    }
  
    const text = String(args.text || "")
    if (!text) throw new Error("text is required")
  
    // Click the uid element to focus it
    const { x, y } = await resolveUidCenter(tabId, session, uid)
    await mouseClick(tabId, x, y, 1)
    await delayCdp(100)
  
    // Type each character via CDP
    for (const char of text) {
      await chromeDebuggerSendCommand(
        { tabId },
        "Input.dispatchKeyEvent",
        { type: "char", text: char, unmodifiedText: char }
      )
    }
  
    return { typed: true, uid, text, method: "cdp.keyboard", browserSessionId: session.browserSessionId }
  }
  
  async function pressKeyByUid(tabId, session, args = {}) {
    const uid = String(args.uid || "").trim()
    if (!uid) {
      return chrome.tabs.sendMessage(tabId, {
        type: "yunti_execute_tool",
        tool: "yunti_press_key",
        arguments: args,
      })
    }
  
    const key = String(args.key || "").trim()
    if (!key) throw new Error("key is required")
  
    // Focus the uid element
    const { x, y } = await resolveUidCenter(tabId, session, uid)
    await mouseClick(tabId, x, y, 1)
    await delayCdp(50)
  
    // Map common key names to CDP key events
    const keyDef = normalizeKey(key)
  
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyDown",
      key: keyDef.key,
      code: keyDef.code,
      windowsVirtualKeyCode: keyDef.keyCode,
      nativeVirtualKeyCode: keyDef.keyCode,
    })
    await chromeDebuggerSendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyUp",
      key: keyDef.key,
      code: keyDef.code,
      windowsVirtualKeyCode: keyDef.keyCode,
      nativeVirtualKeyCode: keyDef.keyCode,
    })
  
    return { pressed: true, uid, key, browserSessionId: session.browserSessionId }
  }
  
  const KEY_MAP = {
    Enter: { key: "Enter", code: "Enter", keyCode: 13 },
    Escape: { key: "Escape", code: "Escape", keyCode: 27 },
    Tab: { key: "Tab", code: "Tab", keyCode: 9 },
    Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
    Delete: { key: "Delete", code: "Delete", keyCode: 46 },
    ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    Home: { key: "Home", code: "Home", keyCode: 36 },
    End: { key: "End", code: "End", keyCode: 35 },
    PageUp: { key: "PageUp", code: "PageUp", keyCode: 33 },
    PageDown: { key: "PageDown", code: "PageDown", keyCode: 34 },
    Space: { key: " ", code: "Space", keyCode: 32 },
    F1: { key: "F1", code: "F1", keyCode: 112 },
    F2: { key: "F2", code: "F2", keyCode: 113 },
    F3: { key: "F3", code: "F3", keyCode: 114 },
    F4: { key: "F4", code: "F4", keyCode: 115 },
    F5: { key: "F5", code: "F5", keyCode: 116 },
    F6: { key: "F6", code: "F6", keyCode: 117 },
    F7: { key: "F7", code: "F7", keyCode: 118 },
    F8: { key: "F8", code: "F8", keyCode: 119 },
    F9: { key: "F9", code: "F9", keyCode: 120 },
    F10: { key: "F10", code: "F10", keyCode: 121 },
    F11: { key: "F11", code: "F11", keyCode: 122 },
    F12: { key: "F12", code: "F12", keyCode: 123 },
    Control: { key: "Control", code: "ControlLeft", keyCode: 17 },
    Shift: { key: "Shift", code: "ShiftLeft", keyCode: 16 },
    Alt: { key: "Alt", code: "AltLeft", keyCode: 18 },
    Meta: { key: "Meta", code: "MetaLeft", keyCode: 91 },
  }
  
  function normalizeKey(key) {
    const upper = key.slice(0, 1).toUpperCase() + key.slice(1).toLowerCase()
    if (KEY_MAP[upper]) return KEY_MAP[upper]
    if (KEY_MAP[key]) return KEY_MAP[key]
    // Fallback for single characters
    if (key.length === 1) {
      const code = key.toUpperCase().charCodeAt(0)
      return { key, code: `Key${key.toUpperCase()}`, keyCode: code }
    }
    return { key, code: key, keyCode: 0 }
  }

  return { executeToolRequest }
}
