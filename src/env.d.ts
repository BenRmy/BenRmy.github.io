/**
 * 全局类型声明：客户端脚本挂在 window 上的跨模块状态 + 没有自带类型的第三方包。
 *
 * tsconfig 的 include 里有 "src/**"，本文件会被自动扫到。
 * 这里刻意写成「全局脚本」（顶层没有 import / export）：
 *   - `interface Window` 才能直接与 lib.dom 的 Window 合并；
 *   - `declare module 'x'` 才是环境模块声明（写成模块文件就变成「模块增强」了）。
 * 需要引用包内类型时用 import('...') 类型语法，不要写成顶层 import。
 */

/** 挂在 window 上的组件状态：换页不重建的组件每次 init 先调 cleanup() 再重新绑定 */
interface MomoCleanup {
  cleanup?(): void;
}

interface MomoThemeState {
  toastTimer?: ReturnType<typeof setTimeout>;
  mediaQuery?: MediaQueryList;
  onSystemThemeChange?: (event: MediaQueryListEvent) => void;
}

interface MomoSearchTranslations {
  placeholder: string;
  loading: string;
  error: string;
  noresult: string;
}

/** OverlayScrollbars 实例（包名里 `OverlayScrollbars` 既是静态工厂也是实例接口） */
type MomoOsInstance = import('overlayscrollbars').OverlayScrollbars;

interface Window {
  // ---- 主题切换（ThemeIcon.astro）----
  __momoTheme: MomoThemeState;

  // ---- AOS 入场动画（Layout.astro）：整个会话只 init 一次 ----
  __momoAos: { started: boolean };

  // ---- OverlayScrollbars（OverlayScrollbars.astro）：整页实例 + 内层容器实例 ----
  __momoOs?: MomoOsInstance;
  __momoOsInner?: { search?: MomoOsInstance };

  // ---- Header.astro：顶栏在 swup 容器外不重建，各子模块自己登记解绑函数 ----
  __momoMobileNav?: MomoCleanup;
  __momoMobileCategory?: MomoCleanup;
  __momoNavIndicator?: MomoCleanup;
  __momoLanguageMenu?: MomoCleanup;
  __momoHeaderScroll?: MomoCleanup;

  // ---- 其它常驻组件 ----
  __momoPhotoCover?: MomoCleanup;
  __momoFabMenu?: MomoCleanup;
  __momoSearchModal?: MomoCleanup;
  __momoSearchTranslations?: MomoSearchTranslations;
  __momoTwikoo: { loading: Promise<unknown> | null };
  __momoUmamiUrl?: string;

  // ---- Pagefind：全站唯一的索引加载入口（Header.astro 内联脚本）----
  __momoPagefindPromise?: Promise<unknown> | null;
  __momoPagefindSearch?: (query: string) => Promise<unknown>;
  __momoEnsurePagefind?: () => Promise<unknown>;
  __momoPagefindPrefetched?: boolean;
}

/** 纯副作用的字体包导入（包入口是 CSS，没有 JS 类型） */
declare module '@fontsource/eb-garamond';
declare module '@fontsource-variable/jetbrains-mono';

/** aos 没有自带类型，这里只声明本站实际用到的三个方法 */
declare module 'aos' {
  interface AosOptions {
    duration?: number;
    once?: boolean;
    [key: string]: unknown;
  }
  const AOS: {
    init(options?: AosOptions): void;
    refresh(): void;
    refreshHard(): void;
  };
  export default AOS;
}
