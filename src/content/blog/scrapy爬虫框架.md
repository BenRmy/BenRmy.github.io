---
title: Scrapy 爬虫框架介绍
pubDate: 2018-09-03
description: 五个组件的分工，从 Spider 到 Pipeline 的骨架，还有那些第一遍跑就会踩的坑。
category: 编程技术
image: ""
draft: false
slugId: scrapy-crawler
---

# Scrapy 到底替你扛了哪些活

用 requests 加 BeautifulSoup 手写爬虫，前二十页都挺顺。翻到两百页开始出问题。某页返回 503，你的循环直接断在半路。翻页链接是相对路径，拼接写错一次，后面全爬到同一个页面。想加个并发，还得自己管线程池和队列。

Scrapy 把这些麻烦收进框架里。请求排队、去重、失败重试、并发控制、翻页跟进、数据落地，各有一层负责。你只需要写两件事，从页面里抠什么数据，以及数据往哪存。

## 五个组件各管一段

| 组件              | 干什么                                                 |
| ----------------- | ------------------------------------------------------ |
| 引擎 Engine       | 在其余四个组件之间转手，管信号和数据传递               |
| 调度器 Scheduler  | 收下引擎递来的 Request，排队整理，引擎要的时候再还回去 |
| 下载器 Downloader | 真正发请求，拿到 Response 交回引擎，引擎再转给 Spider  |
| 爬虫 Spiders      | 解析 Response，抠出 Item，顺手把要跟进的 URL 交回引擎  |
| 项目管道 Pipeline | 对 Item 做清洗、验重、过滤、存库                       |

另外两个中间件是钩子层。下载器中间件夹在引擎和下载器之间，爬虫中间件夹在引擎和 Spider 之间。想在请求发出前改 UA、加代理、换 cookie，都是往这里插。

数据就这么转一圈。Spider 产出 Item 或者新的 Request，Item 走管道落盘，Request 回调度器重新排队，一直转到没有新链接为止。

## 半小时跑通第一个

```bash
pip install scrapy

scrapy startproject mySpider          # 建项目
cd mySpider
scrapy genspider demo "demo.cn"       # 生成爬虫骨架
scrapy crawl demo                     # 运行，demo 是爬虫名
```

项目目录长这样。

| 文件                    | 作用                     |
| ----------------------- | ------------------------ |
| `scrapy.cfg`            | 项目配置，部署时也改这里 |
| `mySpider/items.py`     | 待抓取数据的字段定义     |
| `mySpider/pipelines.py` | 管道实现                 |
| `mySpider/settings.py`  | 全局设置                 |
| `mySpider/spiders/`     | 爬虫代码目录             |

五个步骤走完就是一个能跑的项目。建项目、生成爬虫、写解析、配管道、运行。多数人卡在第三步和第四步，前两步都是脚手架。

## Spider 是唯一必须手写的东西

所有爬虫都继承 `scrapy.Spider`。它的调用顺序是三段。

1. `__init__()` 初始化爬虫名和 `start_urls`
2. `start_requests()` 造出第一批 Request 交给下载器
3. `parse()` 解析 Response，返回 Item 或者新的 Request

接下来就是循环。Item 进管道，Request 回调度器，每条 Response 都交给指定的回调函数处理，默认是 `parse`。

常用属性记这几个就够。

| 属性              | 说明                                         |
| ----------------- | -------------------------------------------- |
| `name`            | 爬虫名，必需且唯一                           |
| `allowed_domains` | 允许抓的域名范围，防止爬飞                   |
| `start_urls`      | 起始 URL 列表                                |
| `custom_settings` | 这个爬虫的局部设置，会覆盖全局               |
| `settings`        | 运行时配置，能读环境变量级别的开关           |
| `logger`          | 带爬虫名的 logger，直接 `self.logger.info()` |
| `state`           | 批次之间保留的状态，断点续爬用得上           |

一个能翻页的最小例子。抓 quotes.toscrape.com 的幽默分类。

```python
import scrapy


class QuotesSpider(scrapy.Spider):
    name = 'quotes'

    # 设了 start_urls 就不用自己写 start_requests 函数
    start_urls = [
        'https://quotes.toscrape.com/tag/humor/',
    ]

    def parse(self, response):
        for quote in response.css('div.quote'):
            yield {
                'author': quote.xpath('span/small/text()').get(),
                'text': quote.css('span.text::text').get(),
            }

        # 翻页，follow 支持相对路径，不用手动 urljoin
        next_page = response.css('li.next a::attr("href")').get()
        if next_page is not None:
            yield response.follow(next_page, self.parse)

        # 还可以更短
        # yield from response.follow_all(css='li.next a', callback=self.parse)
```

`yield` 字典这种写法最省事，Scrapy 会自己包成 Item。要落盘直接加参数。

```bash
scrapy crawl quotes -O quotes.json   # 大写 O 覆盖写，小写 o 是追加
```

`response.follow` 和 `scrapy.Request` 的区别值得记一下。`follow` 接受相对路径，浏览器里那种 `./page/2` 直接喂进去就行。用 `Request` 就得自己 `response.urljoin()` 拼成绝对地址，少写一步就多一个 bug。

## 抠数据靠 Selector

HTML 里取数据，能选的库不少，BeautifulSoup、lxml 都行。Scrapy 自带一层选择器，本质还是 XPath 和 CSS 表达式，只是包成了统一的 API。

`response` 上直接就能用，不用自己构造。

```python
response.selector.xpath('//span/text()').get()
response.xpath('//span/text()').get()     # 简写
response.css('span::text').get()
```

脱离 Spider 也能用，比如离线解析一段 HTML。

```python
from scrapy.selector import Selector

body = '<html><body><span>good</span></body></html>'
text = Selector(text=body).xpath('//span/text()').get()
```

要正则就直接接在后面，注意它返回的是字符串列表，没法继续嵌套选择。

```python
response.xpath('//a[contains(@href, "image")]/text()').re(r'Name:\s*(.*)')
response.xpath('//a[contains(@href, "image")]/text()').re_first(r'Name:\s*(.*)')
```

取值方法有一堆，日常只用两个。

```python
response.css('a::attr(href)').get()        # 取第一个，取不到给 None
response.css('a::attr(href)').getall()     # 取全部，返回 list
```

`extract_first()` 和 `extract()` 是老名字，和 `get()`、`getall()` 等价。新代码统一用后者，读起来短。

## Item 就是个带字段声明的字典

网页是非结构化的，你的目标是把它变成有键有值的对象。Item 干这件事。

```python
import scrapy


class CustomItem(scrapy.Item):
    one_field = scrapy.Field()
    another_field = scrapy.Field(serializer=str)
```

`scrapy.item.Item` 加 `Field` 的老写法也一样，`from scrapy.item import Item, Field` 然后继承 `Item` 就行。

字段多的项目更推荐 dataclass，导出时所有字段都会带上，哪怕第一条数据没抓到那个字段。

```python
from dataclasses import dataclass


@dataclass
class CustomItem:
    one_field: str
    another_field: int
```

注意运行时不做类型检查，`one_field: str` 你塞个 int 进去也没人拦。注解只对编辑器和导出器有用。

`attr.s` 是另一条路，行为类似。

```python
import attr


@attr.s
class CustomItem:
    one_field = attr.ib()
    another_field = attr.ib()
```

用起来跟 dict 几乎一样。

```python
product = Product(name='Desktop PC', price=1000)

product['name']                 # 取值
product.get('lala', 'unknown')  # 带默认值
product['last_updated'] = 'today'

product.keys()
product.items()
dict(product)                                   # 转字典
Product({'name': 'Laptop PC', 'price': 1500})   # 从字典造
```

## Pipeline 负责把数据落地

Item 抓到手之后要清洗、验字段、去重、写库，这一串都在管道里做。每个管道就是一个普通类，按顺序执行，可以中途把不合格的 Item 丢掉。

四个方法，前两个必须或常用，后两个按需。

| 方法                         | 什么时候调 | 说明                                                  |
| ---------------------------- | ---------- | ----------------------------------------------------- |
| `process_item(item, spider)` | 每条数据   | 必须实现，返回 item、Deferred，或者抛 `DropItem` 丢弃 |
| `open_spider(spider)`        | 爬虫启动   | 开文件、连数据库放这里                                |
| `close_spider(spider)`       | 爬虫关闭   | 关连接、刷缓冲                                        |
| `from_crawler(cls, crawler)` | 创建实例时 | 从 `crawler.settings` 读配置，返回管道实例            |

写 JSON 文件最直接。

```python
import json
from itemadapter import ItemAdapter


class JsonWriterPipeline:

    def open_spider(self, spider):
        self.file = open('items.jl', 'w')

    def close_spider(self, spider):
        self.file.close()

    def process_item(self, item, spider):
        # ItemAdapter 统一处理 dict、Item、dataclass 三种对象
        line = json.dumps(ItemAdapter(item).asdict()) + "\n"
        self.file.write(line)
        return item
```

写 MongoDB 的话，配置从 `from_crawler` 里取，别硬编码。

```python
import pymongo
from itemadapter import ItemAdapter


class MongoPipeline:

    collection_name = 'scrapy_items'

    def __init__(self, mongo_uri, mongo_db):
        self.mongo_uri = mongo_uri
        self.mongo_db = mongo_db

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            mongo_uri=crawler.settings.get('MONGO_URI'),
            mongo_db=crawler.settings.get('MONGO_DATABASE', 'items')
        )

    def open_spider(self, spider):
        self.client = pymongo.MongoClient(self.mongo_uri)
        self.db = self.client[self.mongo_db]

    def close_spider(self, spider):
        self.client.close()

    def process_item(self, item, spider):
        self.db[self.collection_name].insert_one(ItemAdapter(item).asdict())
        return item
```

写完还得注册，否则不生效。

```python
ITEM_PIPELINES = {
    'myproject.pipelines.PricePipeline': 300,
    'myproject.pipelines.JsonWriterPipeline': 800,
}
```

数字是顺序，从小的往大的走，习惯写 0 到 1000。清洗给 300，落地给 800，这个分配挺好记。

## 要顺着链接抓全站，换 CrawlSpider

`Spider` 一次只处理你给的那几个入口。整站抓取用 `CrawlSpider`，它靠一组规则自动跟进链接，不用在 `parse` 里手写翻页逻辑。

规则是 `Rule` 对象，核心参数四个。

| 参数             | 作用                             |
| ---------------- | -------------------------------- |
| `link_extractor` | 链接提取器，不给就提取所有链接   |
| `callback`       | 提取到的链接下载完之后交给谁处理 |
| `follow`         | 这些链接要不要继续往下跟         |
| `cb_kwargs`      | 传给回调的额外关键字参数         |

链接提取器用 `LinkExtractor`，常用参数就这几个。

| 参数                               | 作用                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| `allow` / `deny`                   | 必匹配 / 必排除的正则                                     |
| `allow_domains` / `deny_domains`   | 域名白名单和黑名单                                        |
| `restrict_xpaths` / `restrict_css` | 只在页面某一块里找链接                                    |
| `tags` / `attrs`                   | 找哪些标签的哪些属性，默认 `('a', 'area')` 和 `('href',)` |
| `deny_extensions`                  | 要忽略的扩展名，默认跳图片和压缩包这一堆                  |

一个完整的例子。分类页要跟进，详情页要解析。

```python
import scrapy
from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor


class MySpider(CrawlSpider):
    name = 'example.com'
    allowed_domains = ['example.com']
    start_urls = ['http://www.example.com']

    rules = (
        # 没有 callback 时 follow 默认为 True，所以这类链接会被继续跟进
        Rule(LinkExtractor(allow=('category\.php',), deny=('subsection\.php',))),

        # 详情页交给 parse_item 处理
        Rule(LinkExtractor(allow=('item\.php',)), callback='parse_item'),
    )

    def parse_item(self, response):
        self.logger.info('Hi, this is an item page! %s', response.url)

        item = scrapy.Item()
        item['id'] = response.xpath('//td[@id="item_id"]/text()').re(r'ID: (\d+)')
        item['name'] = response.xpath('//td[@id="item_name"]/text()').get()
        item['link_text'] = response.meta['link_text']

        url = response.xpath('//td[@id="additional_data"]/@href').get()
        return response.follow(url, self.parse_additional_page, cb_kwargs=dict(item=item))

    def parse_additional_page(self, response, item):
        item['additional_data'] = response.xpath('//p[@id="additional_data"]/text()').get()
        return item
```

有个坑必须提醒。写 `CrawlSpider` 的时候，新请求的回调要显式指定。它内部把 `parse` 当成规则解析入口占了，你随手写个 `parse` 会被顶掉，行为看起来莫名其妙。

## Request 和 Response 里两个传参口

抓取过程就是 Request 和 Response 在系统里流转。Request 在 Spider 里造，走到下载器执行，回来的 Response 再交给发起它的 Spider。

`Request` 的常用参数。

| 参数          | 说明                                               |
| ------------- | -------------------------------------------------- |
| `url`         | 目标地址                                           |
| `callback`    | 响应回来后调用谁                                   |
| `method`      | 默认 GET                                           |
| `meta`        | 任意数据，会跟着传到响应上                         |
| `headers`     | 请求头，注意这里设的 cookie 不走 CookiesMiddleware |
| `cookies`     | 要发的 cookie，用这个参数才生效                    |
| `body`        | 请求体，最终会转成 bytes                           |
| `priority`    | 优先级，默认 0，大的先抓                           |
| `dont_filter` | 不让调度器去重，默认 False，用的时候小心死循环     |
| `errback`     | 出异常时调谁                                       |
| `cb_kwargs`   | 传给回调的关键字参数字典                           |

传数据给回调有两个口，`cb_kwargs` 和 `meta`。1.7 之后推荐 `cb_kwargs`，语义清楚，也不跟中间件抢地盘。`meta` 留给中间件和扩展用。

```python
def parse(self, response):
    request = scrapy.Request('http://www.example.com/index.html',
                             callback=self.parse_page2,
                             cb_kwargs=dict(main_url=response.url))
    request.cb_kwargs['foo'] = 'bar'
    yield request


def parse_page2(self, response, main_url, foo):
    yield dict(main_url=main_url, other_url=response.url, foo=foo)
```

出错的路径交给 `errback`。它拿到的是 `failure`，能区分 HTTP 错误码、DNS 失败、连接超时。

```python
import scrapy
from scrapy.spidermiddlewares.httperror import HttpError
from twisted.internet.error import DNSLookupError, TimeoutError, TCPTimedOutError


class ErrbackSpider(scrapy.Spider):
    name = "errback_example"
    start_urls = [
        "http://www.httpbin.org/",              # 200
        "http://www.httpbin.org/status/404",    # 404
        "http://www.httpbin.org/status/500",    # 500
        "http://www.httpbin.org:12345/",        # 卡死，超时
        "https://example.invalid/",             # DNS 解析失败
    ]

    def start_requests(self):
        for u in self.start_urls:
            yield scrapy.Request(u, callback=self.parse_httpbin,
                                 errback=self.errback_httpbin,
                                 dont_filter=True)

    def parse_httpbin(self, response):
        self.logger.info('Got successful response from {}'.format(response.url))

    def errback_httpbin(self, failure):
        self.logger.error(repr(failure))

        if failure.check(HttpError):
            response = failure.value.response
            self.logger.error('HttpError on %s', response.url)

        elif failure.check(DNSLookupError):
            request = failure.request
            self.logger.error('DNSLookupError on %s', request.url)

        elif failure.check(TimeoutError, TCPTimedOutError):
            request = failure.request
            self.logger.error('TimeoutError on %s', request.url)
```

错了还想带着参数继续往下走，从 `failure.request.cb_kwargs` 里取就行。

```python
def parse(self, response):
    request = scrapy.Request('http://www.example.com/index.html',
                             callback=self.parse_page2,
                             errback=self.errback_page2,
                             cb_kwargs=dict(main_url=response.url))
    yield request


def errback_page2(self, failure):
    yield dict(main_url=failure.request.cb_kwargs['main_url'])
```

`meta` 里有些键是 Scrapy 自己读的，改它们等于改行为。

| 键                                            | 作用                                           |
| --------------------------------------------- | ---------------------------------------------- |
| `proxy`                                       | 单条请求走指定代理                             |
| `download_timeout`                            | 下载超时秒数                                   |
| `max_retry_times`                             | 这条请求重试几次，优先级高于全局 `RETRY_TIMES` |
| `dont_redirect` / `dont_retry` / `dont_cache` | 跳过重定向、重试、缓存                         |
| `dont_merge_cookies`                          | 不合并已有 cookie                              |
| `handle_httpstatus_list`                      | 哪些错误码交给回调处理，别走 errback           |
| `download_latency`                            | 只读，这条请求花了多少秒                       |

两个专门的 Request 子类，遇到表单和接口就得用。

```python
# 表单 POST
yield scrapy.FormRequest(url="http://www.example.com/post/action",
                         formdata={'name': 'John Doe', 'age': '27'},
                         callback=self.after_post)

# JSON POST
yield scrapy.http.JsonRequest(url='http://www.example.com/post/action',
                              data={'name1': 'value1', 'name2': 'value2'})
```

返回的 `Response` 是 `HtmlResponse`，也就是 `TextResponse` 的子类，`parse` 里的 `response` 就是它。除了常规的 `url`、`status`、`headers`、`body`，还有几个好用的。

```python
response.text          # 解码后的字符串，等于 body.decode(encoding)
response.json()        # 直接反序列化 JSON 文档
response.urljoin(u)    # 拼绝对地址
response.follow(u, self.parse)
response.follow_all(css='li.next a', callback=self.parse)
```

`XmlResponse` 也是 `TextResponse` 的子类，会从 XML 声明行里自动识别编码。

## 中间件改的是全局行为

下载器中间件夹在引擎和下载器之间，能改请求也能改响应。要统一加 UA、轮换代理、处理验证码、记录耗时，都在这一层。

写一个中间件就是写一个类，方法按需实现。

| 方法                                            | 时机                              | 能返回什么                                                                 |
| ----------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| `process_request(request, spider)`              | 请求出门前                        | `None` 继续走，Response 直接短路，Request 重新调度，或者抛 `IgnoreRequest` |
| `process_response(request, response, spider)`   | 响应回来时                        | Response 继续走链，Request 重新调度，或者抛 `IgnoreRequest`                |
| `process_exception(request, exception, spider)` | 下载器或 `process_request` 抛异常 | `None` 交给下一个，Response 短路，Request 重新调度                         |
| `from_crawler(cls, crawler)`                    | 创建实例                          | 返回中间件实例，配置从这里读                                               |

`process_request` 返回 Response 的用法很常见。命中缓存或者被风控拦了，直接造一个假响应返回，后面的中间件和下载器都不再执行。返回 `None` 才是放行。

注册方式和管道一样，数字是顺序，写 `None` 就是禁用内置的。

```python
DOWNLOADER_MIDDLEWARES = {
    'myproject.middlewares.CustomDownloaderMiddleware': 543,
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
}

SPIDER_MIDDLEWARES = {
    'myproject.middlewares.CustomSpiderMiddleware': 543,
    'scrapy.spidermiddlewares.offsite.OffsiteMiddleware': None,
}
```

爬虫中间件位置更靠里，夹在引擎和 Spider 之间。它处理的是即将交给 Spider 的 Response，以及 Spider 吐出来的 Request 和 Item。多数项目不用碰，只有要改 Item 结构或者统一改写请求时才用得上。

## 限速、断点、部署

跑得太快会被封，`DOWNLOAD_DELAY` 是最直接的办法。

```python
AUTOTHROTTLE_ENABLED = True   # 让扩展根据响应时间自己调速度
DOWNLOAD_DELAY = 3            # 固定间隔 3 秒
```

抓大站要中断怎么办。用 `JOBDIR`。

```bash
scrapy crawl zhihu -s JOBDIR=req_tmp   # 第一次跑
# 按 Ctrl+C 暂停
scrapy crawl zhihu -s JOBDIR=req_tmp   # 再执行一次，从断点继续
```

想从头再来就换个目录名。断点信息全在 `req_tmp` 里，删了等于重来。

上线部署用 `scrapyd`，它是个守护进程，收 JSON API 请求然后起进程跑爬虫。

```bash
pip install scrapyd          # 服务端
pip install scrapyd-client   # 客户端
scrapyd                      # 启动，默认端口 6800
```

项目里的 `scrapy.cfg` 加一段。

```ini
[deploy:xxx]
url = http://localhost:6800/
project = mySpider
```

然后执行 `scrapyd-deploy xxx -p mySpider`，它会打包传上去。

```bash
scrapyd-deploy xxx -p mySpider
```

`scrapyd` 自带界面比较简陋，可以用 `scrapydweb` 补一下，装完直接跑，前提是 `scrapyd` 正在运行。配置看 `scrapydweb_settings_v10.py`，远程服务器记得开 username 和 password，项目路径也可以交给它上传。

要真正分布式，Scrapy 本身不支持。`scrapy-redis` 库用 Redis 把请求队列和去重集合挪到外面，多个实例共享同一份队列，这是最常见的分布式爬虫做法。

## 会踩的坑

| 坑                               | 症状                 | 处理                                          |
| -------------------------------- | -------------------- | --------------------------------------------- |
| 用 `scrapy.Request` 拼翻页       | 抓到同一个页面反复   | 用 `response.follow`，它接受相对路径          |
| `CrawlSpider` 里自己写了 `parse` | 规则不生效或者行为怪 | 规则解析入口被占，回调要显式指定              |
| `ITEM_PIPELINES` 没注册          | 管道代码一行没跑     | 数字配好，写 `None` 会被禁用                  |
| 想用 `headers` 传 cookie         | 服务端说没登录       | 用 `Request(cookies=...)`，cookie 不走 header |
| 管道里把 item 吞了               | 后面管道收不到数据   | `process_item` 必须 `return item`             |
| 以为 dataclass 会校验类型        | 类型错了也不报       | 运行时不做检查，校验自己写                    |
| `dont_filter=True` 到处加        | 无限循环爬到死       | 只在确实需要重抓时开                          |
| 忘了设 `allowed_domains`         | 爬到站外去了         | 设上域名范围                                  |
| 以为 `.pyc` 能提速               | 跑得一样快           | 那东西只加速载入，跟爬虫没关系                |
| 想直接多机跑                     | 请求各跑各的，不共享 | 上 `scrapy-redis`，队列和去重得放外面         |

## 上手顺序建议

先把 `Spider` 加 `parse` 那套跑通，能稳定抓一个列表页加详情页，比研究架构图有用。

接着补管道，数据能进库，项目才算能交付。

卡在翻页和整站抓取上，再换 `CrawlSpider` 和 `LinkExtractor`。中间件留到最后，它是给你处理风控和请求改写的，业务还没跑顺就先别碰。

分布式更靠后。单机能跑完的量，加机器只是让 bug 出现得更快。
