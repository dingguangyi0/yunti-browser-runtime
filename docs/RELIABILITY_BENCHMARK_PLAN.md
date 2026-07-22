# P8 Reliability Benchmark Plan

## Status

- Phase: P8.0 complete; P8.1 metric and behavior validation complete locally
- Scope: benchmark contract, scenario matrix, artifact plan, and acceptance
  rules
- Runtime code changes: all 38 scenarios, deep wait support, observation-scoped
  uids, open-shadow coordinate actions, latency instrumentation, and validation
  tests are implemented on the candidate branch
- Baseline target: released `yunti-browser-runtime@0.2.5`

This document defines how Yunti should measure browser-operation quality before
changing observation or action behavior in P8.1+.

## Goal

Produce a reproducible local benchmark for Yunti's real-browser workflow so the
next version is measured against the current `0.2.3` baseline instead of
judged by tool count or anecdotal success.

The benchmark must answer:

- Which browser tasks succeed reliably today?
- Which failures are wrong actions vs target drift vs timing vs transport?
- How often can Yunti recover without user intervention?
- How large are observations and how much context do they cost?
- Which write paths are safe enough to optimize without risking duplicate
  submissions?

## Non-goals

- No public leaderboard optimization.
- No mandatory runtime LLM loop.
- No product-behavior change in this planning slice.
- No remote browser provider work.
- No attempt to hide failures by weakening assertions.

## Baseline Principles

1. Use Yunti's real product boundary:
   - existing browser + unpacked extension
   - local bridge + MCP tools
   - content-script actions plus unrestricted CDP when needed
2. Prefer deterministic local fixtures over third-party sites.
3. Measure both correctness and safety.
4. Separate one-off smoke coverage from repeated-run reliability data.
5. Preserve current `0.2.3` behavior as the benchmark reference.

## Metrics

Every scenario run should emit at least these fields:

- `scenarioId`
- `category`
- `backend` used for the decisive action or verification
- `ok`
- `failureClass`: `wrong-action`, `target-missing`, `timeout`,
  `policy-denied`, `transport`, `browser-crash`, `assertion`,
  `unknown`
- `recovered`
- `duplicateWrite`
- `durationMs`
- `observeCount`
- `totalObservedElements`
- `totalObservationBytes`
- `estimatedObservationTokens`
- `notes`

Roll-up metrics:

- success rate
- wrong-action rate
- recovery rate
- duplicate-write count
- p50 and p95 duration
- median and p95 observation bytes
- median and p95 estimated observation tokens

Metric version 2 separates three latency populations:

- attempt latency: one normal scenario run or one guarded-write repetition
- tool-call latency: one MCP call through the real Bridge/extension boundary
- scenario latency: total end-to-end cost, including all 20 guarded repetitions

Scenario totals remain available for workload accounting, but they are not used
as operational p95. This prevents a 20-attempt scenario from being mislabeled
as one slow browser action.

## Scenario Matrix

P8.0 requires at least 30 deterministic scenarios. The matrix below defines the
minimum first-pass set.

### A. Core Form And Action Flow

1. Single text input fill and verify
2. Textarea fill and verify
3. Contenteditable fill and verify
4. Select by value and verify
5. Select by visible text and verify
6. Checkbox toggle and verify
7. Radio-group selection and verify
8. Button click triggers visible confirmation

### B. Async UI And Timing

9. Delayed render after click
10. Delayed enable state before click
11. Spinner disappears before submit
12. Debounced search result appears after fill
13. URL change wait after navigation
14. Overlay removed before underlying click

### C. Scroll And Viewport

15. Document scroll to offscreen button
16. Nested panel scroll to offscreen row
17. Partial scroll to edge with recovery hint
18. Coordinate scroll fallback to document

### D. Navigation And Tabs

19. Open new tab and verify target inventory
20. Switch back to original tab and continue
21. Navigation preserves active session routing
22. Controller-only active-tab recovery after stale page id

### E. Target Drift And Recovery

23. Re-observe after DOM rerender and act with fresh uid
24. Old uid fails cleanly after rerender
25. Recovery from missing page session without manual refresh
26. Legacy stale session id recovers through controller routing

### F. Frames And Rich Page Structure

27. Same-origin iframe interaction
28. Same-origin iframe wait and verify
29. Open-shadow-root target interaction
30. Open-shadow-root fill and verify

### G. Upload, Download, And Browser Surfaces

31. File upload and verify selected file state
32. Download-trigger click and completion signal
33. Screenshot capture after action
34. Console/network diagnostic capture around a failing page action

### H. Guarded Writes And Safety

35. Single submit executes once across 20 repeated runs
36. Async submit with delayed confirmation executes once
37. Write path interrupted by target drift does not double-submit
38. Write path timeout fails closed without replay

## Repetition Policy

- Scenarios 1-34 run at least once in the baseline capture.
- Scenarios 35-38 run 20 times each.
- Any scenario intended to represent a guarded write must prove
  `duplicateWrite = 0`.
- If a scenario depends on browser timing, the fixture should expose a stable
  timing control instead of relying on ambient machine speed.

## Fixture Plan

Use local deterministic fixtures first. P8.0 should add dedicated fixture pages
instead of relying on public websites.

Required fixture families:

- form controls
- async render / delayed enable / overlay
- nested scroll container
- tab opener
- rerender / stale uid
- same-origin iframe
- open shadow root
- upload/download
- guarded submit counter

Recommended fixture layout:

- `tests/fixtures/benchmark/`
- one HTML file per scenario family where practical
- a shared helper script for deterministic counters and delayed transitions

## Execution Layers

P8.0 should measure Yunti at three layers without changing product behavior:

1. Deterministic unit/contract coverage
   - existing `tests/*.test.js`
2. Real-browser extension E2E scenarios
   - extend `tests/e2e.test.js` or add a benchmark-focused sibling
3. Aggregated benchmark reporting
   - a small runner that executes scenarios and writes JSON results

Commands:

- `npm run test:e2e` remains smoke-level
- `npm run benchmark:baseline` executes all 38 implemented scenarios
- `npm run benchmark:list` prints the manifest and implementation count

## Artifact Plan

Recommended output directory:

- `.artifacts/benchmark/<timestamp>/`

Expected files:

- `summary.json`
- `summary.md`
- `scenario-results.jsonl`
- `failures/<scenarioId>/`
- optional screenshots
- optional console/network snippets
- optional bridge console state

Rules:

- redact sensitive text in persisted summaries by default
- raw screenshots and raw CDP/network payloads stay opt-in
- failure bundles should be small enough to inspect locally

## Failure Classification Rules

Use these classes consistently:

- `wrong-action`: the action succeeded technically but changed the wrong target
- `target-missing`: stale/missing uid, selector, frame path, or route
- `timeout`: expected condition did not happen in time
- `policy-denied`: blocked by confirmation or origin/security rule
- `transport`: bridge/controller/request path failed
- `browser-crash`: browser or extension process crashed/disconnected
- `assertion`: action completed but expected final state was false
- `unknown`: failure could not be classified automatically

## Acceptance For P8.0

P8.0 is complete only when all of the following are true:

1. The scenario matrix is implemented with at least 30 deterministic scenarios.
2. A reproducible `0.2.3` baseline report exists.
3. Success, wrong-action, recovery, duplicate-write, latency, and observation
   size metrics are reported.
4. Guarded-write scenarios prove zero duplicate submissions across repeated runs.
5. The benchmark output format is stable enough to compare future P8 deltas.
6. Status docs link to the benchmark report and summarize the baseline.

## Completion Evidence

The benchmark suite is in place through:

- `tests/fixtures/benchmark/`
- `scripts/benchmark/manifest.js`
- `scripts/benchmark/fixture-server.js`
- `scripts/benchmark-baseline.js`
- `tests/benchmark-foundation.test.js`

The qualifying local capture is:

- artifact: `.artifacts/benchmark/2026-07-22T06-24-26-684Z/`
- scenarios: 38/38 passed
- attempts: 114, including 80 guarded-write repetitions
- MCP calls: 397
- duplicate writes: 0
- attempt p50/p95/max: 520/1501/1523 ms
- tool-call p50/p95/max: 9/435/1406 ms
- scenario p50/p95/max: 149/10595/29940 ms

The next work should be:

1. keep the 38/38 matrix as a release gate for future behavior changes
2. add hostile-page and cross-origin-frame fixtures without weakening current
   assertions
3. compare future tool-call and attempt latency against metric version 2
4. retain 20 repetitions for every guarded-write scenario
