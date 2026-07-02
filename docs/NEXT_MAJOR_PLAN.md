# Next Major Plan: 0.2.0 Best Browser Automation Runtime

This document is the durable planning contract for the next major development
cycle after `yunti-browser-runtime@0.1.3`.

## Goal

Build the most useful browser automation operation layer for AI agents and
developers: local-first, LLM-agnostic, MCP-native, and able to operate the
user's real Chrome/Edge browser through fine-grained, inspectable tools.

`0.2.0` should strengthen Yunti's own direction while absorbing the best
practical ideas from the broader browser automation ecosystem:

- observe pages in a compact, agent-friendly text form;
- act through stable element ids and robust DOM action semantics;
- verify each step with clear recovery hints;
- keep sensitive page content redacted by default;
- combine page-level DOM automation with browser-level CDP, tabs, screenshots,
  network, console, file upload, and diagnostics;
- make both human operators and external agents confident about what happened
  and what to do next;
- preserve the current local-first, zero-config install path.

Execution should stay incremental. The first implementation slice should focus
on Page Agent / browser-use style page observation and indexed actions. Other
ecosystem lessons are backlog inputs for later phases after the observe/action
spine is stable.

## Planning Discipline Before Code

Before each implementation slice, update this document and
`docs/EXECUTION_PLAN.md` with the concrete scope, non-goals, acceptance checks,
and the reason the slice strengthens Yunti's own product direction.

This prevents two failure modes:

- copying a reference project's architecture instead of extracting useful
  concepts;
- starting a broad rewrite before the current Yunti tool surface has a stable
  incremental path forward.

For `0.2.0`, code should move only after the relevant phase has:

- a user-facing capability statement;
- a stable tool/API contract or compatibility rule;
- an explicit "not this phase" list;
- tests or smoke checks that prove the slice works;
- documentation updates that an external agent can follow.

## Yunti-First Principle

Yunti should not become a clone of any single existing tool. Every browser
automation project is a source of ingredients, not the target architecture.

Yunti's distinctive strengths are:

- local MCP bridge that any agent can connect to;
- fine-grained `yunti_*` tools instead of a single opaque task runner;
- real user Chrome/Edge state, tabs, login sessions, screenshots, CDP, network
  observations, and console diagnostics;
- zero LLM API dependency inside the runtime;
- zero-config local install path after extension loading;
- security boundaries based on local loopback, optional token hardening, and
  explicit redaction.

## Ecosystem Lessons To Absorb

The order matters. Start with Page Agent / browser-use for P6.1 and P6.2, then
fold in other automation-system lessons step by step.

### browser-use / Page Agent

What to absorb first:

- text-oriented DOM observation;
- indexed interactive elements;
- scroll hints and scrollable-container metadata;
- better DOM action semantics;
- task history/activity concepts for optional diagnostics;
- content masking hooks.

How Yunti should differ:

- do not move the LLM loop into the runtime core;
- keep Yunti as the browser hands/eyes for any external agent;
- preserve fine-grained tools instead of only natural-language task execution.

### Playwright / Puppeteer / Selenium

What to absorb:

- reliable action semantics for click, fill, select, keyboard, upload, wait, and
  navigation;
- clear locator strategy and auto-waiting behavior;
- trace-style debugging and reproducible action logs;
- screenshot/video/artifact thinking for failures;
- browser context and tab management discipline.

How Yunti should differ:

- operate the user's already-open real browser instead of forcing a separate
  test-runner profile;
- expose capabilities through MCP tools that external agents can compose;
- keep install and runtime local-first.

### Chrome DevTools Protocol

What to absorb:

- complete browser-level power: targets, runtime evaluation, screenshots,
  network, console, performance, DOM, file upload, and emulation;
- precise low-level escape hatches when high-level DOM actions are not enough.

How Yunti should differ:

- wrap CDP with safer, friendlier workflows and recovery hints;
- avoid forcing agents to know raw CDP for common tasks.

### BrowserGym / Web Evaluation Harnesses

What to absorb:

- scenario-based task evaluation;
- deterministic smoke pages and fixtures;
- measurable success/failure criteria for browser actions;
- regression suites for common interaction patterns.

How Yunti should differ:

- prioritize real local browser usefulness over benchmark-only behavior.

### Browser Extensions And Local Runtimes

What to absorb:

- easy install/update paths;
- visible runtime health and connection status;
- permission transparency;
- optional debugging UI that does not block first use.

How Yunti should differ:

- keep the default popup zero-config;
- make richer UI optional and diagnostic, not mandatory.

When a design choice conflicts with Yunti's current strengths, keep Yunti's
current strengths.

## Reference Absorption Ladder

Yunti should absorb browser automation ideas in this order:

1. **Observe/action spine**: Page Agent and browser-use inspire compact page
   observation, indexed interactive elements, and scroll hints.
2. **Action reliability**: Playwright, Puppeteer, and Selenium inspire more
   predictable clicking, filling, selecting, waiting, and upload behavior.
3. **Diagnostics and escape hatches**: CDP remains Yunti's deep browser-control
   layer for screenshots, network, console, targets, runtime evaluation, and
   lower-level recovery.
4. **Regression confidence**: BrowserGym-style fixtures and scenario checks
   help measure whether common browser actions keep working.
5. **Operator experience**: extension/runtime patterns help reduce install
   friction and make connection health visible without adding mandatory UI.

Each rung must be additive. If a new idea requires removing fine-grained
`yunti_*` tools, hiding browser state behind an opaque task runner, or requiring
an LLM provider key inside the runtime, it does not belong in the default
`0.2.0` path.

## Non Goals

- Do not require an LLM API key inside Yunti Browser Runtime.
- Do not replace fine-grained `yunti_*` MCP tools with a single black-box
  natural-language `execute_task` tool.
- Do not make a hub tab, side panel, or UI console mandatory for first use.
- Do not mix remote multi-user mode into the local single-user core.
- Do not remove CDP, network, console, screenshot, or tab-level capabilities in
  favor of a narrower page-only agent abstraction.
- Do not treat compatibility or API parity with any reference project as a goal.
- Do not optimize only for benchmarks while making real user-browser automation
  harder.
- Do not weaken the local loopback security boundary or publish real secrets in
  docs, config output, logs, or tests.

## Release Theme

`0.2.0` should be a compatibility-preserving enhancement release that makes
Yunti feel like the most practical browser automation layer for agents. Existing
tools continue to work, while agents are guided toward a stronger default
workflow:

```text
yunti_observe_page -> yunti_click/fill/select/scroll by uid -> observe/verify
```

`yunti_take_snapshot` remains available. Newer docs and skill instructions should
prefer `yunti_observe_page` once implemented.

## Phase Plan

### P6.0 Product Direction Guardrail

Status: complete.

The release direction is Yunti-first and ecosystem-informed:

- keep Yunti local-first, LLM-agnostic, MCP-native, and real-browser-oriented;
- absorb useful ideas from Playwright, Puppeteer, Selenium, CDP, browser-use,
  Page Agent, BrowserGym, and extension runtimes;
- do not clone a single project or weaken Yunti's current strengths.

### P6.1 Agent-Friendly Page Observation

Status: planned.

Create `yunti_observe_page`, a higher-level observation tool. Use Page Agent's
PageController/browser-state approach as the first concrete reference, adapted
to Yunti's MCP/extension architecture. It returns:

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

First slice:

- add the tool as an additive replacement path, not a breaking change to
  `yunti_get_page_snapshot` or `yunti_take_snapshot`;
- prefer content-script DOM collection first so basic observation works without
  CDP attachment;
- return both structured fields and a compact text tree so agents can choose
  programmatic or prompt-oriented consumption;
- keep uid generation scoped to the latest observation and make stale uid errors
  point back to `yunti_observe_page`;
- redact sensitive input values by default, even before the full P6.4 policy is
  complete.

Not this phase:

- no LLM task loop inside the runtime;
- no Page Agent hub tab, side panel, or visual console requirement;
- no full Playwright-style locator engine;
- no benchmark harness beyond a focused fixture/smoke test;
- no remote multi-user browser orchestration.

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
module such as `extension/dom-actions.js`. Use Page Agent's action sequencing
as the first reference for click/input/select/scroll behavior, then evolve with
additional lessons from Playwright/CDP in later increments.

Scope:

- use consistent pointer/mouse event order for click and hover;
- improve text input for input, textarea, select, and contenteditable;
- support select-by-visible-text and select-by-value;
- improve uid-targeted fill so contenteditable and rich text editors get better
  fallback behavior;
- support scrolling the document or a scrollable container by uid;
- return structured action results with before/after summary where useful.

First slice:

- keep existing `yunti_click`, `yunti_hover`, `yunti_fill`, `yunti_select`,
  `yunti_type_text`, `yunti_press_key`, and `yunti_scroll` names stable;
- make uid-based actions work naturally after `yunti_observe_page`;
- improve errors so agents understand whether to observe again, scroll, wait, or
  switch tabs;
- keep selector and coordinate fallbacks available for recovery and debugging.

Not this phase:

- no large action-runner abstraction that hides individual tool calls;
- no mandatory replay/trace UI;
- no removal of CDP-based fallback behavior.

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

The first two phases should be treated as the technical core of `0.2.0`, but
they must remain additive enhancements to Yunti's MCP tool surface.

For the first implementation cycle, do not attempt to absorb every ecosystem
lesson at once. Complete the Page-Agent-informed observe/action foundation
first, then add Playwright/CDP/BrowserGym-style reliability and diagnostics in
separate follow-up increments.

## Compatibility Rules

- Keep existing `yunti_*` tools unless a replacement has shipped and docs have a
  migration path.
- Add aliases only when they reduce agent confusion.
- Avoid breaking package install, MCP config printer, doctor, and bridge startup.
- Preserve Yunti's CDP, tab, network, console, screenshot, and fine-grained DOM
  action capabilities.
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

Start with docs-first P6.1 preparation:

1. Confirm the `yunti_observe_page` output contract in this plan and
   `docs/EXECUTION_PLAN.md`.
2. Confirm how its uid map relates to existing `yunti_take_snapshot` uid
   behavior.
3. Confirm the first smoke fixture: `observe -> click uid -> observe`.
4. Confirm default redaction rules for password/token-like values.
5. Only then begin the implementation slice:

   - define the `yunti_observe_page` schema in `mcp/tools.js`;
   - implement content-script collection for page metrics and interactive text
     tree;
   - add routing through the extension dispatcher;
   - add unit tests for schema/routing and an E2E smoke update;
   - update skill and docs to prefer observe-first workflows.
