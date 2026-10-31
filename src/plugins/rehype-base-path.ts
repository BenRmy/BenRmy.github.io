/**
 * 给 Markdown 正文里的站内绝对路径补上部署子路径。
 *
 * GitHub Pages 项目页跑在 `https://<user>.github.io/<repo>/` 下，而 Markdown 里
 * 手写的 `[链接](/blog/foo/)`、`![图](/images/a.png)` 是裸绝对路径，构建后直接
 * 指向域名根，线上 404。Astro 只对 `import.meta.env.BASE_URL` 与打包资源负责，
 * 正文里的字符串它管不到，所以在这里统一补前缀。
 *
 * 注意这里**不做**「已带前缀就跳过」的判断：站内路由本身就有一个 `/blog/` 段
 * （文章页是 `/blog/<id>/`），与部署前缀同名，靠字符串无法区分。
 * 正文里的路径按约定一律是「站点内部路径」，统一补前缀才是对的。
 *
 * 不改动的目标：外链（含协议 / 协议相对）、锚点、查询串。
 */
import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';

export interface Options {
    /** 部署子路径，与 astro.config 的 base 保持一致（如 `/blog/`） */
    base?: string;
}

/** 需要补前缀的属性：链接、图片、媒体 */
const URL_ATTRS = ['href', 'src', 'poster'] as const;

function needsBase(value: string): boolean {
    if (!value.startsWith('/')) return false;
    if (value.startsWith('//')) return false; // 协议相对外链
    return true;
}

export function rehypeBasePath(options: Options = {}) {
    const base = (options.base || '/').replace(/\/+$/, '');
    return (tree: Root) => {
        if (!base) return; // 部署在域名根，什么都不用做
        visit(tree, 'element', (node: Element) => {
            const props = node.properties as Record<string, unknown>;
            for (const key of URL_ATTRS) {
                const value = props[key];
                if (typeof value === 'string' && needsBase(value)) {
                    props[key] = base + value;
                }
            }
        });
    };
}
