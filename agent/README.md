# IM_prompt — 墨刀原型转 HTML 审阅页 · 执行者提示词

墨刀原型截图按页放进 HTML 审阅页的中间画布，已定稿的 PRD 放在最右侧，左侧 tab 栏统一切页。

- 形态：Agent 提示词（YAML frontmatter + 正文，整段复制给对话模型使用）
- 适用模型：支持长上下文的对话模型（Claude / GPT / DeepSeek 等）
- 配套模板：`/templates/review-template.html`（三栏：`nav` / `main#prototype` / `aside#prd`）
- 格式来源：效仿 `ComposioHQ/awesome-claude-skills` 的 `SKILL.md` 结构
- 角色定位：**执行者，不是设计者**（`authority: execute-only`）

## 职责边界（重要）

| 做 | 不做 |
|---|---|
| 把原型截图内联进 `#prototype` 画布，按 tab 切页 | 写需求、拆需求、评需求、补需求 |
| 把 PRD 原文按页放进最右侧 `#prd` 面板 | 改 PRD 原文、补规则、补状态稿 |
| 对齐「tab / 截图 / PRD」三处 | 主动提优化建议、点评原型质量 |
| 报告覆盖缺口与「原型未体现」（只报事实） | 替人裁决冲突 |
| 材料不全时报告缺失并停下 | 猜、填、先做一版 |

## 接的三个 Skill

提示词只负责「什么时候调、拿到什么、什么时候停」，具体命令与踩坑在各 `SKILL.md`：

| Skill | 路径 | 在提示词里做什么 |
|---|---|---|
| `modao-prototype` | [`../skills/modao-prototype/SKILL.md`](../skills/modao-prototype/SKILL.md) | Step 1 出页面清单（`pages`）、Step 2 下钻画布与取文字（`tree` / `node` / `text`）、必要时出图（`shot`） |
| `yuque-docs` | [`../skills/yuque-docs/SKILL.md`](../skills/yuque-docs/SKILL.md) | Step 4 取 PRD 原文（`outline` 对齐章节 → `--section` 取一节） |
| `read-web` | [`../skills/read-web/SKILL.md`](../skills/read-web/SKILL.md) | Step 4 兜底：PRD 不在语雀时抓网页正文 |

## 使用方式

1. 打开 `IM_prompt.md`，整段复制，粘贴为目标模型的系统提示词或首轮指令（若模型支持 Skill 加载，同时挂上上面三个目录）。
2. 先跑三个 Skill 的自检，确认令牌可用（命令见各自 `SKILL.md`）。
3. 附上 **原型来源**：墨刀项目 `project_cid` / 分享链接 / 逐页截图（按页面编号命名）。
4. 附上 **页面清单**（`overview` + `P01…Pnn`）；不给则由 `modao-prototype pages` 生成后请你确认。
5. 附上 **PRD 来源**：语雀 `namespace` + `slug`（或文档链接）/ 贴出的正文。
6. 按提示词的 Step 1–6 推进；交付物是单文件、离线可打开的 HTML。

## 文件结构

```
frontmatter   name / description / role / inputs / outputs / authority / version / skills
# 墨刀原型 → HTML 审阅页
Skills 接线   三个 Skill 的相对路径、调用时机、交付物（本文件是主路径，SKILL.md 是操作手册）
模板怎么用    页面三类职责 / 两套交互 data-page + data-go / overview 隐藏右栏 / 截图一页一常量 IMG + design.img 键引用 / 规则四元组与状态映射 / 验收标题判断 / 交付前 grep 清单
Prerequisites 原型来源、PRD 来源、页面清单、令牌就绪与缺省处理
Setup         三个 Skill 自检、打开模板、改 nav、截图 base64 内联、PRD 按页切块
工作流程       Step 1–6：页面清单(modao) / 读画布出图(modao) / 放截图 / 放 PRD(yuque→webread 兜底) / 图文对齐 / 交付前 6 步自检
输出规范       单文件、内联图、模板类名、文件头注释块
Boundaries    红线与批准纪律（含 Skill 红线、令牌红线）
回复规范       每轮两行摘要、报清调了哪个 Skill、一次一阶段、完整文件输出
Known Pitfalls 常见踩坑（链接当截图、抄错骨架、自拟验收行为、分享页当素材源等）
Quick Reference 情形 → 处置对照表
Quality Checklist 交付前自检清单（21 项）
Hooks         模板位置、截图注入点、素材来源、交付记录、编号体系
```

## 模板怎么用（v1.1.0）

模板是成品壳：`<style>`、三段骨架、文件头注释块、**两套交互**逐字保留，只换内容。v1.0.0 起把数据与渲染约定写死，v1.1.0 起把**页面分类与交互**也写死，避免每次生成都重新发明：

| 约定 | 内容 |
|---|---|
| 页面三类 | `overview`（全局规则文字块，右侧 `aside` 隐藏）/ 列表页（进 tab，tab 名 = 原型页面名）/ 详情页（**不进 tab**，由列表页按钮进入，右栏标题 = 页面名称） |
| 两套交互 | ① `data-page`：左侧 tab 切页；② `data-go`：画布内流程按钮切页（列表页「查看详情」→ 详情页，「← 返回任务列表」→ 列表页）。两者走同一个 `render()`，**都必须保留** |
| 按钮纪律 | 每个有图的页最多一个 `data-go` 按钮，不堆叠；会改状态的按钮（`id="complete"` 那类）整段删除，点击只做跳页 |
| 截图注入 | 一页一常量 `const IMG = { P01:'data:image/png;base64,…' }`，`design` 里用 `img:'P01'` 引用；`render()` 拼 `<img>`，缺图走缺图说明，`overview` 走规则文字块 |
| 规则数据 | 四元组 `[编号, 名称, 说明, 状态]`，状态由 PRD 映射（已确认 / 已否决 / 其余「待审阅」） |
| 验收标题 | PRD 有验收 → 「验收行为」；无 → 「验收行为（PRD 未提供）」 |
| 交付前 grep | `模板示例` / `验收行为草案` / `<未填充>` / `id="complete"` / 示例业务词 必须 0 命中；`data-page` 数量 = overview + 列表页；`data-go` 值必须是存在的 `design` 键；`IMG` 与 `design` 键集合一致 |

**模板 3 处写死字面量无法靠改数据改掉，必须在交付副本里改写**（`templates/review-template.html` 原件不动）：规则的 `' · 待审阅 · 模板示例'`、验收标题 `'验收行为草案'`、`overview` 页那个 `data-go` 跳转按钮（overview 不该有按钮）。

## 骨架照抄原则

`Step 3` 给的三段 HTML 是 `templates/review-template.html` 的**原文单行**，逐字照抄，一个属性都不加：

| 容易抄错的地方 | 正确写法 |
|---|---|
| `<main>` | 没有 `id`、没有 `class`（模板里不存在 `.pane`） |
| `#expand` | 只有 `aria-pressed="false"`，**没有** `class="ghost"` |
| `#feedback` | `<p class="toast" role="status" aria-live="polite">`，不是 `<div>` |
| `#location` | `<span>`，不是 `<div>` |
| `#prototype` | 交付时空容器，图片由 `render()` 注入 |

画布允许放的三种内容：① 该页原型截图（base64）② 缺图时一行说明 ③ `overview` 页的全局规则文字块。**一律不画仿真 DOM。**

## 维护约定

- 修改规则措辞属「文档变更」，同样先说明改什么 / 为什么，确认后再改。
- 章节名被正文交叉引用（如 `[Hooks](#hooks)`），重命名需同步修正引用。
- `frontmatter` 中的 `name` / `version` 变更要同步根 README 的版本表。
- 不在此文件中写死具体产品业务，具体内容放到对应产品的原型与 PRD 中。
- 同目录 `IM_pm_prompt.md` 是早期的纯 Markdown 版本（按需求逐条拆解那一代），已被本文件取代，仅保留备查。
- 同目录 `_backup/` 存历史版本快照（命名 `IM_prompt.v<版本>-<时间戳>.md`），改坏时可对照回滚。
