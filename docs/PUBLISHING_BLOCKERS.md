# Publishing Blockers

This document tracks release blockers that require external confirmation before
publishing `yunti-browser-runtime`.

## Active Blocker: npm 2FA Publish OTP

Status: active as of 2026-07-03.

`npm run release:publish` now passes local release gates and npm login preflight,
then reaches `npm publish --registry=https://registry.npmjs.org/`. The registry
rejects the publish with `E403` because the logged-in account requires
two-factor authentication for package publishing.

A temporary npm token retry also passed the local release gate and reached
official npm publish, but npm returned the same `E403`. That token does not
satisfy the publish-time bypass 2FA requirement.

Resolution:

```bash
npm run release:publish -- --otp=<6-digit-code>
```

Use a fresh npm one-time password from the account authenticator. As an
alternative, configure a granular npm access token with package publish
permission and bypass 2FA enabled, then rerun `npm run release:publish`.

After publish succeeds, run:

```bash
npm run release:verify-published
```

## Resolved Blocker: P4.3 Package URLs

Status: resolved on 2026-07-02 with
`https://github.com/dingguangyi0/yunti-browser-runtime`.

The package metadata currently points to:

- Repository: `https://github.com/dingguangyi0/yunti-browser-runtime`
- Homepage: `https://github.com/dingguangyi0/yunti-browser-runtime#readme`
- Issues: `https://github.com/dingguangyi0/yunti-browser-runtime/issues`

The previous `yunti-ai/yunti-browser-runtime` metadata returned HTTP 404. The
project moved to the `dingguangyi0/yunti-browser-runtime` GitHub repository,
and the initial `main` push succeeded.

## Resolution Options

### Option A: Create Or Publicize The Current Repository

Use this when the intended public home is a not-yet-created or private
repository.

Checklist:

- Create the GitHub repository, or make the existing repository public.
- Enable issues, or choose a different public issue tracker.
- Confirm the repository URL and issues URL return non-404 responses.
- Keep the current `package.json` metadata unchanged if these URLs are correct.
- Run the validation commands below.

### Option B: Update Package Metadata To A Different Public Repository

Use this when the final public repository lives somewhere else.

Checklist:

- Update `package.json` `repository.url`.
- Update `package.json` `homepage`.
- Update `package.json` `bugs.url`.
- Update README, release docs, and status docs if they name the old URL.
- Run the validation commands below.

## Validation Commands

After either option is complete, run:

```bash
npm run check:metadata
npm run release:prepublish
```

Actual result after P4.3 is resolved:

- `npm run check:metadata` exits 0.
- Repository, homepage, and issue URLs are publicly reachable.
- `npm run release:prepublish` reaches and passes `npm run release:check`.
- npm E404 is accepted only for the first publish under the intended package
  name.

Before the final publish, also run:

```bash
npm run release:dry-run
```

## Publish Readiness

`npm run release:prepublish` now passes. Before running `npm run
release:publish`, run and review `npm run release:dry-run`.
