# skills — Skill 封装

本目录是所有**可复用能力**的落点：既放纯文档形态的 Skill，也放带脚本的 Skill。
一个 Skill 一个子目录。

```
skills/
├─ README.md
├─ modao-prototype/
│  ├─ SKILL.md            # frontmatter(name, description, version) + 命令 + 踩坑 + 约束
│  └─ modao/              # 可执行脚本（零依赖 node）
├─ read-web/
│  ├─ SKILL.md
│  └─ webread/
├─ yuque-docs/
│  ├─ SKILL.md
│  └─ yuque/              # lib / auth / repos / doc (+ state.json 不入库)
└─ <未来的 skill>/
   ├─ SKILL.md
   ├─ scripts/            # 或直接一个可跑的小目录
   └─ references/         # 按需加载的参考资料
```

## 现在有哪些

| Skill | 能力 | 入口 | 凭证 |
|---|---|---|---|
| [`modao-prototype`](modao-prototype/SKILL.md) | 直连墨刀：列项目、下钻页面目录、定位画布、读文字组件、导出整页 PNG | `node skills/modao-prototype/modao/cli.mjs` | `modao/state.json`（不入库） |
| [`read-web`](read-web/SKILL.md) | 读网页：正文 / 标题层级 / 图片 / 链接，可存 markdown 或原始 HTML | `node skills/read-web/webread/read.mjs <url>` | 无（`--cookie` 传登录态） |
| [`yuque-docs`](yuque-docs/SKILL.md) | 读语雀：列知识库、列文档、取整篇 Markdown、按章节切片段 | `node skills/yuque-docs/yuque/repos.mjs` | `yuque/state.json`（不入库，只读 scope） |

两者都是零依赖 Node 脚本（node 20+），无安装步骤，不进 `node_modules`。

这是本项目**唯一**的外部能力来源：不装插件、不改 DSH profile、不挂别的 MCP。

## SKILL.md 要写什么

| 字段 / 章节 | 说明 |
|---|---|
| `name` | 唯一标识，kebab-case |
| `description` | **何时使用**（触发条件），写给模型看的，不是功能罗列 |
| `version` / `runtime` / `entry` | 版本、运行要求、入口文件 |
| 什么时候用 | 具体触发场景，一两条 |
| 命令 | 可直接复制的命令块 |
| 关键事实（踩过的坑） | 结论性的坑，一条一句，不写过程 |
| 约束 | 红线：只读 / 不重试 / 不编造 |
| 产出位置 | 写到哪、是否入库 |

## 与其它目录的分工

| 目录 | 放什么 |
|---|---|
| `skills/` | 能力本身：脚本 + 用法说明 |
| `agent/` | 角色提示词：**指挥**这些能力按固定流程干活 |
| `templates/` | HTML 外壳（`review-template.html`）+ 示例原型（`samples/`） |

> 同一件事不要在两处维护。能力细节写进 `SKILL.md`，`agent/IM_prompt.md` 只引用路径与调用顺序。

## 待补充时需明确的信息

新建 Skill 前先答这几个问题：能力边界（能做什么 / 绝对不能做什么）、输入从哪来、产出放哪、失败怎么报、凭证放哪。

> Agent 提示词形态见 [`../agent/IM_prompt.md`](../agent/IM_prompt.md)，不要在本目录下重复维护同一份内容。
