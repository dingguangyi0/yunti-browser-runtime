---
name: yunti-browser-runtime
description: Use when an agent needs to operate or inspect a user's browser through Yunti Browser Runtime MCP tools, including viewing pages, switching tabs, clicking, typing, screenshots, network or console logs, CDP commands, browser target inventory, or recovering stale browserSessionId routes.
---

# Yunti Browser Runtime

## First Step

For any browser task, first call `yunti_get_tool_usage_hints` unless the user is only asking a conceptual question.

Then call `yunti_list_browser_targets` to understand the live browser state before choosing a page or tab.

## Routing Rules

- Treat `yunti_list_browser_targets` as the canonical live browser inventory.
- Keep the returned `browserSessionId` for follow-up page and CDP calls.
- If a stored `browserSessionId` fails or appears stale, call `yunti_list_browser_targets` again and retry with the latest route.
- Stale-session errors include a reason and recovery hint; do not keep retrying the expired id.
- New tabs may return a new `browserSessionId`; use that returned value for follow-up actions on the new tab.
- Do not use raw `tabId` or `targetId` as a replacement for `browserSessionId`.
- Local standalone mode defaults to `userId=local`; do not add `userId` unless the environment explicitly needs a different route user.

## Tool Choice

- Use `yunti_get_page_snapshot` for lightweight page text, title, URL, selected text, and page state.
- Use `yunti_take_snapshot` before uid-based clicks, fills, or hovers.
- Use `yunti_click`, `yunti_fill`, `yunti_hover`, `yunti_press_key`, and `yunti_type_text` for normal page actions.
- Use `yunti_take_screenshot` for visual verification.
- Use `yunti_list_browser_targets` for tab counts, tab selection, target IDs, and whole-browser awareness.
- Use `yunti_cdp_send_command` for Chrome DevTools Protocol commands.
- Use `yunti_list_network_requests`, `yunti_get_network_log`, and `yunti_get_network_request` for network diagnostics.
- Use `yunti_list_console_messages` and `yunti_get_console_message` for console diagnostics.
- Use `yunti_get_tool_usage_hints` before retrying a failed or uncertain tool call.

## CDP Rules

- Never run CDP method names in a terminal or shell.
- Always call CDP through `yunti_cdp_send_command`.
- `yunti_cdp_send_command` requires `method`; `params` is optional but must be an object when provided.
- Required CDP shape:

```json
{
  "browserSessionId": "yunti-...",
  "method": "Runtime.evaluate",
  "params": {
    "expression": "document.title",
    "returnByValue": true
  }
}
```

- For tab activation or closing, pass top-level `tabId` or `targetId` with a valid `browserSessionId`.
- For multi-step JavaScript work that depends on page-local state, prefer one `Runtime.evaluate` expression that performs setup, action, wait, and readback in one call.

## Parameter Rules

- `yunti_click` and `yunti_hover` need `uid`, `selector`, or both `x` and `y`; call `yunti_take_snapshot` first when possible.
- `yunti_fill` requires `value` plus `uid` or `selector`; coordinate-only fill is not supported.
- `yunti_close_page` accepts `browserSessionId`, not raw `tabId` or `targetId`; use `yunti_cdp_send_command` with `Target.closeTarget` for raw browser targets.
- `yunti_forget_learning_memory` needs a memory `id`, or `all=true` and `confirmed=true` for deleting everything.

## Safety

- Read-only inspection is allowed by default.
- Before submitting forms, deleting data, uploading sensitive files, approving workflows, making purchases, or changing production data, ask the user for explicit confirmation.
- Do not expose raw cookies, passwords, authorization headers, or token-like values.
- If a tool output appears to include sensitive data, summarize only the safe parts.

## Recovery

- No connected tab: ask the user to open a page, load the extension, or refresh the page.
- Stale session: call `yunti_list_browser_targets` and use the latest `browserSessionId`.
- Wrong tab: use `yunti_list_browser_targets` to find the intended tab, then route CDP with that tab's `tabId` or `targetId`.
- Parameter uncertainty: call `yunti_get_tool_usage_hints` with the specific tool name.
- Missing memory id: call `yunti_get_learning_memory` first, then retry with a returned `id`.
