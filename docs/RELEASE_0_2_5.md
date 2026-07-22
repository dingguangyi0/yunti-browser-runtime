# Yunti Browser Runtime 0.2.5

## Release Positioning

`0.2.5` is a reliability convergence release. It does not add new MCP tools.
Its purpose is to stop protocol mismatch, multi-browser controller replacement,
cross-instance page routing, and layered retry loops from appearing as random
browser disconnects.

## Implemented

- Runtime and extension now share protocol version `1` in addition to package
  version `0.2.5`.
- `doctor` compares the runtime with the extension version and protocol actually
  reported by the live browser controller. A mismatch returns `ok: false`.
- A new MCP process entering proxy mode checks the version of the Bridge already
  owning the port. An older Bridge fails before any browser request is queued.
- MCP protocol mismatch failures are fail-fast and structured with
  `retryable: false`, `retryBudget: 0`, and an explicit `recoveryAction`.
- Browser controllers are keyed by browser/profile instance instead of only
  `userId=local`. Chrome, Edge, and separate profiles no longer replace one
  another.
- Page metadata carries `browserInstanceId` and
  `browserControllerSessionId`. Controller heartbeat refreshes and removes only
  pages belonging to its own browser instance.
- Duplicate `tabId` values in different browsers no longer replace or route to
  one another.
- `yunti_list_browser_targets` aggregates all compatible connected browser
  instances when no route is specified. Rows carry browser family, browser
  instance, and controller route metadata.
- MCP failures expose a common `code`, `retryable`, `retryBudget`,
  `recoveryAction`, and `resultUncertain` contract.
- The packaged skill, tool usage hints, README, install guide, Tool Guide, and
  Agent Workflow Contract use one shared recovery budget instead of layered
  independent retries.
- Controller-routed page actions reuse a known page session while its tab URL
  remains unchanged. A registration probe is now reserved for a missing route
  or a real navigation, avoiding unnecessary probes against sleeping Edge tabs.
- `yunti_new_page` waits for an HTTP/HTTPS tab to load and complete real page
  registration before returning `ready: true`.
- Extension network diagnostics cover HTTP intranet pages as well as HTTPS.
- A reusable `soak-test` CLI launches an isolated complex browser fixture for a
  minimum of 15 minutes and enforces coverage of every published MCP tool.

## Required Acceptance

- Runtime `0.2.5` plus an older live extension fails doctor and queues zero
  browser requests.
- Chrome and Edge controllers remain registered together under `userId=local`.
- Same-numbered tab ids in Chrome and Edge route through their owning
  controller.
- One controller heartbeat cannot expire or refresh another browser's pages.
- Multi-browser target inventory reports all compatible controllers.
- Timeouts mark execution as uncertain; agents verify state before replaying a
  possible write.
- Unit tests, syntax checks, package checks, Chrome E2E, and Edge E2E pass before
  publication.
- The qualifying browser soak runs for at least 900 seconds with complete tool
  coverage, zero failed calls, and zero duplicate guarded writes.

## Release State

Implementation, release checks, real Chromium, real Edge, and simultaneous
Chromium-plus-Edge validation pass locally. The release extension package is
`dist/yunti-browser-runtime-extension-0.2.5.zip`. The user accepted this build
and requested publication on 2026-07-22; registry verification remains required
before the release is marked published.

The first qualifying soak completed for 900.655 seconds with 710 continuous
cycles, 19,233/19,233 successful calls, 52/52 tools covered, 710 stale-route
recoveries, 237 child tabs, 178 CDP detach/reattach recoveries, and zero
duplicate writes. The baseline and reusable procedure are recorded in
[SOAK_TEST.md](SOAK_TEST.md).
