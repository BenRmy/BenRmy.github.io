# BenRmy 的博客

> 写代码，也拆代码。

线上站点：<https://benrmy.github.io>

这里放我觉得值得留档的东西：AI 应用开发中踩到的具体问题，逆向分析的案例，以及一些生活上的判断。不做教程站，只记录结论和验证过程。

## 这个站

- **Astro 7** 静态构建，整站预渲染成 HTML，没有服务端
- **swup** 接管站内跳转，不整页刷新，带悬停预取与前进/后退位置还原
- **pagefind** 在构建期生成搜索索引，站内检索不依赖任何外部服务
- **中英双语**（默认中文），canonical / hreflang / Open Graph / RSS / sitemap 齐全
- 双语文章在目录中，也支持单 md 博客文件解析
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
| `pnpm momo new <path>` | 命令行新建文章，`foo.md` 建扁平单文件、`foo` 建目录，如 `pnpm momo new notes/foo.md` |

注意：`pnpm build` 实际执行 `astro build && pagefind --site dist`。搜索索引是构建产物，`pnpm dev` 下没有索引，站内搜索要在 `pnpm build && pnpm preview` 之后才可用。

## 写文章

两种写法，按需选：

| 写法 | 文件位置 | 生成的 URL | 配图 |
| --- | --- | --- | --- |
| 扁平（一篇一个 md） | `src/content/blog/foo.md` | `/post/foo/` | 放 `public/`，正文写 `/images/x.jpg` |
| 目录（要中英双语或自带图床） | `src/content/blog/foo/zh-cn.md` | `/post/foo/` | 与 md 同目录，正文写 `./x.jpg` |

```bash
pnpm momo new foo.md --title "标题" --category 技术   # 扁平，只建一个 md
pnpm momo new foo --title "标题"                     # 目录，多语言用这个
```

- frontmatter 必填 `title`、`pubDate`、`slugId`，其余可选；`slugId` 是评论用的稳定标识，别随手改
- `draft: true` 在生产构建里整篇不生成，只有 `pnpm dev` 能看到
- 只写 `zh-cn.md` 时，`/en/` 会自动回退到中文并标注「暂无翻译」

## 部署

`.github/workflows/deploy.yml`：推 `main` → `pnpm install` → `pnpm build` → 上传 `dist` → `deploy-pages`。

仓库 Settings → Pages 的 Source 选 **GitHub Actions**，不使用 `gh-pages` 分支，所以 `dist/` 不入库。

## 主题来源与许可

站点基于 [Momo](https://github.com/Motues/Momo) 模板改造（MIT），相对上游做了这些改动：

- 品牌、头像、文案与站点配置换成自己的，清空模板示例文章
- 文章路由 `/blog/<id>` 改为 `/post/<id>`，避免与归档页 `/blog` 同名
- **支持扁平单文件文章**：`src/content/blog/foo.md` 直接渲染为 `/post/foo/`，不必为每篇单独建目录（上游只认 `<目录>/<语言>.md`，扁平文件会被静默丢弃；CMS 与 `pnpm momo new` 同步支持）
- 适配根路径部署：`base` 前缀由 rehype 插件在正文层补齐
- 重写搜索加载链路：统一入口 + 串行队列，去掉会阻塞的 `init()` 与预取
- 关闭 umami 统计与评论

代码沿用上游 **MIT License**（见 `LICENSE`，版权归 Momo 原作者）；站内文章采用 **CC BY-NC-SA 4.0**。

## 联系

GitHub：[@BenRmy](https://github.com/BenRmy)
