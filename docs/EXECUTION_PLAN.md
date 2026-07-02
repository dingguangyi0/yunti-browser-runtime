# Execution Plan

本文档记录 Yunti Browser Runtime 从本地 MVP 走向可开源、可长期稳定使用版本的执行计划。

维护规则：

- 每完成一个阶段，都要更新本文档的状态。
- 每个阶段开始前先确认目标、范围、验收标准。
- 不把远程多用户能力混入本地单用户核心。
- 安全和稳定优先于功能堆叠。

## 当前总目标

把当前本地 MVP 打磨成一个：

- 安装简单；
- 默认安全；
- Agent 不容易误用；
- 能稳定操作真实浏览器；
- 可作为开源项目发布；
- 后续可扩展远程模式但不依赖远程模式；

的本地浏览器运行时。

## 阶段总览

| 阶段 | 状态 | 目标 |
| --- | --- | --- |
| P0.1 | 已完成 | bridge token + CORS 收紧 |
| P0.2 | 已完成 | session TTL / 心跳 / 快速恢复 |
| P1.1 | 已完成 | doctor 增强 |
| P1.2 | 已完成 | MCP config printer |
| P1.3 | 已完成 | extension 打包脚本 |
| P1.4 | 已完成 | 真实浏览器 E2E smoke test |
| P2.1 | 已完成 | README 和文档开源化 |
| P2.2 | 已完成 | npm package metadata / bin |
| P3.1 | 已完成 | 大文件拆分与模块化 |
| P3.2 | 已完成 | 工具参数校验与错误提示增强 |
| P4.1 | 已完成 | 发布前文档与权限审查 |
| P4.2 | 已完成 | Agent 接入示例补全 |
| P4.3 | 已完成 | npm 发布 URL 最终确认 |
| P4.4 | 已完成 | 发布门禁脚本固化 |
| P4.5 | 已完成 | 发布运行手册 |
| P4.6 | 已完成 | package metadata 检查命令 |
| P4.7 | 已完成 | prepublish 发布门禁串联 |
| P4.8 | 已完成 | npm package 内容门禁 |
| P4.9 | 已完成 | extension zip 内容门禁 |
| P4.10 | 已完成 | package / extension 版本一致性门禁 |
| P4.11 | 已完成 | npm bin CLI smoke 门禁 |
| P4.12 | 已完成 | Agent config smoke 门禁 |
| P4.13 | 已完成 | doctor JSON smoke 门禁 |
| P4.14 | 已完成 | 公开文档相对链接门禁 |
| P4.15 | 已完成 | npm 官方 registry 发布脚本 |
| P4.16 | 已完成 | 正式发布脚本内置门禁 |
| P4.17 | 已完成 | npm 登录预检门禁 |
| P4.18 | 已完成 | npm 发布后验证命令 |
| P4.19 | 已完成 | npm 正式发布执行 |
| P5.1 | 已完成 | 本地默认免 bridge token |
| P5.2 | 已完成 | 扩展 popup 与安装引导简化 |
| P5.3 | 已完成 | 扩展首屏零配置 |
| P6.0 | 已完成 | 0.2.0 产品方向护栏 |
| P6.1 | 基本实现，待真实浏览器闭环补验 | Agent 友好的页面观察与 uid action 兼容 |
| P6.2 | 进行中：已完成 action result 多路径结构化切片，下一步补齐剩余 action paths | 稳定 DOM action 层与结构化 action result |
| P6.3 | 计划中 | Agent 工作流契约 |
| P6.4 | 计划中 | DOM 脱敏与页面内容策略 |
| P6.5 | 计划中 | 可选本地运行时控制台 |
| P6.6 | 计划中 | 浏览器扩展分发准备 |

当前 0.2.0 推进快照（2026-07-03）：

- P6.1：`yunti_observe_page` schema、tool hints、bridge routing、content-script observer
  和 deterministic fixtures 已落地；剩余缺口是当前环境缺少 Playwright/Chromium，无法补跑
  `observe -> click uid -> observe/verify` 真实浏览器闭环。
- P6.2：结构化 action result 正在按兼容优先的小切片推进；已覆盖 uid click/hover/fill
  keyboard/fill select、coordinate click/hover、selector hover/click/fill passthrough 和
  scroll passthrough、type_text uid/selector fallback、press_key uid/selector fallback。
- P6.2 下一切片：继续补齐剩余 action paths 的结构化结果，例如 drag 或 upload，同时保留
  所有既有兼容字段与 CDP fallback。

## P0.1 bridge token + CORS 收紧

状态：已完成（2026-07-02）

实现摘要：

- bridge owner 模式启动时读取 `YUNTI_BROWSER_BRIDGE_TOKEN`，未设置时生成进程内 token 并打印到 stderr。
- 受保护 HTTP 路由统一校验 `x-yunti-browser-token`，未授权请求返回 401。
- `/health` 未带 token 时只返回有限状态，带 token 时返回 session 明细。
- CORS 默认只回显本地调试来源和浏览器扩展来源；可用
  `YUNTI_BROWSER_BRIDGE_ALLOW_ORIGINS` 覆盖。
- MCP proxy、extension、doctor 都支持使用同一 token 请求 bridge。
- extension popup 增加 bridge URL、bridge token、页面匹配规则设置。
- `npm test` 增加 token 拒绝、授权 health、CORS 来源覆盖测试。

### 背景

当前 bridge 默认监听 `127.0.0.1`，方向正确，但本地 HTTP 服务仍需要更强的默认防护。

主要风险：

- 普通网页可能探测本地端口。
- CORS 如果过宽，可能给非扩展页面留出调用面。
- 后续如果用户误绑到非本地地址，风险会被放大。

### 目标

- bridge 启动时有本地访问 token。
- MCP、extension、doctor 使用同一 token。
- 非授权请求拒绝。
- CORS 默认只允许扩展和本地调试需要的来源。
- 继续保持本地安装简单。

### 设计建议

- 新增环境变量：
  - `YUNTI_BROWSER_BRIDGE_TOKEN`
  - `YUNTI_BROWSER_BRIDGE_ALLOW_ORIGINS`
- 若未设置 token：
  - MCP owner 模式启动时生成一次进程内 token；
  - 输出到 stderr 仅用于调试；
  - extension 侧仍需要能通过本地配置保存 token。
- 请求头建议：
  - `x-yunti-browser-token: <token>`
- 对以下接口强制校验 token：
  - `/sessions`
  - `/sessions/register`
  - `/sessions/activate`
  - `/extension/poll`
  - `/extension/result`
  - `/extension/network-event`
  - `/extension/cdp-event`
  - `/extension/console-event`
  - `/mcp/request`
  - `/mcp/local-tool`
- `/health` 可返回有限信息；带 token 时返回完整信息。

### 验收标准

- `npm test` 增加未带 token 被拒绝的测试。
- extension 注册页面时会带 token。
- MCP proxy/owner 请求会带 token。
- `npm run doctor` 可以检查 token 和 bridge 状态。
- README / SECURITY 更新 token 说明。

## P0.2 session TTL / 心跳 / 快速恢复

状态：已完成（2026-07-02）

实现摘要：

- session 元数据增加 `lastSeenAt`、`lastActivatedAt`、`expiresAt`、`staleReason`。
- extension poll/register 会刷新 session 心跳和过期时间。
- bridge 定时清理过期 session，并同步清理 active session 路由。
- 旧 `browserSessionId` 会快速失败，错误信息包含 stale/disconnected 原因和
  `yunti_list_browser_targets` 恢复建议。
- `yunti_list_browser_targets` 可在同一用户注册新 session 后恢复到新路由。
- `npm test` 增加过期清理、旧 id 快速失败、poll 心跳、list targets 恢复路径测试。

### 背景

`browserSessionId` 是浏览器页面路由核心。当前规则文档已经要求 stale 时调用 `yunti_list_browser_targets` 恢复，但代码层还缺 TTL 和快速过期清理。

### 目标

- 关闭、刷新、扩展重载后的旧 session 快速失效。
- agent 第一次误用旧 `browserSessionId` 时快速失败，并给出恢复建议。
- `yunti_list_browser_targets` 能作为标准恢复入口。

### 设计建议

- session 元数据增加：
  - `lastSeenAt`
  - `lastActivatedAt`
  - `expiresAt`
  - `staleReason`
- extension poll/register 视为心跳。
- bridge 定期清理过期 session。
- 错误信息统一包含：
  - stale/disconnected 原因；
  - 建议调用 `yunti_list_browser_targets`；
  - 不建议继续重试旧 id。

### 验收标准

- 测试覆盖过期 session 被清理。
- 测试覆盖旧 `browserSessionId` 快速失败。
- 测试覆盖 list targets 恢复路径。
- `yunti_get_tool_usage_hints` 和 skill 同步更新。

## P1.1 doctor 增强

状态：已完成（2026-07-02）

实现摘要：

- `npm run doctor` 检查 Node 版本、bridge 可达性、token 是否配置且有效、session 数、
  active session、是否检测到 extension 注册、MCP server 文件和 skill 文件。
- 输出完整 JSON 到 stdout，方便 agent 读取。
- 同时输出人类可读摘要到 stderr，方便用户排查。
- 常见失败会给出下一步命令或操作建议。
- 新增 `npm run doctor:json`，便于只读取 JSON。

### 目标

把 `npm run doctor` 从简单 health check 升级为安装诊断工具。

### 检查项

- Node 版本。
- bridge 是否可访问。
- token 是否配置/可用。
- 已注册 session 数。
- 当前 active session。
- 是否检测到 extension 页面注册。
- MCP server 文件路径是否存在。
- skills 路径是否存在。

### 验收标准

- 输出 JSON，方便 agent 读取。
- 输出人类可读摘要，方便用户排查。
- 常见失败给出下一步命令。

## P1.2 MCP config printer

状态：已完成（2026-07-02）

实现摘要：

- 新增 `scripts/print-config.js` 和 `npm run print-config`。
- 支持 `--agent codex`、`--agent claude-code`、`--agent cursor`、`--agent cline`。
- 输出包含 MCP server 配置、当前项目绝对路径、`YUNTI_BROWSER_BRIDGE_PORT`、token
  配置说明和 skill 安装路径提示。
- token 只输出占位说明，不把真实 secret 写入生成配置。
- README / INSTALL 使用该命令替代硬编码 MCP 配置。

### 目标

新增命令自动打印不同 Agent 的 MCP 配置，降低安装门槛。

### 建议命令

```bash
npm run print-config
npm run print-config -- --agent codex
npm run print-config -- --agent claude-code
npm run print-config -- --agent cursor
npm run print-config -- --agent cline
```

### 输出内容

- MCP server 配置。
- 当前项目绝对路径。
- `YUNTI_BROWSER_BRIDGE_PORT`。
- 如启用 token，包含 token 配置说明但避免直接把敏感 token 写进公开文档。
- skill 安装路径提示。

### 验收标准

- README 使用该命令替代硬编码本机绝对路径。
- 至少支持 Codex 和 Claude Code 示例。

## P1.3 extension 打包脚本

状态：已完成（2026-07-02）

实现摘要：

- 新增 `scripts/package-extension.js` 和 `npm run package:extension`。
- 输出 `dist/yunti-browser-runtime-extension-<version>.zip`。
- zip 内只包含 `extension/` 运行所需文件，不包含 `.DS_Store`、测试、docs、node_modules。
- README / INSTALL 增加开发加载和 zip 打包说明。

### 目标

提供一键生成 extension zip 的能力。

### 建议命令

```bash
npm run package:extension
```

### 验收标准

- 输出 `dist/yunti-browser-runtime-extension-<version>.zip`。
- zip 内只包含扩展所需文件。
- 不包含 `.DS_Store`、测试、docs、node_modules。
- README 增加开发加载和 zip 安装两种说明。

## P1.4 真实浏览器 E2E smoke test

状态：已完成（2026-07-02）

实现摘要：

- 新增 `tests/e2e.test.js` 和 `npm run test:e2e`。
- 默认跳过，设置 `YUNTI_E2E=1` 后才启动真实浏览器，避免普通 CI / 本地检查被浏览器依赖阻塞。
- E2E 使用 Playwright persistent Chromium profile 加载 unpacked extension。
- 测试会启动本地 bridge 和本地测试页面，并验证 MCP list targets、snapshot、
  selector click/fill、CDP `Runtime.evaluate`。
- 失败时输出临时 artifact 目录，包含 screenshot 和 error log。
- README / INSTALL 增加 E2E 运行说明和跳过策略。

### 背景

当前测试主要覆盖 bridge/MCP 逻辑，还缺真实浏览器、真实扩展消息链路。

### 目标

验证：

- Chromium 加载 extension。
- 页面注册到 bridge。
- MCP 可 list targets。
- MCP 可 snapshot。
- MCP 可 click/fill。
- MCP 可执行 CDP `Runtime.evaluate`。

### 技术建议

- 使用 Playwright 启动 Chromium persistent context。
- 加载 unpacked extension。
- 起一个本地测试页面。
- 起 bridge/MCP 测试进程。

### 验收标准

- 新增 `npm run test:e2e`。
- CI 或本地可跳过，但文档清楚。
- 失败时输出截图/日志位置。

## P2.1 README 和文档开源化

状态：已完成（2026-07-02）

实现摘要：

- README 保留中文主入口，并补充英文摘要。
- README 增加 FAQ，以及权限/隐私说明入口。
- 公开文档统一 npm 命令口径。
- README 命令移除本机绝对路径，可直接复制执行。
- 移除公开文档中的内部参考路径和内部平台名残留。

### 目标

把文档从本地开发说明变成公开项目说明。

### 清理项

- 移除本机绝对路径。
- 移除内部参考路径。
- 中文 README 保留，补英文摘要或英文 README 入口。
- 统一 npm / pnpm 口径。
- 增加常见问题 FAQ。
- 增加“权限说明”和“隐私说明”入口。

### 验收标准

- 公开文档残留检查不出现本机路径或内部平台词。
- README 中所有命令可复制执行。

## P2.2 npm package metadata / bin

状态：已完成（2026-07-02）

实现摘要：

- `package.json` 增加 `bin`、`files`、`repository`、`keywords`、`homepage`、
  `bugs`、`packageManager`。
- 新增 `bin/yunti-browser-runtime.js`，支持 `mcp`、`bridge`、`doctor`、
  `print-config`、`package-extension`。
- `npm pack --dry-run` 可验证发布内容。
- 本地 `npm link` 后可运行 `yunti-browser-runtime --help`。
- README / INSTALL 增加 CLI 使用说明。
- 当前 lockfile 策略：项目没有运行时第三方依赖，暂不提交 lockfile；引入依赖时再提交 npm lockfile。

### 目标

让项目可以以 npm 包形式安装和执行。

### 建议新增

- `bin`
- `files`
- `repository`
- `keywords`
- `homepage`
- `bugs`
- `packageManager`
- lockfile 策略

### 可能命令

```bash
yunti-browser-runtime
yunti-browser-runtime bridge
yunti-browser-runtime doctor
yunti-browser-runtime print-config
yunti-browser-runtime package-extension
```

### 验收标准

- `npm pack --dry-run` 输出内容符合预期。
- 本地 `npm link` 后命令可运行。

## P3.1 大文件拆分与模块化

状态：已完成（2026-07-02）

阶段进展：

- 已将 MCP 工具 schema、工具分组和 `yunti_get_tool_usage_hints` 拆到
  `mcp/tools.js`。
- `mcp/server.js` 重新导出 `TOOLS` 以保持现有测试和外部导入兼容。
- 已将 JSON-RPC 响应封装拆到 `mcp/json-rpc.js`。
- 已将网络/CDP/控制台复用的脱敏、截断和事件规范化逻辑拆到
  `mcp/redaction.js`。
- 已将 learning memory 的本地存储、脱敏和增删查逻辑拆到 `mcp/memory.js`。
- 已将 MCP session hub、请求队列、network/CDP/console 事件缓存和 bridge-local
  tool 路由拆到 `mcp/bridge-hub.js`，`mcp/server.js` 继续重新导出
  `BridgeHub` 以保持测试和外部导入兼容。
- 已将 MCP HTTP bridge server、CORS/token 校验、bridge route handler 和 body
  parser 拆到 `mcp/http-server.js`，`mcp/server.js` 继续重新导出
  `startBridgeServer`、`DEFAULT_HOST`、`DEFAULT_PORT` 和 `BRIDGE_TOKEN_HEADER`。
- 已将 extension 的设置读取、bridge header 和页面匹配逻辑拆到
  `extension/settings.js`。
- 已将 extension 的 webRequest 网络监听、请求体摘要和敏感字段预览脱敏拆到
  `extension/network-monitor.js`。
- 已将 extension 的 CDP target 拦截、attach/detach、trace buffer 和 debugger
  promise 封装拆到 `extension/cdp.js`。
- 已将 extension 的工具分发和页面操作处理器拆到
  `extension/tool-handlers.js`。
- 已将 extension 的 session 注册、poll loop、popup 状态、bridge post 和 console
  event 转发拆到 `extension/session-manager.js`。
- `npm run check` 已纳入 `mcp/tools.js`、`mcp/json-rpc.js`、`mcp/redaction.js`
  和 `mcp/memory.js`、`mcp/bridge-hub.js`、`mcp/http-server.js`，以及 `extension/settings.js`、`extension/network-monitor.js`、
  `extension/cdp.js`、`extension/tool-handlers.js` 和
  `extension/session-manager.js` 语法检查。

### 背景

当前 `mcp/server.js` 和 `extension/background.js` 偏大，维护成本较高。

### 建议拆分

MCP：

- `mcp/server.js`
- `mcp/json-rpc.js`
- `mcp/bridge-hub.js`（已拆出）
- `mcp/tools.js`
- `mcp/memory.js`
- `mcp/redaction.js`
- `mcp/http-server.js`（已拆出）

Extension：

- `extension/background.js`
- `extension/settings.js`
- `extension/session-manager.js`（已拆出）
- `extension/cdp.js`（已拆出）
- `extension/network-monitor.js`
- `extension/tool-handlers.js`（已拆出）

### 验收标准

- 拆分前后测试保持通过。
- 不引入行为变化。
- 每次拆分控制范围，不做混合重构。

验收结果：

- `npm run check` 通过，覆盖新增的 `mcp/http-server.js`、`mcp/bridge-hub.js`、
  `extension/session-manager.js`、`extension/tool-handlers.js` 等模块语法检查。
- `npm test` 通过：58 项测试，57 项通过，1 项真实浏览器 smoke 按配置跳过。
- `npm run test:e2e` 按预期跳过真实浏览器 smoke test。
- `npm run package:extension` 通过，zip 内包含 12 个 extension runtime 文件。
- `npm pack --dry-run` 通过，npm tarball 包含拆分后的 MCP 和 extension 模块。

## P3.2 工具参数校验与错误提示增强

状态：已完成（2026-07-02）

阶段进展：

- 已增强 `yunti_click` / `yunti_hover` 参数组合错误提示，错误信息会指向
  `yunti_take_snapshot`、CSS selector 或坐标工具的正确恢复路径。
- 已为 `yunti_fill` 增加参数校验：要求 `value` 且必须提供 `uid` 或
  `selector`，并明确拒绝 coordinate-only fill。
- 已为 `yunti_close_page` 增加 `tabId` / `targetId` 误用提示，引导 raw target
  关闭走 `yunti_cdp_send_command` + `Target.closeTarget`。
- 已增强 `yunti_cdp_send_command` 的 `method` / `params` 错误提示，并为
  `Target.closeTarget` 缺少 target 的场景给出 `yunti_list_browser_targets`
  恢复建议。
- 已增强 `yunti_forget_learning_memory` 缺少 `id` 或 id 不存在时的恢复提示。
- 已同步 `yunti_get_tool_usage_hints`、`docs/TOOL_GUIDE.md` 和
  `skills/yunti-browser-runtime/SKILL.md` 的常见参数错误说明。
- 已增加 `tests/bridge.test.js` 覆盖 P3.2 usage hints，验证 `yunti_fill`
  和 `yunti_cdp_send_command` 的参数提示会被 MCP 返回。

### 目标

减少 Agent 猜参数、走弯路。

### 重点工具

- `yunti_click`
- `yunti_hover`
- `yunti_fill`
- `yunti_close_page`
- `yunti_cdp_send_command`
- `yunti_forget_learning_memory`

### 验收标准

- 参数组合错误时返回明确修复建议。
- schema 与实际实现一致。
- `yunti_get_tool_usage_hints` 覆盖所有核心工具。
- skill 同步更新常见错误。

验收结果：

- `npm run check` 通过，覆盖 P3.2 涉及的 `extension/tool-handlers.js`、
  `extension/cdp.js`、`mcp/memory.js`、`mcp/tools.js` 等模块语法检查。
- `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器 smoke 按配置跳过。
- `npm run test:e2e` 按预期跳过真实浏览器 smoke test。
- `npm run package:extension` 通过，zip 内包含 12 个 extension runtime 文件。
- `unzip -l dist/yunti-browser-runtime-extension-0.1.0.zip` 确认 zip 内仅包含
  12 个扩展运行文件。
- `npm pack --dry-run` 通过，npm tarball 包含 P3.2 更新后的 docs、skill、
  MCP 和 extension 模块。

## P4.1 发布前文档与权限审查

状态：已完成（2026-07-02）

阶段进展：

- 已复查 README、INSTALL、SECURITY、extension manifest 和 package metadata。
- README 已补充 P3.2 后的参数规则速查，覆盖 click/hover/fill/close/CDP/memory
  常见误用。
- INSTALL 的 Common Recovery 已补充参数错误恢复、`yunti_fill` 定位要求和
  raw tab/target 关闭路径。
- SECURITY 已补充 `storage` 权限用途、广泛 host permissions 的当前理由和
  发布前复审要求。
- package metadata 当前包含 `bin`、`files`、`repository`、`homepage`、`bugs`
  和 keywords；公开发布前仍需按实际仓库最终确认 URL。

### 目标

把发布前用户最容易踩坑的文档入口补齐，并确认权限说明足够透明。

### 验收标准

- README / INSTALL 覆盖 P3.2 后的核心参数规则。
- SECURITY 解释 manifest 中每项权限和 broad host permissions 的原因。
- 公开文档不出现内部路径或内部平台残留。
- npm package dry-run 继续包含更新后的 docs、skill、MCP 和 extension 文件。

验收结果：

- 公开文档残留检查通过：
  `rg "/U[s]ers|d[i]ngguangyi|C[o]deg|x[y]y|y[b]m100" README.md docs skills package.json`
  无输出。
- `npm run check` 通过，P4.1 文档调整未影响 JS 语法检查。
- `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器 smoke 按配置跳过。
- `npm pack --dry-run` 通过，npm tarball 包含更新后的 README、docs、skill、
  MCP 和 extension 文件，共 35 个文件。

## P4.2 Agent 接入示例补全

状态：已完成（2026-07-02）

阶段进展：

- 已在 INSTALL 增加 Codex、Claude Code、Cursor、Cline 的接入示例。
- README 已链接到 INSTALL 的 Agent Examples，并移除“缺少详细接入示例”的未完成项。
- 接入示例统一使用 `npm run print-config -- --agent ... --human`，避免在公开
  文档中写入本机绝对路径。
- 接入示例补充了 skill 安装、bridge token 同步、重启/刷新和 doctor 验证提示。

### 目标

让用户能从公开文档直接完成主流 Agent 的 MCP 接入，而不需要猜配置位置或参数。

### 验收标准

- INSTALL 覆盖 Codex、Claude Code、Cursor、Cline 四类接入示例。
- README 指向详细接入示例，当前未完成项不再包含已完成内容。
- 示例不硬编码本机绝对路径或真实 token。
- 公开文档残留检查、语法检查、测试和 npm pack dry-run 通过。

验收结果：

- 公开文档残留检查通过：
  `rg "/U[s]ers|d[i]ngguangyi|C[o]deg|x[y]y|y[b]m100" README.md docs skills package.json`
  无输出。
- `npm run check` 通过，接入示例文档调整未影响 JS 语法检查。
- `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器 smoke 按配置跳过。
- `npm pack --dry-run` 通过，npm tarball 包含更新后的 README、INSTALL、
  docs、skill、MCP 和 extension 文件，共 35 个文件。

## P4.3 npm 发布 URL 最终确认

状态：已完成（2026-07-02）

阶段进展：

- 已核对 `package.json` 的发布 metadata：
  `repository=git+https://github.com/yunti-ai/yunti-browser-runtime.git`、
  `homepage=https://github.com/yunti-ai/yunti-browser-runtime#readme`、
  `bugs=https://github.com/yunti-ai/yunti-browser-runtime/issues`。
- 已检查 GitHub repository URL：
  `curl -I -L https://github.com/yunti-ai/yunti-browser-runtime` 返回 HTTP 404。
- 已检查 GitHub issues URL：
  `curl -I -L https://github.com/yunti-ai/yunti-browser-runtime/issues` 返回 HTTP 404。
- 已检查 npm registry：
  `npm view yunti-browser-runtime version --json` 返回 E404，说明包名当前未发布或不可见。
- 已收到新的 GitHub SSH 远端：
  `git@github.com:dingguangyi0/yunti-browser-runtime.git`。
- 已通过 `git ls-remote` 确认该 SSH 远端当前账号可访问。
- 已将 `package.json` 发布 metadata 切换到：
  `repository=git+https://github.com/dingguangyi0/yunti-browser-runtime.git`、
  `homepage=https://github.com/dingguangyi0/yunti-browser-runtime#readme`、
  `bugs=https://github.com/dingguangyi0/yunti-browser-runtime/issues`。
- 已修正 `scripts/release-check.js` 的公开文档残留门禁：允许正式公开 GitHub
  owner `dingguangyi0`，继续拦截本机路径和内部残留词。
- 已增强 `scripts/check-package-metadata.js`：repository/homepage/bugs 的 HEAD
  请求遇到 TLS 断连或 5xx 等临时网络失败时会重试，避免 GitHub 瞬时网络抖动误挡发布。
- `scripts/check-package-metadata.js` 会在 homepage 去掉锚点后与 repository URL
  相同时复用 repository 检查结果，避免对同一 GitHub 页面重复发起 HEAD 请求。
- 已执行 `git push -u origin main`，本地 `main` 已跟踪远端
  `origin/main`。
- 已运行 `npm pkg fix`，将 `bin.yunti-browser-runtime` 规范化为
  `bin/yunti-browser-runtime.js`，避免 npm publish dry-run 自动修正 package metadata。
- `npm run check:metadata` 已确认 repository、homepage、bugs URL 均返回 HTTP 200。
- `npm run release:prepublish` 已完整通过。

### 目标

确认 npm 发布 metadata 指向真实公开仓库，避免发布后 npm 页面出现不可访问链接。

### 验收标准

- `repository` 指向真实可访问的公开 GitHub 仓库。
- `homepage` 指向真实可访问的 README 页面。
- `bugs.url` 指向真实可访问的 issue tracker。
- `npm view yunti-browser-runtime` 的 E404 状态被明确接受为首次发布前状态，或根据实际包名调整。

当前结论：

- P4.3 已完成：`package.json` 的 repository/homepage/bugs metadata 指向
  `https://github.com/dingguangyi0/yunti-browser-runtime`，且公开可达。
- npm 包名 `yunti-browser-runtime` 当前未发布；作为 `0.1.0` 首次发布状态已被接受。
- 发布前最后保留 `npm publish --dry-run` 和人工发布确认。

发布门禁结果：

- `npm run check:metadata` 通过（2026-07-02T15:47:32.161Z）：
  repository、homepage、bugs URL 均返回 HTTP 200；npm 未发布状态被识别为首次发布可接受。
- `npm run release:prepublish` 通过（metadata checkedAt:
  2026-07-02T15:57:16.352Z）：`npm run check:metadata` 和
  `npm run release:check` 均通过。
- `npm run release:check` 覆盖公开文档残留检查、public Markdown link check
  （11 个 Markdown 文件）、version consistency check、CLI smoke check、
  print-config smoke check、doctor smoke check、`npm run check`、`npm test`、
  npm package contents check 和 extension zip contents check。
- release gate 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。

## P4.4 发布门禁脚本固化

状态：已完成（2026-07-02）

阶段进展：

- 新增 `scripts/release-check.js`，固化公开文档残留检查、`npm run check`、
  `npm test` 和 `npm pack --dry-run`。
- 新增 `npm run release:check`。
- `npm run check` 已纳入 `scripts/release-check.js` 的语法检查。
- README 和 INSTALL 已增加 `npm run release:check` 的发布前门禁说明。

### 目标

把当前手工发布检查固化成一个可重复命令，减少发布前漏跑步骤。

### 验收标准

- `npm run release:check` 可一次性运行公开文档残留检查、语法检查、测试和
  npm dry-run。
- `npm run check` 覆盖新增脚本语法检查。
- README / INSTALL 说明发布前门禁命令。
- `npm run release:check` 通过。

验收结果：

- `npm run release:check` 通过。
- release check 内部公开文档残留检查通过。
- release check 内部 `npm run check` 通过，并覆盖 `scripts/release-check.js`。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- release check 内部 `npm pack --dry-run` 通过，npm tarball 包含新增的
  `scripts/release-check.js`，共 36 个文件。

## P4.5 发布运行手册

状态：已完成（2026-07-02）

阶段进展：

- 新增 `docs/RELEASE.md`，记录发布前外部 URL 确认、release gate、extension
  zip 检查、可选真实浏览器 smoke test、npm publish dry-run 和发布后检查。
- README 文档入口已增加发布运行手册链接。
- 发布运行手册明确：GitHub repository / issues URL 返回 404 时不得发布。

### 目标

把发布动作整理成可执行 checklist，确保 P4.3 外部确认完成后可以直接按步骤发布。

### 验收标准

- `docs/RELEASE.md` 覆盖外部 URL 确认、`npm run release:check`、extension
  zip 检查、可选 E2E、npm publish dry-run 和发布后验证。
- README 链接发布运行手册。
- `npm run release:check` 通过，并确认 `docs/RELEASE.md` 进入 npm tarball。

验收结果：

- `npm run release:check` 通过。
- release check 内部公开文档残留检查通过。
- release check 内部 `npm run check` 通过。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- release check 内部 `npm pack --dry-run` 通过，npm tarball 包含新增的
  `docs/RELEASE.md`，共 37 个文件。

## P4.6 package metadata 检查命令

状态：已完成（2026-07-02）

阶段进展：

- 新增 `scripts/check-package-metadata.js`，检查 `package.json` 中
  `repository`、`homepage`、`bugs.url` 是否公开可达。
- 新增 `npm run check:metadata`，输出 JSON 报告并在 GitHub URL 不可达时返回
  非零退出码。
- `npm run check` 已纳入 `scripts/check-package-metadata.js` 的语法检查。
- `docs/RELEASE.md` 已改用 `npm run check:metadata` 作为 P4.3 外部 URL
  复验命令。
- README 未完成项已补充 `npm run check:metadata` 复查提示。

### 目标

让 P4.3 的外部 URL 确认可重复执行，并在仓库公开后可以一键复验。

### 验收标准

- `npm run check:metadata` 输出 repository/homepage/bugs/npm 状态 JSON。
- 当前 GitHub URL 返回 404 时，`npm run check:metadata` 返回非零退出码并给出
  下一步提示。
- npm 包名 E404 被报告为首次发布可接受状态，而不是阻断项。
- `npm run check` 和 `npm run release:check` 通过。

验收结果：

- `npm run check:metadata` 输出 JSON 报告；当前报告 `ok=false`，并给出创建/公开
  GitHub repository 或更新 package metadata 的下一步提示。
- `npm run check:metadata` 对当前 GitHub URL 不可达状态返回非零退出码，符合
  发布阻断预期。
- `npm run check:metadata` 将 npm E404 报告为首次发布可接受状态。
- `npm run release:check` 通过；内部 `npm run check` 已覆盖
  `scripts/check-package-metadata.js` 语法检查。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- release check 内部 `npm pack --dry-run` 通过，npm tarball 包含新增的
  `scripts/check-package-metadata.js`，共 38 个文件。

## P4.7 prepublish 发布门禁串联

状态：已完成（2026-07-02）

实现摘要：

- 新增 `npm run release:prepublish`，按顺序运行 `npm run check:metadata`
  和 `npm run release:check`。
- `docs/RELEASE.md` 已补充 `release:prepublish` 的使用时机：外部 package
  metadata 预期已公开可达时运行。
- README 已补充 `release:prepublish` 说明，并明确当前 GitHub URL 返回 404
  时该命令按预期失败。
- 当前 P4.3 GitHub URL 未公开时，`release:prepublish` 会停在
  `check:metadata`，避免误进入本地 release gate 和 npm 发布动作。

### 目标

把“metadata 外部确认 + 本地 release gate”串成一个真正发布前命令，减少发布前漏跑外部 URL 确认。

### 验收标准

- `package.json` 暴露 `npm run release:prepublish`。
- `docs/RELEASE.md` 和 README 说明该命令会在当前 P4.3 未确认状态下失败。
- `npm run check` 通过。
- `npm run release:check` 通过。
- `npm run release:prepublish` 当前因 P4.3 GitHub URL 不可达而失败，并输出
  `check:metadata` 的 JSON 阻塞报告。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、`npm run check`、`npm test`
  和 `npm pack --dry-run` 均通过。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- release check 内部 `npm pack --dry-run` 通过，npm tarball 包含
  `scripts/check-package-metadata.js`、`scripts/release-check.js` 和
  `docs/RELEASE.md`，共 38 个文件。
- `npm run release:prepublish` 返回非零退出码，符合当前 P4.3 未完成状态：
  `check:metadata` 报告 repository 404、bugs 404、homepage URL 不可达，
  npm E404 被识别为首次发布可接受状态。
- P4.3 阻塞处理步骤已新增 `docs/PUBLISHING_BLOCKERS.md` 并从 README、
  release runbook、project status 和当前下一步链接。
- 新增阻塞处理文档后，`npm run release:check` 再次通过：公开文档残留检查、
  `npm run check`、`npm test` 和 `npm pack --dry-run` 均通过；npm tarball
  包含 `docs/PUBLISHING_BLOCKERS.md`，共 39 个文件。

## P4.8 npm package 内容门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 不再只运行普通 `npm pack --dry-run`，而是运行
  `npm pack --json --dry-run` 并解析 tarball 文件列表。
- release gate 现在会校验关键运行时、扩展、skill、发布文档和发布脚本是否实际进入
  npm 包。
- 必备清单覆盖 `README.md`、`LICENSE`、`package.json`、CLI 入口、MCP
  bridge 核心模块、extension 核心模块、skill、安装/发布/阻塞文档，以及
  metadata/release check 脚本。

### 目标

把 npm 包内容从“能打包”提升为“关键发布文件都可证明进入 tarball”，避免后续
`package.json.files`、文件重命名或新增发布文档时漏包。

### 验收标准

- `npm run release:check` 会解析 `npm pack --json --dry-run` 输出。
- release gate 在必备文件缺失时返回非零退出码并列出缺失文件。
- release gate 在必备文件完整时输出 package contents check passed。
- `npm run check` 覆盖更新后的 `scripts/release-check.js` 语法检查。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、`npm run check`、
  `npm test` 和新增的 npm package contents check 均通过。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- release check 内部 `npm pack --json --dry-run` 解析成功，必备 npm package
  内容检查通过，共 39 个文件。

## P4.9 extension zip 内容门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 已在 release gate 中运行 `npm run package:extension`。
- release gate 会解析生成的 extension zip 中央目录，不依赖系统 `unzip`。
- extension zip 校验要求 zip 只包含扩展运行文件：
  `background.js`、`cdp.js`、`content.css`、`content.js`、`network-monitor.js`、
  `manifest.json`、`popup.css`、`popup.html`、`popup.js`、
  `session-manager.js`、`settings.js`、`tool-handlers.js`。
- 必备文件缺失或出现额外文件时，release gate 会返回非零退出码并列出问题文件。

### 目标

把浏览器扩展分发包从“手动 unzip 检查”升级为发布门禁自动检查，避免扩展 zip
遗漏运行文件或混入 docs、tests、node_modules、隐藏文件等非运行内容。

### 验收标准

- `npm run release:check` 会自动运行 `npm run package:extension`。
- release gate 会解析 extension zip 的实际文件列表。
- extension zip 在缺失必备文件或包含额外文件时返回非零退出码。
- extension zip 完整且只包含允许文件时输出 extension zip contents check passed。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、`npm run check`、
  `npm test`、npm package contents check 和 extension zip contents check
  均通过。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- release check 内部 `node scripts/package-extension.js` 成功生成扩展 zip，
  extension zip contents check 通过，共 12 个扩展运行文件。

## P4.10 package / extension 版本一致性门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 已新增 version consistency check。
- release gate 会读取 `package.json` 和 `extension/manifest.json`。
- npm package 版本和 browser extension manifest 版本缺失或不一致时，
  release gate 会返回非零退出码并打印两边版本。
- 当前 `package.json` 和 `extension/manifest.json` 版本均为 `0.1.0`。

### 目标

防止 npm 包版本和浏览器扩展版本在发布前漂移，避免用户拿到 npm runtime 与
extension zip 版本不一致的组合。

### 验收标准

- `npm run release:check` 会校验 `package.json.version` 与
  `extension/manifest.json.version`。
- 两边版本一致时输出 version consistency check passed。
- 任一版本缺失或两边不一致时，release gate 返回非零退出码并列出两边版本。
- `npm run check` 覆盖更新后的 `scripts/release-check.js` 语法检查。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、version consistency check、
  `npm run check`、`npm test`、npm package contents check 和 extension zip
  contents check 均通过。
- version consistency check 输出 `0.1.0`，确认 `package.json` 与
  `extension/manifest.json` 版本一致。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- 最终复查中，`npm run release:check` 继续通过：公开文档残留检查、version
  consistency check、`npm run check`、`npm test`、npm package contents check
  和 extension zip contents check 均通过。
- 最终复查中，`npm run check:metadata` 仍返回非零退出码：repository、
  homepage、bugs URL 均返回 404；npm E404 仍被识别为首次发布可接受状态。

## P4.11 npm bin CLI smoke 门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 已新增 CLI smoke check。
- release gate 会校验 `package.json` 中 `bin.yunti-browser-runtime` 指向
  `bin/yunti-browser-runtime.js`。
- release gate 会运行 `node bin/yunti-browser-runtime.js --help`，确认帮助输出包含
  `Yunti Browser Runtime` 和 `package-extension` 命令。
- release gate 会运行 `node bin/yunti-browser-runtime.js --version`，确认输出与
  `package.json.version` 一致。

### 目标

防止 npm 发布包的 CLI 入口、帮助命令或版本命令在发布前漂移，确保用户安装后能
通过 `yunti-browser-runtime --help` 和 `yunti-browser-runtime --version`
完成基本自检。

### 验收标准

- `npm run release:check` 会校验 `package.json` 的 npm bin 映射。
- CLI `--help` 返回 0，并包含主要命令入口。
- CLI `--version` 返回 0，并与 `package.json.version` 一致。
- 任一检查失败时，release gate 返回非零退出码并打印失败细节。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、version consistency check、
  CLI smoke check、`npm run check`、`npm test`、npm package contents check
  和 extension zip contents check 均通过。
- CLI smoke check 输出 `0.1.0`，确认 `bin.yunti-browser-runtime`、`--help`
  和 `--version` 均可用。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。

## P4.12 Agent config smoke 门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 已新增 print-config smoke check。
- release gate 会分别运行 `scripts/print-config.js --agent <agent> --json`，
  覆盖 Codex、Claude Code、Cursor、Cline 四种 Agent 配置输出。
- JSON smoke 会校验 MCP server 名称、`node` 命令、`mcp/server.js` 参数、
  `YUNTI_BROWSER_BRIDGE_PORT`、`YUNTI_BROWSER_BRIDGE_TOKEN` 指引和 skill 路径。
- release gate 还会运行 `scripts/print-config.js --agent codex --human`，
  确认人类可读输出包含配置标题、token 指引和 skill 路径。

### 目标

防止 Agent 接入配置在发布前漂移，确保公开文档推荐的 `print-config` 命令能持续
输出可用的 MCP 配置和 skill 安装提示。

### 验收标准

- `npm run release:check` 会校验 Codex、Claude Code、Cursor、Cline 的 JSON
  配置输出。
- JSON 输出必须包含可用的 `yunti-browser-runtime` MCP server 配置。
- human 输出必须包含配置标题、bridge token 指引和 skill 路径。
- 任一 Agent 配置输出异常时，release gate 返回非零退出码并打印失败细节。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、version consistency check、
  CLI smoke check、print-config smoke check、`npm run check`、`npm test`、
  npm package contents check 和 extension zip contents check 均通过。
- print-config smoke check 覆盖 Codex、Claude Code、Cursor、Cline 四种 Agent
  JSON 输出，并通过 Codex human 输出检查 token 和 skill 指引。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。

## P4.13 doctor JSON smoke 门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 已新增 doctor smoke check。
- release gate 会运行 `scripts/doctor.js` 并解析 stdout JSON。
- doctor smoke 校验 Node 版本检查、MCP server 文件、skill 文件、bridge
  token header、bridge reachability 字段和 next steps 结构。
- doctor smoke 不要求本地 bridge 必须在线；bridge 未启动时只要 JSON 诊断结构正确，
  release gate 仍可通过。

### 目标

防止安装诊断入口在发布前失效，确保用户发布后可以通过 `npm run doctor` 或
CLI doctor 命令拿到可解析的诊断 JSON 和下一步建议。

### 验收标准

- `npm run release:check` 会校验 doctor JSON 输出可解析。
- doctor JSON 必须包含 Node、bridge、MCP server、skill 和 next steps 信息。
- MCP server 与 skill 文件必须存在。
- bridge 未启动不应阻塞 release gate，但必须在 doctor JSON 中体现 reachable 状态。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、version consistency check、
  CLI smoke check、print-config smoke check、doctor smoke check、`npm run check`、
  `npm test`、npm package contents check 和 extension zip contents check 均通过。
- doctor smoke check 输出 bridge not reachable，确认 bridge 离线时仍能返回结构化
  JSON 诊断并通过 release gate。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。

## P4.14 公开文档相对链接门禁

状态：已完成（2026-07-02）

实现摘要：

- `scripts/release-check.js` 已新增 public Markdown link check。
- release gate 会扫描 README、docs、skills 下的 Markdown 文件。
- link check 会忽略代码块、纯锚点、外部 URL 和 mailto 链接。
- 对本地相对链接，release gate 会解析相对路径并确认目标文件存在。

### 目标

防止公开文档中的相对链接在发布前断裂，确保 README、release runbook、状态文档和
skill 文档里的本地跳转都能指向实际文件。

### 验收标准

- `npm run release:check` 会检查公开 Markdown 相对链接。
- 相对链接目标文件缺失时，release gate 返回非零退出码并列出断链来源。
- 外部 URL、邮件链接、纯页面锚点和代码块中的示例文本不会误报。

### 验收记录

- `npm run release:check` 通过：公开文档残留检查、public Markdown link check
  （11 个 Markdown 文件）、version consistency check、CLI smoke check、
  print-config smoke check、doctor smoke check、`npm run check`、`npm test`、
  npm package contents check 和 extension zip contents check 均通过。
- release check 内部 `npm test` 通过：59 项测试，58 项通过，1 项真实浏览器
  smoke 按配置跳过。
- npm package contents check 通过并确认 dry-run tarball 包含 39 个文件；
  extension zip contents check 通过并确认扩展 zip 包含 12 个运行时文件。

## P4.15 npm 官方 registry 发布脚本

状态：已完成（2026-07-02）

实现摘要：

- 新增 `npm run release:dry-run`，先执行 `npm run release:prepublish`，再执行
  `npm publish --dry-run --registry=https://registry.npmjs.org/`。
- 新增 `npm run release:publish`，先执行 `npm run release:prepublish`，再执行
  `npm publish --registry=https://registry.npmjs.org/`。
- README 和 `docs/RELEASE.md` 已改用这两个脚本，避免本机 npm registry mirror
  影响发布预览或正式发布。

### 目标

确保最终 npm 发布明确指向官方 npm registry，而不是开发机当前配置的
`registry.npmmirror.com` 等镜像源。

### 验收标准

- `npm run release:dry-run` 能生成 npm 发布预览。
- dry-run 输出显示发布目标为 `https://registry.npmjs.org/`。
- dry-run tarball 内容仍为预期的 39 个文件。

### 验收记录

- 本机 `npm config get registry` 返回 `https://registry.npmmirror.com`，确认存在
  mirror registry 误发布风险。
- `npm run release:dry-run` 已通过，输出显示
  `Publishing to https://registry.npmjs.org/`。
- npm publish dry-run tarball 包含 39 个文件。

## P4.16 正式发布脚本内置门禁

状态：已完成（2026-07-03）

实现摘要：

- `release:dry-run` 已改为内置执行 `npm run release:prepublish`。
- `release:publish` 已改为内置执行 `npm run release:prepublish` 和
  `npm run release:whoami`。
- README 和 `docs/RELEASE.md` 已移除需要手动先跑 `release:prepublish` 的发布命令序列。

### 目标

避免人工执行 `release:dry-run` 或 `release:publish` 时绕过 metadata 检查、
release gate、npm package 内容检查和 extension zip 内容检查。

### 验收标准

- `package.json` 中 `release:dry-run` 包含 `npm run release:prepublish`。
- `package.json` 中 `release:publish` 包含 `npm run release:prepublish`。
- `package.json` 中 `release:publish` 包含 `npm run release:whoami`。
- `npm run release:dry-run` 会先跑完整 prepublish gate，再生成官方 npm registry
  dry-run 预览。

### 验收记录

- README 和 `docs/RELEASE.md` 已同步为 `npm run release:dry-run` /
  `npm run release:publish` 流程。
- `npm run release:dry-run` 已通过，命令先进入 `npm run release:prepublish`，
  再执行 `npm publish --dry-run --registry=https://registry.npmjs.org/`。
- 内置 prepublish gate 通过：repository、homepage、bugs 均返回 HTTP 200；
  release gate 覆盖公开文档残留、Markdown 链接、版本一致性、CLI smoke、
  print-config smoke、doctor smoke、`npm run check`、`npm test`、npm package
  contents 和 extension zip contents。
- dry-run 输出显示 `Publishing to https://registry.npmjs.org/`，tarball 包含
  39 个文件。

## P4.17 npm 登录预检门禁

状态：已完成（2026-07-03）

实现摘要：

- 新增 `npm run release:whoami`，执行
  `npm whoami --registry=https://registry.npmjs.org/`。
- `npm run release:publish` 已串联 `npm run release:whoami`，在正式发布前先确认
  当前机器已登录官方 npm registry。
- README、`docs/RELEASE.md` 和项目状态已同步 npm 登录预检说明。

### 目标

让正式发布在缺少 npm 登录时以明确、可操作的错误提前停止，而不是进入 publish
流程后才暴露认证问题。

### 验收标准

- `package.json` 中存在 `release:whoami`。
- `release:publish` 在 `npm publish --registry=https://registry.npmjs.org/`
  前执行 `npm run release:whoami`。
- 未登录 npmjs.org 时，`npm run release:whoami` 返回非零退出码并提示登录。

### 验收记录

- 发布前，`npm run release:whoami` 曾在未登录状态返回 `ENEEDAUTH`，验证缺少 npm
  登录时会提前失败。
- 登录后，`npm run release:whoami` 返回 `xuanzhu`，并在正式发布前通过预检。
- `release:publish` 已内置登录预检；登录前不会进入正式 npm publish。

## P4.18 npm 发布后验证命令

状态：已完成（2026-07-03）

实现摘要：

- 新增 `scripts/check-published-package.js`，从官方 npm registry 读取
  `yunti-browser-runtime@0.1.0` 的发布信息。
- 新增 `npm run release:verify-published`，校验已发布包的 name、version、
  repository、homepage、bugs 和 dist tarball URL。
- `npm run check` 已纳入 `scripts/check-published-package.js` 的语法检查。
- `npm run release:check` 的 npm package contents gate 已要求 tarball 包含
  `scripts/check-published-package.js`。
- README、`docs/RELEASE.md` 和项目状态已同步发布后验证命令。

### 目标

把发布后的 `npm view` 人工检查固化为脚本，确保 npm registry 上的实际包版本和
metadata 与当前 `package.json` 一致。

### 验收标准

- `npm run release:verify-published` 会读取官方 npm registry。
- 已发布版本的 name、version、repository、homepage、bugs 和 tarball URL 与当前
  `package.json` 匹配时命令返回 0。
- 当前版本未发布时，命令返回非零退出码并输出结构化 JSON 报告。
- 未发布失败路径不会把 npm 本机 debug log 路径写入 JSON 报告。
- `npm run release:check` 继续通过，且 npm tarball 包含发布后验证脚本。

### 验收记录

- 发布前，`npm run release:verify-published` 曾返回非零退出码并输出结构化未发布报告，
  且失败路径不包含 npm 本机 debug log 路径。
- 发布后，`npm run release:verify-published` 返回 0，确认
  `yunti-browser-runtime@0.1.0` 已发布到 `https://registry.npmjs.org/`。
- `node --check scripts/check-published-package.js` 通过。
- `npm run release:check` 通过：`npm run check` 已覆盖
  `scripts/check-published-package.js`，npm package contents check 确认 tarball
  包含 40 个文件。
- `npm run release:dry-run` 通过：内置 prepublish gate 通过，官方 npm registry
  dry-run tarball 包含 40 个文件。

## P4.19 npm 正式发布执行

状态：已完成（2026-07-03）

执行摘要：

- `npm run release:whoami` 已确认当前官方 npm registry 登录账号为 `xuanzhu`。
- 已按用户确认执行 `npm run release:publish`。
- `release:publish` 已通过内置 `release:prepublish`、`release:whoami` 和全部本地
  发布门禁；本次测试覆盖 59 项，58 项通过，1 项真实浏览器 smoke 按配置跳过。
- 正式发布进入 `npm publish --registry=https://registry.npmjs.org/`，tarball 包含
  40 个文件。
- npm registry 返回 `E403`：当前账号发布包需要双因素认证 OTP，或使用开启
  bypass 2FA 的 granular access token。
- 已使用临时 npm token 重试 `npm run release:publish`；本地发布门禁再次通过，但
  npm registry 仍返回相同 `E403`，说明该 token 不能绕过发布 2FA 要求。
- 已按项目根目录 `.npmrc` 方式写入实际 token 并确认 `.npmrc` 被 `.gitignore`
  忽略；`npm whoami --registry=https://registry.npmjs.org/` 返回 `xuanzhu`，
  但重新执行 `npm run release:publish` 仍在 `npm publish` 阶段返回相同 `E403`。
- 已用新的 npm token 覆盖项目级 `.npmrc` 后再次确认 `npm whoami` 返回 `xuanzhu`；
  `npm run release:publish` 仍通过本地门禁并在 `npm publish` 阶段返回相同 `E403`。
- 已用具备发布权限的 npm token 覆盖项目级 `.npmrc` 后再次执行
  `npm run release:publish`，正式发布成功：`yunti-browser-runtime@0.1.0` 已发布到
  `https://registry.npmjs.org/`。
- `npm run release:verify-published` 通过，确认 registry 上的 name、version、
  repository、homepage、bugs 和 tarball URL 与本地 `package.json` 匹配。

### 目标

完成 `yunti-browser-runtime@0.1.0` 首次 npm 发布，并用已发布包验证命令确认 registry
上的版本和 metadata。

### 验收标准

- 使用当前有效 npm OTP 执行
  `npm run release:publish -- --otp=<6-digit-code>`，或使用具备 publish 权限且允许
  bypass 2FA 的 npm granular access token。
- `npm publish` 返回成功，并显示发布到 `https://registry.npmjs.org/`。
- `npm run release:verify-published` 返回 0，确认已发布包 name、version、
  repository、homepage、bugs 和 tarball URL 与本地 `package.json` 匹配。
- 发布结果同步到 `docs/PROJECT_STATUS.md`。

### 验收记录

- `npm run release:publish` 成功发布 `yunti-browser-runtime@0.1.0`。
- 发布前门禁通过：metadata URL 检查、公开文档残留检查、Markdown 链接检查、版本一致性、
  CLI smoke、print-config smoke、doctor smoke、`npm run check`、`npm test`、npm
  package contents check 和 extension zip contents check。
- `npm test` 覆盖 59 项测试：58 项通过，1 项真实浏览器 smoke 按配置跳过。
- `npm run release:verify-published` 返回 0。
- `npm view yunti-browser-runtime@0.1.0 ... --registry=https://registry.npmjs.org/`
  返回已发布版本和正确 metadata。

## P5.1 本地默认免 bridge token

状态：已完成（2026-07-03）

实现摘要：

- 默认 `127.0.0.1` 本地 bridge 不再自动生成随机 token，也不要求 extension、doctor
  或 MCP proxy 携带 `x-yunti-browser-token`。
- 用户显式设置 `YUNTI_BROWSER_BRIDGE_TOKEN` 时，bridge 继续强制校验
  `x-yunti-browser-token` 或 `Authorization: Bearer <token>`。
- bridge 绑定到非 loopback host 时必须设置 `YUNTI_BROWSER_BRIDGE_TOKEN`，避免把
  本地免 token 默认值误用于远程或局域网部署。
- `npm run doctor` 默认显示 token not required；只有 bridge 明确要求 token 且请求
  未授权时才提示设置 token。
- `npm run print-config` 默认不再要求用户配置 token，仅保留需要加固时的可选说明。
- 真实浏览器 smoke test 改为覆盖默认免 token 路径。
- package 和 extension 版本同步提升到 `0.1.1`。

### 目标

降低本地安装和首次使用心智：用户只需要启动 bridge、加载扩展、确认 bridge URL，
不需要复制或理解 bridge token。安全边界仍保持本地 loopback 默认，显式 token 用于
共享机器、非本地绑定或额外加固场景。

### 验收标准

- 默认 `npm run bridge` 启动的 `127.0.0.1` bridge 不要求 token。
- 未配置 token 时，extension 可以注册页面，doctor 可以读取完整 health。
- 配置 `YUNTI_BROWSER_BRIDGE_TOKEN` 后，未携带 token 的受保护 HTTP route 仍返回 401。
- `YUNTI_BROWSER_BRIDGE_HOST` 绑定非 loopback 地址且未配置 token 时启动失败。
- README、INSTALL、SECURITY、PROJECT_STATUS 同步新的默认使用路径。
- `npm run release:check` 通过。
- `npm run release:publish` 发布 `yunti-browser-runtime@0.1.1`，并通过
  `npm run release:verify-published` 验证。

### 验收记录

- `npm test` 通过：61 项测试，60 项通过，1 项真实浏览器 smoke 按配置跳过。
- 新增测试覆盖本地默认免 token、显式 token 仍强制校验、非 loopback 无 token
  启动失败。
- `npm run check` 通过。
- `npm run release:check` 通过。
- `npm run release:publish` 成功发布 `yunti-browser-runtime@0.1.1`。
- `npm run release:verify-published` 返回 0。

## P5.2 扩展 popup 与安装引导简化

状态：已完成（2026-07-03）

实现摘要：

- 扩展 popup 首屏不再展示 Bridge Token 输入框，避免用户误以为本地默认安装需要填写
  token。
- Bridge Token 移入“高级设置”，并标注为可选；如果用户已有 token 配置，高级设置会
  自动展开。
- popup 默认状态文案改为“默认无需设置，打开或刷新 http/https 页面即可”。
- README 增加“复制给 Agent 的安装引导”，让用户可以把一段话交给 Agent，由 Agent
  分步骤带用户完成 npm 安装、MCP 配置、扩展加载和 doctor 验证。
- README / INSTALL 明确：加载扩展后默认不需要保存设置，不需要 token。
- package 和 extension 版本同步提升到 `0.1.2`。

### 目标

让用户在安装扩展后尽量立即可用：默认无需填写 token、无需保存 popup 设置；需要
自定义 bridge URL、页面匹配或 token 时再进入高级/设置路径。

### 验收标准

- popup 首屏不出现 Bridge Token 输入框。
- popup 仍保留可选 token 配置能力。
- README 包含可复制给 Agent 的安装引导词。
- README / INSTALL 不再要求默认本地安装时点击 popup 保存 token 或保存设置。
- `npm run release:check` 通过。
- `npm run release:publish` 发布 `yunti-browser-runtime@0.1.2`，并通过
  `npm run release:verify-published` 验证。

### 验收记录

- `npm run release:check` 通过。
- `npm run release:publish` 成功发布 `yunti-browser-runtime@0.1.2`。
- `npm run release:verify-published` 返回 0。

## P5.3 扩展首屏零配置

状态：已完成（2026-07-03）

实现摘要：

- 扩展 popup 首屏只保留连接状态和“刷新状态”，不再展示 Bridge URL、页面匹配、
  Bridge Token 或保存按钮。
- Bridge URL、页面匹配和可选 Bridge Token 统一收进“高级设置”；只有检测到用户已
  配置自定义值时才自动展开。
- popup 根据 bridge 健康状态区分“Agent MCP/bridge 未启动”和“刷新页面即可连接”，
  避免把用户引向不必要的设置项。
- README / INSTALL 明确：作为 MCP 接入时，Agent 启动 MCP server 后会自动启动本地
  bridge；`yunti-browser-runtime bridge` 是独立调试路径。
- package 和 extension 版本同步提升到 `0.1.3`。

### 目标

让用户在完成扩展加载后立即进入可用路径：不打开 popup、不填写 token、不保存设置；
除非 doctor 明确提示 bridge 未运行，否则不要求用户单独启动 bridge。

### 验收标准

- popup 首屏没有任何输入框或保存按钮。
- 默认本地安装仍可在刷新 http/https 页面后自动注册 session。
- README 的复制给 Agent 引导不再把独立 `bridge` 当作必选步骤。
- `npm run release:check` 通过。
- `npm run release:publish` 发布 `yunti-browser-runtime@0.1.3`，并通过
  `npm run release:verify-published` 验证。

### 验收记录

- `npm run release:check` 通过。
- `npm run release:publish` 成功发布 `yunti-browser-runtime@0.1.3`。
- 首次 `npm run release:verify-published` 遇到 npm registry 同步延迟；重试后返回 0。
- `npm view yunti-browser-runtime version dist-tags.latest --registry=https://registry.npmjs.org/`
  返回 `0.1.3`。

## P6.0 0.2.0 产品方向护栏

状态：已完成（2026-07-03）

实现摘要：

- 新增 `docs/NEXT_MAJOR_PLAN.md`，作为 `0.2.0 Best Browser Automation Runtime`
  的持久执行契约。
- 明确 `0.2.0` 是 Yunti-first 增强周期，目标是做最好用的本地浏览器自动化操作层，
  而不是克隆某一个参考项目。
- 明确参考范围扩展到 Playwright、Puppeteer、Selenium、CDP、browser-use、Page Agent、
  BrowserGym 和浏览器扩展/本地运行时生态，吸收它们的可靠 action、locator/uid、
  trace/debug、文本 DOM、benchmark fixture、权限透明和安装体验等优点。
- 明确执行顺序：先参考 Page Agent / browser-use，把 P6.1 页面观察和 P6.2 indexed
  action 主线做扎实；其他生态优点后续再分阶段吸收，避免一次性铺太大。
- 明确不吸收的方向：默认不内置 LLM API key、不把细粒度 MCP 工具替换成单一
  `execute_task`、不让 hub tab/side panel 成为必选项、不把远程多用户模式混入本地
  单用户核心。
- 明确必须保留 Yunti 自己的特色：细粒度 MCP 工具、真实 Chrome/Edge 状态、CDP、
  截图、network/console 诊断、tab 控制、本地 bridge 路由和零配置本地安装。
- 将 P6.1-P6.6 写入本执行计划和 `docs/ROADMAP.md`。
- 将 `docs/PROJECT_STATUS.md` 的当前阶段更新为 `0.2.0` 规划状态。

### 多视角审稿结论

已从产品、架构/API、Agent 工作流、安全隐私、测试发布五个视角审阅 `0.2.0` 计划。
共识如下：

- 方向正确：Yunti-first、本地优先、MCP 原生、真实浏览器状态和细粒度工具必须保留。
- 需要把“最好用”变成可验证承诺：更少误点、更少盲目重试、更清晰恢复、更低安装心智。
- P6.1 必须前置最小安全基线，不能等到 P6.4 才处理 DOM observation 脱敏。
- `yunti_observe_page` 需要字段级输入/输出契约、uid 生命周期、错误码和工具兼容矩阵。
- P6.1/P6.2 需要 deterministic fixture，而不是只写能力描述。
- P6.3 的 skill/tool hints 和可复制工作流提示词应在 P6.1 schema 合并时同步更新。

### 目标

避免上下文压缩或线程切换后丢失下一大版本方向，尤其避免因为阅读单一参考项目而偏离
Yunti 自己的特色。后续实现应直接从仓库文档恢复目标、非目标、阶段顺序、验收标准和
下一步。

### 验收标准

- 仓库中存在独立的下一大版本计划文档。
- `ROADMAP`、`PROJECT_STATUS`、`EXECUTION_PLAN` 都指向或记录 `0.2.0` 方向。
- 下一步明确从 P6.1 `yunti_observe_page` 开始。

### 验收记录

- `npm run release:check` 通过；公开文档残留检查、Markdown 相对链接检查、语法检查、
  单测、npm pack 内容检查和 extension zip 内容检查均通过。

## P6.1 Agent 友好的页面观察

状态：实现中（首个 schema / hints / bridge routing 合约切片已落地）

目标：

新增 `yunti_observe_page`，返回适合外部 Agent 使用的页面观察结果：URL/title、页面
尺寸、滚动位置、可交互文本树、稳定 uid、scrollable 容器信息和脱敏元数据。

第一阶段以 Page Agent 的 PageController / browser-state 思路为主要参考，但实现要适配
Yunti 的 MCP/extension/bridge 架构。

### Page Agent 参考审计

当前参考源：`alibaba/page-agent`。

可吸收点：

- `PageController.getBrowserState()`：把 URL/title、页面尺寸、滚动提示和可交互 DOM
  文本合成一个面向 Agent 的观察结果。
- `updateTree()`：把观察刷新与动作执行分开，适合作为 `observe -> act -> verify`
  工作流的前置步骤。
- `selectorMap` 与 simplified HTML：证明 indexed interactive elements 比原始 CSS
  selector 更适合 Agent 使用；Yunti 需要适配成现有 uid 体系。
- `data-scrollable`：对多面板业务系统很重要，应结构化进入 `scrollableContainers`。
- prompt 规则：评估上一步结果、不要盲目重试、只有存在 pixels above/below 时再滚动。

不复制点：

- 不复制内置 LLM loop。
- 不让 hub/sidebar/operator UI 成为必选项。
- 不把 Yunti 收窄为单页任务工具；仍保留 tabs、CDP、network、console、screenshot、
  file upload 和诊断能力。
- 不追求 Page Agent API 兼容；只吸收思路并转成 Yunti 的 MCP 工具契约。

### 文档先行约束

在动功能代码前，先确认以下契约：

- `yunti_observe_page` 是增量增强，不替换或破坏 `yunti_get_page_snapshot` 与
  `yunti_take_snapshot`。
- 第一版优先走 content script DOM collection，使基础页面观察不依赖 CDP attach。
- 输出同时包含结构化字段和紧凑文本树，便于程序消费和 LLM prompt 消费。
- uid 与最新 observation 绑定；uid 过期、缺失或不可见时，错误提示应引导重新调用
  `yunti_observe_page`。
- 默认不返回 password、token-like、credential-like 输入值；完整 DOM 脱敏策略放到
  P6.4 深化。

### 字段级契约草案

输入：

- `browserSessionId`：可选目标浏览器 session。
- `mode`：默认 `viewport`；后续支持有边界的 `fullPage`。
- `maxElements` / `maxTextLength`：默认限量，防止一次返回过多页面内容。
- `includeHidden`：默认 false。
- `includeTextTree` / `includeRects`：默认 true。
- `redaction`：默认 `balanced`；`strict` 用于更强隐私；`off` 仅允许显式本地调试，
  不进入默认 agent workflow。

输出：

- `observationId`、`browserSessionId`、`capturedAt`、`uidMapVersion`。
- `page`：URL、脱敏 URL preview、title、origin、readyState。
- `viewport`：width、height、devicePixelRatio。
- `scroll`：x/y、page size、pixels/pages above/below。
- `elements[]`：`uid`、`role`、`tag`、`name`、`text`、`label`、`placeholder`、
  `valuePreview`、`valueRedacted`、`type`、`hrefPreview`、`rect`、`visible`、
  `disabled`、`editable`、`checked`、`selected`、`scrollable`、`containerUid`。
- `textTree`：面向 Agent 的紧凑文本树。
- `scrollableContainers[]`：`uid`、`tag`、`name`、`rect`、`scrollTop`、
  `scrollHeight`、`clientHeight`、`canScrollVertical`、`canScrollHorizontal`、
  各方向剩余像素。
- `limits`、`redactions`、`hints[]`、`warnings[]`。

uid 生命周期：

- uid 只对当前 `browserSessionId` 的最近一次 observe/snapshot 有效，不承诺跨刷新或跨
  页面永久稳定。
- action 应接受来自 `yunti_observe_page` 或 `yunti_take_snapshot` 的 uid，但错误提示
  必须说明应重新 observe 还是重新 snapshot。
- stale uid 使用结构化错误码，例如 `STALE_OBSERVATION_UID`，并提示重新
  `yunti_observe_page`。
- uid map 只放内存，不写入 learning memory、task history 或长期诊断日志。

最小脱敏基线：

- P6.1 默认 `balanced`，隐藏 password、hidden token、token/secret/auth/cookie/session/
  api-key/credential/otp-like 值、JWT-like、Bearer-like、private-key-like 和长随机串。
- DOM observation 默认使用属性白名单，不返回任意 attributes。
- URL query 默认摘要化或局部脱敏。
- DOM redaction 不代表 screenshot redaction；截图按真实可见像素处理。

受限/降级状态：

- content script 不可用、browser internal page、跨域 iframe 内容省略、session stale、
  tab changed、无可见交互元素、页面仍在 loading、动作验证不确定时，都需要返回
  `hints[]` 或结构化错误。

### 本阶段不做

- 不把 LLM task loop 放进 runtime。
- 不引入必选 hub tab、side panel 或运行时控制台。
- 不做完整 Playwright locator engine。
- 不做大规模 benchmark harness，只做最小 fixture/smoke。
- 不混入 remote multi-user browser orchestration。

### 第一批验收

- 文档确认 `yunti_observe_page` 的输出契约、uid 关系、默认脱敏和第一条 smoke 路径。
- Page Agent 参考审计已沉淀为 Yunti 术语，不再依赖上下文记忆。
- 首个实现切片只添加 MCP schema、`yunti_get_tool_usage_hints` observe-first 指引和
  bridge routing 合约测试；不实现 content script DOM collector，不重写 action layer。
- 后续代码实现再进入 content script collection、uid map 与 action 兼容、最小
  `observe -> click uid -> observe` 闭环、测试和 skill/docs 更新。
- P6.1 完成必须包括 schema 单测、bridge routing 单测、content fixture 单测、真实浏览器
  smoke、skill 更新和 `yunti_get_tool_usage_hints` 更新。

最新切片记录（2026-07-03）：

- `mcp/tools.js` 已新增 `yunti_observe_page` 输入 schema，覆盖 `mode`、`maxElements`、
  `maxTextLength`、`includeHidden`、`includeTextTree`、`includeRects` 和 `redaction`。
- `yunti_get_tool_usage_hints` 已新增 `yunti_observe_page` guidance，并把
  click/hover/fill 的 uid 说明更新为 observe/snapshot fresh uid。
- `tests/bridge.test.js` 已覆盖工具 surface、observe usage hints schema，以及
  `yunti_observe_page` 从 bridge 转发到 extension 的路由合约。
- `extension/dom-observer.js` 已新增 content-script DOM observation MVP，返回 fresh uid、
  compact text tree、viewport/document scroll、scrollable container metadata、balanced
  redaction metadata 和恢复 hints。
- `extension/content.js` 已接入 `yunti_observe_page`，`extension/manifest.json` 和
  extension/package release gates 已纳入 `dom-observer.js`。
- `tests/dom-observer.test.js` 已覆盖基础 DOM 观察、fresh uid、textTree、balanced
  redaction、URL query 脱敏和 scroll metadata。
- `tests/e2e.test.js` 已把 `yunti_observe_page` 加入 opt-in real-browser smoke。
- 最新验证：`git diff --check` 通过；`npm run release:check` 通过，覆盖 70 个
  node:test 用例，其中 69 个通过、1 个 real-browser smoke 按默认配置跳过；
  `YUNTI_E2E=1 npm run test:e2e` 在当前环境因缺少 Playwright/Chromium 被跳过。
- `extension/tool-handlers.js` 已把 `yunti_observe_page` 返回的 elements 写入最新页面
  uid map，`yunti_click` / `yunti_hover` / `yunti_fill` 继续通过现有 uid resolver 使用
  fresh observe uid，同时保留 `yunti_take_snapshot` 兼容路径。
- `tests/tool-handlers.test.js` 已覆盖 `observe -> click uid` 的 background dispatcher
  最小闭环，以及 missing uid 时提示重新 observe/snapshot。
- `tests/tool-handlers.test.js` 也已覆盖最新 observation 替换旧 uid map：第二次 observe
  后旧 uid 会失败并提示重新 observe/snapshot，新 uid 可以继续驱动现有 click 路径。
- `tests/dom-observer.test.js` 已覆盖 hidden/offscreen targets：默认 viewport observe 会
  排除隐藏和视口外元素，`fullPage` 可包含视口外元素，显式 `includeHidden` 才包含隐藏元素。
- `tests/dom-observer.test.js` 已覆盖 redaction edge modes：balanced 会遮蔽 Bearer、
  token-like、URL query secret 和长随机串，strict 会进一步遮蔽较长普通值，`off` 会返回
  原值并带本地调试 warning。
- `tests/e2e.test.js` 的 opt-in real-browser smoke 已改为先 observe，再用 observe uid
  执行 click；本切片不重写 fill/select/scroll action layer。

P6.1 真实浏览器闭环验证 runbook：

- 验证目标：在真实 Chromium + unpacked extension 环境中跑通
  `observe -> click uid -> observe/verify`，证明 content script observe 生成的 fresh uid
  能驱动现有 `yunti_click` 路径，并且点击后的页面状态可以被后续读取验证。
- 环境准备：安装 Playwright npm 依赖和 Chromium 浏览器二进制；如果本地只安装了项目依赖但
  缺少浏览器二进制，应先执行 Playwright 的 Chromium 安装命令，再运行本 smoke。
- 执行命令：`YUNTI_E2E=1 npm run test:e2e`。
- 当前 smoke 行为：测试会启动本地 bridge、加载 unpacked extension、打开本地 fixture 页面、
  调用 `yunti_observe_page` 找到 "Click me" fresh uid、用该 uid 调用 `yunti_click`，
  再通过页面读回确认点击计数和填充值。
- 成功判定：`real browser extension bridge smoke` 不再 skip，测试通过，并且 artifact
  目录没有 failure screenshot 或 error log。
- 环境缺口判定：如果输出 `install Playwright and Chromium before running
  YUNTI_E2E=1 npm run test:e2e`，该结果只说明当前机器缺少真实浏览器验证依赖，不代表
  P6.1 runtime 逻辑失败；在进入 P6.2 前应重新补跑或明确记录为环境限制。
- 失败恢复：优先查看测试输出的 artifact 目录、`failure.png` 和 `error.log`；再确认 extension
  是否加载、bridge URL 是否写入 extension storage、页面是否刷新注册、以及
  `yunti_list_browser_targets` 是否能看到测试页面。

详细范围、非目标和验收标准见 `docs/NEXT_MAJOR_PLAN.md`。

## P6.2 稳定 DOM action 层

状态：进行中（2026-07-03）

目标：

抽取并增强 DOM action 层，提高 click、hover、fill、select、contenteditable、scroll
容器操作的稳定性，让动作结果更容易被 Agent 验证和恢复。

第一阶段优先参考 Page Agent 的 click/input/select/scroll 事件序列；Playwright/CDP 风格
的 auto-wait、trace 和更深诊断后续再逐步补。

### Page Agent 参考审计

可吸收点：

- `clickElement()` 的 pointer/mouse/focus/click 顺序。
- `inputTextElement()` 对 input、textarea、contenteditable 的分支和插入后验证思路。
- `selectOptionElement()` 的 visible text 选择思路。
- `scrollVertically()` / `scrollHorizontally()` 的容器优先滚动、边界判断和结果消息。

不复制点：

- 不引入隐藏细粒度工具的大型 action runner。
- 不移除 selector、coordinate、CDP fallback。
- 不把动作结果只做自然语言字符串；Yunti 应返回结构化结果，必要时附带人类可读 hint。

### 文档先行约束

- 保持现有 `yunti_click`、`yunti_hover`、`yunti_fill`、`yunti_select`、
  `yunti_type_text`、`yunti_press_key`、`yunti_scroll` 工具名稳定。
- 让 uid action 自然衔接 P6.1 `yunti_observe_page`。
- 错误提示要帮助 Agent 判断下一步是重新 observe、scroll、wait、switch tab，还是使用
  selector/coordinate fallback。
- 保留 CDP、selector 和 coordinate fallback，不把动作层收窄成 page-only abstraction。

### 本阶段不做

- 不引入隐藏细粒度工具的大型 action runner。
- 不要求用户打开 mandatory replay/trace UI。
- 不移除现有 CDP fallback 能力。

### 动作优先级与结果契约

动作优先级：

- P0：`observe -> click uid -> observe`。
- P0：`observe -> fill uid -> verify value`，覆盖 input、textarea、contenteditable。
- P0：页面滚动与 container 滚动恢复。
- P1：select visible text/value、tab 选择/切换、新 tab 续接、等待与验证模板。
- P2：把 console/network/screenshot/CDP 诊断接入“为什么没成功”的恢复建议。

动作结果至少包含：

- 当前兼容返回可以继续保留 `clicked`、`hovered`、`filled`、`selected`、`scrolled`、
  `uid`、`selector`、`x/y`、`method`、`valueLength`、`before/after`、
  `browserSessionId` 等现有字段。
- P6.2 目标结构以增量方式收敛到：`action`、`browserSessionId`、`target`、`ok`、
  `code`、`recoverable`、`nextStepHint`。
- `target` 应能表达 uid、selector、coordinate 或 scroll container，不强迫单一路径。
- 必要时包含 before/after 摘要，例如 scroll position、value length、selected option、
  URL/title 变化、toast/dialog 状态。
- 迁移期间不移除现有成功布尔值或 selector/coordinate 字段，避免破坏外部 Agent 和旧 workflow。

`yunti_select` 兼容缺口：

- 当前 selector/value 路径保留。
- P6.2 需要增加 uid 与 visible text 支持，并写明如何与 `yunti_observe_page` 的 uid
  衔接。

最新切片记录（2026-07-03）：

- `yunti_get_tool_usage_hints` 已新增 P6.2 前置 action recovery guidance，不改写实际
  action layer。
- `yunti_click` / `yunti_hover` / `yunti_fill` hints 现在明确失败或无页面变化后应先
  observe/verify，再根据情况 scroll、wait、switch tab、使用 selector/coordinate fallback
  或询问用户，避免盲目重复同一动作。
- `tests/bridge.test.js` 已覆盖 action recovery guidance，确保 fresh uid、stale/missing
  uid、滚动、等待、tab 切换和 fallback 的恢复提示不会退化。
- 最新验证：`git diff --check` 通过；`node --test tests/bridge.test.js` 通过 63 项；
  `npm run release:check` 通过，覆盖 71 个 node:test 用例，其中 70 个通过、1 个
  real-browser smoke 按默认配置跳过；`YUNTI_E2E=1 npm run test:e2e` 在当前环境因缺少
  Playwright/Chromium 被跳过；token 残留检查无输出。
- `yunti_get_tool_usage_hints` 已新增 action result contract guidance，明确当前 action
  返回是 compatibility-shaped，P6.2 后续只能增量收敛到结构化 `action` / `target` /
  `ok` / `code` / `recoverable` / `nextStepHint` / before-after 摘要，不能破坏现有
  `clicked` / `filled` / `hovered` / selector / coordinate 返回字段。
- 最新验证：`git diff --check` 通过；`node --test tests/bridge.test.js` 通过 64 项；
  `npm run release:check` 通过，覆盖 72 个 node:test 用例，其中 71 个通过、1 个
  real-browser smoke 按默认配置跳过；`YUNTI_E2E=1 npm run test:e2e` 在当前环境因缺少
  Playwright/Chromium 被跳过；token 残留检查无输出。
- `tests/tool-handlers.test.js` 已新增 dispatcher action result shape 测试，锁定当前
  uid click、uid hover、uid fill 和 content-script scroll passthrough 的兼容返回字段，
  作为后续增量加入结构化 `action` / `target` / `ok` / `nextStepHint` 字段前的回归保护。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 4 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 73 个 node:test 用例，其中 72 个
  通过、1 个 real-browser smoke 按默认配置跳过；`YUNTI_E2E=1 npm run test:e2e` 在当前
  环境因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 uid-based `yunti_click` 结果增量追加结构化字段：
  `action: "click"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `clicked`、`uid`、`x/y`、`browserSessionId` 兼容字段。
- `tests/tool-handlers.test.js` 已更新 uid click 断言，确保结构化字段不会替代或破坏
  既有兼容返回。
- 最新验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js` 通过 4 项；
  `npm run release:check` 通过，覆盖 73 个 node:test 用例，其中 72 个通过、1 个
  real-browser smoke 按默认配置跳过；`YUNTI_E2E=1 npm run test:e2e` 在当前环境因缺少
  Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 uid-based `yunti_hover` 结果增量追加结构化字段：
  `action: "hover"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `hovered`、`uid`、`x/y`、`browserSessionId` 兼容字段。
- `tests/tool-handlers.test.js` 已更新 uid hover 断言，确保结构化字段不会替代或破坏
  既有兼容返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 4 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 73 个 node:test 用例，其中 72 个
  通过、1 个 real-browser smoke 按默认配置跳过；`YUNTI_E2E=1 npm run test:e2e` 在当前
  环境因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 uid-based `yunti_fill` keyboard path 结果增量追加
  结构化字段：`action: "fill"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `filled`、`uid`、`method`、`value`、`browserSessionId` 兼容字段；本切片不改
  select/contenteditable/scroll 语义。
- `tests/tool-handlers.test.js` 已更新 uid fill keyboard path 断言，确保结构化字段不会替代或
  破坏既有兼容返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 4 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 73 个 node:test 用例，其中 72 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 uid-based `yunti_fill` select path 结果增量追加
  结构化字段：`action: "fill"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `filled`、`uid`、`method: "select"`、`value`、`browserSessionId` 兼容字段；本切片不改
  select 赋值、change/input 事件派发或 keyboard/contenteditable/scroll 语义。
- `tests/tool-handlers.test.js` 已新增 uid fill select path 断言，确保结构化字段不会替代或
  破坏既有 select 兼容返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 5 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 74 个 node:test 用例，其中 73 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 coordinate fallback `yunti_click` 结果增量追加
  结构化字段：`action: "click"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `clicked`、`x/y`、`method: "coordinate"`、`browserSessionId` 兼容字段；本切片不改坐标点击
  的 CDP mouse event 派发语义。
- `tests/tool-handlers.test.js` 已新增 coordinate click 断言，确保结构化字段不会替代或
  破坏既有 coordinate fallback 兼容返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 6 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 75 个 node:test 用例，其中 74 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 coordinate fallback `yunti_hover` 结果增量追加
  结构化字段：`action: "hover"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `hovered`、`x/y`、`method: "coordinate"`、`browserSessionId` 兼容字段；本切片不改坐标 hover
  的 CDP mouse move 派发语义。
- `tests/tool-handlers.test.js` 已新增 coordinate hover 断言，确保结构化字段不会替代或
  破坏既有 coordinate fallback 兼容返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 7 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 76 个 node:test 用例，其中 75 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 selector fallback `yunti_hover` 结果增量追加
  结构化字段：`action: "hover"`、`target`、`ok`、`recoverable`、`nextStepHint`，同时保留
  `hovered`、`selector`、`x/y`、`method: "selector"`、`browserSessionId` 兼容字段；本切片不改
  selector 定位、scrollIntoView 或 CDP mouse move 派发语义。
- `tests/tool-handlers.test.js` 已新增 selector hover 断言，确保结构化字段不会替代或
  破坏既有 selector fallback 兼容返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 8 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 77 个 node:test 用例，其中 76 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 selector fallback `yunti_click` content-script passthrough
  结果增量追加结构化字段：`action: "click"`、`target`、`ok`、`recoverable`、`nextStepHint`，
  同时保留 content-script 返回的 `clicked`、`element` 字段，并追加 `selector`、
  `method: "selector"`、`browserSessionId` 兼容字段；本切片不改 content-script click
  的 `scrollIntoView`、`element.click()` 或失败返回语义。
- `tests/tool-handlers.test.js` 已新增 selector click passthrough 断言，确保结构化字段不会替代或
  破坏既有 content-script selector click 返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 9 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 78 个 node:test 用例，其中 77 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 `yunti_scroll` content-script passthrough 结果增量追加
  结构化字段：`action: "scroll"`、`ok`、`recoverable`、`nextStepHint` 和
  `browserSessionId`，同时保留 content-script 返回的 `scrolled`、`deltaX/Y`、`target`、
  `before/after` 兼容字段；本切片不改 document/container 滚动选择、坐标命中或
  `scrollBy` 派发语义。
- `tests/tool-handlers.test.js` 已更新 scroll passthrough 断言，确保结构化字段不会替代或
  破坏既有 scroll 返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 9 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 78 个 node:test 用例，其中 77 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 selector fallback `yunti_fill` content-script passthrough
  结果增量追加结构化字段：`action: "fill"`、`target`、`ok`、`recoverable`、
  `nextStepHint`、`selector`、`method: "selector"` 和 `browserSessionId`，同时保留
  content-script 返回的 `filled`、`element`、`valueLength` 兼容字段；本切片不改
  content-script fill 的 `scrollIntoView`、`setEditableText`、input/change 事件或
  contenteditable 处理语义。
- `tests/tool-handlers.test.js` 已新增 selector fill passthrough 断言，确保结构化字段不会替代或
  破坏既有 content-script selector fill 返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 10 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 79 个 node:test 用例，其中 78 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 `yunti_type_text` uid path 和 content-script
  passthrough 结果增量追加结构化字段：`action: "type_text"`、`target`、`ok`、
  `recoverable`、`nextStepHint` 和 `browserSessionId`，同时保留 uid path 的 `typed`、
  `uid`、`text`、`method` 兼容字段，以及 content-script 返回的 `typed`、`element`、
  `textLength`、`mode` 兼容字段；本切片不改 CDP keyboard 派发、selector/coordinate/focused
  fallback 或 content-script `setEditableText` 语义。
- `tests/tool-handlers.test.js` 已新增 uid type_text 和 selector type_text 断言，确保结构化字段
  不会替代或破坏既有 type_text 返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 12 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 81 个 node:test 用例，其中 80 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。
- `extension/tool-handlers.js` 已为 `yunti_press_key` uid path 和 content-script
  passthrough 结果增量追加结构化字段：`action: "press_key"`、`target`、`ok`、
  `recoverable`、`nextStepHint` 和 `browserSessionId`，同时保留 uid path 的 `pressed`、
  `uid`、`key` 兼容字段，以及 content-script 返回的 `pressed`、`key`、`element`、
  `valueChanged` 兼容字段；本切片不改 CDP keyDown/keyUp 派发、selector/coordinate/focused
  fallback 或 content-script key event 语义。
- `tests/tool-handlers.test.js` 已新增 uid press_key 和 selector press_key 断言，确保结构化字段
  不会替代或破坏既有 press_key 返回。
- 最新 targeted 验证：`git diff --check` 通过；`node --test tests/tool-handlers.test.js`
  通过 14 项。
- 最新完整验证：`npm run release:check` 通过，覆盖 83 个 node:test 用例，其中 82 个
  通过、1 个 real-browser smoke 按默认配置跳过；extension zip 内容检查通过，包含 13 个文件；
  npm package 内容检查通过，包含 42 个文件；`YUNTI_E2E=1 npm run test:e2e` 在当前环境
  因缺少 Playwright/Chromium 被跳过；token 残留检查无输出。

详细范围、非目标和验收标准见 `docs/NEXT_MAJOR_PLAN.md`。

## P6.3 Agent 工作流契约

状态：计划中

目标：

将 `observe -> act -> verify` 作为默认 Agent 使用范式写入 skill、tool hints 和文档，
减少盲目重试和坐标操作。

P6.3 的一部分应前置到 P6.1 schema 合并时完成：

- `yunti_get_tool_usage_hints` 必须同步新增 observe-first guidance。
- `skills/yunti-browser-runtime/SKILL.md` 应加入默认循环：
  `hints -> list targets -> observe -> act by uid -> wait if needed -> observe -> verify -> recover or continue`。
- `docs/TOOL_GUIDE.md` 应补点击、填表、滚动找元素、切 tab、等待异步结果五个最小用例。
- 提供可复制提示词，指导外部 Agent 避免盲目重复失败动作，并在提交、删除、支付、
  上传敏感文件或修改生产数据前请求用户确认。

详细范围、非目标和验收标准见 `docs/NEXT_MAJOR_PLAN.md`。

## P6.4 DOM 脱敏与页面内容策略

状态：计划中

目标：

把 DOM observation 的敏感内容脱敏提升为一等能力，与现有 network/console redaction
形成统一安全边界。

P6.1 已前置最小 DOM observation 脱敏基线；P6.4 负责深化：

- `strict` 模式覆盖 email、phone、证件号/银行卡-like、地址-like 和正文中的 credential-like
  片段。
- 对齐 DOM、network、console 的敏感词和字段策略。
- 明确 learning memory、task history、diagnostic artifacts 默认不存 secret，并提供清理路径。
- 明确截图默认是真实像素，不承诺被 DOM redaction 遮蔽。

详细范围、非目标和验收标准见 `docs/NEXT_MAJOR_PLAN.md`。

## P6.5 可选本地运行时控制台

状态：计划中

目标：

提供非必选的本地调试控制台，用于查看 bridge 状态、连接页面、最近工具调用、错误和
stop/cancel 操作，同时保持 popup 零配置。

详细范围、非目标和验收标准见 `docs/NEXT_MAJOR_PLAN.md`。

## P6.6 浏览器扩展分发准备

状态：计划中

目标：

准备 Chrome Web Store / Edge Add-ons 上架材料和权限说明，降低最终用户手动加载扩展的
安装成本，同时保留 unpacked extension 开发路径。

详细范围、非目标和验收标准见 `docs/NEXT_MAJOR_PLAN.md`。

## 每阶段完成后的固定检查

```bash
npm run check
npm test
```

涉及真实浏览器链路时额外执行：

```bash
npm run test:e2e
```

P6.1/P6.2 browser behavior 变更合并前必须执行：

```bash
YUNTI_E2E=1 npm run test:e2e
```

最小 fixture 矩阵：

- `observe-basic.fixture.html`
- `observe-redaction.fixture.html`
- `observe-scroll.fixture.html`
- `observe-dynamic.fixture.html`
- `actions-form.fixture.html`
- `actions-contenteditable.fixture.html`
- `actions-scroll-container.fixture.html`

这些 fixture 是本地确定性回归，不是 benchmark 优化目标。

涉及文档/开源化时额外检查：

```bash
rg "/U[s]ers|C[o]deg|x[y]y|y[b]m100" README.md docs skills package.json
```

## 当前下一步

P0.1-P6.0 已完成，`yunti-browser-runtime@0.1.3` 已发布到官方 npm registry。

- 发布后验证已通过：`npm run release:verify-published`。
- 本地默认使用不再需要 bridge token；需要加固时可显式设置
  `YUNTI_BROWSER_BRIDGE_TOKEN`。
- 扩展 popup 默认不需要用户保存设置；Bridge URL、页面匹配和 token 已移入高级设置。
- `0.2.0 Best Browser Automation Runtime` 的大版本计划已沉淀到
  `docs/NEXT_MAJOR_PLAN.md`。
- 下一步先完成 P6.1 文档契约确认，再开始 `yunti_observe_page` 代码实现。
- 后续如要上架浏览器扩展商店，发布前还需重新审查 broad host permissions。
- 后续版本开发前，先按 `docs/NEXT_MAJOR_PLAN.md` 拆阶段执行并更新本文档验收记录。
