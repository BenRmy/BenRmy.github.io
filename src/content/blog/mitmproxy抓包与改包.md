---
title: mitmproxy 中间代理：抓包与改包
pubDate: 2018-10-17
description: 三个命令的区别，手机证书怎么装，脚本按生命周期怎么挂，还有那些抄了六年的过期参数。
category: 编程技术
image: ""
draft: false
slugId: mitmproxy-capture
---

# 手机上发出的请求，怎么在电脑上看见

调网页接口的时候按个 F12 就够了。换成手机 App 就没这个便利，抓包工具成了唯一的路。

能选的工具不多。Charles 好用但要钱，Fiddler 绑在 Windows 上，Wireshark 看得见 TCP 却看不见 HTTPS 的明文。mitmproxy 是一条 `pip install mitmproxy` 加几条命令行，再给你一个 Python 文件写自己的规则。它不画漂亮的曲线图，可改包这件事，脚本比界面管用。

## 它凭什么能看见 HTTPS

HTTPS 的整个设计目标就是不让中间人看懂内容。mitmproxy 能看懂，靠的是它自己愿意当那个中间人。

客户端以为自己连的是服务器，其实连的是 mitmproxy。mitmproxy 拿自己的 CA 当场给目标域名签一张证书，递给客户端。客户端如果认这张证书，TLS 就握上了，加密通道在这里断成两截，明文落进它的内存。它再另起一条 TLS 连接去连真正的服务器，把改过的内容发出去。

整件事的前提只有一个，客户端得信任 mitmproxy 的 CA。这个信任没法偷偷建立，必须你亲手装证书，这也是它和黑产的分界。你能抓的，只有自己的手机和自己的账号。

## 三个命令，一个包

装完 mitmproxy，你会多出三个命令。功能完全一样，都能加载脚本，区别只在界面。

| 命令        | 界面             | 什么时候用                       |
| ----------- | ---------------- | -------------------------------- |
| `mitmproxy` | 终端里的全屏界面 | 键盘操作快，SSH 到服务器上也能用 |
| `mitmweb`   | 浏览器里的界面   | 第一次上手，看包最直观           |
| `mitmdump`  | 没有界面         | 只跑脚本、只存流量，适合挂自动化 |

三个命令来自同一个 pip 包，参数基本通用，脚本也通用。所以别纠结学哪个，先用 `mitmweb` 摸清楚，`mitmdump` 只是去掉界面。

## 安装

官网给了一个 installer，双击就装。区别在于 installer 只带命令，不带可以 `import mitmproxy` 的包。你要写脚本，就必须走 `pip install mitmproxy`。

证书第一次启动时生成，位置在 `~/.mitmproxy/`，里面有 CA 证书、私钥和几张按域名签出来的证书。

## 五分钟抓到第一个包

开一个窗口。

```bash
mitmweb -p 8080
```

浏览器会自己弹出 `127.0.0.1:8081` 的界面，那是控制台。代理本身在 8080，两个端口别搞混。

接着让流量走进来。系统代理设成 `http://127.0.0.1:8080`，或者只让某一条命令走代理。

```bash
curl -x http://127.0.0.1:8080 http://mitm.it
```

`mitm.it` 这个域名只有经过 mitmproxy 才解析得到，它是个证书分发页。打开就能看到一行平台的图标，点自己那个平台下载安装。

装完再访问一个 HTTPS 站点，控制台里应该出现一条 flow。点开能看到请求头、响应头、响应体，JSON 会自动格式化。到这一步，抓包这件事就算通了。

## 手机这一段最容易卡住

手机和电脑连同一个 WiFi，把手机的 WiFi 代理指到电脑的内网地址加 8080。IP 用 `ipconfig` 或 `ifconfig` 查，别填 `127.0.0.1`，那是手机自己。

然后在手机浏览器里打开 `http://mitm.it`。安卓装到“用户证书”，iOS 装描述文件。

麻烦从安卓 7 开始。系统改了规则，App 默认不信任用户证书，只有浏览器认。你会看到浏览器能抓、App 一片证书错误。解决办法是把 CA 塞进系统证书目录，这需要 root 或者一台带 root 的模拟器。

```bash
# 先算出证书的 hash，输出形如 c8750d0d
openssl x509 -inform PEM -subject_hash_old -in mitmproxy-ca-cert.cer | head -1

# 按 hash 重命名，扩展名必须是 .0
mv mitmproxy-ca-cert.cer c8750d0d.0

# 推进系统证书目录，改权限，重启
adb root
adb remount
adb push c8750d0d.0 /system/etc/security/cacerts/
adb shell "chmod 644 /system/etc/security/cacerts/c8750d0d.0"
adb reboot
```

Android 10 以后系统分区默认只读，`adb remount` 会失败，得先 `adb disable-verity` 再重启，或者干脆用一台自带 root 的模拟器。实机折腾这个的时间，够你在模拟器上把接口调完。

iOS 那边有个开关特别容易漏。描述文件装完只是“已安装”，还得进设置里的通用，找到关于本机，翻到最底下的证书信任设置，把 mitmproxy 那一项打开。不开的话所有 HTTPS 请求都会失败，报的还是看不懂的证书错误。

| 平台           | 证书装到哪                           | 最容易漏的一步               |
| -------------- | ------------------------------------ | ---------------------------- |
| Windows        | 受信任的根证书颁发机构               | 装到“个人”里，浏览器照样报警 |
| macOS          | 钥匙串的“系统”，装完双击设为始终信任 | 只装不改信任设置             |
| iOS            | 描述文件                             | 证书信任设置里的开关         |
| Android 7 以下 | 用户证书就够                         | 无                           |
| Android 7 以上 | 系统证书，要 root                    | 只装了用户证书，App 里全红   |

还有一种情况装什么都不管用。有些 App 把服务端证书固定死在代码里，叫证书固定或者 pinning，换一张 CA 签的证书它直接拒绝连接。处理它要么改 APK 去掉校验，要么上 Frida 在运行时 hook 掉，那是另一件事，这篇不展开。

## 脚本才是它值钱的地方

界面能看能改，但每次都要手点。真正省时间的是把自己关心的动作写成脚本，让它在每个 flow 上自动跑。

写法有两种。第一种是模块级函数，函数名就是事件名。

```python
from mitmproxy import http

def request(flow: http.HTTPFlow):
    print(flow.request.pretty_url)
```

第二种是定义一个类，把实例放进模块级的 `addons` 列表。

```python
import logging
from mitmproxy import http

class Counter:
    def __init__(self):
        self.num = 0

    def request(self, flow: http.HTTPFlow):
        self.num += 1
        logging.info("已经看到 %d 条", self.num)

addons = [Counter()]
```

建议用第二种。类能存状态，一个文件里放几个 addon 也不打架，还能通过 `load` 事件注册自己的命令行参数。

跑起来加 `-s`。

```bash
mitmweb -s addons.py
```

顺手说个过时的东西。老例子里到处是 `ctx.log.info(...)`，这个接口在 9.0 就被标记成不推荐了，标准库的 `logging` 一样能用，还不用多 import 一个模块。

## 事件按生命周期分五层

同一个请求，你可以当成“HTTP 请求到 HTTP 响应”，也可以当成“TCP 连接到断开”。mitmproxy 把这两个视角都开放了，所以事件分成五类。选错层，脚本就挂不上。

| 层        | 常用事件                                              | 用来干什么                 |
| --------- | ----------------------------------------------------- | -------------------------- |
| HTTP      | `request` `responseheaders` `response` `error`        | 改请求、改响应、落盘、统计 |
| TCP       | `tcp_start` `tcp_message` `tcp_end`                   | 抓非 HTTP 的协议           |
| WebSocket | `websocket_start` `websocket_message` `websocket_end` | 改推送消息                 |
| 连接      | `client_connected` `server_connected`                 | 按来源 IP 拒绝、记录连接   |
| 通用      | `load` `running` `configure` `done`                   | 初始化、读配置、收尾       |

`requestheaders` 和 `responseheaders` 这两个值得记住。它们在只读到头部、body 还是空的时候触发，想按 Content-Type 决定要不要读 body，就在这里判断，能省掉大量内存。

事件名改过一次，这点必须提醒。7.0 之前叫 `clientconnect`、`serverconnect`，现在叫 `client_connected`、`server_connected`。网上大量示例还是老名字，粘进新版本不报错，只是永远不触发，你会以为自己的逻辑写错了。

```python
from mitmproxy import connection

def client_connected(client: connection.Client):
    if client.peername and client.peername[0].startswith("192.168.1."):
        client.error = "不接这个网段"
```

`peername` 是个元组，第一项是 IP。给它赋值 `error` 就直接把连接掐掉。

## 五个能直接抄的脚本

**只打印 JSON 接口。** 抓 App 的时候最有用的一个，能把一堆静态资源过滤掉。

```python
import json
import logging
from mitmproxy import http

def response(flow: http.HTTPFlow):
    ctype = flow.response.headers.get("content-type", "")
    if "json" in ctype:
        logging.info("%s %s", flow.request.pretty_url, flow.response.text[:200])
```

**改响应里的字段。** 想看看前端拿到 `vip` 为 true 会怎么画，不用碰后端。

```python
import json
from mitmproxy import http

def response(flow: http.HTTPFlow):
    if flow.request.path.endswith("/user/info"):
        data = flow.response.json()
        data["vip"] = True
        flow.response.text = json.dumps(data)
```

`flow.response.json()` 会顺手把 body 解码，改完赋回 `text`，长度和编码它会自己重算。

**不给服务器发请求，直接编一个响应。** 测异常分支时特别省事。

```python
from mitmproxy import http

def request(flow: http.HTTPFlow):
    if flow.request.path.endswith("/pay"):
        flow.response = http.Response.make(
            500,
            b'{"code": 50001, "msg": "mock error"}',
            {"content-type": "application/json"},
        )
```

只要在 `request` 里给 `flow.response` 赋值，请求就不再往外发，后面的 `response` 事件照常触发。这是最干净的一种假数据方式。

**把抓到的数据落盘。** 边抓边写，不用等收工。

```python
import json
from mitmproxy import http

def response(flow: http.HTTPFlow):
    if "/api/" not in flow.request.path:
        return
    with open("dump.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "url": flow.request.pretty_url,
            "method": flow.request.method,
            "body": flow.request.get_text(),
            "resp": flow.response.get_text(),
        }, ensure_ascii=False) + "\n")
```

**把请求转到测试环境。** 改 `flow.request.host` 就行，比记 `map-remote` 那串斜杠分隔的格式省事。

```python
from mitmproxy import http

def request(flow: http.HTTPFlow):
    if flow.request.pretty_host == "api.prod.com":
        flow.request.host = "api.test.com"
        flow.request.headers["Host"] = "api.test.com"
```

改 host 之后，下一次握手就打到新地址，客户端那边完全无感。这是排查“线上有问题、测试环境已经修了”时最快的一招。要注意的是 `Host` 头得跟着一起改，只改 host 不改头，很多网关会直接把请求打回 404。

## 命令行就能干的几件事

不想写脚本的时候，这些参数够用。

| 参数                    | 作用                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `-p 8080`               | 监听端口，默认也是 8080                                         |
| `--mode socks5`         | 换代理类型，还有 `transparent` `reverse` `upstream` `wireguard` |
| `-w out.flow`           | 边抓边写文件，`-r` 再读回来重新分析或重放                       |
| `--ignore-hosts`        | 跳过某些域名，正则匹配                                          |
| `-k` / `--ssl-insecure` | 不校验上游证书，抓自签名测试服时用                              |
| `--modify-headers`      | 按规则增删改请求头或响应头                                      |
| `--modify-body`         | 按正则替换 body                                                 |
| `--proxyauth user:pass` | 给代理本身加账号密码                                            |

`--modify-headers` 的格式是“过滤器 / 头名 / 值”，值留空表示删掉这个头。

```bash
mitmweb --modify-headers '/~u example.com/X-Debug/1'
mitmweb --modify-body '/~u example.com/"vip":false/"vip":true'
```

顺手拆一个坑。老文章里的 `--replacements` 和 `--setheaders` 在现在的版本里已经没有了，5.2 起它们被 `ModifyBody` 和 `ModifyHeaders` 两个 addon 取代，命令行换成了上面这两个参数。照着五六年前的教程敲，只会得到一句参数不存在。

## 过滤器怎么写

`mitmweb` 顶部那个输入框、`mitmproxy` 里按 `f`、命令行里的 `--view-filter`，用的都是同一套语法。

| 表达式      | 意思                     |
| ----------- | ------------------------ |
| `~u regex`  | URL 匹配                 |
| `~d regex`  | 域名匹配                 |
| `~m post`   | 请求方法                 |
| `~q`        | 发出去了但还没响应的请求 |
| `~hs regex` | 响应头匹配               |
| `~c 200`    | 状态码                   |
| `~t json`   | Content-Type 匹配        |
| `~s` / `~e` | 有响应 / 出错            |

支持 `&`、`|`、`!` 和括号，默认是而且的关系。想只看某个域名的 POST，就写成 `~u api\.example\.com & ~m POST`。

正则默认不区分大小写。要区分，设环境变量 `MITMPROXY_CASE_SENSITIVE_FILTERS=1`。

## 和 requests、scrapy 一起用

写爬虫的时候经常需要“先抓一遍，再让代码重放”。让 requests 走代理就行。

```python
import requests

r = requests.get(
    "https://httpbin.org/get",
    proxies={"http": "http://127.0.0.1:8080", "https": "http://127.0.0.1:8080"},
    verify="C:/Users/me/.mitmproxy/mitmproxy-ca-cert.pem",
)
```

注意 `verify` 要指到 mitmproxy 的 CA 文件，不能写 `False`。写 `False` 等于关掉校验，你验证的是“能连通”，不是“证书配对了”。

Scrapy 里更简单，给单条请求挂 `meta`。

```python
def parse(self, response):
    yield scrapy.Request(url, meta={"proxy": "http://127.0.0.1:8080"})
```

## 会踩的坑

| 坑                        | 症状                  | 处理                               |
| ------------------------- | --------------------- | ---------------------------------- |
| 只装证书没开信任开关      | iOS 上所有 HTTPS 失败 | 设置里打开证书信任                 |
| 安卓 7 以上只装了用户证书 | 浏览器正常，App 全红  | 装系统证书，或者换 root 模拟器     |
| 用了老事件名              | 脚本不报错也不跑      | 改成 `client_connected` 这类新名字 |
| 抄了 `--replacements`     | 报参数不存在          | 换 `--modify-body`                 |
| 端口被占用                | 起不来                | `-p 8081` 换一个                   |
| 开着 VPN 抓包             | 控制台一条都没有      | 关掉 VPN，代理才会生效             |
| 响应体太大看不全          | 详情里被截断          | `-w` 存文件，再用 `-r` 读回来      |
| 把代理和界面端口弄混      | 打不开控制台          | 代理 8080，界面 8081               |
| 抓完忘了关系统代理        | 断网                  | 系统代理关掉                       |

## 上手顺序

先用 `mitmweb` 抓自己的浏览器，确认证书这关过了。不通就查证书，别急着上手机。

然后写一个 `response` 脚本，把某个接口的返回值改掉。写顺了再碰 `request` 里造响应那种，它会改变请求的去向，容易在排查时把自己绕进去。

手机放到第三步，因为它的坑几乎都在证书和权限上，和 mitmproxy 本身关系不大。

透明代理、证书固定、WebSocket 改包这些放到最后。多数人一年也用不上一次，真需要的时候再看文档也来得及。
