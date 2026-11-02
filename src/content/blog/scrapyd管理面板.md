---
title: Scrapyd 管理面板推荐
pubDate: 2018-09-10
description: 除了 ScrapydWeb，几个能管 scrapyd 的面板各是什么状态，谁轻谁重，什么时候干脆不装。
category: 编程技术
image: ""
draft: false
slugId: scrapyd-ui
---

# 除了 ScrapydWeb，还有谁能管 scrapyd

scrapyd 装完，打开 6800 端口，会看到一个很朴素的页面。项目列表、任务列表、日志链接、items 文件下载，就这些。想点个按钮让爬虫跑起来，页面上没有这个按钮。

调度只能走 JSON 接口。一条 curl 打过去，爬虫才开始跑。

```bash
curl http://127.0.0.1:6800/schedule.json -d project=mySpider -d spider=demo
```

手敲几次还行，项目一多就想找个界面。ScrapydWeb 是最常被提到的那个，但它不是唯一，也不是最轻的。有些面板比它省事，有些比它能干，还有些已经很多年没人动了。

## 官方文档只点了两个名

scrapyd 文档里有一节叫 Web interface。它先说明自带界面很简陋，只够看进程、翻日志、下 items，然后给出两个“其他选项”，ScrapydWeb 和 spider-admin-pro。整节没有第三个链接。

这个细节挺有用。写文档的人天天跟着 API 走，他们清楚哪些面板还能对得上。剩下的项目都是社区自己长出来的，能用，但没人背书。

## 一张表看完年龄和状态

判断一个开源面板值不值得装，我一般先看最后发布时间，再看依赖钉得有多死。功能列表都好看，能不能在今天的 Python 上装起来才是真的。

| 项目             | 技术栈                    | 一句话                      |
| ---------------- | ------------------------- | --------------------------- |
| ScrapydWeb       | Flask + Element + ECharts | 功能最全，依赖锁得最死      |
| spider-admin-pro | Flask + Vue + APScheduler | 官方点名的轻量那个          |
| Gerapy           | Django 2.2 + Vue          | 功能最多，挑 Python 版本    |
| SpiderKeeper     | Flask                     | 极简，能跑但别指望复杂功能  |
| ScrapydArt       | 直接改 scrapyd 源码       | 作者自己把权限功能停了      |
| Crawlab          | Go + Vue                  | 不是 scrapyd 的壳，另一条路 |

SpiderKeeper 停在 2017 年，ScrapydArt 停在 2018 年，两个都还在各种“scrapy 可视化工具”的博客里被反复推荐。抄来抄去的时候没人看日期。

## 功能上到底差在哪

面板之间的差别不在“能不能启停爬虫”，那是及格线。真正拉开距离的是这几项，多节点、定时任务、日志解析、在线改代码、部署能力、登录鉴权。

| 能力         | ScrapydWeb               | spider-admin-pro            | Gerapy               | SpiderKeeper   |
| ------------ | ------------------------ | --------------------------- | -------------------- | -------------- |
| 多节点       | 支持，核心功能           | 3.0 起支持                  | 支持                 | 不支持         |
| 定时任务     | 支持，按节点配           | 支持，四种方式              | 支持，crontab 为主   | 支持，比较简单 |
| 日志解析     | 有，logparser 出统计图表 | 要装 `scrapy-util` 才有     | 能看原始日志，不解析 | 只能看原始日志 |
| 在线改代码   | 不支持                   | 不支持                      | 支持，自带编辑器     | 不支持         |
| 打包部署     | 支持，自动打包           | 不支持，靠 `scrapyd-deploy` | 支持，带版本回滚     | 支持，一键部署 |
| 登录鉴权     | basic auth               | 账号密码加 JWT              | Django 用户体系      | 没有           |
| 装起来的成本 | 中，配置项多             | 低，一个 yml                | 高，挑 Python 版本   | 低，但依赖太老 |

表格能看出一个取舍。Gerapy 和 ScrapydWeb 都在抢“平台”的位置，功能堆得满，装起来也重。spider-admin-pro 只做任务和定时，其他一概不碰，所以它轻。SpiderKeeper 停更太久，连及格线都开始掉了。

## 先说 ScrapydWeb，它强在哪、烦在哪

既然多数人是拿它当参照物，就把它的账算清楚。

强的地方在多节点和日志。它能把十几台 scrapyd 收在一个页面里，勾选节点批量执行命令，这块它做得比同类细。日志接了 `logparser`，抓取条数、耗时、错误分类会变成图表，不用自己翻文本。定时任务、邮件报警、移动端适配也都做了。

烦的地方在配置和依赖。第一次启动会生成一个 `scrapydweb_settings_v11.py`，里面几十个开关，`SCRAPYD_SERVERS` 得按它规定的结构写，嵌套错一层就一直连不上，报错还不告诉你错在哪。依赖钉得极死，`Flask==2.0.0`、`Werkzeug==2.0.0`、`Jinja2==3.0.0`、`click==7.1.2`，你在一个已经装了新版 Flask 的环境里 `pip install scrapydweb`，装完那个环境基本就废了。

所以用它就一条原则，单独开 venv，别跟业务环境混。

## 想半小时用上，选 spider-admin-pro

它是这一堆里最像“装完就能用”的。Flask 后端加 Vue 前端，一个进程，一个配置文件，没有数据库迁移那套仪式。

```bash
pip install spider-admin-pro

# Linux 或 macOS
gunicorn 'spider_admin_pro:app'

# Windows 上没有 gunicorn，换 waitress
pip install waitress
waitress-serve --listen=127.0.0.1:8000 'spider_admin_pro:app'
```

配置就一个 `config.yml`，放在启动目录下，运行时会自动读。

```yaml
USERNAME: admin
PASSWORD: "换掉，别用 123456"
COMPRESS_STATIC: True
```

登进去之后能干的事挺齐。任务列表能启停，日志页会自己刷新，定时任务支持单次、间隔、cron、随机延时四种。仪表盘那几个图表用 ECharts 画的，数据来自它自己记的日志统计。

Docker 一条命令也能起。

```bash
docker run -e TZ=Asia/Shanghai -p 8000:8000 -v ./config.yml:/app/config.yml mouday/spider-admin-pro
```

有几个地方得提前知道。

- 默认账号是 `admin` 加 `123456`。装完第一件事改掉，这东西一旦能被外网扫到就是个缺口。
- 前端 Vue 源码是私有的。后端 Flask 全开，前端要赞助或者关注公众号才给。只想用没问题，想改界面就得自己重写一套，好在接口都在后端仓库里，照着写不难。
- 日志里的抓取条数、耗时这些统计，要装作者自己的 `scrapy-util` 扩展才有。不装就只能看原始日志文本，仪表盘基本是空的。

## 要功能全，Gerapy

Gerapy 是崔庆才写的，Django 加 Vue，定位比前面那个高一级。它管的范围比跑任务大一圈。项目源码收在自己目录里，界面上能直接改代码，改完打包推到各个节点。

```bash
pip install gerapy

gerapy init          # 建工作目录，生成 projects 和 logs
cd gerapy
gerapy migrate       # 建 sqlite 表
gerapy initadmin     # 建默认管理员
gerapy runserver 0.0.0.0:8000
```

主机管理、项目打包部署、版本回滚、crontab 定时、实时日志，这几样它都有。依赖里还带着 `scrapy-redis` 和 `scrapy-splash`，做分布式和渲染页面的时候省一步。

麻烦在环境，在 3.11 或者 3.12 上装，大概率卡在编译或者 import 报错上。要用就单开一个 3.9 的虚拟环境，或者直接用 Docker。别指望在主力环境里 `pip install gerapy` 就完事。

## 极简到极致，不如不装面板

SpiderKeeper 被推荐得很多，界面确实清爽，一共没几个页面。但它最后一次发布是 2017 年 9 月，装在新环境里要碰运气，Flask 版本一升级就报 import 错。

功能也真的少。没有分页，任务一多列表拉不到底。没有多节点，只能连一个 scrapyd。没有权限，谁打开网页谁就能停你的爬虫。

如果你的场景就是一台机器、几个爬虫、每天定时跑，面板是负担。cron 加一条 curl 就够了。

```bash
# crontab -e，每天凌晨两点跑一次
0 2 * * * curl -s http://127.0.0.1:6800/schedule.json -d project=mySpider -d spider=demo
```

Windows 上用计划任务调 `curl.exe`，参数一样。

想看点状态又不想维护一个服务，自己写三十行 Flask 也够。scrapyd 的接口就那么几个，`listjobs.json` 拿任务，`schedule.json` 起任务，`cancel.json` 停任务。

```python
from flask import Flask, redirect
import requests

app = Flask(__name__)
API = 'http://127.0.0.1:6800'
PROJECT = 'mySpider'


@app.route('/')
def index():
    data = requests.get(f'{API}/listjobs.json', params={'project': PROJECT}).json()
    rows = []
    for state in ('pending', 'running', 'finished'):
        for job in data.get(state, [])[:20]:
            log = f"{API}/logs/{PROJECT}/{job['spider']}/{job['id']}.log"
            rows.append(
                f"<tr><td>{state}</td><td>{job['spider']}</td>"
                f"<td>{job.get('start_time', '')}</td>"
                f"<td><a href='{log}'>日志</a></td></tr>"
            )
    return f"<table border=1>{''.join(rows)}</table>"


@app.route('/run/<spider>')
def run(spider):
    requests.post(f'{API}/schedule.json', data={'project': PROJECT, 'spider': spider})
    return redirect('/')
```

代价说清楚。没有历史归档，scrapyd 重启后 finished 列表只会越来越长。没有定时管理界面，改时间得改 crontab。没有权限，端口千万别往外开。

## 不想自己维护，托管的那条路

ScrapeOps 是 SaaS，注册之后把 scrapyd 地址填进去，任务、日志、定时、报警都在它那边看。免费档够个人用，代价是运行数据要出你自己的机器。

Crawlab 经常被拿来跟这些面板并列，其实不在一个赛道。它是 Go 写的平台，Docker 起，爬虫用它的 SDK 注册，语言不限，Python、Node、Go 都行。它不调 scrapyd 的接口，所以项目结构得改，迁移不是装个包的事。

## 怎么选

| 你的情况                             | 建议                    |
| ------------------------------------ | ----------------------- |
| 单机，几个爬虫，想要按钮             | spider-admin-pro        |
| 多台 scrapyd，要在线改代码和批量部署 | Gerapy，配 Python 3.9   |
| 多节点，日志分析要图表               | ScrapydWeb              |
| 只要定时，不要界面                   | cron 加 `schedule.json` |
| 不想维护服务                         | ScrapeOps               |
| 爬虫不止 Scrapy                      | Crawlab                 |

只能给一个答案的话，我推 spider-admin-pro。它轻、装得快、Windows 上有明确的启动命令，多节点也支持。功能比 Gerapy 少一截，少掉的那部分是“在线改代码”这类容易出事的能力。

第一条值得多说一句。远程连不上 scrapyd，十次有九次是 `bind_address` 没改。默认只监听 `127.0.0.1`，同一台机器上的面板能连，另一台就连不上，报错还是超时，看不出原因。

## 上手顺序

先别急着装面板。三条命令确认 scrapyd 本身是通的。

```bash
curl http://127.0.0.1:6800/daemonstatus.json      # 看服务活着没
curl "http://127.0.0.1:6800/listprojects.json"    # 看项目传上去没
curl "http://127.0.0.1:6800/listspiders.json?project=mySpider"   # 看爬虫认得没
```

三个都返回 `"status": "ok"`，再打一次 `schedule.json`，确认任务真能跑起来。这一步不通，装什么面板都一样连不上，最后还是要回来查 scrapyd。

能跑之后上 spider-admin-pro，半小时内就能有点击按钮。等项目多到需要在线改代码、需要往五台机器同时推版本，再考虑 Gerapy 或者 ScrapydWeb。

还有一种结局挺常见。跑了半年，任务稳了，面板反而不怎么打开了，最后换成 cron 加一个只读状态页。这算不上退步，需求本来就只有那么多。
