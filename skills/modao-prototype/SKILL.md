---
name: modao-prototype
description: "读墨刀（Modao）原型：列出项目、下钻页面目录、定位真实画布、取画布里的文字与组件、导出整页 PNG。当用户给的是墨刀项目、墨刀分享链接，或需要把原型转成 HTML 审阅页时使用。只读，不改原型。"
version: 0.2.0
runtime: node >= 20（零依赖，不装包）
entry: modao/cli.mjs
---

# modao-prototype

直连墨刀 MCP 接口（`https://modao.cc/agent-py/ai/mcp`）的只读脚本。
不用装 DSH 插件、不进 profile、不改任何配置；令牌存在本目录的 `state.json`（不入库）。

## 什么时候用

- 用户给了墨刀**项目**，要「有哪些页面」「这个画布在哪」；
- 用户给了墨刀**分享链接**（`https://modao.cc/proto/<x>/sharing?...`），要从里面取 `canvasId` 去读内容；
- 要把原型按页拆成「TAB + 截图 + PRD」的审阅页。

## 命令

```bash
node skills/modao-prototype/modao/cli.mjs projects                      # 有哪些原型项目
node skills/modao-prototype/modao/cli.mjs pages  <project_cid>          # 一级页面清单
node skills/modao-prototype/modao/cli.mjs tree   <project_cid> [page_key] # 下钻到真实画布（带缓存 + 节流；锁定单页更快）
node skills/modao-prototype/modao/cli.mjs node   <project_cid> <key>    # 单节点：类型、尺寸、子节点
node skills/modao-prototype/modao/cli.mjs text   <project_cid> <canvas> # 画布里的文字 / 按钮 / 表格
node skills/modao-prototype/modao/cli.mjs shot   <project_cid> [canvas_key] # 导出 PNG 并下载到 out/<cid>/
```

授权与诊断：

```bash
node skills/modao-prototype/modao/login.mjs          # 走一遍 OAuth（本机 3090 回调自动收 code）
node skills/modao-prototype/modao/auth.mjs check     # 令牌还有效吗
node skills/modao-prototype/modao/auth.mjs refresh   # 强制换新
```

## 关键事实（踩过的坑）

| 事实 | 说明 |
|---|---|
| 目录不止一层 | 一级页的 `canvases` 可能是空数组，必须一层层下钻到 `type: rResCanvas` 才是真画布 |
| 分享链接的两个 key | `screen=` 是**页面容器**（`rResBunch`/`rbPage`），`canvasId=` 才是**画布**。要内容用后者 |
| 分享链接抓不到 | 分享页是纯前端渲染，`webread` 只能拿到空壳（约 2.9 KB）；读内容必须走本脚本 |
| 需要节流 | 无间隔连打会被阿里云 ALB 回 `502 Bad Gateway`；`tree` 已内置每节点 0.35s |
| 令牌会过期 | `access_token` 有效期 1 小时，`accessToken()` 在剩余 < 300s 时自动 refresh |
| 导出参数名是 `canvas_key` | `export_proto_to_png` 要 `project_cid` + **`canvas_key`**（不是 `target_key`，传错报 `2 validation errors ... canvas_key Missing required argument`；也不接受 `page_key`） |
| 导出链接 60 分钟过期 | 工具返回一条临时 PNG 链接，`shot` 会当场下载到 `out/<project_cid>/<canvas_key>.png`，不保存链接 |
| `tree` 很慢 | 每个节点 0.35s 节流，一个页面几千个节点就要 20 分钟量级；**锁到单页**（`tree <cid> <page_key>`）并复用缓存（30 分钟内不重走） |

## 约束

- **只读**：本脚本只会调 `get_proto_details`（`shot` 额外调 `export_proto_to_png`）。不调 `continue_task`、不调 `generate*`。
- **失败不重试**：墨刀侧明确要求「展示错误信息，只有用户明确要求后才能再次调用」。
- `state.json` 含令牌，**绝不入库**（`.gitignore` 已覆盖）。

## 授权（一次性，约 1 分钟）

墨刀这个端点**不接受**控制台签发的 API token，带上只会返回：

```json
{"detail":"MCP OAuth authorization required."}
```

`WWW-Authenticate` 指向 `https://modao.cc/agent-py/.well-known/oauth-protected-resource/ai/mcp`，授权服务器 `https://modao.cc/agent-py`，走标准 OAuth 2.1 + PKCE。`/agent-py/me` 只认浏览器登录态，所以**必须由人点一次**，脚本代替不了。

```bash
node skills/modao-prototype/modao/login.mjs
```

1. 脚本动态注册客户端（DCR）、把待授权状态写进 `modao/state.json`，然后监听 `http://127.0.0.1:3090/oauth/callback`。
2. 浏览器打开脚本打印的链接（同时写到 `modao/open-url.txt`），登录墨刀 → 点「授权」。
3. 页面显示 `OK: tokens saved` 即完成，**不用复制任何东西**。

要点：

- 授权 code **只有几十秒有效期**，人工复制粘贴基本都会 `invalid_grant: authorization code is invalid or expired`。要手工兑换时用 `login.mjs --code <code>` 并**当场立刻**执行。
- `3080` 是 DSH Web UI 自己占的端口，不能当回调地址；回调固定 `3090`（`MODAO_CALLBACK_PORT` 可改，改后 `redirect_uri` 会随 DCR 重新注册）。
- **一次只跑一条流程**：中途重置 `state.json` 会让 verifier 与 state 错位，表现为 `Cannot read properties of null (reading 'access_token')`。
- 所有 `.mjs` 保持**纯 ASCII**：中文注释会被 Windows 代码页写坏，报 `SyntaxError: missing ) after argument list`。
- `state.json` 与 `open-url.txt` 都是凭证，已在 `.gitignore` 里忽略。误提交后只删文件没用，必须先去墨刀后台**吊销授权**。

## 接口细节

| 项 | 值 |
|---|---|
| 端点 | `https://modao.cc/agent-py/ai/mcp`（streamable-http，JSON-RPC） |
| 服务端 | `modao-agent-py 3.4.2`，协议版本 `2025-06-18` |
| 会话 | 无状态：不返回 `mcp-session-id`，每次调用都是 initialize + tools/call |
| 工具 | 只用 `get_proto_details`（读结构）；`export_proto_to_png` 仅在需要整页出图时用 |
| 客户端标识 | `client` 参数固定填 `"deepseek-harness"` |

`get_proto_details` 的真实签名：

```json
{
  "required": ["project_cid"],
  "properties": {
    "project_cid": { "type": "string" },
    "target_key":  { "anyOf": [{ "type": "string" }, { "type": "null" }], "default": null },
    "client":      { "anyOf": [{ "type": "string" }, { "type": "null" }], "default": null }
  }
}
```

| 参数 | 必填 | 说明 |
|---|---|---|
| `project_cid` | 是 | 原型项目 cid |
| `target_key` | 否 | 不传：返回页面 / 画布的名称 + Key 目录；传入：返回该页面或画布的结构化内容（布局、尺寸、文字、组件、交互） |
| `client` | 否 | 客户端标识，本仓库固定 `"deepseek-harness"` |

调用顺序：`projects` 拿 cid → 只传 `project_cid` 拿一级目录 → 按 `target_key` 逐层下钻到 `rResCanvas`。

令牌：`access_token` 有效期 **3600 秒**并附 `refresh_token`；每次调用前 `accessToken()` 检查寿命，少于 **300 秒**自动换新并写回 `saved_at`。

## 与其他目录的关系

| 目录 / 文件 | 关系 |
|---|---|
| `agent/IM_prompt.md` Step 2 | 提示词按本文件的命令顺序取原型；能力细节以本文件为准，提示词只写调用顺序 |
| `templates/review-template.html` | 取到的画布配截图后填进中间 `#prototype` |
| `templates/samples/IM系统-总览.html` | 同一个墨刀项目（`pb2mrkfxdjjgfkibm`）的离线导出件，可与 `tree` 结果对照 |

## 产出位置

| 内容 | 路径 | 是否入库 |
|---|---|---|
| 令牌 | `modao/state.json` | 否 |
| 授权待打开链接 | `modao/open-url.txt` | 否 |
| 目录缓存 | `modao/cache/tree-<project_cid>.json` | 否 |
| 导出的 PNG / 索引 | `modao/out/<project_cid>/<canvas_key>.png` + `export.json` | 否 |
