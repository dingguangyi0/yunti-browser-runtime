# Tool Guide

## Agent Workflow

1. Call `yunti_get_tool_usage_hints` when unsure about parameters or routing.
2. Call `yunti_list_browser_targets` to understand the live browser state.
3. Keep the returned `browserSessionId` for follow-up page/CDP tools.
4. Once `yunti_observe_page` is available in the connected runtime, prefer
   `observe -> act by fresh uid -> observe/verify` for page operations.
5. If the session becomes stale, call `yunti_list_browser_targets` again and
   retry with the latest route.
6. For multi-step page work, prefer one stable `browserSessionId` throughout the
   task.

Sessions expire when the extension stops polling the local bridge. Stale-session
errors include a reason and recovery hint; do not keep retrying an expired id.

## Core Tools

- `yunti_list_browser_targets`: canonical live inventory for tabs and targets.
- `yunti_list_pages`: compatibility alias for the same live inventory.
- `yunti_observe_page`: P6.1 observe-first page operation contract with fresh
  uids, compact text tree, scroll metadata, and DOM redaction metadata.
- `yunti_get_page_snapshot`: lightweight page state and visible context.
- `yunti_take_snapshot`: element-oriented snapshot for uid-based actions.
- `yunti_click`, `yunti_fill`, `yunti_hover`: common DOM actions.
- `yunti_cdp_send_command`: low-level CDP access routed through the extension.
- `yunti_get_network_log`, `yunti_list_network_requests`: sanitized network
  observations.
- `yunti_list_console_messages`: console diagnostics.
- `yunti_remember_learning`, `yunti_get_learning_memory`: local agent memory.

## Routing Rules

- Standalone local mode defaults to `userId=local`.
- Agents do not need to pass `userId` unless they intentionally override
  `YUNTI_BROWSER_USER_ID`.
- `browserSessionId` identifies a registered browser page route.
- `browserSessionId` expires without extension heartbeat; refresh live inventory
  when a stale-session error appears.
- New tabs can return a new `browserSessionId`; use the returned value for
  follow-up calls on that tab.
- Raw `targetId` or `tabId` is for CDP/tab operations, not a replacement for
  `browserSessionId`.

## CDP Rules

- Do not run CDP method names in a shell.
- Use `yunti_cdp_send_command` with `method` and optional `params`.
- `params` must be an object when provided.
- For `Target.activateTarget` or `Target.closeTarget`, pass top-level `tabId`
  or `targetId` with a valid `browserSessionId`.
- Use `Runtime.evaluate` for JavaScript evaluation, but keep related multi-step
  work in one eval when page state must stay in the same execution context.

## Parameter Rules

- `yunti_click` and `yunti_hover` require a `uid`, a `selector`, or both `x`
  and `y`; prefer a fresh uid from `yunti_observe_page` once available, or use
  `yunti_take_snapshot` for the current compatibility path.
- `yunti_fill` requires `value` and either `uid` or `selector`; it does not
  support coordinate-only targeting.
- `yunti_close_page` closes by `browserSessionId`; to close by raw `tabId` or
  `targetId`, use `yunti_cdp_send_command` with `Target.closeTarget`.
- `yunti_forget_learning_memory` requires `id`, or `all=true` plus
  `confirmed=true` when deleting every memory.

## Action Recovery Rules

- After a click, fill, or hover, observe again or read page state before treating
  the action as successful.
- If a uid is stale or missing, call `yunti_observe_page` again for a fresh uid
  before retrying the same action.
- If an element may be outside the viewport, use observe scroll hints and
  `yunti_scroll` before falling back to coordinates.
- If the page is loading or changing, wait or observe again instead of blindly
  repeating the same action.
- If the target tab is uncertain, call `yunti_list_browser_targets` and route
  follow-up work through the intended `browserSessionId`.

## Action Result Rules

- Current action results remain compatibility-shaped and may include fields such
  as `clicked`, `hovered`, `filled`, `selected`, `scrolled`, `typed`, `pressed`,
  `uploaded`, `dragged`, `uid`, `selector`, `x`, `y`, `method`, `valueLength`,
  `before`, `after`, and `browserSessionId`.
- P6.2 structured action result fields are being introduced additively. Agents
  should prefer `action`, `target`, `ok`, `recoverable`, and `nextStepHint` when
  present, while still preserving and reading compatibility fields. `code` and
  richer before/after summaries remain follow-on fields where useful.
- Do not treat a dispatched action as final proof of success; verify page state
  with observe, snapshot, evaluate, screenshot, or CDP when the workflow needs
  proof.
- Compatibility fields must remain available while structured result fields are
  introduced.

## Safety Rules

- Read-only inspection is allowed by default.
- Destructive, financial, credential, upload, or submit actions should require
  explicit user confirmation in the agent workflow.
- Tool outputs redact likely cookies, authorization headers, passwords, and
  token-like values.
- DOM observation redaction does not imply screenshot redaction; screenshots
  represent visible page pixels and may include sensitive content.
