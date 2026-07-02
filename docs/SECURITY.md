# Security, Permissions, And Privacy Notes

## Current Boundary

The first release is local single-user software:

- bridge binds to `127.0.0.1` by default;
- local loopback bridge routes do not require a token by default;
- setting `YUNTI_BROWSER_BRIDGE_TOKEN` enables `x-yunti-browser-token` checks
  for bridge routes, and binding to a non-loopback host requires a token;
- CORS only echoes local debug origins and browser-extension origins by default;
- extension talks to the local bridge;
- MCP tools default to `userId=local`;
- no remote relay is part of the documented install path.

## Data Handling

- Cookies and raw authorization headers are not returned by network tools.
- Network URLs, headers, request bodies, and console messages are sanitized.
- Learning memory is stored under `~/.yunti_agent/users/{userId}/memory`.
- The content script does not call product-specific login APIs.

## Browser Permissions

The extension uses browser permissions required for automation:

- `tabs` for tab inventory and activation;
- `debugger` for CDP commands;
- `storage` for local bridge URL, optional token, user, and page-match settings;
- `webRequest` for sanitized network observations;
- `activeTab` for visible-tab capture fallback paths.

The extension currently declares broad `http://*/*` and `https://*/*` host
access so it can register and operate arbitrary local user-selected pages. It
also declares localhost bridge access for the local HTTP bridge. A narrower
allowlist can be configured in the extension popup with page match patterns, and
store-distributed releases should re-review whether broad host permissions are
still appropriate for the intended audience.

Users should only load the extension from a trusted local checkout.

## Privacy Notes

- The runtime is local-first and does not send browser observations to a Yunti
  hosted service.
- Raw cookies, authorization headers, passwords, and token-like fields are not
  returned by the documented tools.
- Learning memory is local filesystem data and should not contain secrets.
- Agents should summarize sensitive-looking output instead of repeating it.

## Not Yet Implemented

- Signed extension release package.
- Remote multi-user isolation layer.
- Per-tool allow/deny policy.

Remote deployment must be designed separately and must not use the local
no-token loopback default without an authentication and ownership model.
