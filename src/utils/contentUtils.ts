import { getCollection, getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { i18n } from "astro:config/client";
import { i18nConfig } from "@/config";

/**
 * 获取排序后的博客条目
 * @param filter 过滤函数，可选，默认过滤掉生产环境中的草稿文章
 * @param sort 排序函数，可选，默认按发布日期降序排列
 * @returns 排序后的博客条目数组
 */
// 1. 定义一个扩展类型，包含 fallback 状态
export type BlogEntryWithLocaleStatus = CollectionEntry<'blog'> & {
  isFallback?: boolean;
};

/** 站点支持的语言代码（`i18n.locales` 可能是字符串或 { path } 对象） */
const supportedLocales = (i18n?.locales ?? i18nConfig.supportedLanguages).map((l) =>
  typeof l === 'string' ? l : l.path
)

/**
 * 把 content collection 的原始 id（相对 `src/content/blog`、带 `.md` 后缀）拆成
 * 「逻辑文章 id + 语言」。三种合法写法：
 *
 *   hello/zh-cn.md  -> { id: 'hello',      language: 'zh-cn' }   // 目录形式，最后一段是语言
 *   flat-note.md    -> { id: 'flat-note',  language: 默认语言 }   // 扁平形式，文件名即 id
 *   2026/10-31.md   -> { id: '2026/10-31', language: 默认语言 }   // 目录 + 非语言文件名
 *
 * 旧实现把最后一段无条件当语言文件名，扁平文件因此算出空 id、语言变成文件名，
 * 随后被语言分组整体丢弃（不报错、页面也不生成）。这里改为按「是否命中语言列表」判定。
 */
export function parseEntryId(rawId: string, defaultLanguage: string): { id: string; language: string } {
  const withoutExt = rawId.replace(/\.md$/, '')
  const parts = withoutExt.split('/')
  const last = parts[parts.length - 1]

  if (parts.length > 1 && supportedLocales.includes(last)) {
    return { id: parts.slice(0, -1).join('/'), language: last }
  }
  return { id: withoutExt, language: defaultLanguage }
}

export async function getBlogEntrySort(
  lang?: string,
  filter?: (entry: CollectionEntry<'blog'>) => boolean | undefined,
  sort?: (a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => number
): Promise<BlogEntryWithLocaleStatus[]> { // 修改返回类型
  
  const defaultFilter = ({ data }: CollectionEntry<'blog'>) => {
    return import.meta.env.PROD ? data.draft !== true : true;
  };

  const defaultSort = (a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => {
    return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
  };

  const blogEntries = await getCollection('blog', filter || defaultFilter);

  const grouped = new Map<string, Record<string, CollectionEntry<'blog'>>>();
  const defaultLanguage = i18n?.defaultLocale ?? i18nConfig.defaultLanguage;

  for (const post of blogEntries) {
    const { id: pathId, language } = parseEntryId(post.id, defaultLanguage);
    // URL 优先取 frontmatter 的 slugId；没有该元数据时才回退到文件路径算出的 id
    const id = post.data.slugId ?? pathId;

    if (!grouped.has(id)) {
      grouped.set(id, {});
    }
    grouped.get(id)![language] = post;
  }

  const selectedEntries: BlogEntryWithLocaleStatus[] = [];
  
  for (const [id, translations] of grouped.entries()) {
    let selectedPost: CollectionEntry<'blog'> | undefined;
    let isFallback = false; // 默认为 false
    
    if (lang && lang !== defaultLanguage) {
      if (translations[lang]) {
        selectedPost = translations[lang];
      } else if (translations[defaultLanguage]) {
        // --- 关键修改点：触发回退逻辑 ---
        selectedPost = translations[defaultLanguage];
        isFallback = true; 
      }
    } else {
      if (translations[defaultLanguage]) {
        selectedPost = translations[defaultLanguage];
      }
    }
    
    if (selectedPost) {
      selectedEntries.push({
        ...selectedPost,
        id: id,
        isFallback: isFallback // 将状态注入对象
      });
    }
  }

  return selectedEntries.sort(sort || defaultSort);
}

export async function getSpec(
    lang: string,
    spec: string
) {
    const defaultLanguage = i18n?.defaultLocale ?? i18nConfig.defaultLanguage;
    let collection = await getEntry('spec', `${spec}/${lang}`)
    if(!collection) collection = await getEntry('spec', `${spec}/${defaultLanguage}`);
    return collection;
}