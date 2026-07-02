# Project Intent

## Why This Project Exists

Modern agents can reason well, but browser operation is still fragile when each
agent invents its own automation path. Yunti Browser Runtime exists to provide a
shared local browser operation layer that any agent can call through MCP.

The project starts from a practical internal browser agent implementation and
extracts the reusable foundation:

- discover local browser tabs and targets;
- inspect page state;
- execute clicks, input, screenshots, file uploads, and navigation;
- send Chrome DevTools Protocol commands;
- capture network, console, and CDP observations;
- keep multi-step operations routed to the intended browser page.

## Design Principles

- Local first: the first version runs on the user's own machine.
- Simple deployment: install dependencies, load the extension, register MCP.
- Fast execution: avoid heavyweight browser re-launches when the user's browser
  is already open.
- Agent agnostic: Claude Code, Codex, Cursor, Cline, OpenCode, and other MCP
  clients should be able to use the same runtime.
- Explicit safety: dangerous writes, downloads, uploads, and form submissions
  should be visible to the agent and user.
- No platform lock-in: the runtime must not depend on any company-internal
  platform.

## First Release Boundary

The first release is a local single-user runtime:

- one local bridge;
- one user's browser extension;
- local-only browser sessions;
- no remote relay;
- no multi-user server;
- no shared market, skills, or workspace concepts.

Remote multi-user deployment can be designed later as a separate layer. The
local runtime should stay small and dependable.
