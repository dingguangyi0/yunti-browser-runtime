# Yunti Browser Runtime 0.2.6

## Release Positioning

`0.2.6` is a backward-compatible dynamic-page reliability release. It does not
add MCP tools or change the protocol version. It strengthens fresh-target
identity, deep asynchronous waits, open Shadow DOM coordinate actions, and the
benchmark evidence used to decide whether those changes are ready.

## Runtime Improvements

- Every `yunti_observe_page` and `yunti_find_elements` result now receives an
  observation-scoped uid namespace. A uid from an older render cannot silently
  resolve to an unrelated element that happens to occupy the same position in
  a later result.
- Scrollable-container uids use the same observation scope as element uids.
- Coordinate actions descend through open shadow roots before falling back to
  the host element, so observed Shadow DOM controls remain actionable through
  the normal coordinate path.
- `yunti_wait_for` text and selector checks traverse same-origin iframes and
  open shadow roots. Shadow-root text matching also falls back to `textContent`
  when `innerText` is unavailable.
- All changes are additive. Existing selector, uid, coordinate, content-script,
  controller recovery, and unrestricted CDP paths remain available.

## Benchmark And Latency Evidence

- The deterministic benchmark expands from 15 to 38 implemented scenarios.
- The 23 added scenarios cover delayed controls, overlays, navigation waits,
  nested scrolling, rerenders, stale uids, same-origin iframes, open Shadow DOM,
  upload/download, dialogs, network and console state, recovery, and guarded
  writes.
- Guarded-write scenarios retain 20 repetitions each. The passing capture has
  114 attempts, 397 MCP calls, and zero duplicate writes.
- Metric version 2 separates attempt latency, individual tool-call latency, and
  total scenario latency so a 20-repetition guarded scenario is not presented
  as one slow browser action.
- The release-tree benchmark capture at
  `.artifacts/benchmark/2026-07-22T06-24-26-684Z/` passed 38/38 scenarios with
  attempt p50/p95/max `520/1501/1523 ms` and tool-call p50/p95/max
  `9/435/1406 ms`.
- The soak runner now reports p99, per-tool distributions, calls over one
  second, and the 20 slowest calls. A qualifying run enforces call p95
  `<= 500 ms` and maximum `<= 10,000 ms`.
- Repeated screenshots run every ten cycles instead of every two cycles. All
  visual tools remain covered while avoiding artificial render pressure.

## Real Edge Acceptance

The candidate Edge run completed for `900.168` seconds with 840 continuous
cycles, 22,410/22,410 successful calls, all 52 MCP tools covered, 840 stale-route
recoveries, 281 child tabs, 211 CDP detach/reattach recoveries, and zero
duplicate writes. Call p50/p95/p99/max was `4/213/413/956 ms`, with no calls
over one second.

This improves the observed tail from the historical Chromium maximum of
`27,682 ms` to `956 ms`. Because those captures use different browser families,
the result is evidence for the Edge acceptance threshold and removal of the
observed long tail, not a browser-neutral microbenchmark claim.

An additional exact-tree Edge run completed 901 seconds, 422 cycles, all
11,288 calls, all 52 tools, 422 stale-route recoveries, and zero duplicate
writes. It measured p50/p95/p99/max `5/321/682/25122 ms`: correctness and p95
passed, but max failed while unrelated concurrent compilation drove host load
average to 115. The run is retained as overload evidence and is not presented
as the latency qualifier.

## Compatibility And Upgrade

- MCP tool count remains 52.
- Protocol version remains 1.
- Node.js 22+ remains required.
- Existing MCP configuration and default local no-token Bridge behavior remain
  unchanged.
- Update both runtime and unpacked extension files to `0.2.6`, then reload the
  extension once from `chrome://extensions` or `edge://extensions`. Normal
  pages do not require individual refreshes.

## Release Gate

Publication requires all of the following on the exact final source tree:

- 38/38 benchmark scenarios pass with zero duplicate writes.
- A real Microsoft Edge soak runs for at least 900 seconds, covers all 52 tools,
  records zero failures and duplicate writes, and satisfies the latency budget.
- `npm test`, `npm run check`, `npm run release:check`, npm dry-run packaging,
  extension packaging, and `git diff --check` pass.
- npm publication and registry metadata verification complete successfully.

## Release State

Release preparation is in progress. The publication result and final exact-tree
acceptance artifact will be recorded here before the release commit is closed.
