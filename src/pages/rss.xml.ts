import rss from "@astrojs/rss";
import { getBlogEntrySort } from "../utils/contentUtils"
import { i18nConfig, profileConfig } from '../config';
import { getSiteTitle } from "../utils/siteTitle";
import { absoluteUrl } from "../utils/seo";
import { baseUrl } from "../utils/urlUtils";
import type { APIContext } from "astro";

export async function GET(_context: APIContext) {
    const blog = await getBlogEntrySort(i18nConfig.defaultLanguage);
    return rss({
        title: getSiteTitle(),
        description: profileConfig.description,
        // site 必须带上部署子路径（项目页为 /blog/），否则条目里的绝对地址会掉一层
        site: absoluteUrl('/'),
        // 订阅源只包含默认语言的文章，显式声明语言便于阅读器正确处理
        customData: `<language>${i18nConfig.defaultLanguage}</language>`,
        items: blog.slice(0, 20).map((post) => ({
            title: post.data.title,
            pubDate: post.data.pubDate,
            description: post.data.description,
            categories: post.data.category ? [post.data.category] : undefined,
            link: baseUrl(`/post/${post.id}/`),
        })),
    })
}