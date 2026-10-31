<script>
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import HashtagIcon from './misc/HashtagIcon.svelte';
  import i18nit from '@i18n/translation';
  import { formatMonthDay } from '@/utils/time'
  import { getRelativeLocaleUrl } from '@utils/urlUtils';

  export let sortedPosts = [];
  export let currentLang = "zh-cn";
  export let defaultLocale = "zh-cn";

  let selectedCategories = [];
  const t = i18nit(currentLang);

  // 响应式过滤逻辑 - 特殊处理 undefined 情况
  $: filteredPosts = selectedCategories.length > 0
    ? sortedPosts.filter(post => {
        const postCat = post.data.category || 'undefined';
        return selectedCategories.includes(postCat);
      })
    : sortedPosts;

  // 按年份分组逻辑
  $: postsByYear = filteredPosts.reduce((acc, post) => {
    const year = new Date(post.data.pubDate).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(post);
    return acc;
  }, {});

  $: years = Object.keys(postsByYear).sort((a, b) => b - a);

  onMount(() => {
    // 获取初始 URL 参数 - 特殊处理 undefined
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    
    // 当参数为 'undefined' 时，专门用于显示未分类文章
    if (categoryParam === 'undefined') {
      selectedCategories = ['undefined'];
    } else if (categoryParam && categoryParam !== 'null') {
      selectedCategories = categoryParam.split(',');
    }

    // 处理浏览器前进/后退
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      selectedCategories = params.get('category')?.split(',') || [];
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
        window.removeEventListener('popstate', handlePopState);
    }
  });

</script>

<div class="archives mx-auto w-full max-w-[var(--page-width)]">
    <div class="text-center pt-5 pb-10 max-w-[var(--page-width)] mx-auto md:mt-0 mt-28">
        <h1 class="text-[var(--text-color)] text-3xl py-5 font-bold">{t("header.archive")}</h1>
        <p class="text-[var(--text-color-70)] font-bold">{t("cover.subTitle.archive", {count: filteredPosts.length})}</p>
    </div>

    <div class="py-6 mx-auto text-[var(--text-color)]" id="archive-content">
        {#each years as year (year)}
            <div class="mb-8">
                <h2 class="text-2xl font-bold my-4 text-[var(--text-color)] flex items-center gap-3">
                    <span class="w-1 h-6 bg-[var(--link-color)] rounded-full"></span>
                    {year}
                </h2>
                <div class="space-y-2">
                    {#each postsByYear[year] as post (post.id)}
                        <div animate:flip={{ duration: 380, easing: cubicOut }} in:fade={{ duration: 180, easing: cubicOut }} out:fade={{ duration: 150 }} >
                            <a 
                                href={getRelativeLocaleUrl(currentLang, `/post/${post.id}`)} 
                                class="flex items-center gap-4 active:bg-[var(--button-hover-color)] hover:bg-[var(--button-hover-color)] p-2 rounded transition-colors duration-200 group"
                            >
                                <span class="text-[var(--text-color-70)] min-w-[80px] md:min-w-[120px]">
                                    {formatMonthDay(post.data.pubDate, currentLang)}
                                </span>
                                
                                <span class="text-lg group-hover:pl-2 group-hover:text-[var(--link-color)] group-hover:font-bold transition-[padding-left,color,font-weight] duration-200 flex-1 group-active:text-[var(--link-color)]">
                                    {post.data.title}
                                    {#if post.isFallback}
                                        <span class="inline-block px-1 ml-2 text-xs font-mono uppercase bg-[var(--button-hover-color)] rounded border border-[var(--button-border-color)]">
                                            {defaultLocale}
                                        </span>
                                    {/if}
                                </span>

                                <span class="hidden md:flex items-center font-mono text-sm text-[var(--text-color-70)]">
                                    <HashtagIcon class="mr-1" />
                                    {post.data.category || t("pagecard.uncategorized")}
                                </span>
                            </a>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>
