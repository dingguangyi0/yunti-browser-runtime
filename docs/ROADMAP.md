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

## Phase 6: Agentic Page Runtime

See [NEXT_MAJOR_PLAN.md](NEXT_MAJOR_PLAN.md) for the durable `0.2.0` execution
plan.

- Add agent-friendly page observation with text DOM, stable uids, and scroll
  hints.
- Improve DOM actions for click, fill, select, contenteditable, and scrollable
  containers.
- Document an observe-act-verify workflow for external agents.
- Promote DOM redaction and page content policy to first-class behavior.
- Add optional local runtime console without changing the zero-config install
  path.
- Prepare extension distribution readiness for browser stores.

## Future: Remote Mode

Remote multi-user operation is intentionally out of the first release. It should
be designed as a separate server layer on top of the local runtime, not mixed
into the local core.
