# BenRmy 的博客

> 写代码，也拆代码。

线上站点：<https://benrmy.github.io>

这里放我觉得值得留档的东西：AI 应用开发中踩到的具体问题，逆向分析的案例，以及一些生活上的判断。不做教程站，只记录结论和验证过程。

## 这个站

- **Astro 7** 静态构建，整站预渲染成 HTML，没有服务端
- **swup** 接管站内跳转，不整页刷新，带悬停预取与前进/后退位置还原
- **pagefind** 在构建期生成搜索索引，站内检索不依赖任何外部服务
- **中英双语**（默认中文），canonical / hreflang / Open Graph / RSS / sitemap 齐全
- 评论默认关闭，后端未接入

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

## 主题来源与许可

站点基于 [Momo](https://github.com/Motues/Momo) 模板改造（MIT），相对上游做了这些改动：

代码沿用上游 **MIT License**（见 `LICENSE`，版权归 Momo 原作者）；站内文章采用 **CC BY-NC-SA 4.0**。

## 联系

GitHub：[@BenRmy](https://github.com/BenRmy)
