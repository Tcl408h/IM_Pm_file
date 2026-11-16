# templates — HTML 封装模板

本目录放 **HTML 封装形态** 的模板骨架与示例素材：单文件、自包含、双击可打开，
用于把「原型 + PRD」放在同一屏审阅。

- `review-template.html` — 空壳外壳（代码骨架）
- `samples/` — **示例原型输入**，看「这个空壳要拿什么素材去填」

## 清单

| 文件 | 用途 | 版本 | 来源 |
|---|---|---|---|
| `review-template.html` | 原型与 PRD 同屏的设计审阅外壳：左侧页面导航、中间原型画布、右侧对应 PRD | v0.1 | 产品方提供的审阅模板 |
| `samples/IM系统-总览.html` | 示例原型（墨刀总览模式导出，13.4 MB，只读） | — | 墨刀「IM系统」项目 `pb2mrkfxdjjgfkibm` |

## 目录职责

| | `review-template.html` | `samples/` |
|---|---|---|
| 内容 | 三栏审阅页的**代码骨架** | **原始原型**导出件（示例素材） |
| 改动 | 只做内容填充，样式与结构不动 | **永不修改**，只读；要换版本就重新导出 |
| 用途 | 最终交付物的外壳 | 给 `#prototype` 提供截图来源，让人看清素材长什么样 |

`samples/` 的约定、已知特性与 21 个页面容器索引见 [`samples/README.md`](samples/README.md)。

## review-template.html 结构

```
<header>   标题 / 审阅状态徽标 / 项目·功能·版本
<div class="layout">   三栏栅格，窄屏自动降级
  <nav>      [data-page] 按钮 → overview / list / detail …
  <main>     #prototype 画布 + 「展开原型」同屏/宽屏切换 + #feedback 状态提示
  <aside>    #prd 右侧 PRD 面板，按页面自动定位
<script>
  design = { <page>: { title, rules:[[编号, 名称, 说明]…], acceptance } }
  render(page)  切换导航高亮 → 渲染 PRD 规则 → 渲染原型 HTML
```

## 制作具体功能时的替换规则

1. **样式不动**：`<style>` 整块保留，不改配色、栅格、断点。
2. **只换数据**：替换 `design` 对象里的页面键、`rules` 编号与文案、`acceptance`。
3. **编号稳定**：沿用 `G` / `P01-R01` / `Qnn` 编号体系，已交付编号不复用、不跳号。
4. **状态标注**：每条规则的 `待审阅 / 已确认 / 已否决` 状态必须如实填写，模板示例不能当作已确认需求。
5. **占位符填充**：文件头注释块中的 `生成时间 / 条目范围 / 对应原型 / 未完成项` 必须填完再交付。
6. **示例数据**：虚构数据必须带「示例 / 虚构」字样，避免被误读为真实业务。

## 交付命名

```
<产品名>-<功能编号>-<页面集>-v<版本>.html
例如：im-chat-group-F001-list+detail-v0.1.html
```
