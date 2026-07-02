# Project Status

## Current Phase

Patch release `yunti-browser-runtime@0.1.3` is complete. The project is now
planning the next major cycle, `0.2.0 Best Browser Automation Runtime`,
documented in `docs/NEXT_MAJOR_PLAN.md`.

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
- Local loopback bridge HTTP routes do not require a token by default; setting
  `YUNTI_BROWSER_BRIDGE_TOKEN` re-enables `x-yunti-browser-token` checks.
- Binding the bridge to a non-loopback host requires
  `YUNTI_BROWSER_BRIDGE_TOKEN`.
- Bridge CORS now echoes only local debug origins and browser extension origins
  by default, with `YUNTI_BROWSER_BRIDGE_ALLOW_ORIGINS` as an override.
- Extension popup can save the local bridge URL, optional token, and page match
  patterns.
- Browser sessions now track `lastSeenAt`, `lastActivatedAt`, `expiresAt`, and
  `staleReason`; extension polling refreshes heartbeat and expired sessions are
  cleaned up with recovery guidance.
- `npm run doctor` now checks Node version, bridge reachability, auth mode,
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
- `yunti-browser-runtime@0.1.3` is published on the official npm registry.
- Extension popup is a zero-config status panel by default; Bridge URL, page
  matching, and optional Bridge Token stay under advanced settings.
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
- The next major execution plan is captured in `docs/NEXT_MAJOR_PLAN.md`.
- P6.1 observe/action compatibility has started: `yunti_observe_page` now has an
  MCP tool schema, observe-first usage hints, bridge routing contract tests, a
  content-script DOM observer, focused DOM observer tests, and an opt-in
  real-browser smoke assertion. Fresh observe uids now feed the existing
  click/hover/fill uid resolver while preserving the `yunti_take_snapshot`
  compatibility path.
- Latest P6.1 observe/action validation: `git diff --check` passed,
  `npm run release:check` passed with 69 passing node:test cases and 1 skipped
  real-browser smoke by default, and `YUNTI_E2E=1 npm run test:e2e` skipped
  because Playwright/Chromium is not installed in the current environment.
- Deterministic observe fixtures now cover hidden/offscreen target handling and
  redaction edge modes in addition to fresh uid, text tree, scroll metadata,
  balanced redaction, and stale uid replacement.
- `docs/EXECUTION_PLAN.md` now includes a P6.1 real-browser closure runbook for
  the remaining `observe -> click uid -> observe/verify` validation gap.
- P6.2 preparation has started with tool usage action recovery guidance for
  click/hover/fill, without changing the runtime action implementation.
- Latest P6.2 preparation validation: `git diff --check` passed,
  `node --test tests/bridge.test.js` passed 63 tests, `npm run release:check`
  passed with 70 passing node:test cases and 1 skipped real-browser smoke by
  default, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium is
  not installed in the current environment, and the token residue grep returned
  no matches.
- P6.2 action result contract guidance now distinguishes current
  compatibility-shaped action returns from the additive target contract for
  `action`, `target`, `ok`, `code`, `recoverable`, `nextStepHint`, and
  before/after summaries.
- Latest P6.2 action result contract validation: `git diff --check` passed,
  `node --test tests/bridge.test.js` passed 64 tests, `npm run release:check`
  passed with 71 passing node:test cases and 1 skipped real-browser smoke by
  default, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium is
  not installed in the current environment, and the token residue grep returned
  no matches.
- Dispatcher-level action result shape tests now lock the current compatible
  uid click, uid hover, uid fill, and content-script scroll passthrough result
  fields before P6.2 adds structured action result fields.
- Latest P6.2 action result shape validation: `git diff --check` passed,
  `node --test tests/tool-handlers.test.js` passed 4 tests,
  `npm run release:check` passed with 72 passing node:test cases and 1 skipped
  real-browser smoke by default, `YUNTI_E2E=1 npm run test:e2e` skipped because
  Playwright/Chromium is not installed in the current environment, and the token
  residue grep returned no matches.
- uid-based `yunti_click` now returns additive structured action result fields
  (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`) while preserving
  the existing `clicked`, `uid`, `x/y`, and `browserSessionId` compatibility
  fields.
- Latest P6.2 uid-click structured result validation: `git diff --check`
  passed, `node --test tests/tool-handlers.test.js` passed 4 tests,
  `npm run release:check` passed with 72 passing node:test cases and 1 skipped
  real-browser smoke by default, `YUNTI_E2E=1 npm run test:e2e` skipped because
  Playwright/Chromium is not installed in the current environment, and the token
  residue grep returned no matches.
- uid-based `yunti_hover` now returns additive structured action result fields
  (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`) while preserving
  the existing `hovered`, `uid`, `x/y`, and `browserSessionId` compatibility
  fields.
- Latest P6.2 uid-hover structured result validation: `git diff --check`
  passed, `node --test tests/tool-handlers.test.js` passed 4 tests,
  `npm run release:check` passed with 72 passing node:test cases and 1 skipped
  real-browser smoke by default, `YUNTI_E2E=1 npm run test:e2e` skipped because
  Playwright/Chromium is not installed in the current environment, and the token
  residue grep returned no matches.
- uid-based `yunti_fill` keyboard path now returns additive structured action
  result fields (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`)
  while preserving the existing `filled`, `uid`, `method`, `value`, and
  `browserSessionId` compatibility fields. Select/contenteditable/scroll
  semantics are intentionally unchanged in this slice.
- Latest P6.2 uid-fill keyboard structured result validation: `git diff
  --check` passed, `node --test tests/tool-handlers.test.js` passed 4 tests,
  `npm run release:check` passed with 72 passing node:test cases and 1 skipped
  real-browser smoke by default, npm package contents validation passed with 42
  files, extension zip contents validation passed with 13 files,
  `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium is not
  installed in the current environment, and the token residue grep returned no
  matches.
- uid-based `yunti_fill` select path now returns additive structured action
  result fields (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`)
  while preserving the existing `filled`, `uid`, `method`, `value`, and
  `browserSessionId` compatibility fields. Select value dispatch semantics are
  intentionally unchanged in this slice.
- Latest P6.2 uid-fill select structured result targeted validation: `git diff
  --check` passed and `node --test tests/tool-handlers.test.js` passed 5 tests.
- Latest P6.2 uid-fill select structured result full validation: `git diff
  --check` passed, `npm run release:check` passed with 73 passing node:test
  cases and 1 skipped real-browser smoke by default, npm package contents
  validation passed with 42 files, extension zip contents validation passed with
  13 files, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium
  is not installed in the current environment, and the token residue grep
  returned no matches.
- Coordinate fallback `yunti_click` now returns additive structured action
  result fields (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`)
  while preserving the existing `clicked`, `x/y`, `method`, and
  `browserSessionId` compatibility fields. Coordinate click dispatch semantics
  are intentionally unchanged in this slice.
- Latest P6.2 coordinate-click structured result targeted validation: `git diff
  --check` passed and `node --test tests/tool-handlers.test.js` passed 6 tests.
- Latest P6.2 coordinate-click structured result full validation: `git diff
  --check` passed, `npm run release:check` passed with 74 passing node:test
  cases and 1 skipped real-browser smoke by default, npm package contents
  validation passed with 42 files, extension zip contents validation passed with
  13 files, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium
  is not installed in the current environment, and the token residue grep
  returned no matches.
- Coordinate fallback `yunti_hover` now returns additive structured action
  result fields (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`)
  while preserving the existing `hovered`, `x/y`, `method`, and
  `browserSessionId` compatibility fields. Coordinate hover dispatch semantics
  are intentionally unchanged in this slice.
- Latest P6.2 coordinate-hover structured result targeted validation: `git diff
  --check` passed and `node --test tests/tool-handlers.test.js` passed 7 tests.
- Latest P6.2 coordinate-hover structured result full validation: `git diff
  --check` passed, `npm run release:check` passed with 75 passing node:test
  cases and 1 skipped real-browser smoke by default, npm package contents
  validation passed with 42 files, extension zip contents validation passed with
  13 files, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium
  is not installed in the current environment, and the token residue grep
  returned no matches.
- Selector fallback `yunti_hover` now returns additive structured action result
  fields (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`) while
  preserving the existing `hovered`, `selector`, `x/y`, `method`, and
  `browserSessionId` compatibility fields. Selector hover dispatch semantics
  are intentionally unchanged in this slice.
- Latest P6.2 selector-hover structured result targeted validation: `git diff
  --check` passed and `node --test tests/tool-handlers.test.js` passed 8 tests.
- Latest P6.2 selector-hover structured result full validation: `git diff
  --check` passed, `npm run release:check` passed with 76 passing node:test
  cases and 1 skipped real-browser smoke by default, npm package contents
  validation passed with 42 files, extension zip contents validation passed with
  13 files, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium
  is not installed in the current environment, and the token residue grep
  returned no matches.
- Selector fallback `yunti_click` now returns additive structured action result
  fields (`action`, `target`, `ok`, `recoverable`, and `nextStepHint`) around
  the existing content-script passthrough result while preserving `clicked`,
  `element`, `selector`, `method`, and `browserSessionId` compatibility fields.
  Selector click dispatch semantics are intentionally unchanged in this slice.
- Latest P6.2 selector-click structured result targeted validation: `git diff
  --check` passed and `node --test tests/tool-handlers.test.js` passed 9 tests.
- Latest P6.2 selector-click structured result full validation: `git diff
  --check` passed, `npm run release:check` passed with 77 passing node:test
  cases and 1 skipped real-browser smoke by default, npm package contents
  validation passed with 42 files, extension zip contents validation passed with
  13 files, `YUNTI_E2E=1 npm run test:e2e` skipped because Playwright/Chromium
  is not installed in the current environment, and the token residue grep
  returned no matches.

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
- `0.2.0` is a Yunti-first enhancement cycle aimed at becoming the most useful
  local browser automation operation layer for agents and developers.
- Reference projects such as Playwright, Puppeteer, Selenium, CDP, browser-use,
  Page Agent, BrowserGym, and extension runtimes are sources of practical ideas,
  not product shapes to copy.
- Page Agent has been reviewed as the concrete first reference for P6.1/P6.2:
  absorb browser-state observation, indexed interactive elements, scrollable
  metadata, action sequencing, and retry discipline; do not copy its built-in
  LLM loop or make its UI model mandatory.
- A multi-perspective 0.2.0 review has been completed across product,
  architecture/API, Agent workflow, security/privacy, and test/release strategy.
  The resulting plan changes emphasize product success metrics, field-level
  observation contracts, uid lifecycle, P6.1 minimum redaction, deterministic
  fixtures, and observe-first skill/tool guidance.
- Implementation should proceed step by step: first use Page Agent/browser-use
  as the concrete reference for P6.1 page observation and P6.2 indexed actions,
  then absorb Playwright/CDP/BrowserGym-style reliability and diagnostics later.
- Each `0.2.0` implementation slice should be documented before code changes:
  user-facing capability, compatibility rule, non-goals, acceptance checks, and
  why it strengthens Yunti's own direction.
- Yunti should not require an LLM API key, mandatory hub tab, side panel, or
  single black-box `execute_task` tool in the default path.
- Yunti should preserve its own distinctive capabilities: fine-grained MCP
  tools, real Chrome/Edge state, CDP, screenshots, network/console diagnostics,
  tab control, local bridge routing, and zero-config local install.
- P6.1 implementation is proceeding in small slices: schema/tool hints/bridge
  routing are complete, content-script observation MVP is underway, and fresh
  observe uids now feed existing uid-based actions without replacing the
  snapshot path.

## Open Work

- Follow `docs/NEXT_MAJOR_PLAN.md` for the next major cycle.
- Continue P6.1 with a verified `observe -> click uid -> observe` real-browser
  closure once Playwright/Chromium is available in the validation environment.
- Keep `observe -> click uid -> observe` real-browser closure as the remaining
  P6.1 validation gap until Playwright/Chromium is available locally.
- Use the P6.1 real-browser closure runbook in `docs/EXECUTION_PLAN.md` before
  broadening into P6.2 action semantics.
- Continue P6.2 in small compatibility-preserving slices: next candidates are
  adding structured action result fields behind the existing compatibility
  fields, then fill/select/scroll semantics after the P6.1 closure gap is either
  verified or explicitly tracked as an environment limitation.
- P4.1 release-readiness docs and permission review is complete.
- P4.2 Agent integration examples are complete.
- P4.3 npm publishing URL confirmation is complete with the GitHub repository
  `https://github.com/dingguangyi0/yunti-browser-runtime`; package metadata
  points to that repository/homepage/issues URL set and all three URLs return
  HTTP 200.
- `npm view yunti-browser-runtime@0.1.0` returns the published `0.1.0` package
  metadata from `https://registry.npmjs.org/`.
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
- Latest P4.18 validation: after publish, `npm run release:verify-published`
  returns 0 and confirms the published name, version, repository, homepage,
  bugs URL, and tarball URL.
- P4.19 formal npm publish execution is complete: `npm run release:publish`
  passed metadata checks, release gates, `npm run release:whoami`, `npm run
  check`, `npm test`, npm package contents validation, extension zip validation,
  and official npm publish.
- Latest P4.19 validation: official npm publish succeeded for
  `yunti-browser-runtime@0.1.0`; the published tarball URL is
  `https://registry.npmjs.org/yunti-browser-runtime/-/yunti-browser-runtime-0.1.0.tgz`.
- A temporary npm token publish retry also reached official npm publish after
  passing the full local release gate, but npm returned the same `E403`; the
  token does not satisfy npm's publish-time bypass 2FA requirement.
- A project-local `.npmrc` retry with the actual token also authenticated
  successfully as `xuanzhu`, then failed at `npm publish` with the same `E403`;
  `.npmrc` is ignored by git to avoid committing local npm credentials.
- A second npm token written to the project-local `.npmrc` also authenticated
  successfully as `xuanzhu`, then failed at `npm publish` with the same `E403`.
- A publish-capable npm token written to the project-local `.npmrc` authenticated
  successfully as `xuanzhu`; `npm run release:publish` then succeeded, followed
  by successful `npm run release:verify-published`.
- P5.1 local default auth simplification is complete: default `127.0.0.1`
  bridge usage no longer needs a token; explicit `YUNTI_BROWSER_BRIDGE_TOKEN`
  still enforces token checks; non-loopback binding without a token fails fast.
- Latest P5.1 validation: `npm test` passed 61 tests with 60 passing and 1
  real-browser smoke skipped by configuration; `npm run check` and
  `npm run release:check` passed; `npm run release:publish` published
  `yunti-browser-runtime@0.1.1`; `npm run release:verify-published` returned 0.
- P5.2 extension popup and onboarding simplification is complete: Bridge Token
  is now optional under advanced settings, README contains a copyable Agent
  installation prompt, and default extension loading no longer asks users to
  save popup settings.
- Latest P5.2 validation: `npm run release:check` passed; `npm run
  release:publish` published `yunti-browser-runtime@0.1.2`; `npm run
  release:verify-published` returned 0.
- P5.3 extension zero-config first-run is complete: popup first screen now only
  shows connection status plus refresh, optional Bridge URL/page match/token
  controls are hidden under advanced settings, and docs explain that the MCP
  server starts the local bridge automatically.
- Latest P5.3 validation: `npm run release:check` passed; `npm run
  release:publish` published `yunti-browser-runtime@0.1.3`; a first
  `npm run release:verify-published` hit npm registry lag, then a retry passed
  and `npm view yunti-browser-runtime version dist-tags.latest` returned
  `0.1.3`.

## Known Risks

- Remote relay environment variables still exist in MCP code for compatibility
  but are not documented as the first release path.
- Tool argument validation is improved for the P3.2 focus tools, but broader
  long-tail tools can still receive the same treatment before a later release.
- Extension broad host permissions are now documented, but should still be
  re-reviewed before any store-distributed release.
- Package repository/homepage/bugs metadata is publicly reachable and published
  npm metadata now matches local `package.json`.
- Tool names and descriptions must stay clear enough for agents to choose the
  right route without relying on hidden model knowledge.

## Maintenance Rule

Every meaningful change to runtime behavior, tool schema, extension behavior,
or install flow must update this file before commit/release.
