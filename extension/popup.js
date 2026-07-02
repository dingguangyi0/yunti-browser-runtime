const statusEl = document.querySelector("#status")
const bridgeUrlEl = document.querySelector("#bridgeUrl")
const bridgeTokenEl = document.querySelector("#bridgeToken")
const platformMatchesEl = document.querySelector("#platformMatches")
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
  setStatus(
    state.activeSession
      ? `页面已连接\n${state.activeSession.title || state.activeSession.url}`
      : "请打开任意 http/https 页面，并确认本地 bridge 已启动。"
  )
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
  setStatus("设置已保存，请刷新目标页面完成重新注册。")
}

function renderSettings(settings) {
  bridgeUrlEl.value = settings.bridgeUrl || "http://127.0.0.1:48887"
  bridgeTokenEl.value = settings.bridgeToken || ""
  platformMatchesEl.value = Array.isArray(settings.platformMatches)
    ? settings.platformMatches.join("\n")
    : "*"
}

function setStatus(text) {
  statusEl.textContent = text
}

function send(message) {
  return chrome.runtime.sendMessage(message)
}
