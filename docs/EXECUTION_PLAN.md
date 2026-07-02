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

## 每阶段完成后的固定检查

```bash
npm run check
npm test
```

涉及真实浏览器链路时额外执行：

```bash
npm run test:e2e
```

涉及文档/开源化时额外检查：

```bash
rg "/U[s]ers|C[o]deg|x[y]y|y[b]m100" README.md docs skills package.json
```

## 当前下一步

## P4.15 npm 官方 registry 发布脚本

状态：已完成（2026-07-02）

实现摘要：

- 新增 `npm run release:dry-run`，执行
  `npm publish --dry-run --registry=https://registry.npmjs.org/`。
- 新增 `npm run release:publish`，执行
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

## 当前下一步

P4.3-P4.15 已完成，当前发布前最后动作：

- `npm run release:dry-run` 已通过。
- 如确认要发布 `0.1.0`，执行 `npm run release:publish`。
- 浏览器扩展如需上架商店，发布前还需重新审查 broad host permissions。
