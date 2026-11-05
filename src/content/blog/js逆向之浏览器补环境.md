---
title: js逆向之补环境：让 Node 假装自己是个浏览器
pubDate: 2019-03-26
description: Node 自带的 navigator 是个卧底，jsdom 的 UA 里写着自己的名字。
category: 编程技术
image: ""
draft: false
slugId: browser-env-patch
---

# 装成浏览器，比装成一个人难

一段 sign 算法拿到手，扔进 Node，第一行就报 `ReferenceError: window is not defined`。文件头补一句 `global.window = global`，报错消失，算出来的值跟浏览器里对不上。

这件差事叫补环境。名字听着像往空壳里填东西，实际做过的人都知道，填只是体力活，填完还要让对面看不出这层壳是补的。后半段才是真正花时间的地方。

## Node 早就不是当年那个 Node 了

把 Node 22 的全局对象列一遍，结果是这样。

| 名字                                                       | 有没有         |
| ---------------------------------------------------------- | -------------- |
| `window`、`self`、`document`、`location`、`history`        | 没有           |
| `localStorage`、`XMLHttpRequest`、`screen`、`chrome`       | 没有           |
| `requestAnimationFrame`、`Image`、`FileReader`             | 没有           |
| `fetch`、`WebSocket`、`Blob`、`FormData`                   | 有             |
| `crypto`、`performance`、`structuredClone`、`atob`、`btoa` | 有             |
| `navigator`                                                | 有，但是个卧底 |

卧底这个词不是修饰。Node 21 起 `navigator` 成了原生全局，`navigator.userAgent` 返回 `Node.js/22`，`navigator.platform` 返回 `Win32`，`navigator.languages` 是 `['zh-CN']`。对面只要在 UA 上做一次 `/node/i` 匹配，你就出局了，连补都省了。

两处更细的地方。`Object.prototype.toString.call(navigator)` 在 Node 里返回 `[object Object]`，真浏览器返回 `[object Navigator]`。原型上那个 `userAgent` 的 getter，`toString()` 打出来是一段完整的 JS 源码，里面明晃晃写着 `Node.js/${StringPrototypeSlice(nodeVersion, 1, ...)}`。

所以自带的 navigator 不能直接用，得整个盖掉。这条要记住，半成品比没有更危险，因为你会以为已经有了，直到算出来的值不对。

## 三条路，先看对面查得多深

| 对面查什么                      | 走哪条                               | 代价                       |
| ------------------------------- | ------------------------------------ | -------------------------- |
| 什么都不查，只要一个 sign       | 硬啃算法，补十几个对象凑合跑         | 最低，几小时               |
| 查 UA、platform、screen、canvas | 系统补环境，一条条填，填完还要过检测 | 一两天，且随时被新检测打回 |
| 查 TLS 指纹、字体渲染、鼠标轨迹 | 补环境这条路到头了，换真实浏览器     | 要浏览器，跑得慢，但最稳   |

判断依据很直接。把目标代码扔进 Node 跑一次，看第一个报错是什么。报 `window is not defined` 是好事，说明对面只是用了浏览器 API。跑完不报错、值也不对，才是麻烦的开始，那意味着它查的是环境本身。

## 先别急着补，先问它要什么

可以用 Hook 或者 Proxy 的方式批量获取调用的浏览器对象。

用 `vm` 建一个上下文，外面套一层 Proxy，读不到的属性先记一笔，再返回一个万能桩，让代码继续往下走。

```js
const vm = require("vm");
const seen = new Set();

function stub(name) {
  const fn = function () {
    return stub(name + "()");
  };
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "[stub " + name + "]";
      if (k === "length") return 0;
      if (k in t) return t[k];
      seen.add(name + "." + String(k));
      return stub(name + "." + String(k));
    },
    apply() {
      return stub(name + "()");
    },
  });
}

const sandbox = new Proxy(
  { console, Intl, result: null },
  {
    has: () => true,
    get(t, k) {
      if (typeof k === "string" && !(k in t)) {
        seen.add(k);
        return stub(k);
      }
      return t[k];
    },
  },
);

const code = require("fs").readFileSync("./target.js", "utf8");
try {
  vm.runInContext(code, vm.createContext(sandbox));
} catch (e) {
  console.log("抛出", e.message);
}
console.log([...seen]);
```

跑完会打出一串 `navigator.userAgent`、`screen.width`、`document.cookie` 这样的名字。这张单子就是你的活清单。

关键在那个 stub 兜底。不兜的话第一行就抛，你一次只能看到一个缺的东西，改一轮跑一轮，三十轮下来就崩溃了。

## 补 navigator 的三种写法，一种比一种像

第一种是源文档里的写法，对象字面量挂到 prototype 上。

```js
function Navigator() {}
Navigator.prototype = { platform: "win32" };
navigator = new Navigator();
```

`navigator.platform` 能取到，三个破绽也一起留下了。`navigator.constructor.name` 是 `Object`，因为整个 prototype 被替换掉，constructor 跟着没了。`navigator.userAgent` 是 undefined。`platform` 是个数据属性，真浏览器里它是原型上的访问器。

第二种，用 `defineProperty` 造 getter，挂在原型上，constructor 能保住。

第三种，偷 Node 自带的 `Navigator.prototype`，只换掉需要的几个 getter，顺手补一个 `Symbol.toStringTag`。

```js
const P = Object.getPrototypeOf(globalThis.navigator);
Object.defineProperty(P, Symbol.toStringTag, {
  value: "Navigator",
  configurable: true,
});
Object.defineProperty(P, "platform", {
  configurable: true,
  get: () => "Win32",
});
```

第三种最省事，原型链、constructor、`[object Navigator]` 一下就对上了。剩下的问题只有一个，getter 的源码还是 JS，一打就露。

## 对面查的就三个问题

检测写得再花，落到 `navigator` 上基本是这三件事。构造函数是不是它该是的东西，属性描述符长得对不对，那串源码里有没有 `[native code]`。

```js
const d = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(navigator),
  "platform",
);
[
  navigator.constructor.name === "Navigator",
  typeof d.get === "function",
  /\[native code\]/.test(d.get.toString()),
  Object.prototype.toString.call(navigator) === "[object Navigator]",
];
```

拿这四条去跑第一种写法，全红。跑第三种，前三绿，最后一条看有没有补 `toStringTag`。

## toString 那条，改原型上的方法才有用

```js
Object.defineProperty(fakeGetter, "toString", {
  value: () => "function get platform() { [native code] }",
});
Function.prototype.toString.call(fakeGetter); // 还是原始源码
```

`Function.prototype.toString` 不看对象自己有没有 `toString` 属性，它读的是函数的源码槽位。想让它吐假话，只能把 `Function.prototype.toString` 本身换掉，里面按白名单分派。

```js
const raw = Function.prototype.toString;
const fakeOf = new WeakMap();

const patched = function toString() {
  if (this === Function.prototype.toString)
    return "function toString() { [native code] }";
  if (fakeOf.has(this)) return fakeOf.get(this);
  return raw.call(this);
};
fakeOf.set(patched, "function toString() { [native code] }");
Function.prototype.toString = patched;

const nativeGetter = (label, fn) => {
  fakeOf.set(fn, `function get ${label}() { [native code] }`);
  return fn;
};
```

第一行那个 `this === Function.prototype.toString` 不能省。对面反查最顺手的一招就是 `Function.prototype.toString.toString()`，看这层补丁自己是不是 native。

还有一处顺序问题。如果对面在文件最前面存了一份 `const realToString = Function.prototype.toString`，你后面怎么改都是改在一个备份之后，它调备份就拿得到真源码。所以补丁要跑在目标代码之前，Node 里用 `--require` 预加载，浏览器里用油猴的 `document-start`。

## 报错栈那条，现在不太灵了

重写 `String.prototype.indexOf`，把栈里的 `modules/cjs/loader` 藏掉。

```js
const _indexOf = String.prototype.indexOf;
String.prototype.indexOf = function (v, f) {
  if (v === "/modules/cjs/loader") return -1;
  return _indexOf.apply(this, [v, f]);
};
```

能挡住的只有一种检测，对面拿 `err.stack` 然后自己调 `indexOf` 找特征。换成 `includes`、`match`、正则，或者干脆用 `Error.prepareStackTrace` 去拿 CallSite 对象，这层补丁全绕过去。

```js
Error.prepareStackTrace = (err, sites) =>
  sites.map((s) => s.getFileName() + ":" + s.getLineNumber());
new Error().stack; // 直接给出 node:internal/modules/cjs/loader:1705
```

CallSite 的 `getFileName()` 走 V8 内部，不经过任何字符串方法。这层拿到的路径该是什么就是什么。

再送一个免费特征。Windows 上跑 Node，栈里是 `C:\Users\xxx\app.js`，浏览器里是 `https://site.com/a.js`，一条正则就分出来了。真要抹掉，得把 `Error.prepareStackTrace` 和 `Error.captureStackTrace` 一起接管，成本比藏一个字符串高一个量级。

## 现成沙箱的自曝表

jsdom 和 happy-dom 是最常用的两个，跑 DOM 逻辑很顺手。拿来当反检测的底座，它们各有各的口音。

| 检查点                                      | jsdom 30.1.3              | happy-dom 21.0.4         |
| ------------------------------------------- | ------------------------- | ------------------------ |
| `navigator.userAgent`                       | 末尾带 `jsdom/30.1.3`     | 末尾带 `HappyDOM/21.0.4` |
| `navigator.platform`                        | 空字符串                  | `X11; Win32 x64`         |
| `navigator.webdriver`                       | undefined                 | true                     |
| `Object.prototype.toString.call(navigator)` | `[object Navigator]`      | `[object Object]`        |
| `canvas.getContext("2d")`                   | 不装 `canvas` 包返回 null | null                     |
| `screen`                                    | 0x0                       | 1024x768                 |

happy-dom 那行 `X11; Win32 x64` 挺有意思，Linux 的显示协议和 Windows 的平台名拼在一起，地球上没有这台机器。`webdriver` 直接是 true，装它等于自报家门。

jsdom 至少在 `[object Navigator]` 上做对了，其余的 UA、platform、canvas 都得你自己重写。它更合适的场景是拿到 HTML 之后在本地跑一段解析脚本，那里没人查你。

## canvas 这关，早晚要撞

canvas 指纹来自字体光栅化的细微差异。同一段文字在不同系统、不同显卡、不同字体版本上画出来，像素不一样，转成 base64 一哈希，就是一个稳定 ID。

同一条件多次绘制必须一致，换图片类型要变，换 quality 要变，换字体属性要变。用 jsdom 加 `canvas` 包跑一遍，四条都能验，同条件三次哈希相同，改字号、改 quality 立刻变。

一条是 `toDataURL("image/webp")` 在 Node 里会静默回落成 png，出来的前缀是 `data:image/png`，真 Chrome 里是 `data:image/webp`。对面只要看一眼前缀。

另一条更根本。Node 画出来的哈希跟任何一台真机都对不上，字体库不同，光栅化实现也不同。所以实践里没人真去模拟 canvas，都是找一台真机画一次，把那个 base64 存成常量，`HTMLCanvasElement.prototype.toDataURL` 直接返回它。对面查多少次都是同一张图，因为本来就是同一张。

## 指纹排队，按能不能伪造

| 指纹                     | 伪造难度   | 做法                                                |
| ------------------------ | ---------- | --------------------------------------------------- |
| UA、platform、language   | 低         | 几个字符串，照着真机抄                              |
| screen、devicePixelRatio | 低         | 几个数字，注意和 UA 声明的系统对得上                |
| canvas                   | 中         | 硬编码真机抓到的 base64，png、jpeg、webp 三种都要   |
| WebGL                    | 中高       | 要 GPU 厂商串、扩展列表、渲染参数，得凑成一套自洽的 |
| 字体列表                 | 高         | 要枚举本机字体并测宽度，编不出来                    |
| AudioContext             | 高         | 浮点输出跟硬件相关，几乎没法造                      |
| TLS（ja3）               | 不在 JS 层 | Python 侧用 `curl_cffi` 的 `impersonate`            |
| 行为和轨迹               | 最高       | 鼠标曲线、按键间隔，只能靠真浏览器                  |

排在后面的几项，难在没法用静态值糊过去。字体和音频的检测代码通常不明显，它只是默默算一个值塞进参数，你连它查了什么都不知道，最后只看到签名不对。

## 检测浏览器自动化特征

无头浏览器默认带一串标记。`navigator.webdriver` 是 true，某些版本会往 window 上挂 `cdc_` 开头的变量，CDP 连上之后 `console` 的行为、`Runtime.enable` 的时序，跟正常页面也有差别。headless 模式下的 `chrome.runtime`、插件列表、`Notification.permission` 也都不一样。

所以现在的路子是“用打过补丁的浏览器”。patchright 是 Playwright 的补丁版，API 跟 Playwright 完全一样，装完把 require 换掉就能跑。

## 边界

补环境本身是中性技术。给自己的系统做安全评估、抓自己账号的数据、采集公开页面，用的都是这套东西。

越过线的是两类。绕过登录和访问控制去拿不属于你的数据，国内有按非法获取计算机信息系统数据罪判的例子。把抓来的数据做成替代性产品对外卖，走的是不正当竞争。这两件事跟你怎么补环境没关系，跟你抓什么有关系。
