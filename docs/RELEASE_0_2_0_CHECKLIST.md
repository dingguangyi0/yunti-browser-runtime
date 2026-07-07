# 0.2.0 发布清单

本文档说明 `yunti-browser-runtime@0.2.0` 相比首个公开版本 `0.1.0`
新增了什么、改善了什么、保留了什么，以及发布前后需要检查什么。

这份清单故意写得比较细。目标是让后续发布、对外介绍、Agent 接力开发和上下文压缩恢复时，
都能清楚看到 `0.2.0` 的真实价值，而不是只看到一串 commit。

## 一句话总结

`0.1.0` 证明了 Yunti Browser Runtime 的本地 MCP 浏览器运行时架构：

- MCP stdio server 给 Agent 暴露 `yunti_*` 工具；
- 本地 bridge 连接 MCP server 和浏览器扩展；
- Chrome/Edge unpacked extension 在用户真实浏览器里执行动作；
- CLI 提供 `mcp`、`bridge`、`doctor`、`print-config`、`package-extension`；
- 发布脚本覆盖 metadata、npm package、extension zip、CLI smoke、doctor smoke
  和 npm publish 流程。

`0.2.0` 则把这个 MVP 推进成更像“可稳定使用的浏览器自动化操作层”：

```text
列出页面 -> 观察页面 -> 使用新鲜 uid 执行动作 -> 读取结构化结果
-> 等待或再次观察 -> 验证结果
```

这次版本的核心不是单个新工具，而是完整的 Agent 浏览器操作闭环。

## 方向没有偏移

`0.2.0` 吸收了 Page Agent / browser-use 这类项目里值得学习的“观察、定位、动作、验证”
思想，但没有把 Yunti 改成另一个项目。

Yunti 继续坚持自己的特色：

- MCP-native，优先服务已经支持 MCP 的 Agent；
- local-first，默认跑在用户本机；
- 操作用户自己的 Chrome/Edge，而不是远端托管浏览器；
- 保留细粒度 `yunti_*` 工具，而不是只暴露一个黑盒 task runner；
- 保留 CDP、截图、网络、控制台、文件上传、tab/page 管理等底层能力；
- 不要求远程服务器、平台账号或强制 hub 页面；
- npm/unpacked extension 路径保持可用，浏览器商店权限 UX 单独后置。

## 0.1.0 基线

`0.1.0` 已经具备这些能力：

- 发布到官方 npm registry；
- 项目具备 npm package metadata；
- 具备 `yunti-browser-runtime` CLI；
- MCP server 可以注册浏览器工具；
- local bridge 可以和扩展通信；
- extension 可以注册 `http` / `https` 页面；
- 可以读取浏览器 target、页面 snapshot、网络日志、控制台日志；
- 可以执行点击、输入、滚动、拖拽、文件上传、CDP 等基础操作；
- `doctor` 可以输出 JSON 和人类可读诊断；
- `print-config` 可以输出 Codex、Claude Code、Cursor、Cline 的 MCP 配置；
- release gate 可以检查公开文档残留、JS 语法、测试、npm pack、extension zip；
- 可选真实浏览器 E2E 存在，但不是默认测试必跑项；
- extension popup 可以保存 bridge URL、token 和页面匹配配置。

`0.2.0` 的工作是在这个基础上增强易用性、动作可靠性、恢复能力、安全边界、文档和发布门禁。

## 用户安装体验改善

### 默认本地不再需要 token

`0.1.0` 的正常本地路径里，bridge token 的存在感比较强，用户容易误以为必须配置 token
才能使用。

`0.2.0` 调整为：

- 默认 bridge 地址仍是 `http://127.0.0.1:48887`；
- 默认 loopback 本地访问不需要 token；
- 仍支持显式配置 `YUNTI_BROWSER_BRIDGE_TOKEN` 做本机加固；
- 绑定非 loopback host 时仍强制要求 token；
- `doctor`、README、INSTALL、skill 文案都强调默认本地安装无需 token。

实际效果：

- 用户不需要理解 token 才能开始使用；
- Agent 不应该在默认本地安装路径里反复要求用户填 token；
- 安全加固路径没有被删除，只是从默认路径里移出。

### MCP 启动路径更自然

`0.2.0` 强调通过 MCP server 进入：

- Agent 接入 MCP 后通常会自动启动或复用本地 bridge；
- 用户一般不需要先手动运行 `yunti-browser-runtime bridge`；
- 只有 `doctor` 明确提示 bridge 未运行时，才引导用户单独启动 bridge；
- README 里的复制给 Agent 的安装引导已经按这个逻辑更新。

这减少了“先开 bridge、再配 extension、再填 token”的心智负担。

### Extension popup 从配置页变成状态面板

`0.1.0` 的 extension popup 更像配置入口。

`0.2.0` 改善为：

- popup 首屏是零配置状态面板；
- bridge URL、page match、optional token 放入高级设置；
- 默认加载扩展、刷新任意 `http` / `https` 页面即可连接；
- 不需要打开 popup、不需要保存设置、不需要填 token；
- popup 仍可用于高级调试和自定义配置。

### 可复制给 Agent 的安装提示词

`0.2.0` 在 README 中沉淀了一段可直接复制给 Agent 的安装引导，要求 Agent：

- 检查 Node.js 22+；
- 安装 `npm install -g yunti-browser-runtime`；
- 执行 `print-config`；
- 把 MCP 配置加入当前 Agent；
- 明确说明 MCP 通常自动启动 bridge；
- 引导用户手动加载 Chrome/Edge unpacked extension；
- 明确默认 bridge URL 和默认无需 token；
- 执行 `doctor`；
- 调用 `yunti_list_browser_targets` 或 `yunti_get_tool_usage_hints` 验证。

这对传播非常关键：用户可以把一段话给任意 Agent，让 Agent 带着他完成安装。

## Agent 配置增强

`0.1.0` 已经支持多 Agent 配置输出。

`0.2.0` 继续强化：

- `print-config` 支持 Codex、Claude Code、Cursor、Cline；
- `release:check` 对 4 个 Agent 的配置输出做 smoke check；
- 文档明确 MCP server 是默认入口；
- skill 安装路径和使用方式更清楚；
- 安装文档避免把 bridge token 误导成必填项。

## 浏览器操作层增强

### 新增 `yunti_observe_page`

这是 `0.2.0` 最重要的新能力。

`0.1.0` 有 snapshot 和直接动作，但缺少一个稳定的“先观察页面再行动”的工具契约。

`0.2.0` 新增 `yunti_observe_page`，给 Agent 返回：

- 当前页面可操作元素；
- 新鲜 uid；
- 紧凑 text tree；
- 页面滚动状态；
- nested scrollable containers；
- input / textarea / select / contenteditable 的字段状态；
- select 当前选项和可选项摘要；
- DOM 脱敏元数据；
- 足够让 Agent 决策下一步动作的结构化页面状态。

这让 Agent 不再只靠猜 selector、猜坐标或看截图，而是可以先理解页面，再行动。

### Fresh uid 操作闭环

`0.2.0` 把 observe 产生的 uid 接入动作工具：

- `yunti_click` 支持 observe uid；
- `yunti_hover` 支持 observe uid；
- `yunti_fill` 支持 observe uid；
- `yunti_select` 支持 observe uid；
- `yunti_scroll` 支持 scrollable container uid；
- `yunti_type_text`、`yunti_press_key`、`yunti_upload_file` 等动作遵循结构化结果契约；
- stale uid / missing uid 会引导 Agent 重新 observe 或 snapshot。

推荐流程变成：

```text
yunti_observe_page
-> 选择新鲜 uid
-> yunti_click / yunti_fill / yunti_select / yunti_scroll
-> 读取 ok/code/recoveryHint/nextStepHint
-> yunti_observe_page
-> 验证结果
```

这就是 `0.2.0` 从“能操作浏览器”到“更稳定地操作浏览器”的关键跃迁。

### 新增 `yunti_select`

`0.1.0` 没有一等的 select 操作路径。

`0.2.0` 增加：

- 通过 uid + value 选择；
- 通过 uid + visible text 选择；
- selector fallback；
- 返回 selected index/value/text；
- option miss 时返回可用 value/text 摘要；
- disabled option 有明确诊断；
- 非 select 目标有明确诊断。

这对真实表单、动态下拉框、配置页面非常有用。

### 新增 `yunti_fill_form`

`0.2.0` 增加批量填表能力：

- 返回整体 filled / failed；
- 每个字段都有独立 result；
- 失败字段携带结构化诊断；
- 保留已有兼容字段；
- 适合多字段表单一次性填写后再检查失败项。

### 新增 `yunti_wait_for`

`0.1.0` 对异步 UI 的处理更多依赖 Agent 自己猜时机。

`0.2.0` 增加 `yunti_wait_for`：

- 等待 text；
- 等待 selector；
- 等待 URL 包含某段内容；
- 成功时返回结构化成功结果；
- 超时时返回 `WAIT_TIMEOUT`；
- 超时被标记为 recoverable；
- 明确提示 Agent 先 observe 当前状态，再调整条件或重试。

适用场景：

- 前端异步渲染；
- 表单校验；
- loading 后出现结果；
- 动态 option 加载；
- 页面跳转；
- infinite scroll。

### 页面和 tab 工作流增强

`0.2.0` 强化页面路由：

- `yunti_list_pages` 作为 live target inventory 的兼容别名保留；
- `yunti_select_page` 可切换当前注册页面路由；
- `yunti_navigate_page` 支持 reload/back 等导航；
- stale session 错误包含恢复提示；
- 文档明确 `browserSessionId` 与 raw `targetId` / `tabId` 的区别；
- CDP 操作继续通过 `yunti_cdp_send_command`。

这样可以减少 Agent 把 raw tab id 当成 Yunti page route 的错误。

## 结构化动作结果

### 新增统一结果字段

`0.1.0` 的动作结果更多是动作特定字段，例如：

- `clicked`;
- `filled`;
- `scrolled`;
- `browserSessionId`;
- `selector`;
- `uid`;
- `before`;
- `after`。

`0.2.0` 在保留这些兼容字段的基础上，新增结构化字段：

- `action`;
- `target`;
- `ok`;
- `code`;
- `recoverable`;
- `recoveryHint`;
- `nextStepHint`;
- 更具体的 before/after 摘要。

这让 Agent 可以按统一方式判断：

- 动作是否真正成功；
- 失败是否可恢复；
- 下一步该 observe、wait、scroll、换 uid、换 selector，还是询问用户。

### 覆盖的动作矩阵

`0.2.0` 的动作结果覆盖矩阵包括 11 类工具：

- `yunti_click`;
- `yunti_hover`;
- `yunti_fill`;
- `yunti_select`;
- `yunti_fill_form`;
- `yunti_wait_for`;
- `yunti_scroll`;
- `yunti_type_text`;
- `yunti_press_key`;
- `yunti_upload_file`;
- `yunti_drag`。

新增 `docs/ACTION_RESULT_COVERAGE.md`，并通过
`npm run check:action-results` 加入 release gate，避免以后改动时无意破坏结果契约。

### 点击和 hover 的改善

`0.2.0` 改善：

- uid click；
- coordinate click；
- selector click；
- uid hover；
- coordinate hover；
- selector hover；
- stale uid 诊断；
- missing uid 诊断；
- selector/content-script 失败诊断。

Agent 不再只知道“失败了”，还能知道下一步应该重新 observe、换定位方式或检查页面状态。

### fill 的改善

`0.2.0` 对 fill 做了大量实际网页场景增强：

- uid keyboard fill；
- uid select fill；
- uid contenteditable fill；
- selector fill；
- non-editable target 诊断；
- hidden/disabled/readonly 诊断；
- option miss 诊断；
- value not applied 诊断；
- contenteditable 返回 method 和文本长度摘要；
- `yunti_fill_form` 内部保留每个字段的结构化失败结果。

重要诊断包括：

- `TARGET_NOT_EDITABLE`;
- `VALUE_NOT_APPLIED`;
- stale uid；
- missing uid；
- option miss；
- disabled option；
- readonly/disabled/hidden field。

这对 React/Vue 受控输入、masked input、contenteditable 编辑器、带校验的表单很关键。

### select 的改善

`0.2.0` 支持：

- uid value path；
- uid visible text path；
- selector path；
- option miss recovery；
- disabled option recovery；
- non-select target recovery；
- 返回可用 option 摘要。

Agent 可以先看 observe 里的 options，再用正确 value/text 选择，而不是乱猜。

### scroll 的改善

`0.2.0` 把滚动从“发起滚动”升级成“可诊断滚动”：

- document scroll；
- uid container scroll；
- coordinate container scroll；
- coordinate document fallback；
- `moved` 状态；
- no movement 诊断；
- edge hint；
- partial movement；
- nested panel recovery；
- observe 提供 `scrollableContainers[]`。

这解决很多真实页面问题：

- 弹窗内部滚动；
- 侧边栏滚动；
- 表格容器滚动；
- 无限列表；
- document 不动但内部 panel 能滚的页面。

### wait 的改善

`0.2.0` 让等待结果可恢复：

- 成功保留兼容字段；
- 超时返回 `ok: false`；
- 超时返回 `code: "WAIT_TIMEOUT"`；
- 超时标记为 recoverable；
- 提醒 Agent observe 当前状态后再调整条件。

这比盲目 sleep 或重复同一个 wait 更可靠。

## DOM 观察和脱敏

### 新增 DOM observer

`0.2.0` 新增 `extension/dom-observer.js`。

它负责：

- 提取可见元素；
- 分配 fresh uid；
- 生成 compact text tree；
- 过滤 hidden/offscreen 元素；
- 识别滚动元数据；
- 识别 scrollable containers；
- 提取 field state；
- 提取 select option 摘要；
- 执行 balanced / strict 脱敏。

### 字段状态提示

observe 结果现在能告诉 Agent：

- 是否 editable；
- 是否 fillable；
- 是否 readOnly；
- 是否 disabled；
- 为什么不能 fill；
- 当前值或摘要；
- placeholder 或 label 摘要。

这样 Agent 可以判断是应该填写、等待、先点击解锁、换控件，还是询问用户。

### select 状态提示

observe 结果现在能告诉 Agent：

- selected index；
- selected value；
- selected text；
- options 摘要。

这直接支持 `yunti_select` 的 value/text 路径。

### 更强 DOM 脱敏

`0.2.0` 加强 DOM 观察脱敏：

- balanced 默认隐藏 credential-like values；
- strict 进一步隐藏可能的邮箱、手机号、Luhn-valid 卡号、地址类文本、标题、label、
  name、visible text、placeholder、value、select option text；
- DOM observer 测试覆盖脱敏边界；
- 文档提醒截图像素不属于 DOM 脱敏范围，Agent 需要谨慎处理 screenshot。

## 网络、控制台、CDP、记忆安全

### 网络诊断改善

`0.2.0` 保留并增强网络诊断：

- list network requests；
- get single network request by id；
- clear network observations；
- 按 session/user scope 隔离；
- 网络观察缓存前脱敏；
- raw CDP events 与 sanitized network observations 分开。

### 控制台诊断改善

`0.2.0` 改善 console 工具：

- list console messages；
- get console message by msgid；
- clear console messages；
- console messages 按 session/user scope 隔离；
- 缓存前脱敏；
- allSessions 诊断不越权暴露其它用户。

### CDP 边界更清楚

`0.2.0` 文档和 tool hints 强调：

- CDP method 不能当 shell 命令执行；
- 必须通过 `yunti_cdp_send_command`；
- `params` 必须是 object；
- `Target.activateTarget`、`Target.closeTarget` 等要区分 raw target/tab 和
  Yunti `browserSessionId`；
- raw CDP diagnostics 属于调试面，使用后应清理。

### learning memory 更安全

`0.2.0` 保留本地学习记忆，并加强边界：

- 默认使用 local user scope；
- 默认存放在 Yunti agent home；
- 写入前脱敏 likely secrets 和 PII-like values；
- 文档提醒不要存储 raw payload、cookie、auth header、private key、payment data、
  personal contact details。

## 可选本地运行时控制台

### 新增 `yunti-browser-runtime console`

`0.2.0` 新增可选本地控制台：

```bash
yunti-browser-runtime console
```

访问：

```text
http://127.0.0.1:48887/console
```

它不是必需的 hub，也不会改变 Agent 的 MCP 使用路径。

### 控制台能看到什么

控制台展示脱敏摘要：

- runtime version；
- expected extension version；
- bridge 状态；
- connected sessions；
- 当前页面；
- pending requests；
- queued requests；
- recent activity；
- diagnostic counts；
- 脱敏后的 title / URL。

### 控制台诊断能力

`0.2.0` 还加入：

- extension/runtime version mismatch warning；
- empty state guidance；
- `/console/state` JSON；
- `HEAD /console`；
- doctor 人类可读摘要打印 console URL；
- bridge auth 启用时保护 console state；
- pending/queued browser requests cancel；
- 控制台状态脱敏测试。

这让用户在“Agent 好像卡住了”时，有地方看 runtime 是否连上、请求是否堆积、版本是否不匹配。

## Agent 文档和 skill 增强

### 新增 Agent Workflow Contract

`0.2.0` 新增 `docs/AGENT_WORKFLOW_CONTRACT.md`。

它定义默认操作循环：

1. 不确定工具规则时先调用 `yunti_get_tool_usage_hints`；
2. 调用 `yunti_list_browser_targets`；
3. 选择目标 `browserSessionId`；
4. 调用 `yunti_observe_page`；
5. 使用 fresh uid 执行动作；
6. 异步 UI 使用 `yunti_wait_for`；
7. 每次动作或等待后再次 observe；
8. 用 observe/snapshot/evaluate/screenshot/network/console 验证；
9. 失败时按 `code`、`recoveryHint`、`nextStepHint` 恢复。

### 明确危险操作确认边界

文档要求 Agent 在这些场景前询问用户：

- 提交会改变生产数据的表单；
- 删除、审批、购买、发布、发送消息；
- 上传敏感文件；
- 暴露或复制 secrets、credentials、cookies、auth headers、tokens、private keys；
- 做无法从页面状态验证影响的动作。

### Minimal Use Cases

`0.2.0` 在 Tool Guide 和 skill 中沉淀 5 个最小可用场景：

- Click；
- Fill Form；
- Scroll To Find；
- Switch Tab；
- Wait For Async Result。

这让 Agent 不只是知道工具列表，还知道完成常见浏览器任务的正确顺序。

### Tool usage hints 更完整

`yunti_get_tool_usage_hints` 现在包括：

- observe-first 操作规则；
- fresh uid 使用规则；
- action result contract；
- wait timeout recovery；
- select value/text path；
- raw CDP 和 screenshot 安全边界；
- default agent workflow；
- minimal use cases；
- action recovery guidance。

这对上下文压缩很重要：即使 Agent 忘了前文，也能通过工具重新读到操作规则。

### Skill 同步更新

`skills/yunti-browser-runtime/SKILL.md` 同步了：

- observe-first；
- fresh uid；
- action 后验证；
- wait + observe；
- structured recovery；
- secret safety；
- risky action confirmation；
- minimal use cases。

## Extension 分发和商店准备

### Extension zip 继续可验证

`0.2.0` 保留 `npm run package:extension`：

- 输出 `dist/yunti-browser-runtime-extension-0.2.0.zip`；
- release gate 会解析 zip 内容；
- 当前 zip 预期包含 13 个扩展运行文件；
- 新增 DOM observer 文件被纳入包内容检查。

### 新增分发文档

`0.2.0` 新增或完善：

- `docs/EXTENSION_DISTRIBUTION.md`；
- `docs/EXTENSION_STORE_COPY.md`；
- `docs/EXTENSION_PERMISSION_STRATEGY.md`。

覆盖：

- npm/unpacked extension 当前分发路径；
- Chrome/Edge 商店描述草案；
- 权限解释；
- 隐私和 data disclosure 草案；
- reviewer notes；
- broad host permissions 风险；
- store-candidate 权限 UX 后置策略。

### Store candidate 明确后置

`0.2.0` 不声称浏览器商店版本已经完成。

后置项包括：

- optional host access UX；
- missing-permission recovery；
- optional network diagnostics；
- store-candidate manifest；
- 商店权限相关测试。

0.2.0 发布目标是 npm/unpacked release，而不是浏览器商店提交版。

## 发布门禁增强

### release gate 覆盖更广

`0.2.0` 发布前检查包括：

- public documentation residue；
- public Markdown links；
- package/extension version consistency；
- CLI `--help` / `--version` smoke；
- print-config 4 个 Agent smoke；
- doctor smoke；
- action result coverage；
- JavaScript syntax checks；
- unit tests；
- npm package contents；
- extension zip contents。

### 测试覆盖增长

`0.2.0` 新增测试覆盖：

- DOM observer；
- DOM redaction；
- stale observe uid；
- observe uid action path；
- structured action results；
- fill/select/scroll/wait diagnostics；
- content scroll container/coordinate 行为；
- console diagnostics；
- network request detail scoping；
- optional local runtime console；
- action result coverage gate。

### 当前 0.2.0 RC 验证结果

已跑过并通过：

- `git diff --check`；
- token 残留 grep；
- package/extension version consistency；
- `npm run release:check`；
- `npm run check:metadata`；
- `npm run release:prepublish`；
- `npm run release:dry-run`；
- `YUNTI_E2E=1 npm run test:e2e`。

最新验证摘要：

- package version：`0.2.0`；
- extension version：`0.2.0`；
- public Markdown link check：17 files；
- action result coverage：11 rows；
- normal Node test suite：126 tests，125 passed，1 skipped；
- real-browser E2E：1 passed；
- npm dry-run package：48 files；
- extension zip：13 files。

## 兼容性说明

### 工具面保持兼容

`0.2.0` 是 additive release，不删除核心能力。

保留：

- MCP stdio server；
- local bridge；
- Chrome/Edge unpacked extension；
- `yunti_*` 工具前缀；
- CDP；
- screenshot；
- network diagnostics；
- console diagnostics；
- learning memory；
- file upload；
- tab/page operations；
- extension packaging；
- 现有兼容字段。

### 结果字段保持兼容

结构化字段是新增，不替换已有字段。

继续保留：

- `clicked`;
- `hovered`;
- `filled`;
- `selected`;
- `scrolled`;
- `typed`;
- `pressed`;
- `uploaded`;
- `dragged`;
- `found`;
- `uid`;
- `selector`;
- `x`;
- `y`;
- `method`;
- `before`;
- `after`;
- `browserSessionId`。

### token 行为是有意变化

变化点：

- 默认本地 loopback 不再需要 token；
- optional token 仍可用；
- 非 loopback host 仍要求 token；
- docs 和 skill 要求 Agent 不要在默认本地路径里强迫用户填 token。

这是为了减少安装心智，而不是移除安全能力。

## 0.2.0 不包含什么

`0.2.0` 不是最终形态，也没有假装已经完成所有浏览器自动化愿景。

暂不包含：

- 内置 LLM 自主任务规划循环；
- 跨刷新/跨会话的历史元素 fingerprint 匹配；
- 长程 action replay；
- browser-store-ready optional host permission UX；
- npm 静默安装 Chrome/Edge extension；
- 远程多用户云服务；
- 强制视觉 hub 或 side panel。

这些边界是主动选择。当前重点是把 Yunti 做成可靠的本地浏览器操作层。

## 发布前后清单

正式发布 `0.2.0` 前确认：

- 工作区干净；
- `package.json` 是 `0.2.0`；
- `extension/manifest.json` 是 `0.2.0`；
- README 发布前仍说明稳定版为 `0.1.3`，发布后改成 `0.2.0`；
- browser store 工作明确为 post-0.2；
- public files 没有 npm/GitHub 凭据或 registry auth 配置片段；
- `npm run check:metadata` 通过；
- `npm run release:prepublish` 通过；
- `npm run release:dry-run` 通过；
- 本机真实浏览器 E2E 通过；
- 用户明确确认正式发布。

正式发布命令：

```bash
npm run release:publish
```

发布后验证：

```bash
npm run release:verify-published
```

发布结果：

- `npm run release:publish` 已发布 `yunti-browser-runtime@0.2.0`；
- `npm run release:verify-published` 已验证 name、version、repository、homepage、bugs
  和 tarball URL；
- README 和状态文档已从发布候选状态更新为已经发布的 `0.2.0`。

## 对外 changelog 短版

可以用于 npm/GitHub release notes：

```text
0.2.0 将 Yunti Browser Runtime 从本地 MCP bridge MVP 升级为 observe-first
浏览器自动化操作层。新版本新增 yunti_observe_page、fresh uid 操作闭环、
结构化动作结果、click/fill/select/scroll/wait 恢复提示、DOM/network/console/
memory 脱敏增强、Agent workflow contract、最小浏览器用例、可选本地运行时控制台、
extension 分发文档和更强 release gates。版本继续保持 local-first、MCP-native、
npm/unpacked extension 路径，并保留细粒度 yunti_* 工具、CDP、截图、网络、
控制台、上传、memory 和 tab/page 能力。
```
