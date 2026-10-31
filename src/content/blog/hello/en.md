---
title: Reopening
pubDate: 2026-10-31
description: The site has been rebuilt on a new engine, and the bundled sample posts are gone. Starting over from here.
category: Notes
image: ""
draft: false
slugId: benrmy/hello
---

# Reopening

The old static site under this domain is gone. The skeleton was rebuilt from scratch, and the posts went with it — keeping someone else's sample articles around seemed worse than starting empty.

## What this is now

- Built with **Astro**, fully static output
- **Swup** for page transitions without full reloads
- **pagefind** for site search, with the index generated at build time — no backend
- Deployed on **GitHub Pages** at the user-site root `https://benrmy.github.io/`; pushing to `main` ships it
- Bilingual via Astro's i18n routing, with the default locale unprefixed

Static was the easy call: nothing to keep alive, no database to patch, and writing Markdown is enough. The trade-off is that features which normally need a server have to be solved differently — search became a build-time index, and comments stay off for now.

## What gets written here

Mostly engineering notes: pitfalls from AI application work, write-ups of reverse engineering cases, and conclusions I could only reach by trying. One filter applies — if I come back in six months, it should still be useful.

If you're looking for a specific fix, the search box in the header covers the whole site.

## Next

[Moving an Astro blog to GitHub Pages](/en/post/astro-github-pages/): the pitfalls that actually bit during this deploy, including a mis-set `base`, absolute paths inside post bodies, and a route that collided with the deploy prefix.
