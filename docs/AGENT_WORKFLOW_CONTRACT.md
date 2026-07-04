# Agent Workflow Contract

This document is the P6.3.1 default operating contract for agents using Yunti
Browser Runtime. It is intentionally tool-level and LLM-agnostic: Yunti stays
the browser operation layer, while the agent remains responsible for task
planning and user judgment.

## Default Loop

Use this loop for normal page work:

1. Call `yunti_get_tool_usage_hints` when the tool contract is uncertain.
2. Call `yunti_list_browser_targets` and choose the intended
   `browserSessionId`.
3. Call `yunti_observe_page` for the current page state.
4. Act with a fresh uid when possible.
5. If the page is loading or changing, call `yunti_wait_for`.
6. After every wait or action, call `yunti_observe_page` again.
7. Verify the result using observe, snapshot, evaluate, screenshot, network, or
   console tools before assuming the task is done.
8. If a uid/session/action result is stale or recoverable, follow
   `code`, `recoveryHint`, and `nextStepHint` before retrying.

## Recovery Rules

- Stale route: call `yunti_list_browser_targets` and use the latest
  `browserSessionId`.
- Stale uid: call `yunti_observe_page` again and use a fresh uid.
- Async UI: call `yunti_wait_for`, then `yunti_observe_page`, then continue
  with a fresh uid.
- Scroll uncertainty: prefer fresh `scrollableContainers[]` uids, inspect
  `moved`, `edgeHint`, `partialMovement`, and `recoveryHint`.
- Fill/select uncertainty: inspect `fillable`, `readOnly`, `disabled`,
  `fillBlockReason`, `selectedValue`, `selectedText`, and `options[]` before
  retrying.
- Timeout: treat `WAIT_TIMEOUT` as a signal to observe and adjust the condition,
  not proof that the user task failed.
- Coordinates/selectors: use them as recovery or debugging paths when fresh
  uids are unavailable.

## Confirmation Boundary

Ask the user for explicit confirmation before:

- submitting forms that change production data;
- deleting, approving, purchasing, publishing, or sending messages;
- uploading sensitive files;
- exposing or copying secrets, credentials, cookies, auth headers, tokens, or
  private keys;
- taking an action whose effect cannot be verified from page state.

## Copyable Prompt

```text
Please operate my browser through Yunti Browser Runtime.

Follow this workflow:
1. Call yunti_get_tool_usage_hints if tool usage is uncertain.
2. Call yunti_list_browser_targets and choose the intended browserSessionId.
3. Use yunti_observe_page before page actions.
4. Prefer fresh uids from yunti_observe_page for click, hover, fill, select,
   scroll, type, press, upload, and drag operations.
5. After each action, verify by observing again or using snapshot, evaluate,
   screenshot, network, or console tools.
6. For async rendering, validation, navigation, option loading, or infinite
   scroll, call yunti_wait_for, then yunti_observe_page, then continue with a
   fresh uid.
7. If a result has ok=false, code, recoveryHint, or nextStepHint, follow that
   guidance before retrying. Do not blindly repeat the same action.
8. Use selector or coordinate fallback only when fresh uids are unavailable or
   as an explicit recovery/debugging path.
9. Before submitting, deleting, approving, purchasing, publishing, uploading
   sensitive files, or changing production data, ask me for confirmation.
10. Do not expose raw cookies, passwords, auth headers, tokens, private keys, or
    other secrets. Remember that DOM observation redaction does not redact
    screenshots.
```

## Non-Goals

- Do not move a built-in LLM loop into Yunti Runtime.
- Do not replace fine-grained `yunti_*` tools with a single opaque task runner.
- Do not require a mandatory hub tab or side panel for the default local path.
- Do not remove CDP, screenshots, network, console, tab control, upload, or
  diagnostic capabilities while improving page-level workflows.
