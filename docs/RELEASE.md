# Release Runbook

This runbook describes the local release checklist for Yunti Browser Runtime.

## Prerequisites

- Node.js 22 or newer.
- A clean local checkout of the project.
- Access to the public repository that will be listed in `package.json`.
- npm publish permission for the `yunti-browser-runtime` package name.

## Required External Confirmation

Before publishing, confirm the package metadata points to live public URLs:

```bash
npm run check:metadata
```

Expected pre-first-release state:

- GitHub repository URL returns a non-404 status.
- GitHub issues URL returns a non-404 status or the issue tracker URL is updated.
- `npm view yunti-browser-runtime` may return E404 if `0.1.0` is the first release.

If the GitHub URLs return 404, do not publish. Create or publicize the repository,
or update `repository`, `homepage`, and `bugs.url` in `package.json`.
Detailed remediation options are tracked in
[`docs/PUBLISHING_BLOCKERS.md`](PUBLISHING_BLOCKERS.md).

`npm run check:metadata` exits non-zero when repository, homepage, or issue URLs
are not publicly reachable. It treats npm E404 as acceptable for a first release
and reports that state in JSON.

## Local Release Gate

Run the consolidated release gate:

```bash
npm run release:check
```

This command verifies:

- public docs do not contain local/internal residue;
- public Markdown relative links resolve to existing files;
- `package.json` and `extension/manifest.json` use the same version;
- npm bin smoke checks for `yunti-browser-runtime --help` and `--version` pass;
- Agent config smoke checks for Codex, Claude Code, Cursor, and Cline pass;
- doctor JSON smoke check returns structured diagnostics and local file checks;
- all JavaScript files pass `node --check`;
- the unit test suite passes;
- `npm pack --json --dry-run` includes required runtime, extension, skill,
  release documentation, and release helper files.
- `npm run package:extension` creates an extension zip containing only the
  required runtime files.

After external package metadata is live, run the stricter prepublish gate:

```bash
npm run release:prepublish
```

This runs `npm run check:metadata` first, then `npm run release:check`.
For the current `dingguangyi0/yunti-browser-runtime` repository metadata, this
gate is expected to pass before publishing.

## Extension Package

Build and inspect the browser extension zip:

```bash
npm run package:extension
unzip -l dist/yunti-browser-runtime-extension-0.1.0.zip
```

`npm run release:check` also validates this zip automatically by parsing the
actual archive entries.

The zip should contain only the extension runtime files:

- `background.js`
- `cdp.js`
- `content.css`
- `content.js`
- `network-monitor.js`
- `manifest.json`
- `popup.css`
- `popup.html`
- `popup.js`
- `session-manager.js`
- `settings.js`
- `tool-handlers.js`

## Optional Real-Browser Smoke Test

Run this when Playwright and Chromium are available:

```bash
YUNTI_E2E=1 npm run test:e2e
```

The default `npm test` run skips the real-browser smoke test unless `YUNTI_E2E=1`
is set.

## Publish

After the external URL confirmation and local release gate pass:

```bash
npm run release:dry-run
npm run release:publish
```

The dry-run and publish scripts both run `npm run release:prepublish` before
publishing. They also pin `https://registry.npmjs.org/` so a local mirror
registry configuration cannot accidentally receive the release.
`npm run release:publish` also runs `npm run release:whoami` before publishing.

If npm auth is missing, log in first:

```bash
npm adduser --registry=https://registry.npmjs.org/
npm run release:whoami
```

After publishing, verify:

```bash
npm run release:verify-published
```

## Post-Release

- Re-run `npm run doctor` in a fresh local setup.
- Re-run `npm run print-config -- --agent codex --human`.
- Load or package the extension from the published source.
- Update `docs/PROJECT_STATUS.md` with the release result and published version.
