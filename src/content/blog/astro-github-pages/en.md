---
title: Moving an Astro blog to GitHub Pages
pubDate: 2026-10-31
description: From a project page to a user site — notes on base paths, absolute links, search indexes and a route that collided with the deploy prefix.
category: Engineering
image: ""
draft: false
slugId: benrmy/astro-github-pages
---

# Moving an Astro blog to GitHub Pages

GitHub Pages has two flavors, and picking the wrong one costs you downstream:

| Type | Repo name | URL | Astro `base` |
| --- | --- | --- | --- |
| Project page | anything, e.g. `blog` | `https://<user>.github.io/blog/` | `/blog/` |
| User site | must be `<user>.github.io` | `https://<user>.github.io/` | `/` |

A project page works immediately, but a single internal link missing the prefix is a 404 in production. In the end I renamed the repo to `<user>.github.io`, moved to the root, and set `base` to nothing — which removed that entire class of bugs.

## 1. `base` only covers what it can see

With `base: '/blog/'`, Astro rewrites:

- bundled assets (`/_astro/xxx.js`)
- anything built from `import.meta.env.BASE_URL`
- paths produced by `getStaticPaths`

It does **not** touch absolute paths written by hand inside Markdown:

```md
Read [this post](/post/astro-github-pages/) for details.
![screenshot](/images/foo.png)
```

Both still point at the domain root after building. On a project page they're dead links; on the root they happen to be correct.

So if you do need a sub-path, patch it in the rehype stage:

```ts
// Only internal absolute paths; skip external, anchors, queries and already-prefixed ones
function needsBase(value: string, base: string) {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false; // protocol-relative
  if (value === base || value.startsWith(`${base}/`)) return false;
  return true;
}
```

## 2. `pathname` already contains `base`

Language switching is where this bites. The naive version strips the current locale prefix and prepends the target one:

```ts
// Wrong: Astro.url.pathname is /blog/en/post/x/,
// stripping "en" leaves /blog/post/x/, and prepending gives /blog/en/blog/post/x/
const rest = pathname.replace(`/${currentLang}`, '');
return `/${targetLocale}${rest}`;
```

The path already carries the deploy prefix, and the join helper adds it again. Strip the two prefixes separately:

```ts
const rest = stripBase(pathname);   // /blog/en/post/x/ -> /en/post/x/
const noLocale = stripLocale(rest); // /en/post/x/       -> /post/x/
return withBase(`/${targetLocale}${noLocale}`);
```

Same on the client: `window.location.pathname` carries the prefix too. Note that **comparing `href` needs the prefixed value while building links needs the stripped one** — keep two variables, don't mix them.

## 3. pagefind keeps its prefix in a yml file

pagefind writes each page's actual path into the index, so a sub-path deploy needs to be told:

```bash
# 1.5.x has no --base-url flag; it's silently treated as an unknown argument
npx pagefind --site dist
```

The setting lives in `pagefind.yml`:

```yaml
base_url: /blog/
```

Missing it looks confusing: search returns results, but clicking one 404s, because the indexed URLs are bare paths.

## 4. Don't name a route after the deploy prefix

This is the nastiest one. The post route used to be `/blog/<id>/` while the deploy prefix was also `/blog/`:

```ts
// Trying to detect "already prefixed" — and it can never be right
const hasBase = path.startsWith('/blog/'); // is /blog/memory/ prefixed?
```

At the string level there is no way to tell. Symptoms: post card links sometimes lose the prefix, and the language menu occasionally builds `/blog/en/en/...`. I sidestepped it by moving post routes to `/post/<id>/`.

The collision disappeared once the site moved to the root, but I kept `/post/` — it reads as "an article", and it leaves no landmine for a future sub-path deploy.

## 5. Don't smoke-test with `networkidle`

Verifying the live site with Playwright, `wait_until="networkidle"` times out consistently on GitHub Pages:

```python
# Hangs: Pages keeps long-lived connections, so the network is never fully idle
await page.goto(url, wait_until="networkidle")
```

Use `load` or `domcontentloaded` plus an explicit wait:

```python
await page.goto(url, wait_until="load", timeout=60000)
await page.wait_for_timeout(2000)
```

And don't judge by screenshots alone — attach a response listener so no 4xx/5xx slips through:

```python
page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)
```

## The deploy itself is the easy part

Set Pages Source to **GitHub Actions** and use the bundled workflow:

```yaml
- run: pnpm install && pnpm build
- uses: actions/upload-pages-artifact@v3
  with:
    path: 'dist'
- uses: actions/deploy-pages@v4
```

Two easily missed permissions: `pages: write` and `id-token: write`. Without `id-token`, the deploy step fails with an OIDC error that doesn't look like a permissions problem at all.

## Takeaways

- Prefer a user site over a project page; dropping `base` removes a whole class of prefix bugs
- On a sub-path, absolute links in post bodies need patching yourself — Astro won't
- `pathname` includes the prefix; strip and join separately, never in one helper
- Index prefixes go in `pagefind.yml`, not on the command line
- Never let a route share a name with the deploy prefix
