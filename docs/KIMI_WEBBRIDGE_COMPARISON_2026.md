# Kimi WebBridge 与 Yunti 对比调研

## 文档状态

- 调研日期：2026-08-16
- 对比基线：已发布的 `yunti-browser-runtime@0.2.7`（`origin/main`）
- 当前工作区的 P8 stable page handle 改动不计入本次基线，也没有在本轮发布
- 本文只记录事实核验、产品判断和升级建议；本轮不修改运行时代码
- 结论中的“未知”表示公开资料没有给出证据，不代表对方一定不支持

## 一句话结论

Kimi WebBridge 目前在安装和分发体验上比 Yunti 成熟，但没有证据表明它在浏览器操作底层能力或会话稳定性上全面强于 Yunti；Yunti 应借鉴 Kimi 的产品化接入路径，同时继续保持 MCP 原生、细粒度工具、双后端和可验证恢复这些特色。

## 已核验的 Kimi 事实

### 1. 安装器做了什么

官方安装脚本
[`https://cdn.kimi.com/webbridge/install.sh`](https://cdn.kimi.com/webbridge/install.sh)
在 2026-08-16 读取到的行为是：

1. 检查 `curl`、`mktemp`、`uname`。
2. 支持 `Darwin`、`Linux`，架构支持 `arm64`、`amd64`。
3. 从 `https://cdn.kimi.com/webbridge/latest/releases/` 下载当前平台的编译二进制。
4. 写入 `~/.kimi-webbridge/bin/kimi-webbridge` 并赋予执行权限。
5. 默认执行 `kimi-webbridge start` 启动本地 daemon。
6. 默认执行 `kimi-webbridge install-skill -y`，向检测到的 Agent runtime 安装 skill。
7. 支持 `--no-start`、`--no-skill` 和 `KIMI_WEBBRIDGE_VERSION` 版本固定。

因此它解决的是“下载本地运行时 + 启动 + Agent 接入”三件事，而不是静默安装浏览器扩展。官方 WebBridge 页面仍要求用户从 Chrome Web Store / Edge Add-ons 安装扩展，或者手动加载扩展目录。

Windows 不是 `install.sh` 的覆盖范围。Kimi FAQ 给出的 Windows 路径是 PowerShell：
`irm https://kimi-web-img.moonshot.cn/webbridge/install.ps1 | iex`。

### 2. 控制架构

Kimi 官方文档明确描述为：本地 Bridge Service 接收 Agent 指令，浏览器扩展通过 Chrome DevTools Protocol 执行动作，结果返回本地 Agent。官方页面也明确写出支持已有 Chrome / Edge 登录态，登录状态和页面内容不离开设备。

官方帮助页列出的能力包括：导航、点击、表单填写、截图、内容提取和复用浏览器登录态。公开资料没有给出稳定页面句柄、跨浏览器 tab 身份隔离、重试预算、写操作不确定性或 15 分钟耐久指标。

### 3. 本地协议和运维信号

对官方 macOS arm64 daemon 做了静态黑盒检查，没有执行该二进制。可见字符串显示：

- 默认本地端口为 `10086`，默认 loopback 监听；
- 存在 HTTP `/status` 和 `/command` 路径；
- `/command` 请求形状包含 `action`、`args`、`session`；
- daemon 同时包含 WebSocket、扩展配对、版本不匹配和 skill 不匹配相关逻辑；
- CLI 至少包含 `start`、`status`、`upgrade`、`install-skill` 等运维命令；
- 二进制字符串提到升级流程会校验 SHA-256，并尝试让 daemon 与扩展版本配对。

这部分是二进制字符串推断，不是 Kimi 的源代码或正式协议文档，不能据此断言全部运行时行为。尤其是初始 `install.sh` 本身直接下载并执行二进制，脚本正文没有显示独立 checksum 校验；这类供应链风险不能照搬。

### 4. 断连和兼容性边界

Kimi 官方 FAQ 的公开恢复建议包括：

- 扩展显示 Disconnected 时，重新执行连接命令；
- Kimi Desktop 场景重启 Kimi Desktop；
- 其他 Local Agent 重新执行 skill 安装命令并重启 Agent；
- 复杂页面或动态加载导致操作失败时，简化指令或先截图确认页面状态；
- Chrome 兼容性警告可能来自其他扩展冲突，建议禁用其他扩展后逐个恢复。

这证明 Kimi 也有连接恢复和页面兼容性问题，只是把主要恢复入口包装成了桌面端、连接命令和扩展状态。公开资料没有证明它能做到标签页一直存在就永不失效，也没有证明它在 Edge sleeping tab 上不需要恢复动作。

### 5. 分发成熟度

2026-08-16 读取的 [Chrome Web Store 页面](https://chromewebstore.google.com/detail/kimi-webbridge/fldmhceldgbpfpkbgopacenieobmligc)显示：

- 扩展版本 `1.11.5`；
- 更新时间为 2026-08-02；
- 约 `100,000 users`；
- 评分 `4.8`，页面显示 `40 ratings`；
- Chrome Web Store 已有正式发布入口，官方帮助页另列出 Edge Add-ons 入口。

这是 Kimi 目前相对 Yunti 最明确的领先项：用户可以走浏览器商店安装，不必把 npm 全局目录暴露给用户，也不必默认打开开发者模式。

Chrome Web Store 同时披露其处理 Web history、User activity、Website content。Yunti 也拥有同等级别的本地页面访问能力，因此 Yunti 的商店版本必须认真准备权限解释、隐私说明和数据边界，而不能只把“本地运行”当成完整的隐私答案。

### 6. 不要把 npm 上的同名包当成官方证据

`kimi-webbridge@0.1.3` 是一个公开 npm 包，但其 npm metadata 的发布者不是 Moonshot 官方，README 也明确要求已有 Kimi WebBridge Chrome 扩展并连接 `ws://127.0.0.1:10086/ws`。它可以作为第三方兼容客户端参考，不能代表官方 daemon、官方 MCP 工具面或官方质量。

## 与 Yunti 0.2.7 的对比

| 维度 | Kimi WebBridge | Yunti 0.2.7 | 判断 |
| --- | --- | --- | --- |
| 首次安装 | 官方 shell/PowerShell 脚本下载 daemon、启动、安装 skill | npm 全局安装，`print-config` 后仍需接入 Agent；扩展通常需商店或手动加载 | Kimi 明显更顺滑 |
| 扩展分发 | Chrome Web Store 和 Edge Add-ons，另有手动包 | 当前 npm/unpacked 路径为主，手动加载开发者扩展 | Kimi 明显领先；Yunti 应补商店渠道 |
| Agent 接入 | 一套安装命令覆盖多个 Local Agent，自动写 skill | 有 `print-config`、打包 skill 和 MCP 配置生成，但配置动作仍较显式 | Kimi 的自动化程度更高 |
| 浏览器范围 | 官方声明 Chrome、Edge | Chrome、Edge，且有多浏览器 controller 隔离 | 能力范围相当，Yunti 的身份隔离证据更具体 |
| 底层通道 | 本地 daemon + 扩展 + CDP | 本地 Bridge + 扩展 controller，Content Script 与 CDP 双后端 | 没有 Kimi 全面领先；Yunti 后端选择更丰富 |
| 页面动作 | 导航、点击、填表、截图、提取等 | 52 个 MCP 工具，含页面、tab、CDP、网络、控制台、上传、追踪、诊断等 | Yunti 工具面明显更宽 |
| 观察与定位 | 官方资料强调 snapshot / 页面提取，细节公开较少 | fresh uid、find、scroll container、iframe/shadow 覆盖、observe-act-verify | Yunti 的 Agent 契约更明确 |
| 会话恢复 | 公开 FAQ 仍建议重新连接、重启 Agent/Desktop | controller 心跳、旧 session 路由恢复、Edge sleeping-tab 有界恢复、结构化 retry budget | Yunti 公开的恢复设计和实测证据更强，但不是同场测试 |
| 失败语义 | 公开资料主要是扩展状态和人工排障提示 | `code`、`retryable`、`retryBudget`、`recoveryAction`、`resultUncertain` | Yunti 明显更适合多步 Agent |
| 安全边界 | 本地执行；官方扩展商店披露页面和浏览活动处理 | loopback 默认无 token；DOM/网络/控制台/记忆脱敏；CDP 原始诊断单独标注 | 两者方向相近，Yunti 的可审计文档更细；商店隐私材料 Kimi 更完整 |
| 版本运维 | daemon/extension/skill 有配对、status、upgrade 线索 | `doctor` 检查 runtime/Bridge/extension/protocol，npm 版本发布 | Kimi 的用户入口更简单，Yunti 的诊断字段更细 |
| 可验证性 | 公开页面没有性能/耐久数字 | 38/38 benchmark，Edge 15 分钟连续测试，`52/52` 工具覆盖，p95/max 记录在发布文档 | Yunti 的公开工程证据更强，但需要持续保持可复现 |
| 开源透明度 | 核心 daemon 为 CDN 黑盒二进制，扩展分发为商店包 | runtime、Bridge、扩展、测试和文档均在公开仓库 | Yunti 明显领先 |
| 云端依赖 | WebBridge 控制链路官方宣称本地；Kimi 产品/Agent 生态仍是配套入口 | 无 Yunti 账号、无 hosted relay、MCP 与模型解耦 | Yunti 更适合独立集成和本地-first 场景 |

## 结论：Yunti 是否做得更差

不能用单一排名回答。

### Kimi 明显做得更好的地方

1. **把安装链路压缩成一个用户动作**：运行安装器就得到 daemon、启动状态和 Agent skill。
2. **浏览器扩展进入官方商店**：这是降低开发者模式、路径复制和手动加载成本的关键。
3. **把版本配对和状态检查包装成用户可理解的 CLI**：`status`、`upgrade`、skill refresh 的产品形态值得借鉴。
4. **Agent 接入面向多个 runtime 设计**：不把 MCP 配置细节全部推给用户。
5. **面向普通用户的断连指引更短**：扩展状态、重新连接、重启 Agent 是清晰的故障入口。

### Yunti 明显有特色或更强的地方

1. **MCP 原生且和模型/Agent 解耦**：Yunti 不要求用户把全部工作迁移到 Kimi Desktop 或某个特定 Agent。
2. **工具面更完整**：页面操作之外，还覆盖浏览器 target、CDP、网络、控制台、上传、下载、追踪、诊断和本地记忆。
3. **双后端**：Content Script 适合普通页面操作，CDP 适合跨域 frame、shadow DOM、canvas、精确输入和底层诊断；不因 CDP 有提示就人为削弱能力。
4. **错误不是简单的“重试/重启”**：Yunti 有共享 retry budget、结构化 recovery 和 `resultUncertain`，能避免 Agent 重复提交。
5. **会话模型更明确**：一个浏览器/profile 一个 controller，页面 route 与 controller transport 分离，支持 Chrome/Edge/profile 共存。
6. **可测量和可审计**：有源码、测试、benchmark、Edge soak、脱敏策略和公开 release 文档。

### 当前不能下结论的地方

Kimi 的公开资料没有足够信息比较以下项目：跨 iframe/shadow DOM 的目标定位、页面导航后的身份保持、tab id 重用、浏览器重启恢复、Edge sleeping tab、重复写入防护、真实长时 p95。Yunti 也没有在同一台机器上跑过 Kimi 的完整同场 benchmark，因此不能把 Yunti 的 15 分钟指标直接宣称为“比 Kimi 高”。

## 值得借鉴的升级顺序

本次调研建议借鉴“产品外壳”，不复制 Kimi 的核心实现。

### P0：一键安装器和 Agent 接入编排

目标：用户执行一个受审计的安装命令后，自动完成 runtime 检查、Bridge 启动、Agent skill/config 接入，并输出下一步只剩浏览器商店授权。

当前已落地第一步：`yunti-browser-runtime setup` 会生成当前 Agent 的 MCP
配置、幂等安装 Codex packaged skill、检测已有自定义 skill 冲突，并打印扩展目录
和浏览器侧仍需确认的步骤；`yunti-browser-runtime status` 会复用 doctor 检查，
输出不包含原始浏览器 payload 的分层状态。Agent 私有 MCP 配置和浏览器扩展仍不
会被静默覆盖或安装。

应吸收：

- macOS/Linux/Windows 分平台安装入口；
- `--no-start`、`--no-skill`、版本固定等可控开关；
- 检测 Codex、Claude Code、Cursor、Cline 等实际运行时；
- 安装后自动验证 MCP、Bridge、扩展版本和端口；
- `status` / `upgrade` / `doctor` 形成统一诊断入口。

约束：不要照搬 `curl | bash` 的无校验二进制执行。Yunti 的安装器应支持固定版本、HTTPS、SHA-256/签名校验、临时文件原子替换、回滚和清晰的权限提示。

### P0：浏览器商店分发

目标：Chrome Web Store 和 Edge Add-ons 成为普通用户的默认扩展安装路径，npm/unpacked 继续保留为开发者和离线路径。

应吸收：

- 商店安装后自动连接本地 Bridge；
- 商店版本与 npm runtime 的协议/版本握手；
- 更新不破坏已有 Bridge 路由；
- 商店页面明确说明 debugger、tabs、host access、页面内容和截图权限。

这比继续优化 README 中的“复制扩展目录”更能直接缩短用户路径，但必须先完成 [扩展分发审计](EXTENSION_DISTRIBUTION.md) 和隐私材料。

### P1：一条可复制的 Agent 安装指令

`print-config` 已经是 Yunti 的基础能力。下一步应把它变成一个幂等的安装/诊断流程：

```text
检查 Node.js 和 Yunti 版本；检查或安装当前 Agent skill；检查 MCP 配置是否已存在且指向同一版本；启动或复用本地 Bridge；检查扩展 controller；列出 live browser targets；最后用一个只读 snapshot 验证。
```

Agent 只在浏览器商店授权这一处请求用户参与，不再要求用户手动复制 JSON、填写 token、刷新页面或重启浏览器作为默认步骤。

### P1：统一连接状态模型

Kimi 的扩展状态入口很直观。Yunti 可以增加一个面向用户的四态状态：

- `runtime_missing`：CLI/Node/runtime 不完整；
- `bridge_offline`：本地 Bridge 未启动；
- `controller_online`：扩展和浏览器 controller 在线，但尚未选择页面；
- `page_ready`：存在可操作的 HTTP/HTTPS 页面。

这个状态只改善可见性，不应退回“每个页面都必须提前注册”的旧模型。页面仍应由 controller inventory 发现，并在动作时按 live tab route 自动恢复。

### P2：小而明确的本地 API 健康检查

Kimi 将 daemon 状态包装为 `status`，这是值得借鉴的用户体验。Yunti 不需要改成 Kimi 的 `10086` 或 `/command` 协议，但可以提供：

- `yunti-browser-runtime status --json`：只读返回 runtime、Bridge、extension、controller、page 数量和版本；
- `yunti-browser-runtime reconnect`：只重启/重建本地 transport，不刷新页面、不重复写操作；
- `doctor --repair`：仅执行确定安全的本地修复，例如 Bridge 重启和 stale route 清理。

### P2：把恢复建议绑定到实际故障

Kimi FAQ 中“重启 Agent/桌面端”是有效但粗粒度的兜底。Yunti 应继续保留更细的恢复语义：

- Bridge 掉线：重建本地 Bridge；
- controller 在线、页面 route 缺失：重新 inventory 并按 tab/target 恢复；
- Edge sleeping tab：有界 probe/injection，必要时短暂激活并恢复用户活动 tab；
- version/protocol mismatch：零重试，提示升级配对；
- `resultUncertain`：先验证页面状态，不自动重放写操作。

## 不建议借鉴的地方

1. **不采用黑盒 daemon 作为 Yunti 核心**：Yunti 的开源 runtime 和可测试性是产品信任的一部分。
2. **不把 Kimi Desktop 或 Kimi 账号设为必需依赖**：Yunti 要保持 MCP-native、Agent-agnostic 和本地-first。
3. **不把简单的“重启 Agent”当成会话稳定性设计**：必须继续建设 controller、page handle、导航上下文和有界恢复。
4. **不默认采用粗粒度单一 `browser` action 工具**：Yunti 的细粒度 MCP 工具更适合安全确认、可观察性和精确恢复。
5. **不直接复制无校验的 `curl | bash` 下载执行**：安装便利不能抵消供应链风险。
6. **不因为 Kimi 使用 CDP 就删除 Content Script 路径**：两类后端解决的问题不同，Yunti 应由能力和可验证性选择后端。

## 建议的下一阶段验收

在动代码前，先建立和 Kimi 可比较的用户体验与稳定性指标：

| 指标 | 目标 |
| --- | --- |
| 新用户从安装到首次只读 snapshot | macOS/Linux/Windows 各不超过 3 个明确人工动作 |
| 商店扩展安装后是否需要刷新页面 | 默认不需要；自动 inventory + route recovery |
| Agent 接入 | 至少 Codex、Claude Code、Cursor、Cline 具备幂等安装/检查路径 |
| 多浏览器 | Chrome + Edge 同时在线，tab id 冲突不串路 |
| 浏览器重启 | controller 和页面 inventory 可重新建立，旧 route 不被误用 |
| Edge sleeping tab | 有界恢复，不阻塞 controller poller，不要求手动刷新 |
| 动态页面 | observe/find/action/verify 覆盖 iframe、shadow、重渲染、异步加载 |
| 写操作安全 | 结果不确定时不重复提交，重复写入保持为 0 |
| 耐久性 | 15 分钟以上连续调用，记录成功率、恢复次数、p95、p99、最大延迟 |
| 供应链 | 固定版本、checksum/签名、原子替换、失败回滚 |

只有当这些指标在相同浏览器、相同页面 fixture、相同 Agent 调用序列下对比，才能回答“Yunti 是否比 Kimi 更稳定”。当前基于公开材料能确定的是：Kimi 的安装体验更好，Yunti 的工程透明度和控制面更强，底层自动化能力尚不能判定谁全面胜出。

## 证据索引

- [Kimi 官方 WebBridge 产品页](https://www.kimi.com/products/kimi-webbridge)
- [Kimi 官方安装脚本](https://cdn.kimi.com/webbridge/install.sh)
- [Kimi WebBridge 工作原理](https://www.kimi.com/help/kimi-webbridge/kimi-webbridge-how-it-works)
- [Kimi WebBridge FAQ](https://www.kimi.com/help/kimi-webbridge/kimi-webbridge-faq)
- [Kimi WebBridge 安装介绍](https://www.kimi.com/help/kimi-webbridge/kimi-webbridge-introduction)
- [Kimi Chrome Web Store listing](https://chromewebstore.google.com/detail/kimi-webbridge/fldmhceldgbpfpkbgopacenieobmligc)
- [Kimi Edge Add-ons listing](https://microsoftedge.microsoft.com/addons/detail/kimi-webbridge/bnlffdbcfnanfbknnlaflhlhkocccckg)
- [Yunti 项目状态](PROJECT_STATUS.md)
- [Yunti 扩展分发审计](EXTENSION_DISTRIBUTION.md)
- [Yunti 安全边界](SECURITY.md)
- [Yunti 耐久测试](SOAK_TEST.md)
