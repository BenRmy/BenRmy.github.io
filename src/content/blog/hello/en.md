---
title: Reopening
pubDate: 2018-08-08
description: The site has been rebuilt on a new engine, and the sample posts bundled with the template are cleared out too. Starting over from here.
category: Notes
image: ""
draft: false
slugId: hello
---

# Reopening

The old static site under this domain is gone. The skeleton was rebuilt from scratch, and the posts went with it — keeping someone else's sample articles around seemed worse than leaving it empty.

## What this is now

- **Astro** underneath, built statically, the whole site outputs plain HTML
- **Swup** for page transitions, no full page reloads
- **pagefind** for site search, the index is generated at build time, no backend
- Deployed on **GitHub Pages**, at the user-site root `https://benrmy.github.io/`
- Bilingual, separated by Astro's i18n route prefixes, with the default language unprefixed

The reason for going static is simple: no service that needs to stay alive, no database to patch, writing Markdown is enough. The trade-off is that features like search and comments — the kind that "needs a server" — have to be solved differently: search is handled with a build-time index, comments stay off for now.

## What gets written here

Mostly engineering notes: pitfalls hit while building AI applications, concrete reverse engineering cases, and conclusions I only reached by trying. There is just one test — six months from now, coming back to it, it should still be useful.

If you only want the fix for one specific problem, just search from the top bar; the index covers the whole site.
