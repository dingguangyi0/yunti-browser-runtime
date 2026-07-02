# Next Major Plan: 0.2.0 Agentic Page Runtime

This document is the durable planning contract for the next major development
cycle after `yunti-browser-runtime@0.1.3`.

## Goal

Make Yunti Browser Runtime easier for external agents to use reliably on real
Chrome/Edge pages:

- observe pages in a compact, agent-friendly text form;
- act through stable element ids and robust DOM action semantics;
- verify each step with clear recovery hints;
- keep sensitive page content redacted by default;
- preserve the current local-first, zero-config install path.

## Inspiration

The next version is informed by Alibaba's Page Agent project:

- Page Agent has a clean split between page controller, agent loop, and optional
  extension/MCP surfaces.
- Its strongest ideas for Yunti are text-based DOM observation, indexed
  interactive elements, scroll hints, explicit step history, user takeover/stop
  controls, and content masking hooks.
- Yunti should not copy Page Agent's LLM-in-runtime model as the default. Yunti's
  core value remains being a local MCP browser runtime for any external agent.

## Non Goals

- Do not require an LLM API key inside Yunti Browser Runtime.
- Do not replace fine-grained `yunti_*` MCP tools with a single black-box
  natural-language `execute_task` tool.
- Do not make a hub tab, side panel, or UI console mandatory for first use.
- Do not mix remote multi-user mode into the local single-user core.
- Do not weaken the local loopback security boundary or publish real secrets in
  docs, config output, logs, or tests.

## Release Theme

`0.2.0` should be a compatibility-preserving release. Existing tools continue to
work, while agents are guided toward a stronger default workflow:

```text
yunti_observe_page -> yunti_click/fill/select/scroll by uid -> observe/verify
```

`yunti_take_snapshot` remains available. Newer docs and skill instructions should
prefer `yunti_observe_page` once implemented.

## Phase Plan

### P6.1 Agent-Friendly Page Observation

Status: planned.

Create `yunti_observe_page`, a higher-level observation tool that returns:

- current `browserSessionId`, URL, title, origin, and captured timestamp;
- viewport size, page size, scroll position, pages above/below, and pixels
  above/below;
- compact text DOM tree for visible interactive elements;
- stable uid for each actionable element;
- role, tag, name/text, label, placeholder, value preview policy, rect, disabled
  state, and visibility state;
- scrollable container metadata, including vertical/horizontal scroll capacity;
- optional full-page mode with bounded element and text limits;
- clear next-step hints when no elements are visible, the page is restricted, or
  the content script is stale.

Acceptance:

- `yunti_observe_page` works on a simple page without CDP attachment.
- It returns a readable tree that an LLM can use without raw selectors.
- It includes scroll hints comparable to "pixels below" and "pages below".
- It redacts sensitive values by default.
- Unit tests cover schema, routing, stale-session recovery, and a fixture page.
- E2E smoke can use `observe -> click uid -> observe` on the test page.

### P6.2 Robust DOM Action Layer

Status: planned.

Extract DOM actions from the current content/tool handler code into a focused
module such as `extension/dom-actions.js`.

Scope:

- use consistent pointer/mouse event order for click and hover;
- improve text input for input, textarea, select, and contenteditable;
- support select-by-visible-text and select-by-value;
- improve uid-targeted fill so contenteditable and rich text editors get better
  fallback behavior;
- support scrolling the document or a scrollable container by uid;
- return structured action results with before/after summary where useful.

Acceptance:

- Existing `yunti_click`, `yunti_hover`, `yunti_fill`, `yunti_select`,
  `yunti_type_text`, `yunti_press_key`, and `yunti_scroll` tests keep passing.
- New tests cover contenteditable, select option text, scrollable containers,
  missing uid, stale uid, and action result shape.
- Tool errors recommend running `yunti_observe_page` before retrying.

### P6.3 Agent Workflow Contract

Status: planned.

Make the recommended agent workflow explicit in docs, skill, and tool hints.

Scope:

- update `skills/yunti-browser-runtime/SKILL.md` with `observe -> act -> verify`;
- add guidance to evaluate the previous action before retrying;
- discourage repeated blind retries and coordinate-only actions;
- add examples for form filling, tab switching, dropdowns, and scroll recovery;
- consider local task-history tools:
  - `yunti_begin_task`
  - `yunti_record_step`
  - `yunti_get_task_history`
  - `yunti_end_task`

Acceptance:

- Skill and tool hints consistently prefer `yunti_observe_page`.
- Agents can recover from failed action by observing again and using a fresh uid.
- Optional task-history tools, if implemented, store no secrets and are scoped to
  the local user.

### P6.4 DOM Redaction And Page Content Policy

Status: planned.

Promote DOM snapshot redaction to a first-class runtime capability.

Scope:

- redact password fields, hidden token-like fields, auth-like attributes, and
  long credential-looking strings;
- optionally redact email, phone, ID-card-like, and bank-card-like values;
- add local configuration for redaction modes:
  - `strict`
  - `balanced`
  - `off` for local debugging only;
- show redaction metadata in observation output;
- keep network and console redaction behavior aligned with DOM redaction.

Acceptance:

- Sensitive input values are not returned by default observation tools.
- Redaction behavior is deterministic and unit tested.
- Docs explain what is and is not redacted.

### P6.5 Optional Local Runtime Console

Status: planned.

Create a non-required local console for debugging and operator confidence.

Scope:

- list bridge status and connected browser sessions;
- show recent MCP tool calls, action results, errors, and stale-session events;
- provide a stop/cancel affordance for pending browser tasks;
- display extension version and bridge version mismatch warnings;
- keep popup zero-config and small.

Acceptance:

- The console is optional and never blocks the first-run path.
- It exposes no raw secrets.
- It helps diagnose "extension loaded but no page connected" without asking the
  user to inspect logs manually.

### P6.6 Extension Distribution Readiness

Status: planned.

Prepare for browser-store distribution to reduce manual loading friction.

Scope:

- review Chrome Web Store and Edge Add-ons permission text;
- write public privacy and permission rationale docs;
- decide whether broad host permissions remain required or can be narrowed;
- produce store-ready icons, screenshots, and package artifacts;
- keep unpacked extension support for developers and npm installs.

Acceptance:

- A store submission checklist exists.
- Permission rationale is understandable to non-developers.
- Release packaging can produce both npm package and extension-store artifact.

## Suggested Implementation Order

1. P6.1 `yunti_observe_page`
2. P6.2 robust DOM action layer
3. P6.3 skill/tool workflow updates
4. P6.4 DOM redaction policy
5. P6.5 optional console
6. P6.6 store distribution readiness

The first two phases should be treated as the technical core of `0.2.0`.

## Compatibility Rules

- Keep existing `yunti_*` tools unless a replacement has shipped and docs have a
  migration path.
- Add aliases only when they reduce agent confusion.
- Avoid breaking package install, MCP config printer, doctor, and bridge startup.
- Maintain Node.js `>=22`.
- Keep local default tokenless loopback behavior unless binding is non-loopback
  or `YUNTI_BROWSER_BRIDGE_TOKEN` is explicitly configured.

## Validation Gates

For every phase:

```bash
npm run check
npm test
```

When observation/action behavior changes:

```bash
npm run release:check
YUNTI_E2E=1 npm run test:e2e
```

Before publishing `0.2.0`:

```bash
npm run release:check
npm run release:publish
npm run release:verify-published
```

## Current Next Step

Start with P6.1:

1. Define the `yunti_observe_page` schema in `mcp/tools.js`.
2. Implement content-script collection for page metrics and interactive text
   tree.
3. Add routing through the extension dispatcher.
4. Add unit tests for schema/routing and an E2E smoke update.
5. Update skill and docs to prefer observe-first workflows.
