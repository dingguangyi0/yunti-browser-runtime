# Publishing Blockers

This document tracks release blockers that require external confirmation before
publishing `yunti-browser-runtime`.

## Current Blocker: P4.3 Package URLs

Status: resolving with `https://github.com/dingguangyi0/yunti-browser-runtime`.

The package metadata currently points to:

- Repository: `https://github.com/dingguangyi0/yunti-browser-runtime`
- Homepage: `https://github.com/dingguangyi0/yunti-browser-runtime#readme`
- Issues: `https://github.com/dingguangyi0/yunti-browser-runtime/issues`

The previous `yunti-ai/yunti-browser-runtime` metadata returned HTTP 404. The
project is now moving to the `dingguangyi0/yunti-browser-runtime` GitHub
repository; after the initial push, rerun the validation commands below.

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

Expected result after P4.3 is resolved:

- `npm run check:metadata` exits 0.
- Repository, homepage, and issue URLs are publicly reachable.
- `npm run release:prepublish` reaches and passes `npm run release:check`.
- npm E404 is accepted only for the first publish under the intended package
  name.

Before the final publish, also run:

```bash
npm publish --dry-run
```

## Do Not Publish While Blocked

Do not run `npm publish` until `npm run release:prepublish` passes. A failing
metadata check means users may install a package whose repository, homepage, or
issue tracker points to a missing public location.
