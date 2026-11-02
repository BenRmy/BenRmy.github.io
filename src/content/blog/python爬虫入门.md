---
title: Python 爬虫入门
pubDate: 2018-08-10
description: 代码只有四步。
category: 编程技术
image: ""
draft: false
slugId: python-crawler-guide
---

# Python 爬虫入门

爬虫的代码量少得让人心虚。一个能跑的采集脚本，去掉注释不超过五十行，四步就完事。

```python
import httpx

def fetch(url: str) -> str:
    resp = httpx.get(url, timeout=10, follow_redirects=True)
    resp.raise_for_status()
    return resp.text

def parse(html: str) -> list[str]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    return [a.get_text(strip=True) for a in soup.select("h2 > a")]

def save(rows: list[str], path: str = "out.txt") -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write("\n".join(rows) + "\n")

if __name__ == "__main__":
    save(parse(fetch("http://quotes.toscrape.com/")))
```

四步就是发起请求、拿到响应、解析内容、存下来。所有教程都这么分，分完那一页就翻过去了。真正耗时间的东西在后面，403、抓回来是空白、跑两天 IP 进黑名单。

上面那段代码有两个细节值得先说。`follow_redirects=True` 得自己加，httpx 默认不跟随 301 和 302，requests 默认跟随，这两家行为不一样，从 requests 换过来的第一个坑就在这。`raise_for_status()` 也得自己加，4xx 和 5xx 的响应体不是空的，是一段错误页面，你不检查，它就会混进解析逻辑，报出一个看不出原因的 AttributeError。

## 状态码表

301 是 Moved Permanently，永久。302 是 Found，临时。HTTP/1.0 里 302 原本就叫 Moved Temporarily，字面就是临时，跟 301 对着来的。

| 码  | 含义                           | 抓到之后怎么办                                              |
| --- | ------------------------------ | ----------------------------------------------------------- |
| 200 | 正常                           | 继续解析                                                    |
| 301 | 永久转移，新地址在 Location 头 | 把新地址记下来，下次直接请求，不然每次都多一跳              |
| 302 | 临时转移                       | 跟过去就行，别改你的 URL 表                                 |
| 304 | 内容没变                       | 说明你带了 If-None-Match 或 If-Modified-Since，响应体是空的 |
| 403 | 拒绝服务                       | 八成是 UA、cookie 或 IP 的问题，看第六节                    |
| 429 | 请求太快                       | 尊重 Retry-After，它写几秒就等几秒                          |
| 503 | 暂时不可用                     | 服务端在限流或者维护，退避重试                              |

304 有个反直觉的地方。它不带响应体，`resp.text` 是空字符串。你如果没做过条件请求，压根遇不到它。一旦为了省流量加上缓存头，代码就得能处理空响应，否则第一次命中 304 就写进去一条空记录。

## 抓回来是空的，先分这两种情况

`resp.text` 里搜不到你要的字，原因通常就两个，且分起来很快。

打开开发者工具切到 Network，刷新页面，看 XHR 或者 Fetch 那一栏。数据在一个 json 响应里，说明页面 HTML 是个空壳，内容是 JS 加载完再请求的。这时候别去解析 HTML，照着那个请求发一次，把 Request Headers 和 Payload 抄过来就行。大部分所谓难爬的站，到这一步就通了。

XHR 里什么都没有，数据确实在 HTML 里，那就是解析方式的问题。最常见的是表格。浏览器按 HTML5 规范解析，`<table><tr><td>` 这种省略写法会被补成 `<table><tbody><tr><td>`，你的 XPath 里写了 `//table/tr`，在控制台跑得通，在服务端跑就是空列表。html5lib 会照着规范把 tbody 补出来，lxml 和 bs4 默认的 html.parser 不会。换个解析器，或者把 XPath 改成 `//table//tr`，两边都能用。

这两种情况还经常混在一起。一个页面里主数据是 ajax 拉的，侧边栏推荐位是服务端渲染的，你以为抓到了整页，其实只拿到推荐位。

## 队列怎么排，决定你先撞哪堵墙

站点当成一张图，每个页面是节点，链接是边。爬虫从入口开始，把发现的链接扔进待抓取队列，队列空了就结束。区别只在于从哪一头取。

深度优先从同一头取，一条路走到黑，撞到死胡同再回头。占内存小，适合结构深、分支少的站。广度优先从另一头取，先把第一层抓完再进第二层，占内存大，但抓到的数据在层级上更均匀。

```python
from collections import deque

def crawl(start: str, max_pages: int = 50) -> list[str]:
    seen: set[str] = {start}
    queue: deque[str] = deque([start])
    visited: list[str] = []
    while queue and len(visited) < max_pages:
        url = queue.popleft()          # popleft 是广度优先，pop 是深度优先
        visited.append(url)
        for link in extract_links(url):
            if link not in seen:       # 去重靠这里，不靠过滤器
                seen.add(link)
                queue.append(link)
    return visited
```

Scrapy 的调度器默认就是队列加去重，去重走 URL 指纹。手写爬虫跑到几百页这个量级以后，压力全在去重结构和失败重试上，那时候该换框架。

## 反爬在防什么，以及 403 之后按什么顺序查

先看对方在防什么。

| 手段            | 防的东西         | 常规绕法                                  |
| --------------- | ---------------- | ----------------------------------------- |
| 单 IP 频率限制  | 一个人猛刷       | 代理池，每个请求换出口，配合随机延迟      |
| 单账号频率限制  | 一个小号刷全站   | 多账号轮流，控制单账号速率，别同时在线    |
| UA 与浏览器指纹 | 非浏览器的客户端 | 抄真实浏览器的头，指纹层面得上 Playwright |
| 验证码          | 自动化           | 打码平台，成本高，能绕就绕                |
| JS 计算签名     | 直接调接口       | 逆向那段签名逻辑，用 Python 重写          |
| 隐藏字段        | 表单被伪造       | 从 HTML 里读出隐藏 input 的值一起提交     |

robots.txt 不在这张表里，它管不了这些，是一份声明，没有强制力。

403 之后按这个顺序查，别乱试。

1. 先看返回体。整页是空的或者只有一段 JS，那是 JS 挑战页，你的请求头对不上，跟封禁无关。
2. 再看参数。POST 的表单字段有没有漏，CSRF token 有没有带，字段格式对不对。少一个字段服务器就直接拒。
3. 看 cookie。登录态是否还在，每个请求有没有都带上。用 `Session` 的话自动处理，手搓 `httpx.get` 就不会。
4. 换一个出口 IP 再请求一次。通了就是 IP 被封，不通就是前面三条里的某一条。
5. 最后才怀疑速度。每秒十次改写每秒一次，加个随机延迟，比任何代理都便宜。

## 慢一点，是技术问题也是法律问题

robots.txt 在 2022 年 9 月成了正式标准，RFC 9309，Google 的三个人和协议原作者一起写的。文档里有一句话很多人没读过，原文是 these rules are not a form of access authorization，这些规则不构成访问授权。

倒过来理解更清楚。robots 写了 Disallow，不代表你抓了会违法，它本来就没有法律效力。robots 什么都没写，也不代表你能随便抓。它约束的是搜索引擎那个生态里的礼貌，法律判断看的是另外的东西。

国内这几年的判决方向比较一致。大众点评诉百度那件，法院认定抓取点评内容做替代性展示构成不正当竞争。微博诉脉脉那件，抓用户信息超出开放平台的授权范围，同样是不正当竞争。还有一类更重，抓的是实时公交数据这种需要账号和授权的系统，走的是刑事，非法获取计算机信息系统数据罪。

落到写代码的人身上，三条能记住就够。要登录才能看的内容，绕开登录去抓，性质就变了。抓个人信息，2021 年 11 月《个人信息保护法》生效以后，边界比过去窄得多。抓来的数据用来做替代性产品，法院基本不支持。

这不是劝谁别写爬虫。公开数据的采集是正常的技术需求，出事的是绕过对方明确设置的访问控制，以及把抓来的东西当成自己的产品卖。

## 一个能跑的骨架

把前面这些拼起来，就是一个粗糙但能用的采集器。

```python
import random
import time
from collections import deque
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9",
}

def same_site(a: str, b: str) -> bool:
    return urlparse(a).netloc == urlparse(b).netloc

def run(start: str, limit: int = 100) -> list[dict[str, str]]:
    seen: set[str] = {start}
    queue: deque[str] = deque([start])
    rows: list[dict[str, str]] = []

    with httpx.Client(headers=HEADERS, timeout=10, follow_redirects=True) as client:
        while queue and len(rows) < limit:
            url = queue.popleft()
            try:
                resp = client.get(url)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                print(f"[skip {e.response.status_code}] {url}")
                continue
            except httpx.RequestError as e:
                print(f"[net error] {url} {e}")
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            rows.extend(parse_quotes(soup, url))

            for a in soup.select("a[href]"):
                link = urljoin(url, a["href"])
                if same_site(link, start) and link not in seen:
                    seen.add(link)
                    queue.append(link)

            time.sleep(random.uniform(0.5, 1.5))   # 别省这一行

    return rows
```

几个地方值得注意。用 `httpx.Client` 而不是裸的 `httpx.get`，连接复用、cookie、默认头都挂在客户端上，配一次全局生效。异常分两类接，`HTTPStatusError` 是服务端回了错误码，`RequestError` 是连不上或者超时，处理方式不一样，混在一起接就只剩一句不明所以的报错。延迟放在每次请求之后而不是循环开头，这样中途 `continue` 也会等。

循环条件用 `len(rows)` 而不是 `len(seen)`，因为一个页面可能返回零条数据，用 seen 计数会在空页面上空转很久。

## 上手顺序

别一上来就装 Scrapy。先用 httpx 手写一遍，把四步、请求头、状态码、去重跑通，一百行以内，出了问题你知道是哪一行。手写这一步跨过去，Scrapy 的架构图一眼就能看懂，那五个组件你都已经用土办法实现过了。

再往后是 JS 渲染。等遇到第一个必须执行 JS 才能拿到数据的站，再上 Playwright，别提前装。

最后是框架和分布式。任务量到了单机跑不完、需要断点续爬和定时调度的时候再看 Scrapy 和 scrapyd，那时你才知道它在替你解决什么问题。
