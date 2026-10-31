---
title: 把 Astro 博客迁到 GitHub Pages
pubDate: 2026-10-31
description: 从项目页搬到用户站，踩了 base、绝对路径、搜索索引和路由同名几个坑，记下来。
category: 技术
image: ""
draft: false
slugId: benrmy/astro-github-pages
---

# 把 Astro 博客迁到 GitHub Pages

静态站部署到 GitHub Pages 有两副面孔，选错一个后面全是麻烦：

| 类型 | 仓库名 | 地址 | Astro `base` |
| --- | --- | --- | --- |
| 项目页 | 任意，如 `blog` | `https://<user>.github.io/blog/` | `/blog/` |
| 用户站 | 必须是 `<user>.github.io` | `https://<user>.github.io/` | `/` |

先落在项目页能马上跑起来，但只要站内有一条链接漏了前缀，线上就是一个 404。最后我把仓库改名成 `<user>.github.io` 搬到根路径，`base` 归零，一整类问题直接消失。

## 一、`base` 只管它自己管得到的地方

设了 `base: '/blog/'` 之后，Astro 会自动处理：

- 打包后的静态资源（`/_astro/xxx.js`）
- `import.meta.env.BASE_URL`，只要你的链接是用它拼的
- `getStaticPaths` 生成的页面路径

它**不会**处理 Markdown 正文里手写的绝对路径：

```md
看[这篇文章](/post/astro-github-pages/)的说明。
![截图](/images/foo.png)
```

这两条构建后仍然指向域名根。项目页部署时，它们是死链；根路径部署时，它们恰好是对的。

所以如果非要挂在子路径，得在 rehype 阶段补一刀：

```ts
// 只改站内绝对路径，外链 / 锚点 / 查询串 / 已带前缀的都放过
function needsBase(value: string, base: string) {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false; // 协议相对
  if (value === base || value.startsWith(`${base}/`)) return false;
  return true;
}
```

## 二、`pathname` 里已经有 `base` 了

语言切换最容易翻车。常见的写法是先剥掉当前语言前缀，再拼目标语言前缀：

```ts
// 错：Astro.url.pathname 是 /blog/en/post/x/，
// 剥掉 en 之后是 /blog/post/x/，再拼 en 就变成 /blog/en/blog/post/x/
const rest = pathname.replace(`/${currentLang}`, '');
return `/${targetLocale}${rest}`;
```

原因是 `pathname` 已经含部署前缀，而拼接函数又补了一次。修法是把「部署前缀」和「语言前缀」分成两次独立的剥离：

```ts
const rest = stripBase(pathname);   // /blog/en/post/x/ -> /en/post/x/
const noLocale = stripLocale(rest); // /en/post/x/       -> /post/x/
return withBase(`/${targetLocale}${noLocale}`);
```

浏览器侧同理，`window.location.pathname` 同样带着前缀。要注意的是，**比较 `href` 时要用带前缀的原值，拼链接时用剥干净的值**——两套变量，别混用。

## 三、pagefind 的前缀配置藏在 yml 里

pagefind 生成搜索索引时，会把页面的实际路径写进索引。部署在子路径下就得告诉它前缀：

```bash
# 1.5.x 没有 --base-url 参数，写了会被当成未知参数忽略
npx pagefind --site dist
```

配置只能落在 `pagefind.yml`：

```yaml
base_url: /blog/
```

漏了这一步的表现很有迷惑性：搜索能出结果，但点进去 404——因为结果里的链接是索引里存的裸路径。

## 四、路由名不要和部署前缀撞车

这条是最阴的。原本文章路由是 `/blog/<id>/`，部署前缀也叫 `/blog/`，于是：

```ts
// 想判断「这个路径是不是已经带前缀了」，结果永远判断不准
const hasBase = path.startsWith('/blog/'); // /blog/memory/ 算不算带前缀？
```

字符串层面无法区分。表现是文章卡片的链接时有时无前缀，语言菜单偶尔拼出 `/blog/en/en/...`。当时我把文章路由整体挪到了 `/post/<id>/` 避开同名。

搬到根路径后这个冲突自然消失，但 `/post/` 我留着了——它比 `/blog/` 更能说明「这是一篇文章」，也不给未来的子路径部署留雷。

## 五、冒烟测试别用 `networkidle`

用 Playwright 验收线上站时，`wait_until="networkidle"` 在 GitHub Pages 上会稳定超时：

```python
# 会挂：Pages 侧存在长连接，网络永远不会"完全空闲"
await page.goto(url, wait_until="networkidle")
```

改成 `load` 或 `domcontentloaded`，再加一个显式等待就行：

```python
await page.goto(url, wait_until="load", timeout=60000)
await page.wait_for_timeout(2000)
```

排查时也别只看截图。加一层响应监听，4xx/5xx 一个都跑不掉：

```python
page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)
```

## 部署本身反而最简单

Pages 的 Source 选 **GitHub Actions**，仓库自带的 workflow 就够了，核心三步：

```yaml
- run: pnpm install && pnpm build
- uses: actions/upload-pages-artifact@v3
  with:
    path: 'dist'
- uses: actions/deploy-pages@v4
```

两个容易忽略的权限：`pages: write` 和 `id-token: write`。少了 `id-token`，deploy 步骤会报 OIDC 相关的错，看起来完全不像权限问题。

## 小结

- 能用用户站就别用项目页，`base` 归零能省掉一整类前缀问题
- 真要挂子路径，正文里的绝对路径得自己补，Astro 不管
- `pathname` 含前缀，剥和拼要分开做，别在一个函数里连剥带拼
- 搜索索引的前缀配置在 `pagefind.yml`，不在命令行
- 路由别和部署前缀同名
