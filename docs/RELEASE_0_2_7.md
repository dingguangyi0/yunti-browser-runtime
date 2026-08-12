# Yunti Browser Runtime 0.2.7

## Release Positioning

`0.2.7` is an urgent user-experience hotfix based directly on the published
`0.2.6` release. It does not include the unfinished P8 stable-page-handle work.

## Change

- Remove the injected `AI` floating button and its `Yunti Browser Runtime` /
  `刷新连接` panel from every HTTP/HTTPS page.
- Keep content-script registration, browser-controller recovery, MCP page
  operations, extension popup, Content Script actions, and unrestricted CDP
  behavior unchanged.
- Add a regression test that rejects any reintroduction of the page widget,
  refresh button, or temporary-enhancement copy in `extension/content.js`.

## Upgrade

Upgrade the npm package, then reload the unpacked extension once from
`chrome://extensions` or `edge://extensions` so the browser uses extension
version `0.2.7`. Existing normal pages no longer receive a visible Yunti UI.

## Compatibility

- MCP tool count remains 52.
- Extension protocol remains version 1.
- Node.js 22+ remains required.
- Existing Agent MCP configuration remains valid.
