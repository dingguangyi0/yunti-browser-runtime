export const benchmarkScenarios = [
  { id: "A01", title: "Single text input fill and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_fill", "yunti_evaluate_script"] },
  { id: "A02", title: "Textarea fill and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_fill", "yunti_evaluate_script"] },
  { id: "A03", title: "Contenteditable fill and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_fill", "yunti_evaluate_script"] },
  { id: "A04", title: "Select by value and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_select", "yunti_evaluate_script"] },
  { id: "A05", title: "Select by visible text and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_select", "yunti_evaluate_script"] },
  { id: "A06", title: "Checkbox toggle and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_evaluate_script"] },
  { id: "A07", title: "Radio-group selection and verify", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_evaluate_script"] },
  { id: "A08", title: "Button click triggers visible confirmation", category: "core-form", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_evaluate_script"] },
  { id: "B09", title: "Delayed render after click", category: "async-ui", family: "async-ui", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_wait_for"] },
  { id: "B10", title: "Delayed enable state before click", category: "async-ui", family: "async-ui", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_evaluate_script"] },
  { id: "B11", title: "Spinner disappears before submit", category: "async-ui", family: "async-ui", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_evaluate_script"] },
  { id: "B12", title: "Debounced search result appears after fill", category: "async-ui", family: "async-ui", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_fill", "yunti_wait_for"] },
  { id: "B13", title: "URL change wait after navigation", category: "async-ui", family: "async-ui", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_wait_for"] },
  { id: "B14", title: "Overlay removed before underlying click", category: "async-ui", family: "async-ui", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_evaluate_script"] },
  { id: "C15", title: "Document scroll to offscreen button", category: "scroll", family: "nested-scroll", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_scroll", "yunti_click", "yunti_evaluate_script"] },
  { id: "C16", title: "Nested panel scroll to offscreen row", category: "scroll", family: "nested-scroll", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_scroll", "yunti_click"] },
  { id: "C17", title: "Partial scroll to edge with recovery hint", category: "scroll", family: "nested-scroll", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_scroll"] },
  { id: "C18", title: "Coordinate scroll fallback to document", category: "scroll", family: "nested-scroll", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_scroll", "yunti_evaluate_script"] },
  { id: "D19", title: "Open new tab and verify target inventory", category: "navigation-tabs", family: "tab-opener", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_new_page", "yunti_list_browser_targets", "yunti_close_page"] },
  { id: "D20", title: "Switch back to original tab and continue", category: "navigation-tabs", family: "tab-opener", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_new_page", "yunti_select_page", "yunti_close_page"] },
  { id: "D21", title: "Navigation preserves active session routing", category: "navigation-tabs", family: "tab-opener", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_navigate_page", "yunti_wait_for", "yunti_evaluate_script"] },
  { id: "D22", title: "Controller-only active-tab recovery after stale page id", category: "navigation-tabs", family: "tab-opener", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_list_browser_targets", "yunti_observe_page"] },
  { id: "E23", title: "Re-observe after DOM rerender and act with fresh uid", category: "target-drift", family: "rerender", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_evaluate_script"] },
  { id: "E24", title: "Old uid fails cleanly after rerender", category: "target-drift", family: "rerender", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_evaluate_script"] },
  { id: "E25", title: "Recovery from missing page session without manual refresh", category: "target-drift", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_list_browser_targets", "yunti_observe_page"] },
  { id: "E26", title: "Legacy stale session id recovers through controller routing", category: "target-drift", family: "form-controls", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_list_browser_targets", "yunti_observe_page"] },
  { id: "F27", title: "Same-origin iframe interaction", category: "deep-structure", family: "iframe", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_evaluate_script"] },
  { id: "F28", title: "Same-origin iframe wait and verify", category: "deep-structure", family: "iframe", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_wait_for"] },
  { id: "F29", title: "Open-shadow-root target interaction", category: "deep-structure", family: "shadow-root", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_wait_for", "yunti_evaluate_script"] },
  { id: "F30", title: "Open-shadow-root fill and verify", category: "deep-structure", family: "shadow-root", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_fill", "yunti_click", "yunti_evaluate_script"] },
  { id: "G31", title: "File upload and verify selected file state", category: "browser-surfaces", family: "upload-download", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_upload_file", "yunti_evaluate_script"] },
  { id: "G32", title: "Download-trigger click and completion signal", category: "browser-surfaces", family: "upload-download", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click"] },
  { id: "G33", title: "Screenshot capture after action", category: "browser-surfaces", family: "upload-download", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_take_screenshot", "yunti_evaluate_script"] },
  { id: "G34", title: "Console/network diagnostic capture around a failing page action", category: "browser-surfaces", family: "upload-download", repeatCount: 1, guardedWrite: false, status: "implemented", primaryTools: ["yunti_click", "yunti_list_console_messages", "yunti_list_network_requests"] },
  { id: "H35", title: "Single submit executes once across 20 repeated runs", category: "guarded-writes", family: "guarded-submit", repeatCount: 20, guardedWrite: true, status: "implemented", primaryTools: ["yunti_click", "yunti_wait_for", "yunti_evaluate_script"] },
  { id: "H36", title: "Async submit with delayed confirmation executes once", category: "guarded-writes", family: "guarded-submit", repeatCount: 20, guardedWrite: true, status: "implemented", primaryTools: ["yunti_click", "yunti_wait_for", "yunti_evaluate_script"] },
  { id: "H37", title: "Write path interrupted by target drift does not double-submit", category: "guarded-writes", family: "guarded-submit", repeatCount: 20, guardedWrite: true, status: "implemented", primaryTools: ["yunti_observe_page", "yunti_click", "yunti_wait_for", "yunti_evaluate_script"] },
  { id: "H38", title: "Write path timeout fails closed without replay", category: "guarded-writes", family: "guarded-submit", repeatCount: 20, guardedWrite: true, status: "implemented", primaryTools: ["yunti_click", "yunti_wait_for", "yunti_evaluate_script"] },
]

export function summarizeBenchmarkScenarios(scenarios = benchmarkScenarios) {
  const total = scenarios.length
  const implemented = scenarios.filter((scenario) => scenario.status === "implemented")
  const planned = total - implemented.length
  const guardedWrites = scenarios.filter((scenario) => scenario.guardedWrite).length
  const categories = [...new Set(scenarios.map((scenario) => scenario.category))]
  return {
    total,
    implemented: implemented.length,
    planned,
    guardedWrites,
    categories,
  }
}
