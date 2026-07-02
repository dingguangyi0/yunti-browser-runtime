export const TOOLS = [
  {
    name: "yunti_get_tool_usage_hints",
    description:
      "Return current Yunti Browser Runtime MCP tool usage hints, required parameters, common mistakes, and recommended workflows. With no arguments it returns core rules and key tools; pass tool for one tool's schema/hints, or topic for a filtered group. Use this before retrying a failed or uncertain yunti_* tool call.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description:
            "Optional tool name to focus on, for example yunti_evaluate_script or yunti_close_page.",
        },
        topic: {
          type: "string",
          enum: ["all", "browser", "cdp", "tabs", "memory", "network", "console"],
          description: "Optional topic filter. Defaults to all.",
        },
      },
    },
  },
  {
    name: "yunti_get_page_snapshot",
    description:
      "Read a lightweight current-user browser page snapshot: URL, title, auth state, selected text, visible text excerpt, browserSessionId, and optional element summaries. Does not read raw cookies.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "Optional target Yunti browser session owned by the required userId. Use the browserSessionId returned by yunti_get_page_snapshot or the current Yunti browser route for stable current-tab routing.",
        },
        mode: {
          type: "string",
          enum: ["light", "detailed"],
          description:
            "Use light for session/auth/page overview. Use detailed only when element summaries are needed.",
        },
        includeElements: {
          type: "boolean",
          description:
            "Include forms, buttons, inputs, links, and tables. Defaults to true only when mode is detailed.",
        },
        maxTextLength: {
          type: "integer",
          minimum: 0,
          maximum: 60000,
          description: "Maximum visible text characters to return.",
        },
      },
    },
  },
  {
    name: "yunti_observe_page",
    description:
      "Observe the current browser page for agentic operation. Returns an observationId, page/viewport/scroll metadata, a compact interactive text tree, structured elements with fresh uids, scrollable container metadata, redaction metadata, and next-step hints. Prefer this for observe -> act by uid -> verify workflows once available. Sensitive credential-like values are redacted by default.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "Optional target Yunti browser session. Use the returned browserSessionId for follow-up actions on the same tab.",
        },
        mode: {
          type: "string",
          enum: ["viewport", "fullPage"],
          description:
            "Observation scope. Defaults to viewport; fullPage is bounded by maxElements and maxTextLength.",
        },
        maxElements: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Maximum interactive elements to return. Defaults to a bounded runtime value.",
        },
        maxTextLength: {
          type: "integer",
          minimum: 0,
          maximum: 60000,
          description: "Maximum textTree/visible text characters to return.",
        },
        includeHidden: {
          type: "boolean",
          description: "Include hidden or invisible elements. Defaults to false.",
        },
        includeTextTree: {
          type: "boolean",
          description: "Include the compact agent-facing interactive text tree. Defaults to true.",
        },
        includeRects: {
          type: "boolean",
          description: "Include viewport-relative element rectangles. Defaults to true.",
        },
        redaction: {
          type: "string",
          enum: ["balanced", "strict", "off"],
          description:
            "DOM observation redaction mode. Defaults to balanced. Use off only for explicit local debugging; it is not recommended for agent workflows.",
        },
      },
    },
  },
  {
    name: "yunti_get_selected_context",
    description:
      "Read the current selection and nearest DOM context from the active browser page.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
      },
    },
  },
  {
    name: "yunti_fetch_with_cookie",
    description:
      "Ask the browser extension to fetch an internal platform URL with the current browser login cookies. Cookie values are never returned.",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        browserSessionId: { type: "string" },
        url: { type: "string" },
        method: { type: "string", default: "GET" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        body: { type: "string" },
        maxBytes: { type: "integer", minimum: 1024, maximum: 1000000 },
        confirmed: {
          type: "boolean",
          description: "Set true only after the user approved a dangerous non-read request.",
        },
      },
    },
  },
  {
    name: "yunti_get_network_log",
    description:
      "Read recent sanitized internal platform network observations captured by the browser extension. Does not include raw cookies, auth headers, or response bodies.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        sinceId: { type: "integer", minimum: 1 },
        method: { type: "string" },
        urlContains: { type: "string" },
      },
    },
  },
  {
    name: "yunti_clear_network_log",
    description:
      "Clear sanitized Yunti network observations for the active tab, a selected session, or all sessions.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_clear_network_requests",
    description:
      "Clear structured network request observations for the active tab, a selected session, or all sessions. Alias of yunti_clear_network_log with network-request naming.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_list_network_requests",
    description:
      "List network requests captured from the active browser page with request ids, resource type, status, timing, and sanitized summaries.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        sinceId: { type: "integer", minimum: 1 },
        method: { type: "string" },
        urlContains: { type: "string" },
      },
    },
  },
  {
    name: "yunti_get_network_request",
    description:
      "Get a single network request by its event id (from yunti_list_network_requests). Returns URL, method, status, timing, request body summary, and sanitized headers.",
    inputSchema: {
      type: "object",
      required: ["eventId"],
      properties: {
        browserSessionId: { type: "string" },
        eventId: { type: "integer", description: "The event id from yunti_list_network_requests or yunti_get_network_log." },
      },
    },
  },
  {
    name: "yunti_remember_learning",
    description:
      "Store an auditable Yunti learning memory such as an API pattern, workflow step, selector, field mapping, or gotcha. Do not store secrets or raw cookies.",
    inputSchema: {
      type: "object",
      required: ["title", "detail"],
      properties: {
        userId: {
          type: "string",
          description:
            "Optional local route user id. Defaults to YUNTI_BROWSER_USER_ID or local.",
        },
        kind: { type: "string" },
        title: { type: "string" },
        detail: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        source: { type: "string" },
        relatedNetworkEventIds: { type: "array", items: { type: "integer" } },
      },
    },
  },
  {
    name: "yunti_get_learning_memory",
    description: "Search auditable Yunti learning memories recorded by agents.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "Optional local route user id. Defaults to YUNTI_BROWSER_USER_ID or local.",
        },
        query: { type: "string" },
        kind: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "yunti_forget_learning_memory",
    description: "Delete one Yunti learning memory by id, or all memories when confirmed.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "Optional local route user id. Defaults to YUNTI_BROWSER_USER_ID or local.",
        },
        id: { type: "string" },
        all: { type: "boolean" },
        confirmed: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_apply_preview_patch",
    description:
      "Apply temporary DOM patches to the current browser page. Patches are preview-only and disappear after refresh.",
    inputSchema: {
      type: "object",
      required: ["patches"],
      properties: {
        browserSessionId: { type: "string" },
        patchId: { type: "string" },
        patches: {
          type: "array",
          items: {
            type: "object",
            required: ["selector"],
            properties: {
              selector: { type: "string" },
              text: { type: "string" },
              html: { type: "string" },
              value: { type: "string" },
              appendHtml: { type: "string" },
              beforeHtml: { type: "string" },
              afterHtml: { type: "string" },
              style: { type: "object", additionalProperties: { type: "string" } },
              attributes: { type: "object", additionalProperties: { type: "string" } },
              className: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "yunti_capture_visible_tab",
    description:
      "Capture a PNG screenshot of the visible area of the active Yunti browser tab through the extension. Reuses the user's current browser without requiring a separate debugging setup.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
      },
    },
  },
  {
    name: "yunti_list_browser_targets",
    description:
      "List all Chrome/Edge browser targets visible inside the current user's local browser instance through Yunti Browser Runtime. This is the canonical whole-browser inventory for tab/page counts and target overviews.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "Optional connected Yunti browser session used as the local extension route. Pass the current session id when available.",
        },
      },
    },
  },
  {
    name: "yunti_get_browser_target",
    description:
      "Get one Chrome/Edge browser target from the current user's local browser instance by targetId or tabId. Use this after yunti_list_browser_targets for detailed target inspection without switching browser sessions.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "Optional connected Yunti browser session used as the local extension route. Pass the current session id when available.",
        },
        targetId: {
          type: "string",
          description: "Target id returned by yunti_list_browser_targets.",
        },
        tabId: {
          type: "integer",
          description: "Chrome/Edge tab id returned by yunti_list_browser_targets.",
        },
      },
    },
  },
  {
    name: "yunti_cdp_send_command",
    description:
      "Forward one low-level browser protocol command through the installed Yunti extension. The required userId is the isolation scope; browserSessionId routes the request to that user's extension/browser instance. Optional tabId or targetId selects the concrete Chrome/Edge target inside that browser, including targets listed by yunti_list_browser_targets that are not registered Yunti sessions. Browser method names such as Target.activateTarget, Runtime.evaluate, Page.navigate, Network.enable, and DOM.* are not terminal/shell commands; call them here through the method and params fields. For current-page or multi-step operations, pass both userId and browserSessionId from yunti_get_page_snapshot or the current Yunti browser route so Runtime.evaluate and follow-up calls stay on the same tab. For switching to a specific tab, use yunti_list_browser_targets with userId/browserSessionId to find tabId or targetId, then call Target.activateTarget through this tool.",
    inputSchema: {
      type: "object",
      required: ["method"],
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "Routes the request to this user's connected Yunti extension session. This is the browser channel, not necessarily the final CDP target when tabId/targetId is set.",
        },
        tabId: {
          type: "number",
          description:
            "Optional Chrome/Edge tab id returned by yunti_list_browser_targets. When set, CDP is sent to this tab even if it is not a registered Yunti page.",
        },
        targetId: {
          type: "string",
          description:
            "Optional target id returned by yunti_list_browser_targets, or tab-<tabId>. When set, CDP is sent to the resolved tab even if it is not a registered Yunti page.",
        },
        method: {
          type: "string",
          description: "Browser protocol method name, for example Runtime.evaluate or Page.captureScreenshot.",
        },
        params: {
          type: "object",
          description: "Raw CDP command parameters.",
          additionalProperties: true,
        },
        protocolVersion: {
          type: "string",
          description: "Debugger protocol version for first attach. Defaults to 1.3.",
        },
        attach: {
          type: "boolean",
          description: "Attach before sending. Defaults to true.",
        },
      },
    },
  },
  {
    name: "yunti_cdp_detach",
    description:
      "Detach the Yunti extension from the active browser tab's low-level browser protocol target.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
      },
    },
  },
  {
    name: "yunti_get_cdp_events",
    description:
      "Read raw low-level browser protocol events forwarded by the browser extension for the active tab. First internal version does not redact event payloads.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        sinceId: { type: "integer", minimum: 1 },
        method: { type: "string" },
      },
    },
  },
  {
    name: "yunti_clear_cdp_events",
    description:
      "Clear raw CDP events for the active tab, a selected session, or all sessions.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_click_at",
    description:
      "Click a viewport coordinate in the current browser page through the extension. Useful when selector tools are brittle. Dangerous targets require confirmation.",
    inputSchema: {
      type: "object",
      required: ["x", "y"],
      properties: {
        browserSessionId: { type: "string" },
        x: { type: "number", description: "Viewport x coordinate in CSS pixels." },
        y: { type: "number", description: "Viewport y coordinate in CSS pixels." },
        confirmed: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_type_text",
    description:
      "Type or set text in the focused element, a selector target, a uid target (from yunti_observe_page or yunti_take_snapshot), or a coordinate target on the current browser page.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        browserSessionId: { type: "string" },
        uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot." },
        text: { type: "string" },
        selector: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        clear: { type: "boolean", description: "Replace existing text instead of appending." },
      },
    },
  },
  {
    name: "yunti_press_key",
    description:
      "Send a keyboard key event to the focused element, a uid target (from yunti_observe_page or yunti_take_snapshot), a selector target, or a coordinate target on the current browser page.",
    inputSchema: {
      type: "object",
      required: ["key"],
      properties: {
        browserSessionId: { type: "string" },
        uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot." },
        key: { type: "string", description: "Examples: Enter, Escape, Tab, ArrowDown, Backspace." },
        selector: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
      },
    },
  },
  {
    name: "yunti_scroll",
    description:
      "Scroll the current browser page or the scrollable container under a viewport coordinate through the extension.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        deltaX: { type: "number", default: 0 },
        deltaY: { type: "number", default: 600 },
      },
    },
  },
  {
    name: "yunti_drag",
    description:
      "Drag from one viewport coordinate to another. Uses CDP Input.dispatchMouseEvent sequence: press → move → release. Useful for sliders, sortable lists, and drag-and-drop UI.",
    inputSchema: {
      type: "object",
      required: ["fromX", "fromY", "toX", "toY"],
      properties: {
        browserSessionId: { type: "string" },
        fromX: { type: "number", description: "Start viewport x coordinate." },
        fromY: { type: "number", description: "Start viewport y coordinate." },
        toX: { type: "number", description: "End viewport x coordinate." },
        toY: { type: "number", description: "End viewport y coordinate." },
        steps: { type: "integer", minimum: 1, maximum: 50, description: "Number of intermediate move events. Defaults to 10." },
      },
    },
  },
  {
    name: "yunti_upload_file",
    description:
      "Set files on a file input element by uid (from yunti_observe_page or yunti_take_snapshot) or selector. Uses CDP DOM.setFileInputFiles. Paths must be accessible to the browser.",
    inputSchema: {
      type: "object",
      required: ["filePaths"],
      properties: {
        browserSessionId: { type: "string" },
        uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot for the file input." },
        selector: { type: "string", description: "CSS selector for the file input element." },
        filePaths: { type: "array", items: { type: "string" }, description: "Absolute file paths to upload." },
      },
    },
  },
  {
    name: "yunti_rollback_preview_patch",
    description:
      "Rollback one temporary preview patch by patchId, or all preview patches if patchId is omitted.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        patchId: { type: "string" },
      },
    },
  },
  {
    name: "yunti_click",
    description:
      "Click an element on the current browser page using a uid from yunti_observe_page or yunti_take_snapshot, a CSS selector, or viewport coordinates. Prefer a fresh uid for reliability. For coordinate-only clicks, yunti_click_at is the clearer dedicated tool. Dangerous labels require user confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot (e.g. yunti-1). Takes precedence over selector." },
        selector: { type: "string", description: "CSS selector. Used when uid is not provided." },
        x: { type: "number", description: "Viewport x coordinate fallback. Use together with y; yunti_click_at is preferred for coordinate-only clicks." },
        y: { type: "number", description: "Viewport y coordinate fallback. Use together with x; yunti_click_at is preferred for coordinate-only clicks." },
        confirmed: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_hover",
    description:
      "Hover over an element on the current browser page using a uid from yunti_observe_page or yunti_take_snapshot, a CSS selector, or viewport coordinates. Useful for triggering tooltips, dropdowns, and hover menus.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot (e.g. yunti-1). Takes precedence over selector." },
        selector: { type: "string", description: "CSS selector fallback. The element center is resolved and hovered through CDP." },
        x: { type: "number", description: "Viewport x coordinate fallback. Use together with y." },
        y: { type: "number", description: "Viewport y coordinate fallback. Use together with x." },
      },
    },
  },
  {
    name: "yunti_fill",
    description:
      "Fill an input, textarea, select, or contenteditable element using a uid from yunti_observe_page or yunti_take_snapshot, or a CSS selector. Prefer a fresh uid for reliability.",
    inputSchema: {
      type: "object",
      required: ["value"],
      properties: {
        browserSessionId: { type: "string" },
        uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot (e.g. yunti-3). Takes precedence over selector." },
        selector: { type: "string", description: "CSS selector. Used when uid is not provided." },
        value: { type: "string" },
      },
    },
  },
  {
    name: "yunti_list_console_messages",
    description:
      "List console messages (console.log, console.error, console.warn, etc.) captured from the active browser page via CDP Runtime/Log events. Supports filtering by level and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
        level: { type: "string", enum: ["error", "warning", "info", "debug", "log", "verbose"] },
        source: { type: "string", enum: ["console-api", "javascript", "network", "other"] },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        sinceId: { type: "integer", minimum: 1 },
      },
    },
  },
  {
    name: "yunti_get_console_message",
    description:
      "Get a single console message by its msgid from yunti_list_console_messages. Returns full detail including stack trace.",
    inputSchema: {
      type: "object",
      required: ["msgId"],
      properties: {
        browserSessionId: { type: "string" },
        msgId: { type: "integer", description: "The message id from yunti_list_console_messages." },
      },
    },
  },
  {
    name: "yunti_clear_console_messages",
    description:
      "Clear cached console messages for a session, or all sessions.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        allSessions: { type: "boolean" },
      },
    },
  },
  {
    name: "yunti_select",
    description: "Select an option in a select element on the current browser page.",
    inputSchema: {
      type: "object",
      required: ["selector", "value"],
      properties: {
        browserSessionId: { type: "string" },
        selector: { type: "string" },
        value: { type: "string" },
      },
    },
  },
  {
    name: "yunti_fill_form",
    description:
      "Fill multiple form fields at once. Each field specifies a uid (from yunti_observe_page or yunti_take_snapshot) or a selector, and its value. More efficient than calling yunti_fill repeatedly.",
    inputSchema: {
      type: "object",
      required: ["fields"],
      properties: {
        browserSessionId: { type: "string" },
        fields: {
          type: "array",
          items: {
            type: "object",
            required: ["value"],
            properties: {
              uid: { type: "string", description: "Fresh uid from yunti_observe_page or yunti_take_snapshot." },
              selector: { type: "string", description: "CSS selector fallback." },
              value: { type: "string", description: "Value to fill." },
            },
          },
        },
      },
    },
  },
  {
    name: "yunti_handle_dialog",
    description:
      "Handle a JavaScript dialog (alert, confirm, prompt) on the page. Use 'accept' to dismiss or 'dismiss' to cancel. For prompts, provide promptText.",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        browserSessionId: { type: "string" },
        action: { type: "string", enum: ["accept", "dismiss"], description: "accept = click OK, dismiss = click Cancel." },
        promptText: { type: "string", description: "Text to enter for prompt dialogs." },
      },
    },
  },
  {
    name: "yunti_resize_page",
    description:
      "Resize the browser page viewport to the specified dimensions. Uses CDP Emulation.setDeviceMetricsOverride.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        width: { type: "integer", minimum: 100, maximum: 10000, description: "Viewport width in CSS pixels." },
        height: { type: "integer", minimum: 100, maximum: 10000, description: "Viewport height in CSS pixels." },
        deviceScaleFactor: { type: "number", minimum: 0.5, maximum: 3, description: "Device pixel ratio. Defaults to 1." },
      },
    },
  },
  {
    name: "yunti_emulate",
    description:
      "Emulate a device, user agent, or network/CPU conditions. Uses low-level browser emulation APIs.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        deviceName: { type: "string", description: "Device name preset: 'iPhone 12', 'Pixel 5', 'iPad', etc." },
        userAgent: { type: "string", description: "Custom user agent string." },
        viewport: { type: "object", properties: { width: { type: "integer" }, height: { type: "integer" }, deviceScaleFactor: { type: "number" } } },
        cpuThrottleRate: { type: "number", minimum: 1, maximum: 20, description: "CPU slowdown factor." },
        networkConditions: { type: "string", enum: ["offline", "slow3g", "fast3g", "slow4g", "none"], description: "Network throttling preset." },
        clear: { type: "boolean", description: "Set to true to clear all emulation overrides." },
      },
    },
  },
  {
    name: "yunti_performance_start_trace",
    description:
      "Start a performance trace on the selected page. Uses the browser tracing API to capture timeline events. Call yunti_performance_stop_trace to end and collect results.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        categories: { type: "string", description: "Comma-separated trace categories. Default: 'blink,loading,rendering,page'." },
      },
    },
  },
  {
    name: "yunti_performance_stop_trace",
    description:
      "Stop the active performance trace and return captured events. Uses the browser tracing API.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
      },
    },
  },
  {
    name: "yunti_new_page",
    description:
      "Create a new browser tab and optionally navigate to a URL. Returns the new tab's browserSessionId for subsequent tool calls.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate the new tab to." },
        active: { type: "boolean", description: "Whether to activate the new tab. Defaults to true." },
      },
    },
  },
  {
    name: "yunti_close_page",
    description:
      "Close a browser tab identified by its browserSessionId. The last connected tab cannot be closed to prevent losing the agent's browser context.",
    inputSchema: {
      type: "object",
      required: ["browserSessionId"],
      properties: {
        browserSessionId: { type: "string" },
      },
    },
  },
  {
    name: "yunti_wait_for",
    description:
      "Wait for a condition to be met on the page: text appears, a selector becomes visible, the URL changes, or the DOM/network becomes idle. Returns when the condition is met or times out.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string" },
        text: { type: "string", description: "Wait for this text to appear on the page." },
        selector: { type: "string", description: "Wait for this CSS selector to be visible." },
        urlContains: { type: "string", description: "Wait until the page URL contains this string." },
        timeoutMs: { type: "integer", minimum: 100, maximum: 30000, description: "Max wait time. Defaults to 5000." },
      },
    },
  },
  {
    name: "yunti_list_pages",
    description:
      "List current browser pages/tabs visible inside the current user's local browser instance. Compatibility alias for yunti_list_browser_targets; results come from the same live Chrome/Edge target inventory rather than stale Yunti registration records.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "Optional connected Yunti browser session used as the local extension route. Pass the current session id when available.",
        },
        userId: {
          type: "string",
          description:
            "Required current Yunti user id. Used as the isolation scope for the browser route.",
        },
      },
    },
  },
  {
    name: "yunti_select_page",
    description:
      "Select a connected Yunti browser page as the active session for subsequent session-scoped tool calls. The page must already be registered by Yunti Browser Runtime. Do not pass raw Chrome targetIds here; for whole-browser targets returned by yunti_list_browser_targets, use yunti_cdp_send_command with tabId or targetId instead.",
    inputSchema: {
      type: "object",
      required: ["browserSessionId"],
      properties: {
        browserSessionId: {
          type: "string",
          description:
            "A registered Yunti browserSessionId from yunti_get_page_snapshot or a known Yunti session. Do not pass raw targetId or tabId from browser target inventory here.",
        },
      },
    },
  },
  {
    name: "yunti_navigate_page",
    description:
      "Navigate the selected browser page to a URL, reload, or go back/forward. URL/reload use browser tab APIs; back/forward prefer CDP history entries and fall back to window.history when SPA/hash history is not represented by CDP.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string", description: "Target browser session." },
        url: { type: "string", description: "URL to navigate to. Required when action is 'url'." },
        action: {
          type: "string",
          enum: ["url", "reload", "back", "forward"],
          description: "Navigation action. Defaults to 'url'.",
        },
      },
    },
  },
  {
    name: "yunti_take_screenshot",
    description:
      "Capture a PNG screenshot of the selected browser page. Supports viewport and full-page modes via CDP Page.captureScreenshot.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string", description: "Target browser session." },
        format: { type: "string", enum: ["png", "jpeg"], description: "Image format. Defaults to png." },
        quality: { type: "integer", minimum: 0, maximum: 100, description: "JPEG quality (0-100). Ignored for PNG." },
        fullPage: { type: "boolean", description: "Capture full scrollable page. Defaults to false (viewport only)." },
        clip: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            scale: { type: "number" },
          },
        },
      },
    },
  },
  {
    name: "yunti_evaluate_script",
    description:
      "Evaluate a JavaScript expression in the selected browser page and return the result. Uses CDP Runtime.evaluate. The result is serialized and length-limited.",
    inputSchema: {
      type: "object",
      required: ["expression"],
      properties: {
        browserSessionId: { type: "string", description: "Target browser session." },
        expression: { type: "string", description: "JavaScript expression to evaluate." },
        awaitPromise: { type: "boolean", description: "Wait for the returned promise to resolve. Defaults to false." },
        maxLength: { type: "integer", minimum: 0, maximum: 100000, description: "Max result length. Defaults to 10000." },
      },
    },
  },
  {
    name: "yunti_take_snapshot",
    description:
      "Take an accessibility-tree-based snapshot of the current page. Returns stable uids (yunti-1, yunti-2, ...) for each interactive element. Use these uids with yunti_click, yunti_fill, and yunti_hover. Prefer this over raw selectors or coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        browserSessionId: { type: "string", description: "Target browser session." },
        maxElements: { type: "integer", minimum: 1, maximum: 500, description: "Max elements to return. Defaults to 200." },
        includeHidden: { type: "boolean", description: "Include hidden/invisible elements. Defaults to false." },
      },
    },
  },
  {
    name: "yunti_request_user_confirmation",
    description:
      "Ask the browser user to confirm an action in the browser page before the agent proceeds.",
    inputSchema: {
      type: "object",
      required: ["message"],
      properties: {
        browserSessionId: { type: "string" },
        message: { type: "string" },
        detail: { type: "string" },
      },
    },
  },
]

export const BRIDGE_LOCAL_TOOLS = new Set([
  "yunti_get_network_log",
  "yunti_clear_network_log",
  "yunti_get_cdp_events",
  "yunti_clear_cdp_events",
  "yunti_select_page",
  "yunti_clear_network_requests",
  "yunti_list_console_messages",
  "yunti_get_console_message",
  "yunti_clear_console_messages",
  "yunti_list_network_requests",
  "yunti_get_network_request",
])

export const MEMORY_LOCAL_TOOLS = new Set([
  "yunti_remember_learning",
  "yunti_get_learning_memory",
  "yunti_forget_learning_memory",
])

export const META_LOCAL_TOOLS = new Set([
  "yunti_get_tool_usage_hints",
])

export const BROWSER_SCOPED_TOOLS = new Set(
  TOOLS.map((tool) => tool.name).filter((name) => !MEMORY_LOCAL_TOOLS.has(name) && !META_LOCAL_TOOLS.has(name))
)

installBrowserIsolationSchemas()

function installBrowserIsolationSchemas() {
  for (const tool of TOOLS) {
    if (MEMORY_LOCAL_TOOLS.has(tool.name)) continue
    const schema = tool.inputSchema || { type: "object" }
    schema.properties = schema.properties || {}
    schema.properties.userId = {
      type: "string",
      description:
        "Optional local route user id. Defaults to YUNTI_BROWSER_USER_ID or local in the standalone runtime.",
    }
    tool.inputSchema = schema
  }
}



export function schemaForTool(name) {
  return TOOLS.find((tool) => tool.name === name)?.inputSchema || null
}

export function toolUsageHints(args = {}) {
  const requestedTool = String(args.tool || "").trim()
  const topic = String(args.topic || "all").trim() || "all"
  const tools = {
    yunti_get_page_snapshot: {
      purpose: "Establish the current Yunti browser route and read lightweight page state.",
      required: [],
      recommended: ["browserSessionId"],
      notes: [
        "Use this first for current-page work when browserSessionId is unknown.",
        "Keep the returned browserSessionId for follow-up current-tab tools.",
        "If an old browserSessionId fails, call yunti_list_browser_targets to refresh the live route inventory.",
      ],
    },
    yunti_observe_page: {
      purpose: "Observe the current page for observe -> act by uid -> verify workflows.",
      required: [],
      recommended: ["browserSessionId", "mode", "redaction"],
      examples: [
        {
          browserSessionId: "yunti-...",
          mode: "viewport",
          includeTextTree: true,
          redaction: "balanced",
        },
      ],
      notes: [
        "Use this as the default page-operation refresh step once available.",
        "Returned uids are fresh for the latest observation in the current browserSessionId; observe again after navigation, DOM changes, or stale uid errors.",
        "Default balanced redaction hides credential-like values. Screenshots are separate and may still contain visible sensitive content.",
        "Use yunti_get_page_snapshot for lightweight route/title/text overview and yunti_take_snapshot for compatibility with older uid workflows.",
      ],
      commonMistakes: [
        "Do not treat observation uids as permanent selectors across refreshes or tabs.",
        "Do not use redaction=off unless the user explicitly wants local debugging.",
        "Do not blindly retry an action after no page change; observe, wait, scroll, or switch tabs based on hints.",
      ],
    },
    yunti_list_browser_targets: {
      purpose: "Canonical live Chrome/Edge tab and target inventory.",
      required: [],
      recommended: ["browserSessionId"],
      notes: [
        "Use for page counts, all tabs, finding a tab, or choosing a CDP target.",
        "tabId and targetId are selectors; route CDP through the current user's browserSessionId.",
        "Use this to recover when a stored browserSessionId is stale.",
      ],
    },
    yunti_list_pages: {
      purpose: "Compatibility alias for the same live target inventory as yunti_list_browser_targets.",
      required: [],
      recommended: ["browserSessionId"],
      notes: [
        "Do not treat this as a separate Yunti registration registry.",
        "Prefer yunti_list_browser_targets in new prompts and workflows.",
      ],
    },
    yunti_cdp_send_command: {
      purpose: "Send one low-level browser protocol command through the current user's browser route.",
      required: ["method"],
      recommended: ["browserSessionId", "method", "params"],
      examples: [
        {
          browserSessionId: "yunti-...",
          tabId: 123,
          method: "Target.activateTarget",
          params: {},
        },
        {
          browserSessionId: "yunti-...",
          method: "Runtime.evaluate",
          params: { expression: "document.title", returnByValue: true },
        },
      ],
      commonMistakes: [
        "Do not run CDP method names in a shell.",
        "params must be an object when provided; do not pass a string or array.",
        "For tab operations, pass top-level tabId or targetId together with browserSessionId.",
        "For Target.closeTarget, call yunti_list_browser_targets first, then pass a returned top-level tabId or targetId.",
        "If browserSessionId is stale, refresh with yunti_list_browser_targets before retrying.",
      ],
    },
    yunti_evaluate_script: {
      purpose: "Evaluate JavaScript in the selected browser page.",
      required: ["expression"],
      aliases: { script: "expression" },
      examples: [
        {
          browserSessionId: "yunti-...",
          expression: "document.title",
          awaitPromise: false,
        },
      ],
      commonMistakes: ["Use expression, not script."],
    },
    yunti_new_page: {
      purpose: "Create a new browser tab.",
      required: [],
      recommended: ["browserSessionId", "url", "active"],
      notes: [
        "Returns a new browserSessionId for the created tab.",
        "Use the returned browserSessionId for follow-up yunti_* calls on the new tab.",
      ],
    },
    yunti_close_page: {
      purpose: "Close a registered Yunti browser page by browserSessionId.",
      required: ["browserSessionId"],
      commonMistakes: [
        "This tool does not accept tabId or targetId.",
        "Passing tabId or targetId will be rejected instead of selecting the close target.",
      ],
      alternatives: [
        "To close by tabId or targetId, route through yunti_cdp_send_command with the current browserSessionId and Target.closeTarget.",
      ],
    },
    yunti_select_page: {
      purpose: "Select a registered Yunti browser session.",
      required: ["browserSessionId"],
      commonMistakes: [
        "Do not pass raw Chrome targetId or tabId here.",
        "Use yunti_cdp_send_command for raw browser targets from yunti_list_browser_targets.",
      ],
    },
    yunti_forget_learning_memory: {
      purpose: "Delete one learning memory by id, or delete all memories when confirmed.",
      required: [],
      recommended: ["id"],
      notes: [
        "Call yunti_get_learning_memory first to find the memory id.",
        "Use all=true and confirmed=true only when deleting every memory for this user.",
        "If the returned deleted count is 0, refresh the memory list and retry with an existing id.",
      ],
      commonMistakes: ["Use id, not title."],
    },
    yunti_click: {
      purpose: "Click by observe/snapshot uid, CSS selector, or viewport coordinates.",
      required: [],
      recommended: ["browserSessionId", "uid"],
      notes: [
        "Prefer a fresh uid from yunti_observe_page or yunti_take_snapshot for reliability.",
        "Use selector when uid is unavailable.",
        "Coordinate mode requires both x and y; yunti_click_at is clearer for coordinate-only clicks.",
        "After clicking, observe again or read page state before deciding whether the action succeeded.",
        "If the target is missing or stale, observe again; if it may be below the fold, scroll first; if the page is changing, wait before retrying.",
        "Current results are compatibility-shaped and may include clicked, uid, selector/coordinate, method, and browserSessionId; P6.2 will converge action outputs toward action, target, ok/code, recoverable, nextStepHint, and before/after summaries.",
      ],
      recovery: [
        "Stale or missing uid: call yunti_observe_page again for the current browserSessionId, or yunti_take_snapshot for compatibility workflows.",
        "Element not visible: use observe scroll hints, yunti_scroll, or a screenshot before falling back to coordinates.",
        "No visible page change: call yunti_observe_page or yunti_get_page_snapshot to verify, then wait, scroll, switch tabs, or ask the user instead of repeating the same click.",
        "Wrong page: call yunti_list_browser_targets and switch to the intended browserSessionId.",
      ],
      commonMistakes: [
        "Do not treat a successful dispatch as proof that the page changed.",
        "Do not repeat the same uid click after a stale uid error; refresh the observation first.",
      ],
    },
    yunti_hover: {
      purpose: "Hover by observe/snapshot uid, CSS selector, or viewport coordinates.",
      required: [],
      recommended: ["browserSessionId", "uid"],
      notes: [
        "Prefer a fresh uid from yunti_observe_page or yunti_take_snapshot for reliability.",
        "Selector mode resolves the element center and dispatches CDP mouse move.",
        "Coordinate mode requires both x and y.",
        "Observe again after hover when menus, tooltips, or hover-only controls are expected to appear.",
        "Current results are compatibility-shaped and may include hovered, uid, selector/coordinate, method, and browserSessionId; P6.2 will converge action outputs toward action, target, ok/code, recoverable, nextStepHint, and before/after summaries.",
      ],
      recovery: [
        "Stale or missing uid: observe again before retrying the hover.",
        "Expected menu did not appear: wait briefly, observe again, or use screenshot before switching to coordinate fallback.",
      ],
    },
    yunti_fill: {
      purpose: "Fill an input-like element by observe/snapshot uid or CSS selector.",
      required: ["value"],
      recommended: ["browserSessionId", "uid", "value"],
      notes: [
        "value is required and may be an empty string when intentionally clearing a field.",
        "Prefer a fresh uid from yunti_observe_page or yunti_take_snapshot for reliability.",
        "Use selector when uid is unavailable.",
        "Coordinate-only fill is not supported; use uid or selector.",
        "After filling, verify through yunti_observe_page, yunti_get_page_snapshot, or yunti_evaluate_script when exact field value matters.",
        "If the input is hidden, disabled, or no longer present, observe again, scroll, wait for rendering, or switch tabs before retrying.",
        "Current results are compatibility-shaped and may include filled, uid, selector, method, value/valueLength, and browserSessionId; P6.2 will converge action outputs toward action, target, ok/code, recoverable, nextStepHint, and before/after summaries.",
      ],
      recovery: [
        "Stale or missing uid: call yunti_observe_page again and use a fresh editable uid.",
        "Field not editable: check disabled/editable fields from the observation, then wait, scroll, or ask the user if the control is gated.",
        "Value did not stick: verify whether the target is contenteditable, masked, controlled by framework state, or requires typing/press_key semantics.",
        "Wrong page: refresh targets with yunti_list_browser_targets and route the fill through the intended browserSessionId.",
      ],
      commonMistakes: [
        "Do not omit value.",
        "Do not pass only x/y coordinates to yunti_fill.",
        "Do not keep retrying a fill without observing whether the field exists and is editable.",
      ],
    },
  }
  const topicMap = {
    browser: ["yunti_observe_page", "yunti_get_page_snapshot", "yunti_list_browser_targets", "yunti_list_pages"],
    cdp: ["yunti_cdp_send_command", "yunti_evaluate_script"],
    tabs: ["yunti_new_page", "yunti_close_page", "yunti_select_page", "yunti_list_browser_targets"],
    memory: ["yunti_get_learning_memory", "yunti_remember_learning", "yunti_forget_learning_memory"],
    network: ["yunti_get_network_log", "yunti_list_network_requests", "yunti_get_network_request", "yunti_clear_network_requests"],
    console: ["yunti_list_console_messages", "yunti_get_console_message", "yunti_clear_console_messages"],
  }
  const selectedNames = requestedTool
    ? [requestedTool]
    : topic !== "all" && topicMap[topic]
      ? topicMap[topic]
      : Object.keys(tools)
  const selectedTools = {}
  for (const name of selectedNames) {
    selectedTools[name] = {
      ...(tools[name] || {
        purpose: "No specialized hint is available for this tool. Use the schema field below.",
      }),
      schema: schemaForTool(name),
    }
  }
  return {
    version: "2026-07-02",
    coreRules: [
      "Every browser-facing yunti_* tool call requires userId.",
      "browserSessionId is the current user's browser route; tabId and targetId are selectors, not permissions.",
      "yunti_list_browser_targets is the canonical live browser inventory.",
      "yunti_list_pages is a compatibility alias for the same live target inventory.",
      "For page operations, prefer observe -> act by fresh uid -> observe/verify once yunti_observe_page is available.",
      "If an old browserSessionId is disconnected or stale, call yunti_list_browser_targets with the current userId to recover the latest browserSessionId and live targets.",
      "After yunti_new_page, use the returned browserSessionId for follow-up calls on the new tab.",
      "Sessions expire quickly when the extension stops polling; stale-session errors include the reason and recovery hint.",
      "If a tool call fails due to parameters, inspect this hint output and the tool schema before retrying.",
    ],
    workflows: {
      newPage: [
        "Call yunti_new_page with userId and optional current browserSessionId.",
        "Store the returned browserSessionId.",
        "Use that returned browserSessionId for navigate/evaluate/screenshot/close on the new tab.",
      ],
      closePage: [
        "If you have the target page's browserSessionId, call yunti_close_page with userId and that browserSessionId.",
        "If you only have tabId or targetId, use yunti_cdp_send_command routed through the current browserSessionId.",
      ],
      recoverRoute: [
        "When a saved browserSessionId fails as disconnected, stale, or not registered, do not keep retrying it.",
        "Call yunti_list_browser_targets with the current userId; it can route through the current active browser session and returns the latest browserSessionId.",
        "Use the returned browserSessionId as the route for subsequent yunti_* calls.",
      ],
      evaluate: [
        "Use yunti_evaluate_script with expression.",
        "Use yunti_cdp_send_command Runtime.evaluate only when raw CDP options are required.",
      ],
      memoryDelete: [
        "Call yunti_get_learning_memory to find the id.",
        "Call yunti_forget_learning_memory with that id.",
      ],
      actionRecovery: [
        "For page actions, prefer observe -> act by fresh uid -> observe/verify.",
        "If an action fails with a stale or missing uid, refresh with yunti_observe_page before retrying.",
        "If the element may be outside the viewport, use observe scroll hints and yunti_scroll before falling back to coordinates.",
        "If the page is loading or changing, use yunti_wait_for or observe again instead of blind retries.",
        "If the target tab is uncertain, call yunti_list_browser_targets and switch to the intended browserSessionId.",
        "Use selector or coordinate fallbacks only as recovery/debugging paths, not as the default when fresh uids are available.",
      ],
      actionResultContract: [
        "Current action outputs are compatibility-shaped: click/hover/fill/scroll may return clicked, hovered, filled, scrolled, uid, selector, x/y, method, valueLength, before/after, and browserSessionId depending on the tool path.",
        "P6.2 target shape should be additive and structured: action, browserSessionId, target, ok, code, recoverable, nextStepHint, and before/after summaries where useful.",
        "Do not remove existing success booleans or selector/coordinate fields while converging on the structured result contract.",
        "Treat successful dispatch as transport/action execution evidence, then verify page state with yunti_observe_page, yunti_get_page_snapshot, yunti_evaluate_script, screenshot, or CDP when the workflow needs proof.",
        "Recoverable failures should clearly point to observe, scroll, wait, switch tabs, selector/coordinate fallback, or asking the user.",
      ],
    },
    tools: selectedTools,
  }
}
