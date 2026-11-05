---
title: JS 反混淆之 AST
pubDate: 2019-03-25
description: 反混淆的目标该定在哪，AST 三个步骤怎么串起来，visitor 和 scope 怎么用。
category: 编程技术
image: ""
draft: false
slugId: js-ast-deobfuscate
---

# 混淆过的 JS，怎么还原到人能读的样子

打开一个站，找到加密函数，格式化，两万行，变量名全是 `_0x4f2a`。字符串被塞进数组，下标是十六进制，中间插着几百个 `debugger` 和永远为真的判断。代码能跑，人读不了。

AST 反混淆就是把这些一层层剥回去。剥的过程有个前提，每改一步，程序的行为必须跟原来一模一样。

## 目标先定下来，不然会无限投入

反混淆的清单列出来有九条。解密代码、去掉最外层 IIFE 的参数、把只用一次的变量换成值、算掉能算的表达式、还原短路和类型转换的简写、删掉纯干扰的代码，这七条都能写成脚本。剩下两条只能人做，按主函数的执行顺序重排，猜变量名和函数名。

七条里每一条都有人写好了，但没人能告诉你该做到哪一步停。我的标准是能打断点、能顺着调用链把加密函数读完，就收手。再往下猜名字，投入产出比很低，你猜的 `getSign` 和它原本叫 `a` 对调试没有影响。

这件事的收益也不是线性的。字符串数组拆掉之后，代码从"完全看不懂"变成"能看出结构"，这一步最值。控制流平坦化拆掉之后，才有第二波提升。中间那些常量折叠都是顺手的事。

## AST 就是一棵树，每个节点只有 type 是必须的

`a + 1` 解析出来长这样。

```json
{
  "type": "BinaryExpression",
  "left": { "type": "Identifier", "name": "a" },
  "operator": "+",
  "right": {
    "type": "NumericLiteral",
    "extra": { "rawValue": 1, "raw": "1" },
    "value": 1
  }
}
```

实际节点上还有 `start`、`end`、`loc`，记录源码位置，我把它们省了。看结构就够了，一个二元表达式底下挂左右两个子节点，数值节点同时存了值和原文 `raw`。

括号在这棵树里不存在，优先级已经体现在嵌套关系上。这是 AST 跟源码字符串最大的区别，也是为什么改结构比正则替换安全。

## 三步，你只用管第二步

Babel 处理代码分三步，解析、转换、生成。第一步和第三步是库的事，你写的东西全在中间。

```js
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const src = fs.readFileSync("input.js", "utf-8");
const ast = parser.parse(src); // 源码进树
traverse(ast, {/* 你的 visitor 写这里 */}); // 树上改
fs.writeFileSync("output.js", generate(ast).code); // 树出源码
```

`require` 后面那个 `.default` 不能省。`@babel/traverse` 和 `@babel/generator` 是 ESM 包，CommonJS 里直接 `require` 拿到的是模块对象，调 `traverse(ast)` 会报 `not a function`。

依赖装这些。

```bash
npm install @babel/parser @babel/traverse @babel/generator @babel/types
```

## visitor 的键名就是节点类型

遍历这棵树要递归，Babel 把它包装成了访问者模式。你给一个对象，键是节点类型，值是一个函数，遍历到那个类型就调你。

```js
const visitor = {
  Identifier: {
    enter(path) {
      /* 刚进这个节点，子节点还没处理 */
    },
    exit(path) {
      /* 子节点处理完了，正在往外走 */
    },
  },
  // 一个函数管两种类型，竖线分隔
  "StringLiteral|NumericLiteral"(path) {
    /* ... */
  },
};
```

`enter` 和 `exit` 的区别决定了你能干什么。想在父节点上一次性处理完所有子节点，用 `exit`，那时子节点已经被改过了。想自上而下扫一遍，用 `enter`。

有个坑必须提前说。visitor 里改完节点，遍历还会继续往下走这个新节点。你在 `CallExpression` 里换成另一个 `CallExpression`，就会无限递归。真想要这么写，换完调 `path.skip()`。

## node 是数据，path 是位置

`path.node` 是那个纯粹的 JSON 对象，`path` 是它在树里的位置，带 parent、带 scope、带一堆操作方法。

改代码全走 path。

```js
traverse(ast, {
  BinaryExpression(path) {
    path.node.left; // 拿 node，只能读
    path.get("left"); // 拿 path，能继续操作
    path.replaceWith(t.stringLiteral("x")); // 换掉整个节点
  },
});
```

判断类型也有两套。`t.isIdentifier(path.node.left)` 判 node，`path.get("left").isIdentifier()` 判 path。功能一样，后者读起来顺一点。第二个参数可以带上字段做浅比较。

```js
t.isIdentifier(path.node.left, { name: "n" });
```

## scope 是唯一能防止你把代码改坏的东西

前面都是语法层面的事。一旦你要做"把这个变量换成它的值"，语法就不够用了，你得知道这个变量在哪定义、被谁引用、有没有被改过。

`path.scope.getBinding(name)` 返回的就是这些。

| 属性                 | 意思                                      |
| -------------------- | ----------------------------------------- |
| `path`               | 定义它的那个节点的 path，要删定义就删这个 |
| `constant`           | 有没有被重新赋值过，false 就别内联        |
| `referenced`         | 有没有被引用，false 说明是死代码          |
| `referencePaths`     | 所有引用点的 path 数组，替换时用这个      |
| `constantViolations` | 所有赋值的 path，判断能不能安全替换靠它   |

判断"只用一次"就是 `referencePaths.length === 1 && constant`。两个条件缺一个都会改坏代码，只看引用数不看 constant，遇到后面被重新赋值的变量就出错。

有个坑我自己踩了一次才明白。改完一批节点，`binding` 里的引用信息不会自动更新，你还拿着旧数据做判断。得手动 `scope.crawl()` 重扫一遍。

刷新之后还有一个陷阱，旧的 binding 对象已经作废了。

```js
traverse(ast, {
  Program(path) {
    path.scope.crawl(); // 重扫，重建所有 binding
    const b = path.scope.getBinding("_arr"); // 必须重新取，旧对象不会更新
    if (b && !b.referenced) b.path.remove();
  },
});
```

我第一版把 binding 存进 Map 里复用，crawl 之后拿它判断 `referenced`，永远返回 true，数组声明怎么都删不掉。查了半天才反应过来，那个对象是快照，不是句柄。

## 一个完整的例子，把字符串数组拆掉

这是最常见的一层混淆。

```js
// 还原前
const _0x1a2b = ["sign", "timestamp"];
function _0x3c4d(i) {
  return _0x1a2b[i];
}
const a = _0x3c4d(0);
const b = _0x3c4d(1);
```

思路分两步。先认出 `function f(i){ return arr[i] }` 这种壳函数，把数组记下来。再把所有 `f(数字)` 的调用换成对应的字符串。

```js
const stringArrays = new Map(); // 壳函数名 -> 数组节点

traverse(ast, {
  FunctionDeclaration(path) {
    const { id, params, body } = path.node;
    if (!id || params.length !== 1) return;
    const ret = body.body[0];
    if (!t.isReturnStatement(ret)) return;
    const arg = ret.argument;
    if (!t.isMemberExpression(arg) || !arg.computed) return;
    if (!t.isIdentifier(arg.object)) return;

    const b = path.scope.getBinding(arg.object.name);
    if (!b || !b.constant || !t.isArrayExpression(b.path.node.init)) return;

    stringArrays.set(id.name, {
      arr: b.path.node.init,
      arrayName: arg.object.name,
    });
    path.remove(); // 壳函数用完就删
  },
});
```

第二遍遍历做替换。

```js
traverse(ast, {
  CallExpression(path) {
    const { callee, arguments: args } = path.node;
    if (!t.isIdentifier(callee) || args.length !== 1) return;
    const hit = stringArrays.get(callee.name);
    if (!hit || !t.isNumericLiteral(args[0])) return;
    const el = hit.arr.elements[args[0].value];
    if (!t.isStringLiteral(el)) return;
    path.replaceWith(t.stringLiteral(el.value));
  },
});
```

跑完输出是这样。

```js
const a = "sign";
const b = "timestamp";
```

数组声明的清理接的是前面那段 `crawl` 加 `getBinding`，三块拼起来才是这个结果，只跑前两块会留下一行没人用的 `const _0x1a2b = [...]`。

为什么分两遍遍历。第一遍处理函数声明，第二遍处理调用。放一遍里也能写，但同一个 visitor 里既删函数又改调用，节点顺序会给你添麻烦，分开更省心。

## 五类混淆，分别怎么打

| 混淆手法                  | 特征                                               | 怎么处理                                          |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| 字符串数组                | 顶部一个大数组，下面全是 `_0x1234(0x5)`            | 上面那个例子，一遍过                              |
| 十六进制与 Unicode 字面量 | `0x1f`、`\u0061` 满屏                              | 解析之后本来就是字面量节点，生成时自动变十进制    |
| 常量表达式                | `!![]`、`"a" + "b"`、`1 + 2`                       | visitor 判两边都是字面量就直接算                  |
| 控制流平坦化              | 一个 `while(1)` 里套 `switch(_0x[i++])`，全是 case | 最贵的，要按执行顺序重建基本块，通常得上现成工具  |
| 死代码与调试保护          | 永远走不到的分支、成片的 `debugger`                | 判条件真值，删掉；`debugger` 直接 `path.remove()` |

第三行有个细节值得留意。生成的代码里 `0x1f` 会变回 `31`，因为 parse 之后存的只有 `value`，`raw` 只是个附属字段，generator 默认不认它。所以"十六进制还原"这件事你什么都不用做，跑一遍就没了。

第四行值得多说两句，它是唯一一个不适合手写的。平坦化之后，一个函数被拆成几十个 case，靠一个状态变量决定下一步跳哪个。要还原，得先找到那个状态变量，按它的赋值把 case 串成执行链，再重建基本块。这中间任何一步漏了边，代码就少一段。现成工具处理这个也是半自动，出来还得人工对一遍。

还有一件事前面没提。内联的时候如果需要造临时变量，别自己起名字，用 `path.scope.generateUidIdentifier("tmp")`，它会避开当前作用域里所有已有的名字。手写一个 `tmp` 撞上对方原有的变量，这种 bug 最难查，因为生成的代码看起来完全正常。

## 别从零写，先看这两个轮子

`webcrack` 专门对付 obfuscator.io 那一套，字符串数组、控制流平坦化、bundle 拆包都做了。拿到一个明显是 obfuscator.io 产物，先让它跑一遍，能省掉你两天的活。

`ben-sb/javascript-deobfuscator` 通用一些，把一个站整个丢进去，出来一个能读的版本，还能在网页上用。比前者慢，但覆盖面广。

两个都跑不出结果，再自己写插件。自己写的价值在于能针对某一个站的特定写法，通用工具处理不了的那一层，往往就是这家站自己加的东西。

`astexplorer.net` 留着，写 visitor 之前把一小段代码粘进去看一眼结构，比在脑内推快得多。

## 边界

AST 这个技术本身跟混淆无关，它也是压缩器、类型检查、代码格式化的底座。用在反混淆上，对象通常是自己负责的系统、自己账号的数据，或者公开页面。

越过去的是两类。绕过登录和访问控制去取不属于你的数据，国内已有按非法获取计算机信息系统数据罪判的案子。把还原出来的接口拿去做替代性产品对外卖，走的是不正当竞争。这两条跟你会不会写 Babel 插件没关系。
