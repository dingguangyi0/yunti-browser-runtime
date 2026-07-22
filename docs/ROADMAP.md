# Roadmap

## Phase 0: Scaffold

- Create standalone repository structure.
- Document project intent and status.
- Define local-first architecture.

## Phase 1: Local Runtime MVP

- MCP stdio server starts a local bridge automatically.
- Browser extension registers local tabs with the bridge.
- Agent can list browser targets.
- Agent can inspect a page snapshot.
- Agent can send CDP commands through a stable browser route.
- Agent can click, type, navigate, screenshot, and read network/console logs.

## Phase 2: Install Experience

- Add `npm run doctor`.
- Add `npm run package:extension`.
- Add MCP config printer.
- Add clear Chrome/Edge extension loading instructions.

## Phase 3: Reliability

- Add session TTL and fast stale-session failures.
- Add better error messages for wrong parameter combinations.
- Add smoke tests for bridge, MCP, and extension message contracts.

## Phase 4: Productization

- Rename tools to `yunti_*`.
- Keep compatibility aliases only when useful.
- Publish an npm package.
- Prepare public docs and examples.

## Phase 5: Local Install Simplification

- Default local loopback bridge usage does not require a token.
- MCP server starts the local bridge automatically.
- Extension popup stays zero-config on first run.
- Token, bridge URL, and page match customization stay in advanced settings.

## Phase 6: Best Browser Automation Runtime

See [NEXT_MAJOR_PLAN.md](NEXT_MAJOR_PLAN.md) for the durable `0.2.0` execution
plan.

- Keep the release Yunti-first: build the best local browser automation
  operation layer for agents instead of pivoting to any single reference
  project's shape.
- Absorb practical strengths from Playwright, Puppeteer, Selenium, CDP,
  browser-use, Page Agent, BrowserGym, and extension runtimes.
- Sequence the work: first implement the Page Agent / browser-use inspired
  observe/action spine, then absorb the other ecosystem lessons step by step.
- Treat Page Agent/browser-use as the first DOM operation reference only; Yunti's
  full product boundary still includes MCP setup, real browser sessions, tabs,
  CDP, network/console diagnostics, screenshots, uploads, and zero-config local
  install.
- Define success in practical terms: fewer mis-clicks, fewer blind retries,
  clearer recovery, default redaction, and deterministic browser-action
  fixtures.
- Keep planning ahead of code for each slice: confirm the user-facing capability,
  compatibility rule, non-goals, and validation path before implementation.
- Add agent-friendly page observation with text DOM, stable uids, and scroll
  hints.
- Improve DOM actions for click, fill, select, contenteditable, and scrollable
  containers.
- Document an observe-act-verify workflow for external agents.
- Promote DOM redaction and page content policy to first-class behavior.
- Add optional local runtime console without changing the zero-config install
  path.
- Prepare extension distribution readiness for browser stores.
- Track store-facing permission/privacy readiness in
  [EXTENSION_DISTRIBUTION.md](EXTENSION_DISTRIBUTION.md) before changing
  manifest behavior.
- Keep the npm/unpacked path stable while evaluating the browser-store
  permission strategy in
  [EXTENSION_PERMISSION_STRATEGY.md](EXTENSION_PERMISSION_STRATEGY.md).

## Future: Remote Mode

Remote multi-user operation is intentionally out of the first release. It should
be designed as a separate server layer on top of the local runtime, not mixed
into the local core.

## Phase 8: Measured Browser-Agent Reliability

See [COMPETITOR_RESEARCH_2026.md](COMPETITOR_RESEARCH_2026.md) for the durable,
evidence-backed post-`0.2.3` plan.

- Use Alibaba Page Agent and browser-use as the primary references.
- Exclude stale projects from prioritization; use other active projects only as
  narrow evidence for actionability, diagnostics, evaluation, or security.
- P8.0 benchmark, the `0.2.3` baseline, and the `0.2.6` release-tree capture
  are complete; use them as gates for later runtime behavior changes.
- The benchmark contract and 30+ scenario matrix now live in
  [RELIABILITY_BENCHMARK_PLAN.md](RELIABILITY_BENCHMARK_PLAN.md).
- Follow with Observation v2, unified actionability/auto-wait, validated target
  recipes, sanitized trajectories, trust boundaries, capability profiles, and
  extension distribution.
- Before semantic target recipes, add the P8.2.4 stable page handle contract:
  agents select a live tab once, while navigation, reload, extension reconnect,
  Bridge restart, and page-session replacement stay internal to the runtime.
  See [STABLE_PAGE_HANDLE_PLAN.md](STABLE_PAGE_HANDLE_PLAN.md).
- Keep remote browsers and advanced DevTools insight packs optional and later
  than measurable local reliability improvements.
- Preserve local existing-browser operation, fine-grained MCP tools, the single
  controller transport, redaction, and unrestricted CDP.
