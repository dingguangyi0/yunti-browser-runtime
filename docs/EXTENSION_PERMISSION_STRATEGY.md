# Extension Permission Strategy

This document is the P6.6.3 pre-store permission strategy decision for Yunti
Browser Runtime. It turns the manifest audit and store-copy draft into a clear
product decision before any browser-store implementation work.

## Decision Summary

Yunti will keep the current npm/unpacked extension path unchanged for the
current `0.2.0` development cycle:

- broad `http` / `https` host access remains acceptable for the local developer
  and npm-installed extension path;
- `webRequest` remains available by default for local diagnostics;
- `debugger`, `tabs`, screenshots, CDP, network, console, upload, and tab
  capabilities remain part of Yunti's core local browser automation surface;
- the current manifest should not be submitted to Chrome Web Store or Edge
  Add-ons as the recommended store build without an explicit maintainer
  decision.

The recommended store-candidate direction is a two-track model:

- **Developer/npm track**: preserve today's zero-config, broad-access local
  runtime for users who intentionally install Yunti as a browser automation
  tool.
- **Store-candidate track**: design and test a lower-warning permission mode
  before submission, likely using optional host access and optional network
  diagnostics where the browser APIs and Yunti UX can support it reliably.

This is a decision checkpoint, not a manifest rewrite.

## Why This Decision

Yunti's core product promise is real local browser automation for arbitrary
user-opened Chrome/Edge pages. The current broad permissions support that
promise: an agent can observe, click, fill, scroll, inspect diagnostics, switch
tabs, and recover through CDP without forcing the user to grant site access on
every page first.

However, browser stores evaluate extension trust differently from a local
developer install:

- Chrome recommends optional permissions when functionality allows it, so users
  get informed control over resource and data access.
- Chrome permission and host declarations can trigger user-visible install
  warnings.
- Edge policy says extensions should request only permissions essential for the
  declared functionality, and must clearly disclose dependency on non-integrated
  software and testing steps.
- Yunti's current `debugger`, broad host access, `tabs`, and `webRequest`
  combination is truthful for a browser automation runtime, but it is also the
  highest-review-burden shape.

The safest product path is therefore:

1. Do not weaken the local Yunti experience just to reduce store warnings.
2. Do not submit a broad-permission store build casually.
3. Build a store-candidate mode only after the permission UX and recovery
   behavior are designed and tested.

## Decision Matrix

| Option | Decision | Reason |
| --- | --- | --- |
| Submit current manifest unchanged to stores | Not recommended by default. | It preserves functionality, but broad host access plus `debugger` and `webRequest` creates high reviewer and user-trust burden. |
| Remove broad host permissions immediately | Rejected for now. | It would break the current zero-config observe/action workflow unless a replacement permission UX is implemented first. |
| Make `webRequest` optional before store submission | Recommended for design/prototype. | Network diagnostics are valuable but not required for every click/fill/scroll workflow. Optionalizing them may reduce review surface. |
| Move broad web access to optional host permissions | Recommended for design/prototype. | Better aligns with user-controlled access, but needs UX, content-script registration/injection changes, recovery guidance, and tests. |
| Keep npm/unpacked as the only 0.2.0 distribution path | Acceptable fallback. | Preserves the core product while avoiding premature store compromises. |

## Permission Strategy

### Developer / npm Track

Keep current behavior:

- `permissions`: `activeTab`, `debugger`, `storage`, `tabs`, `webRequest`.
- `host_permissions`: `http://*/*`, `https://*/*`, localhost bridge access.
- Static content scripts for `http` / `https` pages.
- Popup remains zero-config by default.
- Advanced page match patterns remain a runtime registration filter, not a
  browser permission boundary.

This track is the default for local users who intentionally install the runtime
from npm and load the extension from the package directory.

### Store-Candidate Track

Do not implement this until the next slice has a concrete design. The target
shape should evaluate:

- `optional_host_permissions` for broad `http` / `https` page access.
- A first-run or popup flow that clearly requests access for the current site
  or all sites, without becoming a mandatory hub.
- Recovery messages when the agent cannot observe a page because host access
  has not been granted.
- Whether content scripts should remain declarative, be dynamically registered,
  or be injected after permission grant.
- Optionalizing network diagnostics so `webRequest` is requested only when the
  user enables debugging.
- Whether `debugger` can remain required for the store candidate, with strong
  single-purpose justification, or whether some workflows can operate before
  debugger attachment.

The store-candidate track must remain additive. It must not remove the
developer/npm track or narrow Yunti into a page-only automation tool.

## Required UX Before Store Submission

Before any store build with narrowed permissions:

- Popup should show a clear "grant access for this site" or equivalent action
  when the current page is blocked by missing host permission.
- Agent-facing errors should say whether the page is unavailable because host
  permission is missing, the bridge is offline, the page is unsupported, or the
  extension needs a refresh.
- Tool hints and the packaged skill should explain how to recover:
  `open page -> grant site access -> refresh -> yunti_list_browser_targets`.
- Optional network diagnostics should be visibly separate from basic DOM
  automation.
- `doctor` should detect permission-mode problems and provide a human-readable
  next step.

## Required Engineering Work Before Store Submission

If the store-candidate track proceeds, the next implementation slices should be
small and testable:

1. Add a permission-mode design/prototype for host access.
2. Add a diagnostics-mode design/prototype for `webRequest`.
3. Update extension popup state and background registration flow.
4. Update MCP errors, `yunti_get_tool_usage_hints`, Tool Guide, and packaged
   skill for missing-permission recovery.
5. Add deterministic extension tests for permission-denied and permission-
   granted paths.
6. Add real-browser E2E coverage for:
   - page blocked before host grant;
   - grant access;
   - refresh/register;
   - observe/action success;
   - optional diagnostics enabled/disabled.
7. Update store copy and privacy text after the final manifest strategy is
   known.

## Store Readiness Gate

A browser-store submission should not proceed until all of these are true:

- final manifest permissions match the submitted store copy;
- privacy policy URL is published and matches runtime behavior;
- support URL and reviewer test steps are confirmed;
- screenshots use non-sensitive demo pages;
- `npm run release:check` passes;
- real-browser E2E passes with the submitted extension package;
- no local token, private path, unpublished account detail, or internal-only
  URL appears in store metadata;
- maintainer explicitly accepts the remaining `debugger` and host-access
  warnings.

## P6.6.3 Outcome

P6.6.3 completes when this decision is linked from distribution readiness docs
and status files. It does not change `extension/manifest.json` or runtime
behavior.
