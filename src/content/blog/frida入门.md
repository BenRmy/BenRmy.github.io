---
title: Frida 入门：先搞清楚你要注入什么
pubDate: 2019-09-02
description: 四种注入方式对应四种处境，安卓上第一步最容易翻在端口。
category: 编程技术
image: ""
draft: false
slugId: frida-intro
---

# 装完 Frida 不算入门，知道往哪注入才算

手机里那个 App 登录时算一个 `X-Sign`，改一个参数值它就变。反编译出来的 dex 里搜不到算它的地方，字符串全是加密的，控制流被拍平过。静态分析到这儿就卡住了，剩下能做的只有一件事，让它跑起来，在它算的那一刻拦住。

Frida 干的就是这个。它不负责反编译，也不负责抓包，它往一个正在运行的进程里塞一段 JS，这段 JS 能读内存、改参数、换返回值、调进程里的原生函数。

装完之后你要写的九成是 JS，Python 只是那层壳，负责把脚本送进去、把消息接出来。

## 三层结构，各管一段

Frida 的代码分成三块，理解这三块之后，官方文档里那些名词就不会打结了。

| 层         | 语言           | 干什么                                                          |
| ---------- | -------------- | --------------------------------------------------------------- |
| Gum        | C              | 真正的插桩内核。Interceptor、Stalker、Memory 这些能力都在这一层 |
| GumJS      | C 加 JS 运行时 | 把 JS 引擎接到 Gum 上，让脚本能调到 Gum 的 API                  |
| frida-core | C              | 把 GumJS 打包成共享库注入目标进程，负责双向通信、枚举进程和设备 |

一句话，Gum 干活，GumJS 让你用 JS 指挥，frida-core 负责把整套东西送进去再把消息带出来。

运行时这块有个细节值得先知道。现在的默认引擎是 QuickJS，V8 得显式要，`create_script(js, runtime="v8")` 或者 CLI 加 `--runtime=v8`。QuickJS 启动快、占的内存小，日常够用。如果脚本明明写对了却报一堆看不懂的错，换 V8 跑一次，报错信息通常能指到具体行。

## 四种进法，对应四种处境

注入方式选错，后面全是白费功夫。先看你在什么处境。

| 方式                  | 怎么进                                         | 适合什么情况               |
| --------------------- | ---------------------------------------------- | -------------------------- |
| Injected              | 设备上跑 `frida-server`，PC 端 attach 或 spawn | 有 root 或越狱，最常用     |
| Gadget 嵌入           | 把 `frida-gadget` 塞进目标 App 或其加载的 so   | 没 root，靠重打包或改系统  |
| 动态链接器预加载      | `LD_PRELOAD` 或 `DYLD_INSERT_LIBRARIES`        | 桌面端，不想装 server      |
| Gadget 加脚本自主运行 | gadget 配置成 script 模式，开机就加载          | 需要长期驻留，不要外部通信 |

第二种是没 root 时的主战场。`frida-gadget` 是个共享库，加载它就等于把 Frida 塞进去了，之后用 `frida-trace` 之类的工具远程连它一样能操作。它支持四种交互模式，Listen、Connect、Script、ScriptDirectory，默认是 Listen，也就是等人连过来。

改模式靠一个配置文件，文件名和 gadget 二进制完全一致，后缀换成 `.config`。比如库叫 `libgadget.so`，配置就叫 `libgadget.config`。

这里有个能省事的点，二进制你可以随便改名。改成 `libmsf.so`、`libstat.so` 都行，配置文件跟着改成对应的名字。对面靠扫文件名找 Frida 痕迹的老办法就此失效。

安卓上还有一条限制要记住，包管理器只从应用的 `lib` 目录复制文件，所以 config 必须和 so 放在同一层。

```
lib
└── arm64-v8a
    ├── libgadget.config.so
    └── libgadget.so
```

iOS 那边宽松些，config 放在 `Frameworks` 目录下就行。

## Python 和 JS 之间那条线

Python 负责壳，JS 负责逻辑，中间有一条双向通道。这是 Frida 用起来最舒服的地方，调参数不用重开进程。

JS 发消息用 `send()`，参数可以是任何能 JSON 序列化的值。Python 收到后走回调。

```python
import frida
import sys

JS = """
const libc = Process.getModuleByName("libc.so");
Interceptor.attach(libc.getExportByName("open"), {
  onEnter(args) {
    send({ path: args[0].readUtf8String() });
  },
});
"""

session = frida.attach("target")
script = session.create_script(JS)

def on_message(message, data):
    if message["type"] == "error":
        print("[!]", message.get("stack"))
    elif message["type"] == "send":
        print("[i]", message["payload"])

script.on("message", on_message)
script.load()
sys.stdin.read()
```

反方向，Python 用 `script.post()` 发，JS 用 `recv()` 收。这里有个容易搞错的地方，`recv` 是一次性的，回调触发一次就失效，想收下一条得重新注册。

要在进程里同步等一条消息再继续往下走，就用 `op.wait()` 阻塞住。

```js
Interceptor.attach(ptr("0x400544"), {
  onEnter(args) {
    send(args[0].toString());
    const op = recv("input", (value) => {
      args[0] = ptr(value.payload);
    });
    op.wait();
  },
});
```

这种写法我在改参数、按需放行的场景里用得最多。JS 把现场信息发出去，Python 算完把新值发回来，进程停在那儿等，算完接着跑。

## attach 和 spawn，差的是几十毫秒

两种模式经常被混着说，实际差别不小。

attach 是往一个已经跑起来的进程里注入，底层靠 ptrace 改内存。如果这个进程已经在被调试（tracer pid 不是 0），attach 会直接失败。

spawn 是把进程启动起来先挂住，注入完再放行。所以但凡需要赶在某个初始化动作之前下手，只能选 spawn。`RegisterNatives` 就是典型，Java 层的 native 方法在 so 加载时批量注册，晚一步那些函数指针已经填好了，你再 hook 就是 hook 在别处。

命令行里 `-f` 就是 spawn，`--pause` 让它停在入口，敲 `%resume` 才继续。

```bash
frida -U -f com.demo.app --pause -l hook.js
```

## 安卓上最容易翻的一步是端口

教程里这段经常自相矛盾，我见的最多的一种写法是这样。

```bash
./frida-server -l 0.0.0.0:8888
adb forward tcp:27042 tcp:27042
```

上面让 server 监听 8888，下面把 PC 的 27042 转到手机的 27042，两个端口对不上，连不上是必然的。要么让 server 用默认端口（不传 `-l`，默认 27042），要么把转发写成 `adb forward tcp:27042 tcp:8888`。

完整流程不长，但每一步都有坑。

```bash
adb devices -l                                  # 先确认设备在线
adb shell getprop ro.product.cpu.abi            # 确认架构，arm64-v8a 还是 armeabi-v7a
adb push frida-server /data/local/tmp/          # 版本要和 PC 端完全一致
adb shell su -c "chmod 755 /data/local/tmp/frida-server"
adb shell su -c "/data/local/tmp/frida-server &"
adb forward tcp:27042 tcp:27042
frida-ps -U                                     # 能看到进程列表就成了
```

版本这一条最要命。PC 端 `pip install frida-tools` 装的是 15.x，你从 release 页面下载了个 12.0.1 的 server，两边协议对不上，表现是 `Failed to connect` 或者连上立刻断，报错信息不会告诉你是版本问题。

架构也别猜，`ro.product.cpu.abi` 一行就出来了。大多数现在的机器是 `arm64-v8a`，老的模拟器和低端机还有 32 位。

## 拿不到 root 时的四条路

| 做法                  | 原理                                                                 | 卡在哪                             |
| --------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| 重打包                | 解包后改 smali 或 patch so 把 gadget 打进去，重签安装                | 有签名校验就废，校验弱的时候最省事 |
| Patch so              | 直接改 `/data/app/<pkg>/lib/arm64` 下的 so，这个目录不在签名覆盖范围 | App 检测 BL 锁就没戏               |
| 编译系统              | 改 AOSP 源码把 gadget 编进系统，App 启动时自动加载                   | 工作量大，App 得能在 AOSP 上跑     |
| Gadget 加 Zygisk 模块 | 靠 Magisk 在 zygote 阶段注入                                         | 还是要有 root，但比刷系统轻        |

第二条值得多说一句，因为大多数人不知道它的依据在哪。apk 安装后 so 会被解压到 `/data/app/<pkg>/lib/arm64`，运行时从那加载，而这个目录里的文件不在签名校验范围内。改这里不会触发校验，代价是 App 每次更新你都得再改一遍。

## 对面是怎么发现你的

这一节不是教你怎么绕过检测，是先让你明白为什么有人照着教程做完全套，一跑就被踢。

Frida 默认留的痕迹挺多的。默认端口 27042 是个固定值，扫一遍本机端口就能发现。进程名 `frida-server` 明晃晃挂在进程列表里。注入之后线程里会多出 `gum-js-loop` 这类名字。`/proc/self/maps` 里能看到 `frida-agent` 相关的映射。文件系统里还留着 `/data/local/tmp` 下那个二进制。

所以哪怕你只是自测，也建议从第一天就养成三个习惯。server 换个名字、放到非标准目录、监听端口改掉。这三件事花不了五分钟，能挡掉一大批粗糙的检测。

真正的检测不止这些，还有扫线程名、比对 so 加载顺序、检测 inline hook 留下的跳转指令。到那一层就要看具体 App 的检测逻辑了，通用办法不多。

## 命令行那五个工具够用了

| 工具               | 用途                                                         |
| ------------------ | ------------------------------------------------------------ |
| `frida`            | REPL，边敲边试，原型阶段最快                                 |
| `frida-ps`         | 列进程。`-U` 走 USB，`-Ua` 只列应用，`-Uai` 连已安装的一起列 |
| `frida-trace`      | 按名字批量 hook，自动生成 handler 文件供你改                 |
| `frida-ls-devices` | 列设备，多设备时拿 ID                                        |
| `frida-kill`       | 杀进程，PID 从 `frida-ps` 里拿                               |

`frida-trace` 是我用得最多的一个，尤其在还不知道目标函数叫什么的阶段。

```bash
# 跟踪所有 recv/send 开头的导出函数，日志里带上库名
frida-trace --decorate -i "recv*" -i "send*" -p 1372

# 跟 Windows 进程里 msvcrt 的 mem* 系列
frida-trace -p 1372 -i "msvcrt.dll!*mem*"

# 排在 msvcrt 之外的 open 系列
frida-trace -p 1372 -i "*open*" -x "msvcrt.dll!*open*"

# 跟一个没导出的函数，直接给偏移
frida-trace -p 1372 -a "libjpeg.so!0x4793c"

# 安卓上跟 Java 方法，签名里带 certificate，忽略大小写，只搜用户类
frida-trace -U -f com.google.android.youtube -j '*!*certificate*/isu'
```

`-a` 那条最有用，碰上静态链接或者被 strip 的 so，函数根本没有符号，只能按偏移挂。偏移从哪来，IDA 或者 Ghidra 里看一眼就有。

## Stalker 不是 hook

新手容易把 Stalker 当成 Interceptor 的加强版，其实两件事。

Interceptor 是定点打击，你知道地址，在那下钩子。Stalker 是全程录像，它跟踪整个线程，每一次跳转、每一个基本块都记下来，粒度可以到单条指令。

代价是慢，通常是几十倍的开销，跑起来风扇会响。所以它解决的是另一个问题，你不知道该 hook 谁的时候，用它看这段代码到底调了哪些函数，然后拿结果回去写 Interceptor。

支持的架构主要是 AArch64 和 x86_64，桌面和手机上够用了。

## 边界

Frida 是给开发者和安全研究员用的工具，用在自己写的 App、自己买的设备、有授权的测试上，都是正常工作。

给别人家的 App 打补丁、打包分发、做成收费工具，性质和前面完全不同。国内对非法获取计算机信息系统数据、破坏计算机信息系统这两条都有判例，落在具体行为上，不看你用了什么工具。
