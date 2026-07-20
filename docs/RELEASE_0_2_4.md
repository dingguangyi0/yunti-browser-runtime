# Yunti Browser Runtime 0.2.4

`0.2.4` is a focused Microsoft Edge session-recovery patch based on real Edge
150 testing. It does not include the unfinished Phase 8 observation,
actionability, benchmark, or self-healing feature work.

## Changes

- Bounds content-script probe and injection waits so an Edge sleeping tab cannot
  block forever.
- Keeps the single browser-controller poll running independently from serialized
  page-tool execution.
- Adds an extension-side tool timeout and a progress watchdog that replaces a
  stalled controller poller.
- Temporarily activates an Edge sleeping target when background injection
  stalls, then restores the user's previously active tab without refreshing the
  page.
- Normalizes recovered observe results with the authoritative page
  `browserSessionId`.
- Updates the packaged skill, README, installation guide, tool guide, and Agent
  workflow contract so agents do not ask users to refresh, switch tabs, or
  restart Edge before automatic controller/target recovery has failed.
- Adds a release gate that verifies Edge recovery guidance remains synchronized
  across all packaged Agent documentation.

## Real Edge Evidence

- Discovered 21 pre-existing Edge tabs with zero page sessions and no refresh.
- Recovered a sleeping tab in 3288 ms after the same operation had timed out
  twice before the fix.
- Reused a page session recorded before extension reload and recovered it in
  3284 ms while the page remained in the background.

## Compatibility

- Chrome behavior and the `0.2.3` single-controller route contract are retained.
- Local loopback operation still requires no token by default.
- No MCP tool is removed or renamed.
- No unfinished Phase 8 feature is part of this patch.
