# Action Result Coverage

This document is the durable P6.2 action result coverage matrix. It exists so
future context compaction or thread handoff cannot blur which browser action
surfaces already expose structured result fields.

Compatibility rule: every action path must keep its historical fields while
adding structured fields such as `action`, `target`, `ok`, `code`,
`recoverable`, `recoveryHint`, and `nextStepHint` where useful.

## Coverage Matrix

| Tool | Covered success paths | Covered failure diagnostics | Compatibility fields preserved | Remaining validation |
| --- | --- | --- | --- | --- |
| `yunti_click` | uid, coordinate, selector | stale uid, missing uid, selector failure via content result | `clicked`, `uid`, `selector`, `x`, `y`, `method`, `element`, `browserSessionId` | Real-browser observe-click-observe closure pending |
| `yunti_hover` | uid, coordinate, selector | stale uid, missing uid, selector failure via content result | `hovered`, `uid`, `selector`, `x`, `y`, `method`, `element`, `browserSessionId` | Real-browser hover menu closure pending |
| `yunti_fill` | uid keyboard, uid select, uid contenteditable, selector | stale uid, missing uid, selector failure, non-editable, hidden, disabled, readonly, option miss, value not applied | `filled`, `uid`, `selector`, `method`, `value`, `valueLength`, `element`, `before`, `after`, `browserSessionId` | Real-browser controlled input closure pending |
| `yunti_select` | selector value, uid value, uid text | selector failure, uid failure, option miss, disabled option, non-select target | `selected`, `uid`, `selector`, `value`, `text`, `selectedIndex`, `element`, `browserSessionId` | Real-browser async option closure pending |
| `yunti_fill_form` | aggregate success, partial failure | per-field fill/select failure aggregation | `filled`, `failed`, `results`, `browserSessionId` | Real-browser multi-field form closure pending |
| `yunti_wait_for` | text, selector, urlContains | timeout | `found`, `text`, `selector`, `condition`, `value`, `waitedMs`, `browserSessionId` | Real-browser async wait closure pending |
| `yunti_scroll` | document, uid container, coordinate container, coordinate document fallback | uid missing, uid stale, coordinate unavailable, no movement, partial movement, document fallback hint | `scrolled`, `deltaX`, `deltaY`, `target`, `before`, `after`, `moved`, `browserSessionId` | Real-browser nested panel closure pending |
| `yunti_type_text` | uid, selector | stale uid, missing uid, selector failure via content result | `typed`, `uid`, `selector`, `text`, `textLength`, `method`, `mode`, `element`, `browserSessionId` | Real-browser text editor closure pending |
| `yunti_press_key` | uid, selector | stale uid, missing uid, selector failure via content result | `pressed`, `uid`, `selector`, `key`, `element`, `valueChanged`, `browserSessionId` | Real-browser shortcut closure pending |
| `yunti_upload_file` | uid, selector | stale uid, missing uid, selector failure via CDP/content path | `uploaded`, `uid`, `selector`, `fileCount`, `filePaths`, `browserSessionId` | Real-browser file input closure pending |
| `yunti_drag` | coordinate | coordinate argument validation, CDP dispatch failure via tool error | `dragged`, `from`, `to`, `steps`, `browserSessionId` | Real-browser drag target closure pending |

## Coverage Gate

- Last audited phase: P6.2.7.
- Required automated check: `npm run check:action-results`.
- Required release gate: `npm run release:check` runs the coverage check.
- Real browser closure: Pending until Playwright/Chromium is installed in the
  validation environment.
- Real browser command: `YUNTI_E2E=1 npm run test:e2e`.

## Next Coverage Work

P6.2.7 closes the structured action result coverage audit. The next engineering
slice should not add another manual coverage checklist unless a new action tool
or result contract is introduced. Prefer moving to real-browser closure
validation or P6.3 agent workflow contracts.
