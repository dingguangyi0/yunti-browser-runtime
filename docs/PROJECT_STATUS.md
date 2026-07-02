# Project Status

## Current Phase

Release readiness: local MVP is prepared for first public release. P4.19 formal
npm publish is in progress and currently blocked only by npm two-factor
authentication OTP.

## Current State

- Project directory created.
- Project intent, install, tool, security, roadmap, and status docs exist.
- Local-first architecture selected.
- MCP server, local bridge, extension, runtime path helper, doctor command, and
  bridge tests have been extracted.
- A distributable agent skill exists at
  `skills/yunti-browser-runtime/SKILL.md`.
- README is Chinese-first and includes browser extension setup, MCP registration,
  and agent skill installation steps.
- A staged execution plan exists at `docs/EXECUTION_PLAN.md`.
- Tool prefix is `yunti_*`.
- MCP local mode defaults to `userId=local`.
- Bridge HTTP routes now require `x-yunti-browser-token`; unauthenticated
  `/health` only returns limited status.
- Bridge CORS now echoes only local debug origins and browser extension origins
  by default, with `YUNTI_BROWSER_BRIDGE_ALLOW_ORIGINS` as an override.
- Extension popup can save the local bridge URL, token, and page match patterns.
- Browser sessions now track `lastSeenAt`, `lastActivatedAt`, `expiresAt`, and
  `staleReason`; extension polling refreshes heartbeat and expired sessions are
  cleaned up with recovery guidance.
- `npm run doctor` now checks Node version, bridge reachability, token validity,
  registered sessions, active session, extension presence, MCP server path, and
  skill path; it emits JSON plus a human-readable summary.
- `npm run print-config` prints MCP configuration for Codex, Claude Code,
  Cursor, and Cline, including project paths, bridge port, token guidance, and
  skill installation hints.
- `npm run package:extension` writes a minimal extension zip to `dist/` with
  only extension runtime files.
- `npm run release:dry-run` and `npm run release:publish` pin the official npm
  registry at `https://registry.npmjs.org/`, avoiding accidental publication to
  a locally configured mirror registry.
- `npm run test:e2e` provides an opt-in real-browser Playwright smoke test for
  extension loading, page registration, MCP target listing, snapshot, click/fill,
  and CDP `Runtime.evaluate`.
- Package metadata now includes bin, files, repository, keywords, homepage,
  bugs, and packageManager fields. The `yunti-browser-runtime` CLI routes
  `mcp`, `bridge`, `doctor`, `print-config`, and `package-extension`.
- MCP tool schemas and usage hints have been split into `mcp/tools.js` so
  `mcp/server.js` is focused on bridge, routing, and JSON-RPC behavior.
- MCP JSON-RPC response wrappers, redaction/event normalization helpers, and
  learning memory storage have been split into `mcp/json-rpc.js`,
  `mcp/redaction.js`, and `mcp/memory.js`.
- MCP session hub, request queueing, network/CDP/console event caches, and
  bridge-local tool routing have been split into `mcp/bridge-hub.js`, while
  `mcp/server.js` keeps compatibility re-exports.
- MCP HTTP bridge server, CORS/token checks, route handlers, and body parsing
  have been split into `mcp/http-server.js`, while `mcp/server.js` keeps
  compatibility re-exports.
- Extension settings/page matching and network monitoring have been split into
  `extension/settings.js` and `extension/network-monitor.js`, and the extension
  package script includes those module files.
- Extension CDP target routing, debugger attach/detach, and tracing helpers
  have been split into `extension/cdp.js`, and the extension package script
  includes the module file.
- Extension session registration, polling, popup state, bridge posting, and
  console event forwarding have been split into `extension/session-manager.js`,
  and the extension package script includes the module file.
- Extension tool dispatch and page operation handlers have been split into
  `extension/tool-handlers.js`, and the extension package script includes the
  module file.
- P3.2 tool argument validation is complete for `yunti_click`, `yunti_hover`,
  `yunti_fill`, `yunti_close_page`, `yunti_cdp_send_command`, and
  `yunti_forget_learning_memory`, with recovery-oriented errors and updated
  usage hints.
- `docs/TOOL_GUIDE.md` and `skills/yunti-browser-runtime/SKILL.md` now document
  the common P3.2 parameter rules.
- README and INSTALL now include P3.2 parameter recovery guidance.
- SECURITY now documents `storage` permission usage and broad host permission
  rationale for the local-first extension.
- INSTALL now includes Codex, Claude Code, Cursor, and Cline MCP setup examples
  based on `npm run print-config`.
- Extension registers all `http` and `https` pages by default.
- Product-specific fixed conversation, workspace, and side-panel entry points
  have been removed from the standalone extension.

## Decisions

- Project name: `yunti-browser-runtime`.
- Public package/tooling prefix: `yunti`.
- Environment variable prefix: `YUNTI_BROWSER_`.
- Tool prefix target: `yunti_*`.
- `yunti_list_pages` is a compatibility alias for the live browser target
  inventory, not a separate registration registry.
- If a `browserSessionId` becomes stale, agents should call
  `yunti_list_browser_targets` to refresh the route inventory.
- The content script must not call product-specific login APIs in the
  standalone runtime.

## Open Work

- Follow `docs/EXECUTION_PLAN.md` for the active P4.19 npm publish step.
- P4.1 release-readiness docs and permission review is complete.
- P4.2 Agent integration examples are complete.
- P4.3 npm publishing URL confirmation is complete with the GitHub repository
  `https://github.com/dingguangyi0/yunti-browser-runtime`; package metadata
  points to that repository/homepage/issues URL set and all three URLs return
  HTTP 200.
- `npm view yunti-browser-runtime` currently returns E404, which is acceptable
  only if `0.1.0` is intended to be the first npm release under this package
  name.
- Latest release gate checks passed after documenting P4.3: public-doc residue
  check, `npm run check`, `npm test`, and `npm pack --dry-run`.
- P4.4 release gate scripting is complete: `npm run release:check` now runs
  public-doc residue checks, `npm run check`, `npm test`, and
  `npm pack --dry-run`.
- P4.5 release runbook is complete: `docs/RELEASE.md` documents external URL
  confirmation, release gates, extension zip checks, optional E2E, and npm
  publish steps.
- Latest `npm run release:check` passed after adding the runbook; the npm
  tarball includes `docs/RELEASE.md`.
- P4.6 package metadata checking is complete: `npm run check:metadata` reports
  public reachability for package repository/homepage/bugs URLs and npm package
  status, returning non-zero while the GitHub URLs are unavailable.
- Latest `npm run release:check` passed after adding metadata checking; the npm
  tarball includes `scripts/check-package-metadata.js`.
- P4.7 prepublish gate is complete: `npm run release:prepublish` now runs
  metadata checks before the local release gate and is expected to fail until
  P4.3 repository URLs are public.
- Latest P4.7 validation: `npm run release:check` passed public-doc residue
  checks, `npm run check`, `npm test`, and `npm pack --dry-run`; `npm run
  release:prepublish` failed as expected at `check:metadata` because the current
  repository and bugs URLs still return 404 or are not publicly reachable.
- P4.3 blocker remediation is documented in `docs/PUBLISHING_BLOCKERS.md`;
  latest `npm run release:check` passed after adding that guide, and the npm
  tarball now includes the blocker guide with 39 total files.
- P4.8 npm package contents gate is complete: `npm run release:check` now parses
  `npm pack --json --dry-run` and fails if required runtime, extension, skill,
  release documentation, or release helper files are missing from the tarball.
- Latest P4.8 validation: `npm run release:check` passed public-doc residue
  checks, `npm run check`, `npm test`, and the required npm package contents
  check; the parsed npm pack output contained 39 files.
- P4.9 extension zip contents gate is complete: `npm run release:check` now
  runs `npm run package:extension`, parses the generated zip, and fails if the
  archive is missing required extension runtime files or includes unexpected
  files.
- Latest P4.9 validation: `npm run release:check` passed public-doc residue
  checks, `npm run check`, `npm test`, required npm package contents validation,
  and extension zip contents validation; the generated extension zip contained
  exactly 12 runtime files.
- P4.10 package / extension version consistency gate is complete:
  `npm run release:check` now fails if `package.json.version` and
  `extension/manifest.json.version` are missing or different.
- Latest P4.10 validation: `npm run release:check` passed public-doc residue
  checks, version consistency check for `0.1.0`, `npm run check`, `npm test`,
  required npm package contents validation, and extension zip contents
  validation.
- P4.11 npm bin CLI smoke gate is complete: `npm run release:check` now verifies
  `package.json` bin mapping, `yunti-browser-runtime --help`, and
  `yunti-browser-runtime --version` behavior through the local CLI entrypoint.
- Latest P4.11 validation: `npm run release:check` passed public-doc residue
  checks, version consistency check for `0.1.0`, CLI smoke check for `0.1.0`,
  `npm run check`, `npm test`, required npm package contents validation, and
  extension zip contents validation.
- P4.12 Agent config smoke gate is complete: `npm run release:check` now
  validates `print-config` JSON output for Codex, Claude Code, Cursor, and
  Cline, plus the human-readable Codex output for token and skill guidance.
- Latest P4.12 validation: `npm run release:check` passed public-doc residue
  checks, version consistency check for `0.1.0`, CLI smoke check for `0.1.0`,
  print-config smoke check for 4 agents, `npm run check`, `npm test`, required
  npm package contents validation, and extension zip contents validation.
- P4.13 doctor JSON smoke gate is complete: `npm run release:check` now runs
  `scripts/doctor.js`, parses stdout JSON, validates Node/MCP/skill diagnostics,
  and accepts bridge offline as a structured diagnostic state instead of a release
  gate failure.
- Latest P4.13 validation: `npm run release:check` passed public-doc residue
  checks, version consistency check for `0.1.0`, CLI smoke check for `0.1.0`,
  print-config smoke check for 4 agents, doctor smoke check with bridge offline,
  `npm run check`, `npm test`, required npm package contents validation, and
  extension zip contents validation.
- P4.14 public Markdown link gate is complete: `npm run release:check` now scans
  README, docs, and skills Markdown files and fails if a relative Markdown link
  points to a missing local file.
- Latest P4.14 validation: `npm run release:check` passed public-doc residue
  checks, public Markdown link check for 11 Markdown files, version consistency
  check for `0.1.0`, CLI smoke check for `0.1.0`, print-config smoke check for
  4 agents, doctor smoke check with bridge offline, `npm run check`, `npm test`,
  required npm package contents validation, and extension zip contents
  validation. The release gate test run covered 59 tests, with 58 passed and 1
  real-browser smoke test skipped by configuration.
- Latest P4.3 validation: `git push -u origin main` succeeded, `npm run
  check:metadata` passed with repository/homepage/bugs all returning HTTP 200,
  and `npm run release:prepublish` passed end to end.
- `npm run check:metadata` now retries transient repository/homepage/bugs HEAD
  request failures, so temporary GitHub TLS disconnects do not immediately block
  an otherwise reachable public URL set.
- `npm run check:metadata` also reuses the repository HEAD result when homepage
  resolves to the same GitHub URL, reducing duplicate external requests during
  release gates.
- P4.15 npm official registry publish scripts are complete:
  `release:dry-run` and `release:publish` explicitly use
  `https://registry.npmjs.org/`.
- Latest P4.15 validation: local npm registry is
  `https://registry.npmmirror.com`, while
  `npm run release:dry-run` passed and showed the official npm registry as the
  target; the dry-run tarball contained 39 files.
- P4.16 publish script gate chaining is complete: `release:dry-run` and
  `release:publish` now run `npm run release:prepublish` before reaching npm
  publish or publish dry-run.
- Latest P4.16 validation: `npm run release:dry-run` passed, entered
  `release:prepublish` first, then completed npm publish dry-run against
  `https://registry.npmjs.org/`; the tarball contained 39 files.
- P4.17 npm auth preflight is complete: `release:whoami` checks login against
  `https://registry.npmjs.org/`, and `release:publish` runs it before
  `npm publish`.
- Latest P4.17 validation: after npm login, `npm run release:whoami` succeeds
  against `https://registry.npmjs.org/` and reports account `xuanzhu`.
- P4.18 post-publish verification command is complete:
  `release:verify-published` checks the published npm package name, version,
  repository, homepage, bugs URL, and tarball URL against local `package.json`.
- Latest P4.18 validation: `release:verify-published` currently fails with a
  structured unpublished-package report for `yunti-browser-runtime@0.1.0`,
  `node --check scripts/check-published-package.js` passes, and
  `release:dry-run` passes with a 40-file npm tarball that includes the new
  verifier.
- P4.19 formal npm publish execution is in progress: `npm run release:publish`
  passed metadata checks, release gates, `npm run release:whoami`, `npm run
  check`, `npm test`, npm package contents validation, and extension zip
  validation before reaching `npm publish`.
- Latest P4.19 validation: official npm publish reached
  `https://registry.npmjs.org/` with a 40-file tarball, then failed with npm
  `E403` because the account requires two-factor authentication OTP or a
  granular access token with bypass 2FA enabled.
- A temporary npm token publish retry also reached official npm publish after
  passing the full local release gate, but npm returned the same `E403`; the
  token does not satisfy npm's publish-time bypass 2FA requirement.
- Next required release step: rerun
  `npm run release:publish -- --otp=<6-digit-code>` with a current npm OTP, or
  configure an npm granular access token that can publish with bypass 2FA; after
  publish succeeds, run `npm run release:verify-published`.

## Known Risks

- Remote relay environment variables still exist in MCP code for compatibility
  but are not documented as the first release path.
- Tool argument validation is improved for the P3.2 focus tools, but broader
  long-tail tools can still receive the same treatment before a later release.
- Extension broad host permissions are now documented, but should still be
  re-reviewed before any store-distributed release.
- Package repository/homepage/bugs metadata is publicly reachable, and the
  final npm publish is now waiting on npm 2FA OTP or a publish-capable granular
  access token.
- Tool names and descriptions must stay clear enough for agents to choose the
  right route without relying on hidden model knowledge.

## Maintenance Rule

Every meaningful change to runtime behavior, tool schema, extension behavior,
or install flow must update this file before commit/release.
