# Edge Session Recovery Investigation

Date: 2026-07-20

## Scope

This note records the Microsoft Edge-specific session failure found after the
`0.2.3` release. Chrome 150 did not reproduce the problem; Edge 150 did.

## Root Cause

On an existing Edge sleeping tab, `chrome.tabs.sendMessage` and background
content-script injection can remain pending instead of rejecting promptly. The
single browser controller previously awaited the complete tool execution from
inside its poll loop. One hung page recovery therefore stopped controller
polling. Recovery alarms refreshed registration metadata but treated the old
poller object as healthy, so Bridge eventually expired the controller and page
routes even though the Edge window and tabs still existed.

## Fix

- Bound content-script probe and injection time.
- Run serialized tool execution independently from controller polling.
- Bound extension-side tool execution and return a result instead of hanging.
- Replace pollers that stop making progress through the recovery watchdog.
- Temporarily activate an Edge sleeping tab when background injection stalls,
  then restore the previously active tab without reloading the page.
- Normalize observe results with the authoritative recovered page session id.

## Evidence

- Edge connected with 21 existing tabs and zero page sessions.
- `yunti_list_browser_targets` discovered all 21 tabs without refreshing them.
- Before the fix, observing sleeping tab `1542219058` timed out twice after
  25-30 seconds and blocked controller polling.
- After the fix, the same tab recovered in 3288 ms and returned 12 elements.
- A page session recorded before an extension reload was reused after reload
  while the page was in the background. It recovered in 3284 ms and returned
  28 elements without a page refresh.

## Regression Coverage

`tests/session-manager.test.js` covers a hanging Edge content-script probe,
sleeping-tab temporary activation and restoration, controller polling while a
tool remains pending, and replacement of a poller that stops making progress.
