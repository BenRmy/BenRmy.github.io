---
title: python初级教程
pubDate: 2018-09-02
description: 学 Python 最容易走偏的地方，是把它当 C 或 Java 来学。
category: 编程语言
image: ""
draft: false
slugId: python-1level
---

# Python 入门，看完能写出会跑的小脚本

## 它到底是个什么路子的语言

Python 早年不吃香，原因很实在，那时候硬件太弱，程序性能得靠人写代码去抠。后来算力上来了，一大堆场景里“写得快”比“跑得快”值钱，脚本语言就顺势成了第一选择。

官方描述是易学、功能强、自带高层数据结构、支持面向对象、语法优雅、动态类型、解释执行。听着像广告，逐条翻译一下就知道它对你的日常意味着什么。

| 特点     | 什么意思                               | 对你的实际影响                          |
| -------- | -------------------------------------- | --------------------------------------- |
| 解释执行 | 不编译，直接跑                         | 改一行立刻验证，没有编译等待            |
| 面向对象 | 一切皆对象，整数 `10` 也有 `id` 和属性 | 能对数字调方法，能给类运行时加属性      |
| 动态类型 | 变量类型运行时可变                     | `x = 1` 之后 `x = "s"` 完全合法         |
| 强类型   | 某一刻类型确定，不做隐式转换           | `"1" + 1` 直接报错，不会偷偷拼成 `"11"` |
| 语法简单 | 缩进表达代码块                         | 代码必须工整，格式本身就是语法          |
| 易于扩展 | 能用 C/C++ 写模块接进来                | wxPython 就是 C++ 版 wxWidget 的移植    |
| 免费     | 解释器随便用                           | 谁都能自己写个实现，不交专利费          |
| 可移植   | 主流架构和系统都有解释器               | 同一份代码跨平台基本无差别              |
| 库丰富   | 决定了它的应用领域                     | 互联网、AI、移动端都有现成轮子          |

有一件事得先分清。语言是一份规范，解释器是具体的实现。实现不同，脾气就不同，同一份代码表现可能有出入。

| 实现       | 说明                                          |
| ---------- | --------------------------------------------- |
| CPython    | python.org 官方版本，C 写的，最正统，默认选它 |
| IronPython | .NET 平台上的实现                             |
| Jython     | JVM 上的实现                                  |

入门阶段别纠结，装 CPython 就行。

## 跑起来就两种方式

| 方式   | 形态                                 | 什么时候用             |
| ------ | ------------------------------------ | ---------------------- |
| 交互式 | 启动解释器，等你敲指令，执行完接着等 | 试语法、查 API、算个数 |
| 脚本式 | 指令写进 `.py` 文件，整体执行        | 所有正式代码           |

```bash
python            # 交互模式
python hello.py   # 脚本模式
```

第三种是 Notebook，用网页界面编辑和执行，做数据分析的人用得最多。

`hello.py` 长这样。

```python
# 这是注释
x = 5              # 变量在赋值时创建
if x > 2:
    print("Hello, World!")   # 缩进表示代码块
```

两种方式有个共同点，代码都没编译就直接跑了。Perl、Shell、TCL 全都这样，这是脚本语言的共性。

源码默认按 UTF-8 处理。要是你的文件不是这个编码，第一行得写声明。

```python
# -*- coding: gbk -*-

#!/usr/bin/env python3     # 指定解释器时，编码声明退到第二行
# -*- coding: cp1252 -*-
```

注释有两种。

```python
# 行注释，从 # 到行尾，解释器完全不看

def foo():
    """文档字符串，放在模块、函数、类的起始处
    严格讲它不算注释，解释器会保留它，能用 foo.__doc__ 取出来"""
    pass
```

## 缩进就是语法，认了吧

这个是 Python 最反直觉的地方，好处也很明显，全世界的 Python 代码长得都差不多。

| 语言   | 代码块边界              |
| ------ | ----------------------- |
| C      | 一对 `{ }`              |
| Shell  | 成对关键字，`if ... fi` |
| Python | 缩进相同的连续行算一块  |

后果就是，C 代码可以写得很丑照样跑，Python 写得丑直接 `IndentationError`。嵌套靠缩进层级表达。

```python
if True:
    print("level 1")
    if True:
        print("level 2")     # 再深一层就再缩一级
```

约定四空格，别用 Tab。混用迟早炸。

## 变量，赋了就有

没有声明语句，首次赋值即创建，类型跟着值走，之后还能换。

```python
x = 10
y = "Bill"                 # 单双引号等价

a, b, c = "Orange", "Banana", "Cherry"   # 一次赋多个
x = y = z = "Orange"                     # 一次赋同一个值

a = """Python is a high level
programming language."""                 # 三引号写多行
```

命名就四条规矩，记不住也行，写错了解释器会告诉你。

- 开头必须是字母或下划线
- 不能拿数字开头
- 只能有字母、数字、下划线
- 区分大小写，`age`、`Age`、`AGE` 是三个不同的变量

全局和局部的坑得单独说。函数外创建的叫全局变量，函数内外都能读。你在函数里写个同名变量，那是新建了一个局部变量，外面那个纹丝不动。

```python
x = "awesome"

def myfunc():
    print(x)        # 能读到 awesome

def myfunc2():
    x = "changed"   # 这是局部变量，外面不受影响

myfunc2()
print(x)            # 还是 awesome
```

要让函数真的改外面那个，得声明 `global`。

```python
x = "awesome"

def myfunc():
    global x        # 声明之后，下面改的就是全局那个
    x = "fantastic"

myfunc()
print("Python is " + x)   # Python is fantastic
```

## 类型先认全，别急着背

| 类别   | 类型                               |
| ------ | ---------------------------------- |
| 文本   | `str`                              |
| 数值   | `int`、`float`、`complex`          |
| 序列   | `list`、`tuple`、`range`           |
| 映射   | `dict`                             |
| 集合   | `set`、`frozenset`                 |
| 布尔   | `bool`                             |
| 二进制 | `bytes`、`bytearray`、`memoryview` |

查看类型用 `type()`，转换用同名构造函数。

```python
print(type(10))          # <class 'int'>

x = "Hello World"        # str
x = 29                   # int
x = 1j                   # complex

x = str("Hello World")
x = int(29)
x = list(("apple", "banana", "cherry"))
x = dict(name="Bill", age=36)
x = bytearray(5)

w = float("4.6")         # 字符串转 float，日常最高频
```

随机数得先导入模块，Python 没有内置的 `random()` 函数。

```python
import random
print(random.randrange(1, 10))
```

布尔值这块值得花两分钟。`bool()` 能评估任何值，规律是只要东西非空就是 True。

- 非空字符串为 True
- 非零数字为 True
- 非空 list、tuple、set、dict 为 True

被判成 False 的其实很少，`()`、`[]`、`{}`、`""`、`0`、`None`、`False` 就这么几个。写 `if items:` 比 `if len(items) > 0:` 更地道，道理就在这。

自定义类也能控制真假，实现 `__len__()` 返回 0 就行。

```python
class myclass:
    def __len__(self):
        return 0

print(bool(myclass()))   # False
```

判断类型用 `isinstance()`，需要分支处理时很方便。

```python
x = 200
print(isinstance(x, int))   # True
```

## 运算符七组，真要记的只有三个

| 组   | 运算符                                       |
| ---- | -------------------------------------------- |
| 算术 | `+ - * / % ** //`                            |
| 赋值 | `= += -= *= /= %= //= **= &= \|= ^= >>= <<=` |
| 比较 | `== != > < >= <=`                            |
| 逻辑 | `and or not`                                 |
| 身份 | `is`、`is not`                               |
| 成员 | `in`、`not in`                               |
| 位   | `& \| ^ ~ << >>`                             |

```python
7 / 2     # 3.5   真除法，永远返回 float
7 // 2    # 3     地板除
2 ** 10   # 1024  幂，别写成 ^（^ 是异或）

a = [1, 2]
b = [1, 2]
a == b    # True   值相等
a is b    # False  不是同一个对象
```

`==` 比值，`is` 比身份。判断 `None` 一律用 `is None`，别用 `== None`。

`and` 和 `or` 是短路求值，返回的是操作数本身，不一定是布尔值。这一条后面写配置默认值时天天用。

```python
name = user_input or "匿名"    # 空字符串时自动兜底
```

## 字符串，切片是硬功夫

单双引号完全等价。字符串本质是字符序列，所以能索引、能切片。

```python
a = "Hello"
a[1]        # 'e'
a[2:5]      # 'llo'     左闭右开，记住这个
a[-5:-2]    # 'Hel'     负索引从末尾算
len(a)      # 5
```

```python
"ain" in "python"      # True
"ain" not in "python"  # False
"Hello" + "World"      # 拼接
```

格式化有三种写法，优先用 f-string，可读性最好。`+` 不能拼字符串和数字，会直接 TypeError。

```python
quantity, itemno, price = 3, 567, 49.95

print(f'price is {price}')        # 首选，花括号里能塞表达式

myorder = "I want {} pieces of item {} for {} dollars."
print(myorder.format(quantity, itemno, price))   # 按顺序填

myorder = "I want to pay {2} dollars for {0} pieces of item {1}."
print(myorder.format(quantity, itemno, price))   # 按索引填
```

方法不少，按用途分一下就不乱了。

| 用途     | 方法                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| 大小写   | `upper()` `lower()` `capitalize()` `title()` `swapcase()` `casefold()`                                          |
| 查找     | `find()` `rfind()` `index()` `rindex()` `count()`                                                               |
| 判断     | `startswith()` `endswith()` `isalpha()` `isdigit()` `isalnum()` `isspace()` `islower()` `isupper()` `istitle()` |
| 修剪补位 | `strip()` `lstrip()` `rstrip()` `center()` `ljust()` `rjust()` `zfill()`                                        |
| 拆分连接 | `split()` `rsplit()` `splitlines()` `partition()` `rpartition()` `join()`                                       |
| 替换     | `replace()` `translate()` `maketrans()`                                                                         |
| 其他     | `encode()` `format()` `expandtabs()` `isidentifier()` `isprintable()`                                           |

有个前提得记住，字符串不可变。上面每个方法都返回新字符串，没有“就地改”这回事。你调了 `s.upper()` 却忘了赋值，那就等于没调。

## 条件与循环

条件语句没什么好说的，注意缩进和冒号都是语法的一部分。

```python
a, b = 200, 66

if b > a:
    print("b is greater than a")
elif a == b:
    print("a and b are equal")
else:
    print("a is greater than b")
```

分支简单的时候可以压成一行，读着也挺顺。

```python
if a > b: print("a is greater than b")

print("A") if a > b else print("B")                        # 三元
print("A") if a > b else print("=") if a == b else print("B")   # 链式，别超过两级
```

`if` 块不能空着，暂时没想好写什么就填个 `pass`。

```python
if condition:
    pass    # TODO
```

循环有两种。`while` 是条件为真就一直转。

```python
i = 1
while i < 7:
    print(i)
    i += 1
else:
    print("i is no longer less than 7")   # 条件失效后跑一次
```

`for` 是迭代序列，跟 C 那种计数器循环不是一回事。

```python
fruits = ["apple", "banana", "cherry"]
for x in fruits:      # 不需要索引变量
    print(x)
```

数次数用 `range()`。

```python
range(10)          # 0 到 9，不含 10
range(3, 10)       # 3 到 9
range(2, 30, 3)    # 2 5 8 ... 29，步长 3
```

`for` 和 `while` 后面都能挂 `else`，这个语法很多人压根没用过。规则很简单，循环没被 `break` 打断才会执行。

```python
for x in range(10):
    print(x)
else:
    print("Finally finished!")
```

拿它替代“循环结束后判断一个标志位”的写法，代码会干净不少。

`break` 直接结束整个循环，`continue` 只跳过本次。

## 函数，先把架子搭顺

```python
def my_function(fname, country="China"):   # 默认参数
    print("Hello from a function" + fname + country)
    return "ok"                            # 没写 return 就返回 None

my_function("Bill")
my_function(**{"fname": "Phoebe", "country": "Asia"})   # 字典解包传参
```

递归也能写，Python 默认栈深大约一千层，要慎用。

```python
def tri_recursion(k):
    if k > 0:
        result = k + tri_recursion(k - 1)
        print(result)
    else:
        result = 0
    return result

tri_recursion(6)
```

递归写错的典型表现是永无止境然后炸栈。能改成循环就改，除非递归写法确实更清楚，比如遍历树。
