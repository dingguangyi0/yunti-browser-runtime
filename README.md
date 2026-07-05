# Yunti Browser Runtime

面向 AI Agent 的本地浏览器运行时。

English summary: Yunti Browser Runtime is a local-first browser automation
runtime for MCP-capable AI agents. It lets agents inspect and operate a user's
own Chromium browser through a local bridge and an unpacked extension, without
requiring a remote service.

Yunti Browser Runtime 让任何支持 MCP 的 Agent 都可以操作用户本地
Chrome/Edge 浏览器：查看标签页、读取页面、点击输入、截图、上传文件、
监听网络/控制台日志，以及发送 Chrome DevTools Protocol CDP 命令。

它的第一目标是：**部署简单、执行高效、和具体 Agent/平台解耦**。

## 当前定位

当前版本是本地单用户 MVP：

- MCP stdio server：给 Agent 注册工具。
- 本地 bridge：默认监听 `127.0.0.1:48887`。
- Chrome/Edge 扩展：负责在用户真实浏览器中执行动作。
- 工具前缀：`yunti_*`。
- 默认用户：`local`，Agent 通常不需要手动传 `userId`。
- 无远程服务器、平台账号依赖。

## 项目结构

```text
yunti-browser-runtime/
  mcp/                         # MCP stdio server + local bridge
  extension/                   # Chrome/Edge unpacked extension
  skills/yunti-browser-runtime # 给 Agent 使用的浏览器操作 skill
  docs/                        # 项目文档
  scripts/                     # doctor / 辅助脚本
  tests/                       # bridge 和 MCP 测试
```

## 快速启动

推荐作为 MCP 工具接入 Agent，由 Agent 自动启动本地 bridge：

```bash
npm install -g yunti-browser-runtime
yunti-browser-runtime print-config -- --agent codex --human
```

把输出的 MCP 配置加入 Agent 后，加载浏览器扩展并刷新任意 `http` / `https` 页面即可。
默认不需要填写 token，不需要打开扩展 popup，也不需要保存设置。

需要独立调试 bridge 时，可以手动运行：

```bash
yunti-browser-runtime bridge
```

需要查看本地运行时状态时，可以打开可选控制台：

```bash
yunti-browser-runtime console
```

然后访问：

```text
http://127.0.0.1:48887/console
```

控制台只展示连接页面、pending/queued 任务、最近工具 activity 和诊断数量等脱敏摘要；
它不是必选 hub，也不会改变 Agent 的 MCP 使用路径。
`yunti-browser-runtime doctor` 的人类可读摘要也会打印这个控制台 URL。

其他常用 CLI：

```bash
yunti-browser-runtime doctor
yunti-browser-runtime package-extension
```

默认 bridge 地址：

```text
http://127.0.0.1:48887
```

默认本地 bridge 只监听 `127.0.0.1`，不需要配置 token。需要额外加固本机访问时，
可以显式启用 token：

```bash
YUNTI_BROWSER_BRIDGE_TOKEN="$(openssl rand -hex 24)" npm run bridge
```

健康检查：

```bash
npm run doctor
```

`doctor` 会输出机器可读 JSON，并在 stderr 打印人类可读诊断摘要。只需要 JSON
时可执行：

```bash
npm run doctor:json
```

## 复制给 Agent 的安装引导

把下面这段话复制给你正在使用的 Agent，让它一步步引导你安装和验证：

```text
请帮我安装并接入 Yunti Browser Runtime。它是一个本地浏览器运行时，让你通过 MCP 操作我本机 Chrome/Edge 页面。

请按步骤引导我完成，不要跳步：

1. 确认我本机有 Node.js 22+。
2. 执行：npm install -g yunti-browser-runtime
3. 执行：yunti-browser-runtime print-config -- --agent 当前Agent名称 --human
4. 根据输出，把 MCP server 配置加入当前 Agent 的 MCP 配置。
5. 告诉我：当前 Agent 启动 MCP server 后会自动启动本地 bridge，一般不需要单独运行 bridge。
6. 引导我打开 Chrome/Edge 的扩展管理页，开启开发者模式，手动加载扩展目录：
   $(npm root -g)/yunti-browser-runtime/extension
7. 告诉我：扩展默认 bridge URL 是 http://127.0.0.1:48887，本地默认不需要 token，不需要打开 popup，也不需要保存设置。
8. 打开任意 http/https 页面并刷新。
9. 执行：yunti-browser-runtime doctor
10. 如果 doctor 正常，再调用 yunti_list_browser_targets 或 yunti_get_tool_usage_hints 验证你能看到浏览器页面。

注意：Chrome 扩展不能由 npm 静默安装，必须由我手动在浏览器扩展页加载。扩展加载完成后默认立即可用，不要要求我填写 token、打开 popup 或保存设置；除非 doctor 明确提示 bridge 未运行，才让我单独执行 yunti-browser-runtime bridge。
```

## 安装浏览器扩展

npm 全局安装后，扩展目录通常是：

```bash
$(npm root -g)/yunti-browser-runtime/extension
```

开发加载方式：

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启开发者模式。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目的 `extension/` 目录。
5. 打开任意 `http` 或 `https` 页面。
6. 刷新目标页面即可连接。

扩展默认使用 `http://127.0.0.1:48887`，本地安装不需要 token，不需要打开 popup，
也不需要保存设置。扩展 popup 首屏只显示连接状态；自定义 bridge URL、页面匹配或
可选 token 都收在高级设置里。扩展只负责把页面注册到本地 bridge，并执行 Agent
发来的浏览器动作。

也可以生成 zip 包用于分发或归档：

```bash
npm run package:extension
```

输出文件位于 `dist/yunti-browser-runtime-extension-<version>.zip`，zip 内只包含扩展运行所需文件。
浏览器商店分发前的权限、隐私和素材准备清单见
[扩展分发准备度](docs/EXTENSION_DISTRIBUTION.md)。

## 给 Agent 注册 MCP

按目标 Agent 打印 MCP 配置，再加入你的 Agent MCP 配置中：

```bash
npm run print-config -- --agent codex --human
npm run print-config -- --agent claude-code --human
npm run print-config -- --agent cursor --human
npm run print-config -- --agent cline --human
```

大多数 Agent 启动 MCP server 时会自动启动或复用本地 bridge。开发调试时也可以
手动执行：

```bash
npm run bridge
```

更详细的 Codex、Claude Code、Cursor、Cline 接入示例见
[安装说明](docs/INSTALL.md#agent-examples)。

## 给 Agent 安装浏览器操作 Skill

项目内置了一个可分发的 skill：

```text
skills/yunti-browser-runtime/SKILL.md
```

推荐把整个目录复制到 Agent 的 skills 目录，例如 Codex：

```bash
mkdir -p ~/.codex/skills
cp -R skills/yunti-browser-runtime ~/.codex/skills/
```

安装后，新会话遇到浏览器操作任务时，Agent 应先读取该 skill，再调用
`yunti_*` 工具。

如果你的 Agent 不支持自动加载 skills，也可以把
`skills/yunti-browser-runtime/SKILL.md` 的内容加入 Agent 的系统提示或项目提示中。

## Agent 使用原则

浏览器任务建议遵循这个顺序：

1. 先调用 `yunti_get_tool_usage_hints`，确认工具规则。
2. 调用 `yunti_list_browser_targets` 获取浏览器全貌。
3. 保存当前页面返回的 `browserSessionId`。
4. 后续页面/CDP 操作都带同一个 `browserSessionId`。
5. 如果旧 `browserSessionId` 失效，重新调用 `yunti_list_browser_targets` 获取最新路由。
6. CDP 命令必须通过 `yunti_cdp_send_command` 调用，不要把 `Target.activateTarget` 之类的 CDP method 当 shell 命令执行。
7. 涉及提交、删除、付款、上传敏感文件等写操作前，Agent 必须获得用户确认。

### 参数规则速查

- `yunti_click` / `yunti_hover` 需要 `uid`、`selector`，或同时提供 `x` 和 `y`。
- `yunti_fill` 必须提供 `value`，并用 `uid` 或 `selector` 定位；不支持只传坐标。
- `yunti_close_page` 按 `browserSessionId` 关闭页面；如只有 `tabId` / `targetId`，请用 `yunti_cdp_send_command` + `Target.closeTarget`。
- `yunti_cdp_send_command` 必须提供 `method`；`params` 可选，但传入时必须是 object。
- `yunti_forget_learning_memory` 需要 memory `id`，或使用 `all=true` 且 `confirmed=true` 删除全部。

## 常用工具

- `yunti_list_browser_targets`：浏览器标签页和 target 总览。
- `yunti_get_page_snapshot`：读取当前页面轻量状态。
- `yunti_take_snapshot`：获取适合点击/输入的元素快照。
- `yunti_click` / `yunti_fill` / `yunti_hover`：页面交互。
- `yunti_take_screenshot`：截图。
- `yunti_cdp_send_command`：发送 CDP 命令。
- `yunti_get_network_log` / `yunti_list_network_requests`：网络日志。
- `yunti_list_console_messages`：控制台日志。
- `yunti_remember_learning` / `yunti_get_learning_memory`：本地经验记忆。

## 文档

- [安装说明](docs/INSTALL.md)
- [工具指南](docs/TOOL_GUIDE.md)
- [权限和隐私说明](docs/SECURITY.md)
- [发布运行手册](docs/RELEASE.md)
- [发布阻塞处理](docs/PUBLISHING_BLOCKERS.md)
- [项目初衷](docs/PROJECT_INTENT.md)
- [项目状态](docs/PROJECT_STATUS.md)
- [执行计划](docs/EXECUTION_PLAN.md)
- [路线图](docs/ROADMAP.md)

## 验证

```bash
npm run check
npm test
npm run release:check
npm pack --dry-run
```

当前测试覆盖 bridge 路由、MCP 工具列表、浏览器 session 隔离、网络/控制台日志、
learning memory 和核心工具分发。

`npm run release:check` 会串行执行公开文档残留检查、语法检查、单元测试和
`npm pack --dry-run`，适合作为发布前门禁。

仓库 URL 和 npm metadata 已确认公开可达。发布前运行：

```bash
npm run release:dry-run
```

`release:dry-run` 会先执行 `npm run check:metadata` 和 `npm run release:check`，
再显式使用官方 npm registry，避免本机 registry mirror 影响发布预览。

正式发布前先登录官方 npm registry：

```bash
npm adduser --registry=https://registry.npmjs.org/
npm run release:whoami
```

发布后运行：

```bash
npm run release:verify-published
```

真实浏览器 E2E smoke test 默认跳过；需要本机安装 Playwright / Chromium 后显式启用：

```bash
YUNTI_E2E=1 npm run test:e2e
```

失败时测试会在系统临时目录写入截图和错误日志路径，便于排查扩展消息链路。

## FAQ

### 为什么需要浏览器扩展？

扩展负责在用户已经打开的真实浏览器页面中注册 session、执行页面动作，并把安全处理后的网络、控制台和 CDP 观察结果交给本地 bridge。

### bridge token 是什么？

默认本地安装不需要 bridge token。bridge 只监听 `127.0.0.1`，扩展和 MCP server
可以直接连接，减少首次使用心智。需要加固共享机器或自定义部署时，可设置
`YUNTI_BROWSER_BRIDGE_TOKEN`，这时 MCP server、extension 和 doctor 必须使用同一个
token。

### 会读取 cookie 或密码吗？

工具不会返回原始 cookie、authorization header、密码或疑似 token 字段。网络日志、请求体预览和学习记忆都会做敏感字段脱敏。

### 旧的 `browserSessionId` 失效怎么办？

调用 `yunti_list_browser_targets` 获取最新浏览器路由，再用返回的 `browserSessionId` 继续操作。

## 发布状态与后续事项

- 当前稳定发布版本：`yunti-browser-runtime@0.1.3`。
- 当前分支正在收口 `0.2.0` npm/unpacked extension 发布候选版本；`0.2.0`
  增强了 `yunti_observe_page`、fresh uid 操作闭环、结构化恢复诊断、DOM/diagnostic
  脱敏和可选本地控制台。
- 发布后验证命令：`npm run release:verify-published`。
- 浏览器扩展商店版本不阻塞 `0.2.0` npm 发布；如要上架商店，需要沿
  `docs/EXTENSION_PERMISSION_STRATEGY.md` 另行设计 store-candidate 权限 UX。
