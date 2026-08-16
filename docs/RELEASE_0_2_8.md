# Yunti Browser Runtime 0.2.8

## Release Positioning

`0.2.8` is a backward-compatible productization release based directly on the
published `0.2.7` page-UI hotfix. It improves installation, Agent onboarding,
and health visibility without changing the browser action protocol or starting
the unfinished P8 stable-page-handle work.

## User-Facing Improvements

- Added `yunti-browser-runtime setup --agent <name>`.
- Codex setup installs the packaged skill idempotently when it is missing.
- Existing differing Codex skills are preserved unless `--force` is explicit.
- `--check-only` is read-only regardless of option order.
- Setup prints the MCP server block, extension directory, local bridge defaults,
  and the remaining browser-side installation step.
- Agent-private MCP configuration is never rewritten automatically.
- Added `yunti-browser-runtime status` with compact states:
  `page_ready`, `controller_online`, `runtime_ready`, `bridge_offline`,
  `bridge_unauthorized`, `version_mismatch`, and `needs_setup`.
- Added `status --json` for automation and `status --strict` as a page-readiness
  gate.
- Updated README, install guide, packaged skill, release checks, and project
  status documentation to use the new flow.
- Added Kimi WebBridge comparison research and evidence-backed next steps for
  future store distribution.

## Compatibility

- MCP tool count remains 52.
- Extension protocol remains version 1.
- Node.js 22+ remains required.
- The default loopback Bridge remains `http://127.0.0.1:48887` with no token
  required unless explicitly configured.
- Existing MCP configuration remains valid.
- The browser extension still requires Chrome Web Store / Edge Add-ons or one
  browser-side Load unpacked confirmation; npm cannot silently install it.
- P8 stable page handle work is not included.

## Validation

The exact release candidate passed:

- `npm run check`
- `npm test`: 191 tests, 190 passed, 1 real-browser smoke skipped by default
- `npm run release:check`
- npm package contents check: 70 files
- extension zip contents check: 13 files
- `git diff --check`

The CLI tests cover read-only setup, idempotent skill installation, custom skill
conflict protection, forced replacement, compact status output, and CLI help.

## Release State

This document describes the `0.2.8` release candidate. npm publication and
`npm run release:verify-published` remain pending until the candidate is
approved for publication.
