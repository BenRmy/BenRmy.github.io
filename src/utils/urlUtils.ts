import { i18n } from "astro:config/client";
import { i18nConfig } from "@/config";

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}
/**
 * 给站内绝对路径补上部署子路径（`import.meta.env.BASE_URL`）。
 * GitHub Pages 项目页跑在 `/<repo>/` 下，`/foo` 这种裸绝对路径会 404。
 * 已经带前缀的路径原样返回，避免出现 `/blog/blog/...`（重复补前缀）。
 */
export function withBase(path: string): string {
	const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') // 根路径时为 ''
	const p = path.startsWith('/') ? path : `/${path}`
	if (!base) return p
	if (p === base || p.startsWith(`${base}/`)) return p
	return base + p
}

/**
 * 去掉部署子路径：`/blog/post/x/` -> `/post/x/`（页面部署在域名根时原样返回）。
 * 反过来算子路径时（语言前缀、当前路径比较）必须先过这一层，
 * 否则会把 base 当成路径的一部分，拼出 `/blog/en/blog/...` 这种地址。
 */
export function stripBase(path: string): string {
	const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
	const p = path.startsWith('/') ? path : `/${path}`;
	if (!base) return p;
	if (p === base) return '/';
	if (p.startsWith(`${base}/`)) return p.slice(base.length);
	return p;
}

/**
 * 构建完整的URL路径
 * @param path - 需要拼接的路径片段
 * @returns 返回拼接后的完整URL路径
 */
export function baseUrl(path: string) {
	return joinUrl("", import.meta.env.BASE_URL, path);
}

/**
 * 文章目录内可用的图片。只取 key 做存在性判断，不真正加载模块。
 * 扁平文章（`src/content/blog/foo.md`）没有自己的目录，写相对封面必然找不到文件，
 * 这里直接返回空串，免得 <Image> 去 import 不存在的路径、控制台刷 ERROR。
 */
const contentImageKeys = new Set(
	Object.keys(
		import.meta.glob("/src/content/blog/**/*.{png,jpg,jpeg,webp,avif,gif}", {
			eager: false,
			caseSensitive: false,
		})
	)
);

/**
 * 将相对于content/blog目录的路径转换为相对于src目录的路径
 * @param contentPath 相对于content/blog目录的路径
 * @param blogName 博客文章的名称/ID，用于构建完整路径
 * @returns 相对于src目录的路径
 */
export function blogCoverUrl(contentPath: string, blogName: string): string {

    if (!contentPath) return '';

    // 外链与 public 资源原样返回（public 路径由 <ImageModule> 补 BASE_URL）
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(contentPath) || contentPath.startsWith('//')) {
        return contentPath;
    }
    if (contentPath.startsWith('/')) {
        return contentPath;
    }

    // 相对路径：图片必须和 markdown 放在同一个文章目录里
    const file = contentPath.replace(/^\.\//, '');
    const key = `/src/content/blog/${blogName}/${file}`;
    if (!contentImageKeys.has(key)) return '';

    return joinUrl("content/blog/", blogName, file)
}

export function getRelativeLocaleUrl(lang: string, path: string) : string { 
    // routing 可能是 'manual'（无前缀配置），此时按“不给默认语言加前缀”处理
    const prefixDefaultLocale = typeof i18n?.routing === "object" ? i18n.routing.prefixDefaultLocale : false;
    const defaultLocale = i18n?.defaultLocale ?? i18nConfig.defaultLanguage;
    // 站内链接一律经 withBase 补部署子路径：调用方只关心语言前缀，不关心站点挂在哪一层
    if(prefixDefaultLocale) {
        return withBase(joinUrl("/", lang, path));
    }else {
        if(lang === defaultLocale) return withBase(joinUrl("/", path));
        return withBase(joinUrl("/", lang, path));
    }
}