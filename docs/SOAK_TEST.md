# Browser Endurance Test

## Purpose

The soak test is the reusable post-installation acceptance test for Yunti
Browser Runtime. It launches an isolated Chromium profile, loads the packaged
extension, starts an isolated local Bridge and fixture server, then continuously
operates a deliberately complex page for at least 15 minutes.

This is not a one-click smoke test. A qualifying run fails on the first tool
error, incomplete MCP tool coverage, duplicate guarded write, or duration below
15 minutes.

## Run After Installation

Install the Playwright Chromium binary once if it is not already available:

```bash
npx playwright-core install chromium
```

Run the qualifying test from any writable directory:

```bash
yunti-browser-runtime soak-test
```

Repository contributors can use the equivalent npm command:

```bash
npm run test:soak
```

The test opens a visible test browser. It uses a temporary profile and does not
modify the user's normal Chrome or Edge profile. Current branded Chrome builds
ignore command-line unpacked-extension loading, so the default runner uses the
Chromium for Testing binary installed by Playwright.

Useful options:

```bash
yunti-browser-runtime soak-test --browser=edge
yunti-browser-runtime soak-test --executable-path=/absolute/path/to/browser
yunti-browser-runtime soak-test --artifact-dir=/writable/output/directory
```

For runner development only, a short run can be enabled explicitly:

```bash
npm run test:soak -- --duration-seconds=180 --allow-short
```

A short run always reports `qualifyingDuration: false` and must not be used as
release evidence.

## Coverage

The fixture combines form entry, selects, async controls, dynamic rerendering,
stale uid recovery, guarded writes, tables, HTTP requests, nested scrolling,
coordinate clicks, drag and drop, upload, same-origin iframe content, open
Shadow DOM, dialogs, preview patch and rollback, navigation, child tabs,
screenshots, traces, emulation, memory operations, console diagnostics, network
diagnostics, and CDP detach/reattach.

The coverage contract is generated against the published MCP tool list. Adding
a new public tool without adding it to the soak plan fails the normal unit test
suite, so the endurance test cannot silently remain on an old tool surface.

## Pass Criteria

A release-qualifying result requires all of the following:

- elapsed time is at least 900 seconds
- every published MCP tool is invoked
- every recorded tool call succeeds
- at least one complete continuous cycle finishes
- stale page routes recover through the same live browser session
- every created child tab reports `ready: true` before follow-up operations
- accepted guarded writes match cycles and duplicate write attempts remain zero

Call latency is recorded as p50, p95, and maximum. A passing run can still
expose a tail-latency regression; reviewers should inspect the slowest rows in
`operations.jsonl` instead of treating pass/fail as the only signal.

## Artifacts

By default, each run writes to the current directory:

```text
.artifacts/soak/<timestamp>/
```

The directory contains:

- `operations.jsonl`: one sanitized timing/result row per MCP call
- `summary.json`: machine-readable acceptance result and metrics
- `summary.md`: compact human-readable report
- `error.log`, `failure.png`, and `bridge-state.json` when a run fails

`.artifacts/` is intentionally ignored by Git. Durable release metrics must also
be copied into `docs/PROJECT_STATUS.md`, while the raw local artifacts remain
available for detailed investigation.

## 0.2.5 Baseline

The qualifying run completed on 2026-07-22 in
`.artifacts/soak/2026-07-22T04-42-52-595Z/`:

- elapsed: 900.655 seconds
- cycles: 710
- calls: 19,233 successful out of 19,233
- tool coverage: 52/52
- stale-route recoveries: 710
- child tabs created and closed: 237
- CDP detach/reattach recoveries: 178
- accepted guarded writes: 710
- duplicate write attempts: 0
- call latency p50/p95/max: 4/218/27,682 ms

The maximum latency was one successful `yunti_hover` during a temporary browser
slowdown. It did not change the page session, trigger a duplicate write, or
start an unbounded retry loop, but remains a tail-latency baseline for later
releases.
