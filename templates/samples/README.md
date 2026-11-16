# samples — 示例原型

这里放**示例原型输入**，用来看「`templates/` 的空壳审阅页到底要拿什么素材去填」。

与同目录上一层的关系见 [`../README.md`](../README.md)。

## 约定

- **只读**：不改、不重排、不覆盖。要新版本就重新从墨刀导出一份、另起文件名。
- **保留导出时的原名**（含中文、空格），便于和墨刀里的项目对上。
- **大文件直接入库**：墨刀导出的 HTML 动辄十几 MB（内联 SVG + data URI 图片），用普通 git 存即可。仓库里这类文件少、更新频率低，不值得引入 Git LFS。

## 清单

| 文件 | 大小 | sha256 | 来源 |
|---|---|---|---|
| `IM系统-总览.html` | 13.4 MB | `267637cf…a634d7075` | 墨刀「IM系统」项目（`project_cid = pb2mrkfxdjjgfkibm`）总览模式导出 |

## 这份示例怎么用

| 用途 | 做法 |
|---|---|
| 看素材长什么样 | 浏览器直接打开，左侧是自动生成的页面目录 |
| 对照 `review-template.html` 的空位 | 中间 `#prototype` 放的是**这种页面的截图**；右侧 `#prd` 放的是**对应的 PRD 原文** |
| 取实时目录 | `node skills/modao-prototype/modao/cli.mjs pages pb2mrkfxdjjgfkibm` |

## 已知特性（判断能不能直接用之前先看）

- **结构**：外层 `.mb-document[data-mb-overview="true"]`，内含 **21 个 `<main class="mb-page">` 页面容器、约 343 个画布**（`data-mb-type="rResCanvas"`），约 1530 个 `<img>`、8060 个 `<svg>`。
- **自带目录**：文件末尾有 `data-mb-page-directory-runtime` 脚本，运行时**动态插入** `<nav class="mb-page-directory">`。所以源码里搜 `<nav>`、`data-page=` 都是 0 命中——体积大、文本搜不到，属正常现象，不是坏文件。
- **不是审阅模板**：没有 `data-page` 绑定、没有 `#prototype` / `#prd`、没有左侧 tab 交互。要交付审阅页，用 `../review-template.html` + `agent/IM_prompt.md`，**不要**在这个导出文件上改。
- **断网可读**：矢量与位图全内联；字体走 `https://cdn-release.modao.cc/fonts/...`，离线时只是字体退化，版式不掉。

## 页面容器索引

只列 21 个页面容器和画布名首项，完整画布清单以文件内 `data-mb-route` 为准。

| # | 页面容器 `data-mb-cid` | 画布数 | 内容（画布名） |
|---|---|---|---|
| 0 | `rbpVPQtpVPQtskrpYiMsbs` | 8 | 组织架构 / 部门选择器、人员选择器、店铺选择器、仓库选择器、供应商选择器、货号选择器、应收应付账户选择器 |
| 1 | `rbpVPQtqVPQtsljnWGrAVG` | 3 | 顶部导航条、表单-竖排布局、表单-水平布局 |
| 2 | `rbpVPQtqVPQtsmEgtgrnY8` | 20 | 组织架构选择器 2、店铺选择器（快捷筛选 / 高级筛选）、货号选择器筛选、人员选择器（搜索结果 / 已选人员）、已选部门… |
| 3 | `rbpVS4UmWLwRXBDoZ` | 5 | APP端--全局聊天--时间展示、首页--系统提示、首页--隐藏、店铺群列表、多个店铺群--非处理人 |
| 4 | `rbpVQZ7o25BP1lUHr` | 3 | APP端--店铺群（单个）、语音发送、语音取消 |
| 5 | `rbpVQZ973EfeMsvyX` | 3 | APP端--私聊--发送 / 单选 / 多选 |
| 6 | `rbpVSXmW2lYKo8jyP` | 5 | APP端--消息已读、消息未读 |
| 7 | `rbpVQZ918ayfcHaZy` | 4 | APP端--群内邀请通话（创建 / 邀请 / 完成）、内容编辑 |
| 8 | `rbpVSXpKaQ8tA2uKG` | 1 | APP端--回复 |
| 9 | `rbpVSXpLC29kmna1` | 1 | APP端--重新编辑 |
| 10 | `rbpVQZ861jAokJdnQ` | 3 | APP端--@交互（单选 / 多选 / 完成） |
| 11 | `rbpVRIObbZgd0eRGD` | 5 | APP端--多选转发、批量转发、群聊天记录 |
| 12 | `rbpVRIOcChULfD2EZ` | 26 | APP端--多群聊（创建 / 邀请 / 搜索 / 空列表）、个人详情、聊天记录查询、查看文件 |
| 13 | `rbpVQjNM1p9Ojoj2W` | 4 | APP端--群公告（定时 / 置顶） |
| 14 | `rbpVSblihdJ0p7eyK` | 5 | APP端--群公告（公告内容 / 弹窗遮罩 / 已读未读 / 公告详情） |
| 15 | `rbpVSbqJwxBSkbc8s` | 3 | APP端--群公告（新增 / 编辑 / 发布） |
| 16 | `rbpVSW4vQdzzu6HTw` | 32 | APP端--富文本、IM群聊--设置、我的收藏、默认分组 |
| 17 | `rbpVSVqyq22buzLwL` | 17 | APP端--收藏、店铺群--处理人、班次配置 |
| 18 | `rbpVRJA3LmcKT6GuC` | 17 | 聊天对话框（消息时间 / 查看成员信息 / 编辑回复 / 多选转发）+ APP端 多群聊 |
| 19 | `rbpVRJk4LBmHH0Wsq` | 6 | 聊天对话框--多选转发、逐条转发、POS机--客服弹窗、时间配置、敏感词库 |
| 20 | `rbpVS3fgC4eYiumkJ` | 28 | APP端 全量汇总：群内邀请通话、@交互、消息已读未读、私聊、多选转发 |

> 这张表是从导出文件里解析出来的**静态索引**，原型一更新就会过时。要实时目录用墨刀接口：
> `node skills/modao-prototype/modao/cli.mjs pages pb2mrkfxdjjgfkibm`。
