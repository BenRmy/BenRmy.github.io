# BenRmy 的博客

> 写代码，也拆代码。

线上站点：<https://benrmy.github.io> · 本仓库即站点源码（`BenRmy/BenRmy.github.io`）

这里放我觉得值得留档的东西：AI 应用开发中踩到的具体问题（Copilot Studio 智能体、对话流与自动化），逆向分析的案例（Rizin 静态分析、Frida 动态插桩），以及一些工程上的判断。不做教程站，只记录结论和验证过程。

## 这个站

- **Astro 7** 静态构建，整站预渲染成 HTML，没有服务端
- **swup** 接管站内跳转，不整页刷新，带悬停预取与前进/后退位置还原
- **pagefind** 在构建期生成搜索索引，站内检索不依赖任何外部服务
- **中英双语**（默认中文），canonical / hreflang / Open Graph / RSS / sitemap 齐全
- 托管在 **GitHub Pages**，推 `main` 即自动构建发布
- 评论默认关闭，后端未接入

## 内容结构

一个目录一篇文章，每种语言一个文件：

```
src/content/blog/<slug>/
├── zh-cn.md
└── en.md
```

文章 frontmatter 示例：

```yaml
---
title: 重新开张
pubDate: 2026-10-31
description: 站点换了一套引擎重建，从这里重新开始。
category: 随笔
image: ""
draft: false
slugId: benrmy/hello
---
```

独立页面（关于、友链）走同一套约定：`src/content/spec/{about,friends}/{zh-cn,en}.md`。

## 本地开发

环境要求：Node.js **>= 22**（CI 用 24 LTS），包管理 [pnpm](https://pnpm.io/)。

```bash
git clone https://github.com/BenRmy/BenRmy.github.io.git
cd BenRmy.github.io
pnpm install
pnpm dev        # http://localhost:4321
```

常用指令：

| 指令 | 作用 |
| --- | --- |
| `pnpm dev` | 本地开发服务器，`http://localhost:4321` |
| `pnpm build` | 构建到 `dist/`，并生成 pagefind 搜索索引 |
| `pnpm preview` | 预览构建结果 |
| `pnpm cms` | 本地 CMS 后台，`http://localhost:5188`，可视化写文章 |
| `pnpm momo new <path>` | 命令行新建文章，如 `pnpm momo new docs/test` |

注意：`pnpm build` 实际执行 `astro build && pagefind --site dist`。搜索索引是构建产物，`pnpm dev` 下没有索引，站内搜索要在 `pnpm build && pnpm preview` 之后才可用。

## 部署

`.github/workflows/deploy.yml`：推 `main` → `pnpm install` → `pnpm build` → 上传 `dist` → `deploy-pages`。

仓库 Settings → Pages 的 Source 选 **GitHub Actions**，不使用 `gh-pages` 分支，所以 `dist/` 不入库。

这是用户站（`BenRmy/BenRmy.github.io`），根路径部署，`base` 为 `/`。若以后要搬回项目页的子路径，构建时给 `SITE_BASE=/blog` 即可：`astro.config.mjs` 会读它，`rehype-base-path` 插件负责给正文里的 `/post/...`、`/images/...` 这类绝对链接补前缀。

## 目录

```
src/
├── config.ts          # 站点信息、主题开关、i18n 文案、友链
├── content/           # 文章与独立页面（Markdown）
├── components/        # 组件，含搜索、目录、PostCard 等
├── layouts/           # Layout 与文章布局
├── pages/             # 路由：首页 / post / archives / about / friends
├── plugins/           # rehype 插件（base 前缀、链接 target）
├── i18n/              # 多语言词条
├── styles/            # 全局样式
└── utils/             # 工具函数
public/                # favicon、封面等静态资源
cms/                   # 本地 CMS 管理后台
script/momo/           # momo 命令行工具
```

## 主题来源与许可

站点基于 [Momo](https://github.com/Motues/Momo) 模板改造（MIT），相对上游做了这些改动：

- 品牌、头像、文案与站点配置换成自己的，清空模板示例文章
- 文章路由 `/blog/<id>` 改为 `/post/<id>`，避免与日志页 `/blog` 同名
- 适配根路径部署：`base` 前缀由 rehype 插件在正文层补齐，并清理 favicon / RSS / sitemap 的硬编码路径
- 重写搜索加载链路：统一入口 + 串行队列，去掉会阻塞的 `init()` 与预取
- 关闭 umami 统计（未配置即不请求）与评论

代码沿用上游 **MIT License**（见 `LICENSE`，版权归 Momo 原作者）；站内文章采用 **CC BY-NC-SA 4.0**。

## 联系

GitHub：[@BenRmy](https://github.com/BenRmy)
