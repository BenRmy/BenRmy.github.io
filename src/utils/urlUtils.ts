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
 * 将相对于content/blog目录的路径转换为相对于src目录的路径
 * @param contentPath 相对于content/blog目录的路径
 * @param blogName 博客文章的名称/ID，用于构建完整路径
 * @returns 相对于src目录的路径
 */
export function blogCoverUrl(contentPath: string, blogName: string): string {

    if (!contentPath) return '';
    
    if (contentPath.startsWith('http')) {
        return contentPath;
    }

    // 处理相对路径 ./ 开头的情况
    if (contentPath.startsWith('./')) {
        contentPath = contentPath.substring(2);
    }
    
    // 移除可能的前导斜杠
    const normalizedPath = contentPath.startsWith('/') ? contentPath.slice(1) : contentPath;
    
    // 构造相对于src目录的路径，包含博客名称文件夹
    return joinUrl("content/blog/", blogName, normalizedPath)
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