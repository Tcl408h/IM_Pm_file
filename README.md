# IM_chat_group — 产品文件仓库

产品侧可复用的封装资产仓库，统一用 git 管理。内容按**封装形态**分目录存放。

## 四种封装形态

| 形态 | 目录 | 说明 | 当前状态 |
|---|---|---|---|
| Skill 封装 | [`skills/`](skills/README.md) | 一 Skill 一子目录：`SKILL.md`（frontmatter + 用法 + 踩坑 + 约束）+ 配套可执行脚本 | `modao-prototype`、`read-web`、`yuque-docs` |
| Agent 提示词 | [`agent/`](agent/README.md) | 整段复制即可使用的执行者提示词（YAML frontmatter + SKILL 式结构），一文件一角色 | `IM_prompt.md` |
| HTML 封装 | [`templates/`](templates/README.md) | 单文件自包含 HTML 模板骨架：左侧 tab 栏 / 中间原型截图 / 右侧 PRD 三栏同屏审阅；`samples/` 放示例原型 | `review-template.html`、`samples/IM系统-总览.html` |
| 交付项目 | [`project/`](project/IM服务群PRD/) | 按具体 PRD 落地的成品页（非模板）：单文件离线 HTML + 过程记录 | `IM服务群PRD/`（v0.2.0） |

四者关系：

```
templates/samples/（示例原型，只读）──┐
                                       ├─► Agent 提示词（IM_prompt）──► templates/ 三栏审阅页 ──► project/ 交付
PRD（已整理）──────────────────────────┘   按页归位：导航项 / 画布截图 / 右侧 PRD 三者对齐
                                            ▲
                                            └──── skills/：能力脚本 + 用法，供提示词调用 ────┘
```

`templates/` 是**骨架**，`project/` 是**用骨架做出来的成品**。模板原件不动，改动只发生在交付副本里。

## 仓库结构

```
IM_chat_group/
├─ README.md                     # 本文件：总览与导航
├─ agent/
│  ├─ README.md                  # 提示词形态的使用与维护约定
│  ├─ IM_prompt.md               # 需求转化智能体角色提示词（SKILL 式，现行版）
│  └─ IM_pm_prompt.md            # 早期纯 Markdown 版本（已取代，保留备查）
├─ skills/                       # 能力都在这里：脚本 + SKILL.md，别处不再放工具
│  ├─ README.md                  # Skill 规范、现有清单、与其它目录的分工
│  ├─ modao-prototype/
│  │  ├─ SKILL.md                # 直连墨刀：何时用、命令、踩坑、只读约束
│  │  └─ modao/                  # lib / login / auth / cli (+ state.json 不入库)
│  ├─ read-web/
│  │  ├─ SKILL.md                # 读网页：何时用、命令、踩坑
│  │  └─ webread/                # read.mjs (+ cache/out 不入库)
│  └─ yuque-docs/
│     ├─ SKILL.md                # 读语雀：知识库 / 文档 / 章节切片，只读
│     └─ yuque/                  # lib / auth / repos / doc (+ state.json 不入库)
├─ templates/
│  ├─ README.md                  # 模板说明、替换规则、交付命名
│  ├─ review-template.html       # 原型与 PRD 同屏的设计审阅模板 v0.1
│  └─ samples/                   # 示例原型（只读）：README.md + IM系统-总览.html
├─ project/
│  └─ IM服务群PRD/               # 交付成品：语雀 PRD「IM服务群PRD」转成的离线审阅页
│     ├─ 设计审阅.html            # v0.1.0 当前入口（第 1–7 章，4.38 MB）
│     ├─ 设计审阅.v0.1.0.html     # v0.1.0 冻结副本
│     ├─ 设计审阅.v0.2.0.html     # v0.2.0 现行版（第 1–8 章全量，22.96 MB）
│     ├─ 上下文交接.md            # ★ 总纲：铁律 / 技术实现 / 校验体系 / 踩坑 / 未完成项
│     ├─ 进度记录.md              # 进度表：逐条需求对照、校验结果
│     └─ 会话记录.md              # 历史：时间线与用户原话锚点
├─ LICENSE                       # MIT
└─ .gitignore
```

## 快速开始

1. **当提示词用**：复制 `agent/IM_prompt.md` 全文 → 粘到对话模型 → 附墨刀原型截图（按页命名）+ 页面清单 → 附已整理好的 PRD。原型也可以直接用 `node skills/modao-prototype/modao/cli.mjs` 取，见 [`skills/README.md`](skills/README.md)；示例原型见 [`templates/samples/`](templates/samples/README.md)。
2. **当模板用**：复制 `templates/review-template.html` → 截图 base64 转进 `#prototype` → PRD 按页放进 `design` → 填完文件头占位符 → 交付。
3. **看实际成品**：直接双击 `project/IM服务群PRD/设计审阅.v0.2.0.html`（单文件离线，无外部依赖、无联网请求）。接手前先读 `project/IM服务群PRD/上下文交接.md`——里面是完整上下文：内容铁律、构建链、校验体系、20 条踩坑、未完成项。
4. **归档交付物**：生成的 HTML 默认被 `.gitignore` 忽略（`output/`、`*.local.html`），要入库用 `git add -f`。
5. **加新能力**：在 `skills/<skill-name>/` 下写 `SKILL.md` + 脚本，按 [`skills/README.md`](skills/README.md) 的字段说明填。外部能力只放这里，不再新开 `tools/` 之类目录。

## 变更纪律

- **变更须批准**：任何对已有内容的修改、删减、重排，先说明「改什么 / 为什么 / 影响哪些文件」，获批后再改。
- **编号稳定**：规则编号（`G01` / `P01-R01` / `Qnn`）一经交付不复用、不跳号。
- **不编造**：业务规则、数据、文案不臆造；示例必须标注「示例 / 虚构」。
- **模板样式不动**：`templates/*.html` 的样式与结构为基准，只做内容填充。
- **交付内容逐字不动**：`project/` 下的成品页，正文一律照搬源 PRD 原文——不改写、不精简、不补写、不重排。审核人明确指出的单点可改，其余一律不动。

## 上传到 Git

远程仓库：`https://github.com/Tcl408h/IM_Pm_file`，分支 `main`，现行标签 `v0.2.0`。

```bash
git remote add origin https://github.com/Tcl408h/IM_Pm_file.git
git branch -M main
git push -u origin main --tags
```

后续日常提交：

```bash
git add -A
git commit -m "docs: 调整提示词边界说明"
git push
```

提交信息用简化的 Conventional Commits：

```
feat:   新增形态 / 新增章节
docs:   文档、提示词措辞、模板文案调整
fix:    修正错误描述或冲突点
chore:  仓库配置、忽略规则
```

### 什么不入库

| 内容 | 位置 | 原因 |
|---|---|---|
| 墨刀令牌 | `skills/modao-prototype/modao/state.json` | 含 `access_token` / `refresh_token` / `client_id`，等于账号读权限 |
| 语雀令牌 | `skills/yuque-docs/yuque/state.json` | 只读 scope，但仍等于账号读权限 |
| 授权待打开链接 | `skills/modao-prototype/modao/open-url.txt` | 带 `state` / `code_challenge`，一次性凭据 |
| 抓取缓存与导出 | `skills/*/*/cache/`、`skills/*/*/out/` | 本机运行时产物 |
| `.env*`、`*.pem`、`*.key`、`secrets/`、`credentials/` | 任意位置 | 密钥兜底规则 |
| 本机安装产物 | `node_modules/`、`pnpm-lock.yaml` | 各机器自行安装 |
| 生成的交付 HTML | `output/`、`*.local.html` | 需留存时用 `git add -f` 显式添加 |
| 反复重导的原型大文件 | `*.export.html`、`*.temp.html`、`templates/**/*-副本.*` | 随源文件重导即可，没必要进历史 |
| 一次性诊断/构建脚本 | 根目录 `_tmp_*.js`、`_tmp_*.json`、`_tmp_*.mjs`、`_tmp_*.md` | 解析器、构建器、校验脚本与会话缓存，用完即弃 |
| 语雀原文快照与解包图片 | `_tmp_prd_*.md`、`_tmp_imgs/` | 每次可从语雀重新拉取，体积大（图片 13 MB+） |

**推送前自查**：`git status --short` 不应出现上表任何一项。若令牌已误提交，只删文件不够——必须先去墨刀后台**吊销该授权**，再清理历史。

## 版本

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1.0 | 2026-11-14 | 建立三种形态目录：Agent 提示词完整版 + HTML 审阅模板 v0.1；Skill 目录留空壳 |
| v0.2.0 | 2026-11-16 | 新增 `agent/IM_prompt.md`：效仿 Composio `SKILL.md` 格式改写为角色提示词（frontmatter + Prerequisites/Setup/Workflow/Pitfalls/Quick Reference/Hooks）；旧 `IM_pm_prompt.md` 保留备查 |
| v0.3.0 | 2026-11-16 | 职责收敛：由「逐条拆解需求」改为「墨刀原型截图按页放入 `#prototype` 画布 + 已整理 PRD 放最右侧 `#prd`」，新增图文对齐与覆盖缺口清单 |
| v0.4.0 | 2026-11-16 | 角色再收敛为**纯执行者**（`authority: execute-only`）：材料由人提供，不设计、不改写、不补内容、不提建议；缺失即停并报告 |
| v0.5.0 | 2026-11-16 | Step 3 贴入三栏真实骨架代码；接入墨刀（`tools/modao`，现已迁入 `skills/modao-prototype`），Step 2 改为取墨刀原型 |
| v0.6.0 | 2026-11-16 | 墨刀 OAuth 授权跑通（3090 本地回调 + 自动换 token）；工具收敛为**只用 `get_proto_details`**，写入 `client` 参数约定与「失败不许自动重试 / 不许 create 绕过」硬约束 |
| v0.7.0 | 2026-11-16 | 能力清理：删掉 DSH bundle / 插件 / MCP 装配尝试，只保留两个脚本能力——直连墨刀与读网页；两者零依赖、无需安装 |
| v0.8.0 | 2026-11-16 | 新增原始原型目录放用户提供的 `IM系统-总览.html`（墨刀导出 13.4 MB，只读输入），并记录与 `templates/` 的分工、命名约定与页面容器索引；`.gitignore` 增加重导大文件规则（v0.10.0 已迁入 `templates/samples/`） |
| v0.9.0 | 2026-11-16 | **`tools/` 并入 `skills/`**：`skills/modao-prototype/`（含 `SKILL.md`）、`skills/read-web/`（含 `SKILL.md`）；能力与说明同处一目录，`tools/` 目录取消；全仓路径引用与 `.gitignore` 同步 |
| v0.10.0 | 2026-11-16 | **目录收敛**：删除 `docs/`（墨刀接入说明并入 `skills/modao-prototype/SKILL.md`）、删除 `prototypes/`（示例原型迁到 `templates/samples/`）；仓库只剩三种封装形态：`agent/`、`skills/`、`templates/` |
| v0.11.0 | 2026-11-16 | 新增 `skills/yuque-docs/`：语雀只读能力（知识库 / 文档 / 整篇 Markdown / 章节切片），代码只有 GET；令牌存 `yuque/state.json` 不入库 |
| v0.12.0 | 2026-11-16 | `agent/IM_prompt.md` 升 v0.8.0：新增「Skills 接线」一节，把 `modao-prototype` / `yuque-docs` / `read-web` 按 Step 1–2 / Step 4 / 兜底接进主路径，补 Skill 红线与令牌红线、Quick Reference 与 Checklist 同步 |
| v0.13.0 | 2026-11-16 | **全 Skill 实测回归**：修 `modao-prototype` 的 PNG 导出（`export_proto_to_png` 参数名是 `canvas_key`，旧代码传 `target_key` 必失败；现导出后当场下载到 `out/<cid>/<canvas_key>.png`）；`yuque-docs` 增加正文磁盘缓存（30 分钟，一次会话只打一次接口）、429 限流显式报错与 `--refresh`、`--section` 直接打印该节；三份 `SKILL.md` 补实测坑 |
| v0.14.0 | 2026-11-16 | `agent/IM_prompt.md` 升 **v0.9.0**（附 v0.8.0 备份于 `agent/_backup/`）：Step 3 三段骨架改为模板原文单行逐字照抄（修 5 处——`<main>` 去 `.pane`、`#expand` 去 `.ghost`、`#feedback` 复原 `<p class="toast">`、`#location` 复原 `<span>`、`#prototype` 留空容器）；新增「画布三种内容」（截图 / 缺图说明 / overview 规则文字块）；**Step 6 从空标题补成 6 步交付流程**；Step 2 命令改 `shot <cid> [canvas_key]` 并删掉过时错误文本；Step 4 `acceptance` 改为只搬不写（PRD 无验收条目时写「PRD 未提供验收行为」）；Pitfalls / Quick Reference / Checklist 同步 |
| v0.15.0 | 2026-11-17 | `agent/IM_prompt.md` 升 **v1.0.0**（附 v0.9.0 备份于 `agent/_backup/`）：新增「模板怎么用」一节——① 截图改「一页一常量 `IMG` + `design.img` 键引用」并给出 `render()` 三种分支；② 规则从三元组升为**四元组 `[编号, 名称, 说明, 状态]`** 并给出 PRD→状态的映射表；③ 验收标题按数据判断为「验收行为」/「验收行为（PRD 未提供）」；④ 画布内禁用 `data-go`；⑤ 交付前 7 项 grep 清单。同时点名模板 3 处写死字面量（`· 模板示例`、`验收行为草案`、`[data-go]` 旁路）须在**交付副本**改写、模板原件不动；Step 4 数据示例与 Hooks 截图注入说明同步 |
| v0.16.0 | 2026-11-17 | `agent/IM_prompt.md` 升 **v1.1.0**：推翻 v1.0.0 的「禁用 `data-go`」——模板的交互本就是两套，① `data-page` 左 tab 切页、② `data-go` 画布内流程按钮切页，**两套都保留**。新增：① **页面分三类**（overview 全局规则/右栏 `aside` 隐藏、列表页 tab 名=原型页面名、详情页**不进 tab** 由列表页按钮进入且右栏标题=页面名称）；② overview 页隐藏右栏的写法 `prdPanel.hidden = (page==='overview')`；③ 详情页画布放**截图**、只保留一个返回按钮，删掉 `id="complete"` 那类改状态按钮；④ `design` 增 `go:{to,label,primary}` 配置驱动流程按钮，`render(page)` 拼图+按钮；⑤ grep 清单换成「`data-go` 允许保留、每页最多一个、值必须是存在的 `design` 键、`data-page` 数量 = overview + 列表页」；⑥ 联动链路写两条（tab / `data-go`）共用同一 `render()`。Quality Checklist 16→21 项，Step 6 里那句「末尾那 12 项」一并修正为 21 |
| v0.17.0 | 2026-11-17 | 新增 **`project/` 交付项目目录**与首份成品 `project/IM服务群PRD/`：语雀 PRD「IM服务群PRD」第 1–7 章转成单文件离线 HTML（4.38 MB），标签 `v0.1.0`；同时落地 `进度记录.md`、`会话记录.md` 两份过程文档。确立「`templates/` 是骨架、`project/` 是成品」的分工 |
| v0.18.0 | 2026-11-18 | **`设计审阅.v0.2.0.html` 第 8 章全量接入**（22.96 MB / 154 节点 / 146 内联 PNG），标签 `v0.2.0`。要点：① 语雀第 8 章按标题层级建树，保留原文编号（8.1.2 处理人端、8.2 WEB 端），154 节点逐层对齐；② 中间画布**只放原型截图**、右栏放该节点**完整 PRD 正文**，一个层级一个层级看，不混放；③ 9 列表格全量展开、不限高限宽，短内容列 `nowrap`；④ 表格内嵌图片在 WEB 端转 `〔图片：PSn〕` 标签，146 张截图全部内联 base64、图片地址 0 泄漏；⑤ 正文按原文出现顺序渲染（`blocks` 数组），列表项冒号与原文序号逐字还原；⑥ 语雀站内锚点 18 处变可点跳转，第 1–7 章目录 169 项可点；⑦ 截图支持点击放大（滚轮缩放 / 拖动 / Esc / ←→）；⑧ 前七章隐藏右栏与「展开原型」按钮，流程图限宽居中；⑨ 无图中间层 23 个自动落到第一个有图叶子，5 个空叶子保留原文墨刀预留入口；⑩ 章首提示音与 `:::info` 块只出现在第 8 章目录页右栏。校验：162 页运行时遍历 0 异常、内容一致率 100%（2697/2697）、冒号覆盖 762/762 |

## 许可证

[MIT](LICENSE)
