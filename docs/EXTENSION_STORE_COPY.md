# Extension Store Copy Draft

This document is the P6.6.2 draft copy pack for future Chrome Web Store and
Microsoft Edge Add-ons submissions. It is written as reviewable product copy and
reviewer notes, not as a final legal policy.

Current status: draft for maintainer review. Do not submit this text to a store
until the maintainer has confirmed the final permission strategy, privacy-policy
URL, support URL, screenshots, and test instructions.

## Policy Baseline

This copy follows the browser-store principles recorded in
`docs/EXTENSION_DISTRIBUTION.md`:

- Chrome extension permissions, host permissions, and content script matches
  must be declared in the manifest. Some permissions and match patterns can
  trigger install warnings.
- Chrome recommends optional permissions when the feature can support runtime
  user grants.
- Chrome Web Store policy expects user data use to be limited to the disclosed
  single purpose and the narrowest permissions needed for implemented features.
- Edge Add-ons policy expects the extension to request only permissions
  essential for functioning, clearly disclose data handling, and maintain a
  relevant privacy policy.

Official references:

- Chrome permission declaration:
  https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome Web Store program policies:
  https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome Web Store Limited Use policy:
  https://developer.chrome.com/docs/webstore/program-policies/limited-use
- Microsoft Edge Add-ons developer policies:
  https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies

## One-Sentence Purpose

Local browser runtime that lets user-authorized AI agents inspect and operate
the user's own Chrome or Edge pages through a local MCP bridge.

## Short Description

Yunti Browser Runtime connects MCP-capable AI agents to the user's local
Chrome/Edge browser so the agent can inspect pages, click, type, switch tabs,
capture screenshots, and read sanitized diagnostics through a local bridge.

## Long Description Draft

Yunti Browser Runtime is a local-first browser automation extension for users
who want MCP-capable AI agents to operate their own Chrome or Edge pages.

The extension connects pages in the user's browser to a local bridge running on
the user's machine. Agents can then inspect the active page, click, type,
select, scroll, switch tabs, capture screenshots when needed, and read sanitized
network or console diagnostics. The default install path does not use a hosted
Yunti service.

Yunti is designed for explicit user-directed automation. The user installs the
runtime, loads or installs the extension, starts an MCP-capable agent, and keeps
control of which browser pages are open. The extension popup shows connection
status and keeps advanced settings, such as a custom bridge URL or optional
token, out of the default first-run path.

The extension needs broad browser access because browser automation must work
on user-selected websites, tabs, and application pages. Sensitive diagnostics
are minimized by default: page observation redacts credential-like values,
network and console summaries are sanitized before storage or display, and raw
CDP diagnostics are a low-level debugging exception that should be cleared after
use. Screenshots are real visible page pixels and may contain sensitive content,
so agents should request or use them only when visual evidence is needed.

## Permission Rationale Draft

Use this table as the source for Chrome Web Store permission justification,
Edge certification notes, and any public privacy-policy explanation.

| Manifest item | User-facing reason | Reviewer-facing detail | Keep / decide |
| --- | --- | --- | --- |
| `activeTab` | Allows temporary access to the visible tab for user-directed capture and fallback operations. | Used as a narrower visible-tab fallback where possible. It does not replace persistent access needed for the current automation workflow. | Keep. |
| `debugger` | Enables the local agent to control the user's browser tab through the browser's debugging protocol. | Core transport for CDP commands, target routing, console/runtime diagnostics, screenshots, and low-level recovery. This is high-sensitivity and must be explained as the product's primary browser automation mechanism. | Keep for current developer path; re-review before store submission. |
| `storage` | Saves local extension settings such as bridge URL, optional token, user id/name, and page match settings. | Stores local configuration only. It is not used for hosted sync by default. | Keep. |
| `tabs` | Lets the agent list and switch the user's open browser tabs. | Needed for tab inventory, target selection, activation, and routing metadata. Store copy should explain that tab metadata is used only for user-directed local automation. | Keep for current workflow; evaluate narrower alternatives later. |
| `webRequest` | Lets the runtime provide sanitized network diagnostics when debugging page automation. | Used for observation and diagnostics, not ad blocking or request modification. Because this combines with broad hosts, consider making network diagnostics optional in a later slice. | Keep for developer path; P6.6.3 should decide optionalization. |
| `host_permissions` for `http://*/*` and `https://*/*` | Lets the extension work on the web pages the user wants the agent to operate. | Broad host access supports arbitrary user-selected business apps, websites, and local workflows. This has the highest trust and review burden. Store submission must choose between broad access and an optional/site-grant UX. | Decision required before store submission. |
| `host_permissions` for `http://127.0.0.1/*` and `http://localhost/*` | Lets the extension communicate with the local bridge on the user's machine. | Required for local loopback communication. The default bridge URL is `http://127.0.0.1:48887`; no hosted relay is used by default. | Keep. |
| `content_scripts.matches` for `http://*/*` and `https://*/*` | Lets the extension observe and act on user-selected web pages. | Required for DOM observation, fresh element ids, click/fill/select/scroll actions, and page registration. Consider optional host permission UX before a store release if broad install-time warnings are unacceptable. | Decision required before store submission. |

## Privacy Policy Draft

Yunti Browser Runtime is local-first software. In the default install path, the
extension communicates with a bridge on the user's own machine at
`http://127.0.0.1:48887`. Yunti does not provide a hosted relay service in the
default install path.

The extension may access page content, page titles, URLs, tab metadata, visible
page pixels in screenshots, console messages, and network request metadata when
the user directs an MCP-capable agent to inspect or operate browser pages. This
access is used to provide the single purpose of local browser automation.

The runtime minimizes sensitive data exposure where possible. Structured page
observation redacts credential-like values by default and supports stricter
redaction for likely personal information. Network URLs, headers, request
bodies, console messages, learning-memory text, and diagnostic summaries are
sanitized before storage or display. Cookies and raw authorization headers are
not returned by the documented network tools.

Screenshots are real visible page pixels and may contain sensitive information.
Raw CDP diagnostics are a low-level debugging exception and may contain
sensitive payloads. Users and agents should prefer sanitized observations and
diagnostics, use screenshots and raw CDP only when needed, and clear raw CDP
diagnostics after debugging.

Learning memory, if used, is stored on the local filesystem under the user's
Yunti data directory. Users can delete local learning memory and can remove the
browser extension at any time.

Yunti Browser Runtime does not intentionally collect data for advertising,
profiling, resale, or cross-site tracking. External agents that call Yunti MCP
tools may have their own data handling policies; users should review the agent
they choose to connect.

## Store Data Disclosure Draft

These answers are draft guidance for store forms. Final answers must match the
actual submitted build and privacy policy.

| Data surface | Accessed? | Stored by Yunti by default? | Sent to hosted Yunti service? | Draft disclosure |
| --- | --- | --- | --- | --- |
| Page content / DOM text | Yes, when an agent observes or operates a page. | No persistent DOM storage by default. | No. | Used only for local browser automation and redacted by default for credential-like values. |
| URLs and tab titles | Yes. | May appear in sanitized runtime summaries or local diagnostics. | No. | Used for tab selection, routing, and user-visible diagnostics. |
| Screenshots | Yes, when requested by an agent/tool. | Not persisted by the extension by default. | No hosted Yunti service by default. | Visible pixels may contain sensitive content; use only when visual inspection is needed. |
| Network diagnostics | Yes, for pages where the extension is active. | Sanitized summaries may be cached locally in memory. | No. | Used to debug page automation; cookies and raw authorization headers are not returned by documented tools. |
| Console diagnostics | Yes. | Sanitized summaries may be cached locally in memory. | No. | Used to debug page automation and JavaScript errors. |
| Learning memory | Optional MCP feature. | Yes, local filesystem only when the user/agent writes memory. | No. | Sanitized before disk writes; users can delete memory. |
| Bridge settings | Yes. | Yes, in extension local storage. | No. | Stores bridge URL, optional token, user id/name, and page-match settings. |

## Reviewer Notes Draft

Yunti Browser Runtime depends on local software outside the extension: an MCP
server and bridge installed through npm. The extension is not useful by itself;
it is the browser-side component for the local runtime. Submission notes should
include install and test steps:

1. Install Node.js 22 or newer.
2. Install the runtime package.
3. Start or configure an MCP-capable agent so it launches the local bridge.
4. Install the extension build.
5. Open and refresh an `http` or `https` page.
6. Run `yunti-browser-runtime doctor`.
7. Verify that the extension shows a connected page and that MCP tools can list
   browser targets.

Reviewer explanation for broad access:

```text
Yunti Browser Runtime is a local browser automation runtime. Its single purpose
is to let a user-authorized MCP agent inspect and operate the user's own
Chrome/Edge pages through a local bridge. Broad web access is currently required
because the user may ask the agent to operate arbitrary websites and business
applications that are already open in the browser. The default path does not use
a hosted Yunti service; observations route to the local bridge on loopback.
```

Reviewer explanation for `debugger`:

```text
The debugger permission is part of the core automation transport. It lets the
runtime use Chrome DevTools Protocol for target routing, tab-level automation,
screenshots, console/runtime diagnostics, and low-level recovery. The extension
does not use debugger access for advertising, profiling, or unrelated browsing
history collection.
```

Reviewer explanation for local bridge dependency:

```text
The extension communicates with local software running on the user's own
machine, normally at http://127.0.0.1:48887. This local bridge is installed as
part of yunti-browser-runtime and is required for the extension's primary
browser automation function.
```

## Final Review Checklist

Before store submission:

- Confirm whether broad `http` / `https` host access remains in the submitted
  manifest or moves to optional host permissions.
- Confirm whether `webRequest` remains always-on or becomes an optional
  diagnostics feature.
- Confirm the final privacy-policy URL and support URL.
- Confirm screenshots do not expose real private browser data.
- Confirm all store form answers match the submitted manifest and package.
- Confirm reviewer test steps work on a clean machine.
- Confirm no npm token, local path, private account, or unpublished internal
  detail appears in public store metadata.

## P6.6.2 Outcome

P6.6.2 is complete when this copy pack is linked from distribution readiness
docs and status files. It intentionally does not change the extension manifest
or runtime behavior.
