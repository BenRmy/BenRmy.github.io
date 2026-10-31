// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from "@tailwindcss/vite";
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkDirective from 'remark-directive';
import rehypeComponents from "rehype-components";

import { admonition } from "./src/plugins/rehype-component-admonition.ts";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.ts";
import { MusicCardComponent } from "./src/plugins/rehype-component-music-card.ts";
import { GithubCardComponent } from './src/plugins/rehype-component-github-card.ts';
import { QuoteComponent } from "./src/plugins/rehype-component-quote.ts"
import { customFigurePlugin } from "./src/plugins/rehype-figure-plugin.ts";
import { rehypeLinkTarget } from "./src/plugins/rehype-link-target.ts";
import { rehypeBasePath } from "./src/plugins/rehype-base-path.ts";
import { rehypeImageCollage } from "./src/plugins/rehype-image-collage.ts";
import { remarkCombined } from './src/plugins/remark-combined.ts';
import { remarkTypst } from './src/plugins/remark-typst.ts';
import { remarkReadingTime } from './src/plugins/remark-reading-time.ts';
import { remarkLqip } from './src/plugins/remark-lqip.ts';

import svelte from "@astrojs/svelte";
import swupIntegration from '@swup/astro';

const swup =
  /** @type {(options: Omit<NonNullable<Parameters<typeof swupIntegration>[0]>, 'accessibility' | 'smoothScrolling'> & Record<string, unknown>) => import('astro').AstroIntegration} */
  (swupIntegration);

import { siteConfig, i18nConfig } from './src/config';

import expressiveCode from "astro-expressive-code";
import { ecThemeOptions } from "./ec.config.mjs";

const ecSettings = siteConfig.expressiveCode ?? {};
const ecEnabled = ecSettings.enable !== false;
const collageSettings = siteConfig.theme?.imageCollage ?? {};

// 站点部署在用户站（https://benrmy.github.io/），跑在域名根下，base 为空。
// 代码里所有链接仍然统一走 withBase()/getRelativeLocaleUrl()，换到子路径部署时
// 只需 SITE_BASE=/repo/ pnpm build，不用再改一遍源码。
const BASE_PATH = process.env.SITE_BASE ?? '/';

// https://astro.build/config
export default defineConfig({
  site: siteConfig.rootSiteUrl, // Root URL of site
  base: BASE_PATH,
  i18n: {
    locales: i18nConfig.supportedLanguages,
    defaultLocale: i18nConfig.defaultLanguage,
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  },
  integrations: [icon({
    include: {
      "fa6-brands": ["*"],
      "fa6-solid": ["*"],
      "simple-icons": ["*"],
      "vscode-icons": ["*"],
      "material-symbols": ["*"],
      "fluent": ["*"],
    }
  }), svelte(),
  swup({
    theme: false, 
    animationClass: 'transition-swup-',  // ⚠️ 不能是默认的 transition-（会命中 Tailwind 的 transition-all）
    containers: ['main#swup-container'],
    loadOnIdle: true,
    cache: true,
    preload: true,
    accessibility: {
      announcements: {
        'zh-CN': '已导航至：{title}',
        en: 'Navigated to: {title}',
        '*': 'Navigated to: {title}',
      },
    },
    updateHead: true, 
    updateBodyClass: false, 
    globalInstance: true, 
    smoothScrolling: { animateScroll: false },
    reloadScripts: true, 
    ignore: [
      /\.xml$/i, 
      /\.pdf$/i,
      /^\/cms/, 
      'a[download]',
      '[data-no-swup]',
    ],
  }),
  ...(ecEnabled ? [expressiveCode({
    ...ecThemeOptions(ecSettings),
    getBlockLocale: ({ file }) => {
      const match = /(?:^|[\\/])([a-z]{2}(?:-[a-z]{2})?)\.md$/i.exec(file?.path || '');
      if (!match) return undefined;
      const code = match[1].toLowerCase();
      return code === 'zh-cn' ? 'zh-CN' : code;
    }
  })] : [])],
  markdown: {
    ...(ecEnabled ? {} : { syntaxHighlight: false }),
    processor: unified({
      remarkPlugins: [
        remarkMath,
        remarkReadingTime,
        remarkDirective,
        remarkTypst,
        parseDirectiveNode,
        remarkCombined,
        [remarkLqip, { enable: siteConfig.theme.LQIP }],
      ],
      rehypePlugins: [
        rehypeKatex,
        customFigurePlugin,
        // [文字](url){target="_blank"}：新标签页打开 + 右上箭头图标
        rehypeLinkTarget,
        // 正文里的站内绝对路径补部署子路径（项目页挂在 /<repo>/ 下）
        [rehypeBasePath, { base: BASE_PATH }],
        [rehypeImageCollage, {
          enable: collageSettings.enable !== false,
          maxColumns: collageSettings.maxColumns ?? 4,
          publicDir: fileURLToPath(new URL('./public/', import.meta.url))
        }],
        [
          rehypeComponents,
          {
            components: {
              github: GithubCardComponent,
              music: MusicCardComponent,
              quote: QuoteComponent,
              note: admonition("note"),
              tip: admonition("tip"),
              important: admonition("important"),
              caution: admonition("caution"),
              warning: admonition("warning"),
            },
          },
        ],
      ]
    })
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // @swup/astro 在 loadOnIdle 下用动态 import() 加载这些入口，Vite 静态扫描抓不到，
      // 会在运行时补做预打包并触发整页 reload。这里预声明，启动时一次性优化完。
      include: [
        '@swup/astro/client/Swup',
        '@swup/astro/client/SwupA11yPlugin',
        '@swup/astro/client/SwupHeadPlugin',
        '@swup/astro/client/SwupPreloadPlugin',
        '@swup/astro/client/SwupScriptsPlugin',
        '@swup/astro/client/SwupScrollPlugin',
        '@swup/astro/idle',
        '@swup/astro/serialise',
      ]
    }
  }
});