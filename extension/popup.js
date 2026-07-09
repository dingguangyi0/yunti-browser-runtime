const statusEl = document.querySelector("#status")
const bridgeUrlEl = document.querySelector("#bridgeUrl")
const bridgeTokenEl = document.querySelector("#bridgeToken")
const platformMatchesEl = document.querySelector("#platformMatches")
const advancedSettingsEl = document.querySelector("#advancedSettings")
const defaultBridgeUrl = "http://127.0.0.1:48887"
document.querySelector("#save").addEventListener("click", save)
document.querySelector("#refresh").addEventListener("click", refresh)

void refresh()

async function refresh() {
  const state = await send({ type: "yunti_panel_get_state" })
  if (!state.ok) {
    setStatus(state.error || "状态读取失败")
    return
  }
  renderSettings(state.settings || {})
  setStatus(statusText(state))
}

async function save() {
  const state = await send({
    type: "yunti_panel_save_settings",
    settings: {
      bridgeUrl: bridgeUrlEl.value,
      bridgeToken: bridgeTokenEl.value,
      platformMatches: platformMatchesEl.value,
    },
  })
  if (!state.ok) {
    setStatus(state.error || "保存失败")
    return
  }
  renderSettings(state.settings || {})
  setStatus("设置已保存。扩展会自动尝试重新注册可访问页面。")
}

function renderSettings(settings) {
  bridgeUrlEl.value = settings.bridgeUrl || defaultBridgeUrl
  bridgeTokenEl.value = settings.bridgeToken || ""
  const platformMatches = Array.isArray(settings.platformMatches)
    ? settings.platformMatches
    : ["*"]
  advancedSettingsEl.open =
    Boolean(settings.bridgeToken) ||
    (settings.bridgeUrl && settings.bridgeUrl !== defaultBridgeUrl) ||
    platformMatches.some((pattern) => pattern !== "*")
  platformMatchesEl.value = platformMatches.join("\n")
}

function statusText(state) {
  if (state.activeSession) {
    return `页面已连接\n${state.activeSession.title || state.activeSession.url}`
  }
  if (!state.bridge?.ok) {
    return "Bridge 未连接。请确认 Agent MCP 已启动，或运行 yunti-browser-runtime bridge。"
  }
  return "默认无需设置。打开任意 http/https 页面后会自动连接。"
}

function setStatus(text) {
  statusEl.textContent = text
}

function send(message) {
  return chrome.runtime.sendMessage(message)
}
