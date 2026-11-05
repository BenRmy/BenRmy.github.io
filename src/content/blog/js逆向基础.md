---
title: JS 逆向：先搞清楚你要的是参数还是算法
pubDate: 2019-03-24
description: 四条技术路线怎么选，加密点在哪找，hook 该挂在哪一层。
category: 编程技术
image: ""
draft: false
slugId: js-reverse-basics
---

# 抓到一个 sign 参数，然后呢

抓包看到 `sign=8f2c...`，三十几位，每次刷新都变。去掉它，请求被拒。接下来的工作全在一件事上，这个值从哪来，怎么算出的。

这门手艺叫 JS 逆向。名字听着凶，实际干的事很朴素，把对方浏览器里跑过的一段逻辑找出来，看懂，在自己的程序里重跑一遍。找得到、看得懂、跑得起来，三件事，卡在哪一步决定了你该选什么方案。

## 四条路，先选再动手

同一道题有四种解法，成本差得很远。选错的代价是三天后才发现方向不对，推倒重来。

| 做法 | 什么时候用 | 代价 |
|---|---|---|
| 白盒还原 | 代码没混淆，或者只是简单压缩，算法是标准 AES、RSA、MD5 | 逐行翻译成 Python，纯手工，慢，但结果最干净 |
| Node 还原 | 算法复杂、依赖一堆内部函数，但跟设备指纹无关 | 要补环境，`window`、`navigator`、`document` 一个个喂进去，缺一个就报 undefined |
| RPC 调用 | 同上，但你不关心它怎么算，只要结果 | 最快，线上得挂一个浏览器，那个浏览器死了你就断了 |
| 浏览器自动化 | 算法跟设备指纹、支付环境强绑定，拆不出来 | 最接近真人，痕迹也最多，速度慢一个量级 |

判断顺序我一般这样走。先花十分钟格式化代码看一眼，能读懂就走白盒。读不懂但函数看着自成体系，试 Node。Node 补环境补到崩溃，上 RPC。RPC 也被识别，最后才是自动化。

## 第一步看请求，别从代码翻起

新手常犯的错是打开 Sources 就从第一个文件看。几万行压缩代码，翻到天亮也找不到。

Network 面板才是入口。切到 Fetch/XHR，刷新，找到那个带 sign 的请求，看三样东西。

Payload 里有几个自定义参数，哪一个你没见过。Headers 里有没有 `x-` 开头的自定义头。Initiator 那一列写着发起请求的调用栈，点开就是哪个函数里的哪一行发的。

Initiator 是这里最省时间的东西。它直接给出调用链，从上往下就是执行顺序。很多时候加密函数就在这条链的第二三层，点进去是个叫 `getSign` 或者干脆叫 `a` 的函数。

## 搜不到的时候，去内存里找

全局搜 `sign`，在压缩代码里经常一个结果都没有。变量全改名成 `a`、`b`、`_0x4f2a`，字符串被拆开拼接，`sign` 可能写成 `"si"+"gn"`。

这时候有两个办法。

一个是搜具体的值。把某个参数的值复制出来，比如时间戳 `1730000000000`，全局搜这串数字。如果它是 `Date.now()` 现生成的，搜不到，换思路。

另一个是内存快照。DevTools 的 Memory 面板，点 Take snapshot，等它抓完，在快照里搜那个值。快照能看到对象之间的引用关系，顺着引用往回找，就能摸到持有这个值的对象和生成它的函数。这一步慢，对付把参数藏在闭包里的代码很有效。

## 断点比搜索可靠

搜不到就走断点。四种，按命中率排。

**XHR 断点**打在 URL 上。Sources 面板右侧的 XHR/fetch Breakpoints，加一个关键词，比如 `/api/order`。请求一发出去就停在发起它的那一行，栈里往上翻两层基本就是参数拼装的地方。这招专治参数在 body 里的情况，因为全局搜关键词搜的是 URL，body 里的字段搜不到。

**事件断点**打在按钮上。Event Listener Breakpoints 里勾 `click`，点页面上的按钮，直接停在事件处理函数第一行，再单步往下走。适合点了才发请求的流程。

**DOM 断点**打在节点上。Elements 面板右键节点，Break on，选 attribute modifications 或者 subtree modifications。适合盯着某个数字什么时候被改。

**条件断点**用在不方便停的地方。滑块拖动那条轨迹，鼠标一动就生成几百次，普通断点停下来几十次没法看。右键行号，Edit breakpoint，条件写 `console.log(this.xxx)`，它就不停了，只打日志。这个用法比断点本身有用。

## Hook 是包一层，位置比写法重要

原理一句话能说完。把原函数存起来，用同名函数替换，里面先干自己的事，再调用存起来的那个。跟 Python 装饰器一个思路。

```js
const _sign = window.sign;

window.sign = function (a, b) {
    const ret = _sign(a, b);
    console.log("[sign]", a, b, ret);
    return ret;
};
```

难的地方在什么时候注入。业务代码执行过一次之后，你替换的就不是它实际持有的那个引用了。

三个位置，从早到晚。

**油猴脚本**，头部写 `@run-at document-start`。默认值是 `document-idle`，页面渲染完才跑，那时加密函数早就调用过一轮了。这是新手最常踩的坑，脚本写得没错，一条日志都没有。

**DevTools Snippets**，Sources 面板左侧。适合调试阶段手动跑，缺点是刷新就没了，得重新执行一次。

**Local Overrides**，也在 Sources 面板。把线上 JS 拦下来存到本地，改完保存，浏览器以后加载的是你改过的那份。这招最彻底，刷新就生效，还能直接在里面加 `console.log` 和断点。

cookie hook 示例，先拿到原生描述符再转调。

```js
const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

Object.defineProperty(document, "cookie", {
    configurable: true,
    get() {
        return desc.get.call(document);
    },
    set(v) {
        if (String(v).includes("sign=")) {
            console.log("[cookie]", v);
        }
        return desc.set.call(document, v);   // 必须转调，否则写不进去
    },
});
```

## 停在断点时，把函数捞出来

断在某一行，控制台里能直接调当前作用域的函数。这个窗口很窄，`resume` 一按就没了，下次想调又得重新断。

想反复试参数，就在停下的时候把函数挂到全局。

```js
// 断在该函数内部时执行，之后不打断点也能直接调
window._sign = sign;
```

```js
_sign("123", "456");   // 换着参数试，不用重开断点
```

试完记得 `delete window._sign`，免得污染页面。

顺带说个补环境时经常撞的事。有些加密文件末尾带一句 `"undefined" != typeof exports ? exports : void 0`，用来兼容 CommonJS 导出。浏览器里 `typeof exports` 是 `undefined`，走后面那半句，整个表达式返回 undefined。Node 里 `exports` 是个对象，走前面，返回的是 exports。同一份代码放进 Node 直接跑，行为跟在浏览器里就不一样，报错还指向别的地方。补环境补到最后发现算出来的值对不上，八成是这个。

## toString 那条检测，反过来用就行

反调试里最常见的一招是比函数源码。hook 过的函数，`toString()` 出来是包装后的代码，跟原始字符串不一样，一比就露馅。

```js
// 页面里的检测，原串是它自己写死的那份
test + "" == "function test(aa,bb){cc=aa+bb;return cc;}"
    ? console.log("无修改")
    : setInterval(function () { eval("debugger") }, 1000);
```

反制就是连 `toString` 一起 hook。

```js
const _toString = Function.prototype.toString;

Function.prototype.toString = function () {
    if (this.name === "sign") {
        return "function sign(a, b) { return a + b; }";   // 返回它期待的字符串
    }
    return _toString.call(this);
};
```

这段检测本身有个毛病，写的人多半没注意。它比的是格式化之前的原始字符串，只要代码被压缩器处理过一次，这个比较就永远返回 false，然后无条件进死循环 debugger。所以你遇到页面一打开就卡死、F12 一按就停不下来，先怀疑这段，再怀疑自己的插件。

处理无限 debugger 有三条路。Ctrl+F8 停用所有断点，最省事。在 debugger 那一行右键选 Never pause here，只跳过这一处。或者用 Local Overrides 把那段代码直接删了。

## 反调试的七层，越往后越贵

| 层级 | 具体做法 | 处理成本 |
|---|---|---|
| 混淆 | JSFuck、控制流平坦化、字符串数组 | 格式化后硬读，严重的上 AST 还原 |
| 环境检测 | `navigator.webdriver`、`window.chrome`、插件列表 | 补参数，或者用真实浏览器加 CDP 端口 |
| 检测调试 | 控制台检测、执行时间差、窗口尺寸 | 改代码替换，或者停用断点 |
| eval 加密 | 运行时拼字符串再 eval | hook `eval` 打印明文 |
| jsVMP | 自定义字节码加一个解释器 | 只能在解释器里 hook 关键参数，整体还原基本没戏 |
| wasm | 逻辑编译成 WebAssembly | `wasm2js` 转回 JS，或者 `pywasm` 在 Python 里跑 |
| 指纹 | ja3、canvas、字体 | 自定义指纹库 |

前四层都能靠手工解决，第五层开始就是体力活。jsVMP 那种东西别想着还原，找到它把参数吐出来的位置，在那里 hook，比什么都快。

## ja3 这条，Python 现在能过了

ja3 是把 TLS 握手里的加密套件、扩展、椭圆曲线拼起来做一次哈希。`requests` 底层走 OpenSSL，握手参数跟浏览器差得远，算出来的哈希一眼能分辨。

现在有 `curl_cffi`，它把 libcurl 和浏览器的指纹配置打包在一起，能直接套某个版本的 Chrome。

```bash
pip install curl-cffi
```

```python
from curl_cffi import requests

resp = requests.get(
    "https://example.com/api",
    impersonate="chrome",          # 也可以写 chrome124、safari17_0 这类具体版本
    timeout=10,
)
print(resp.status_code, resp.json())
```

用法跟 `requests` 几乎一样，`Session`、`cookies`、`proxies` 都在，迁移成本很低。

它解决的是传输层指纹，管不了 JS 层算出来的参数。两件事别混。

## 边界

这些技术本身中立，用在哪由人决定。给自己负责的系统做安全评估、抓自己账号的数据、采集公开页面，都是正常的技术工作。

越过这条线的是两类。绕过登录和访问控制去拿不属于你的数据，国内已有按非法获取计算机信息系统数据罪判的案子。把抓来的数据做成替代性产品对外卖，走的是不正当竞争。这两条跟你的技术选型没关系，跟你抓什么有关系。
