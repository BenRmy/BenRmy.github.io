---
title: python中级教程
pubDate: 2018-09-02
description: 容器怎么选，参数到底怎么传，类和对象怎么用，迭代器和生成器省在哪，异常怎么处理才不会把 bug 埋掉，代码怎么拆成模块。
category: 编程语言
image: ""
draft: false
slugId: python-2level
---

# Python 中级，写到别人愿意接着维护

## 四大集合，先学会选

选错类型不会报错，只会让你在语义和性能上同时吃亏。

| 类型 | 有序 | 可变 | 可重复 | 索引 | 字面量 | 什么时候用 |
|---|---|---|---|---|---|---|
| `list` | 是 | 是 | 是 | 是 | `[]` | 有顺序的一组数据，栈、队列 |
| `tuple` | 是 | 否 | 是 | 是 | `()` | 固定结构，坐标、多返回值，能当 dict 键 |
| `set` | 否 | 只能增删项 | 否 | 否 | `{}` | 去重、判断成员、集合运算 |
| `dict` | 插入顺序（3.7 起保证） | 是 | 键不能重 | 按 key | `{}` | 键值映射、配置、计数 |

一个具体的差距，是判断某个值在不在容器里，`set` 是 O(1)，`list` 是 O(n)。数据量上千之后这个差别肉眼可见。

## list，用得最多也最容易翻车

```python
thislist = ["apple", "banana", "cherry", "orange", "kiwi", "melon", "mango"]

# 读
thislist[1]        # 'banana'
thislist[-1]       # 'mango'    负索引
thislist[2:5]      # 索引 2 到 4，不含 5
thislist[-4:-1]    # 倒数第 4 个到倒数第 2 个

# 改
thislist[1] = "mango"

# 遍历、判成员、取长度
for x in thislist: ...
if "apple" in thislist: ...
len(thislist)

# 增
thislist.append("orange")        # 末尾追加
thislist.insert(1, "orange")     # 指定位置插入

# 删，四种语义完全不同
thislist.remove("banana")   # 按值删，值不存在会 ValueError
thislist.pop()              # 按索引删，默认删最后一个，返回被删元素
del thislist[0]             # 按索引删，不返回值
thislist.clear()            # 清空但保留列表对象
del thislist                # 连变量一起删

# 复制
mylist = thislist.copy()
mylist = list(thislist)

# 合并
list3 = list1 + list2       # 生成新列表
list1.extend(list2)         # 原地扩展，省一次分配
for x in list2:             # 手工等价写法，不推荐
    list1.append(x)
```

下面这段得单独拎出来。`b = a` 是给同一张列表起了第二个名字，不是复制。

```python
a = [1, 2, 3]
b = a          # 同一个对象，两个名字
b.append(4)
print(a)       # [1, 2, 3, 4]  a 也变了
```

真要复制用 `a.copy()`、`list(a)` 或者 `a[:]`。但这三个都是浅拷贝，列表里装着可变对象（比如嵌套列表）时，内层还是共享的。

```python
import copy
deep = copy.deepcopy(a)   # 需要彻底隔离时用它
```

方法清单，扫一眼就行：`append` `clear` `copy` `count` `extend` `index` `insert` `pop` `remove` `reverse` `sort`

`sort()` 原地排序，返回 `None`。`sorted(x)` 返回新列表。日常真正好用的是 `sorted(lst, key=lambda x: x[1], reverse=True)` 这种带 key 的写法。

## tuple，不可变换来的好处

```python
thistuple = ("apple", "banana", "cherry")

onetuple = ("apple",)    # 单项元组必须有逗号，否则只是加了括号的字符串
print(thistuple[1])      # 支持索引和切片
print(thistuple[-1])

# 不可变，但可以曲线改
x = ("apple", "banana", "cherry")
y = list(x); y[1] = "kiwi"; x = tuple(y)

for item in thistuple: ...   # 可遍历
"apple" in thistuple         # 可判成员
len(thistuple)               # 可取长度

t3 = tuple1 + tuple2         # 合并成新元组
del thistuple                # 只能整体删，不能删元素
```

只有两个方法，`count()` 和 `index()`。

值得用它的理由有三个。不可变意味着可哈希，能当 dict 的键、能塞进 set。语义上它明说这条记录不该被改。解包天然友好。

```python
x, y = (10, 20)          # 坐标解包

def f():
    return 1, 2          # 实际返回的是 tuple
```

## set，去重和集合运算

```python
thisset = {"apple", "banana", "cherry"}

# 无序无索引，thisset[0] 会报错
for x in thisset: ...
"banana" in thisset

thisset.add("orange")
thisset.update(["orange", "mango", "grapes"])   # 批量加

thisset.remove("banana")    # 不存在则 KeyError
thisset.discard("banana")   # 不存在也不报错，优先用这个
x = thisset.pop()           # 随机弹一个，因为无序
thisset.clear()
del thisset

set3 = set1.union(set2)     # 并集，返回新集合
set1.update(set2)           # 并集，原地更新
```

方法还有 `difference` `intersection` `symmetric_difference` `isdisjoint` `issubset` `issuperset`，每个都有对应的 `*_update` 原地版本。

两个高频用法。`list(set(data))` 去重，注意会丢顺序；`set(a) & set(b)` 找共同元素。

## dict，Python 里最重要的结构

```python
thisdict = {
    "brand": "Porsche",
    "model": "911",
    "year": 1963,
}

x = thisdict["model"]        # 键不存在就 KeyError
x = thisdict.get("model")    # 键不存在给 None
x = thisdict.get("color", "red")   # 给个默认值，最常用

thisdict["year"] = 2022      # 改
thisdict["color"] = "red"    # 键不存在就是新增

# 三种遍历
for k in thisdict: ...                    # 只有键
for v in thisdict.values(): ...           # 只有值
for k, v in thisdict.items(): ...         # 键和值，最常用

if "model" in thisdict: ...               # 判断的是键
len(thisdict)

# 删
thisdict.pop("model")        # 按键删，返回值
thisdict.popitem()           # 删最后插入的一项
del thisdict["model"]
thisdict.clear()

# 复制
mydict = thisdict.copy()
mydict = dict(thisdict)
```

嵌套字典拿来表达结构化数据很顺手。

```python
myfamily = {
  "child1": {"name": "Phoebe Adele", "year": 2002},
  "child2": {"name": "Alex", "year": 2005},
}
```

方法清单：`clear` `copy` `fromkeys` `get` `items` `keys` `pop` `popitem` `setdefault` `update` `values`。

`setdefault(k, default)` 是写分组和计数最干净的写法。键不存在就插入默认值并返回，存在就直接返回现值，一行顶三行。

## 函数，参数这层真相得说清

默认参数那行看着人畜无害，坑很大。

```python
def greet(fname, country="China"):
    return f"Hello {fname} from {country}"
```

默认值在函数定义时求值一次，之后一直复用。所以绝不能拿可变对象当默认值。

```python
def bad(item, bucket=[]):      # 这个 [] 全程序共享
    bucket.append(item)
    return bucket

bad(1)   # [1]
bad(2)   # [1, 2]  不是你想要的 [2]
```

正确写法是这样。

```python
def good(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket
```

传参还有解包这一层。`*` 把序列摊成位置参数，`**` 把字典摊成关键字参数。

```python
my_function(**{"fname": "Phoebe", "country": "Asia"})   # 字典变关键字参数
args = ["Phoebe", "Asia"]
my_function(*args)                                       # 列表变位置参数
```

定义函数时反过来，`*args` 把多余位置参数收成元组，`**kwargs` 把多余关键字参数收成字典。写装饰器和通用封装全靠它。

递归前面提过，这里补一句代价。每层压栈，Python 默认递归上限大约一千，数据量大就换循环或者生成器。

lambda 是只能装一个表达式的小函数。

```python
x = lambda a, b, c: a + b + c
print(x(5, 6, 2))     # 13
```

它真正好用的地方是闭包和回调。

```python
def myfunc(n):
    return lambda a: a * n     # 返回一个乘 n 的函数

tripler = myfunc(3)
print(tripler(11))             # 33

data.sort(key=lambda r: r["age"])          # 排序场景最常见
list(filter(lambda v: v > 0, nums))
```

有名字、有逻辑、要复用，就老老实实写 `def` 函数。lambda 不是缩短版的 def 函数。

## 类和对象，够用就行

类是数据和行为的组合。定义类就是定义一个新类型，实例化就是创建这个类型的对象。

```python
class Person:
    species = "human"              # 类变量，所有实例共享

    def __init__(self, name, age): # 构造时自动调用
        self.name = name           # 实例变量，每个实例独有
        self.age = age

    def greet(self):               # 方法，第一个参数固定是 self
        return f"{self.name}, {self.age}"

    def __del__(self):
        print("销毁对象！")         # 对象销毁时调用，不能带参数

p = Person("Bill", 30)
print(p.greet())
```

`__init__` 是初始化函数。Python 里定义多个 `__init__` 没意义，后一个覆盖前一个，别指望像 C++ 那样靠参数个数重载。

`__del__` 在对象销毁时调用，`del p` 能显式触发。但资源释放别依赖它，用 `with`。

类变量和实例变量的区别得记牢。

| 类型 | 定义位置 | 归属 | 改了谁受影响 |
|---|---|---|---|
| 类变量 | 类体里直接写 | 所有实例共享 | 通过 `类名.var` 改，所有实例都看见 |
| 实例变量 | `self.xxx` | 单个实例 | 只影响这一个实例 |

有个细节容易误会。实例“继承”到的类属性不是副本，是指向。但你给实例属性赋值不会回写到类。

```python
class Student:
    name = "xxx"

    def __init__(self, name):
        self.name = name     # 建的是实例属性，把类属性挡住了

s = Student("yyy")
print(s.name, Student.name)   # yyy xxx
```

继承和 `super()` 这样写。

```python
class Student(Person):
    def __init__(self, name, age, school):
        super().__init__(name, age)   # 不用写父类名，自动找父类
        self.school = school
```

Python 支持多重继承，Java 不支持。多个基类有同名属性时，排在前面的那个生效。规则细节后面高级篇再展开。

## 迭代器和生成器，省内存的主力

先看 `for` 背后到底发生了什么。它干三件事。

1. 对容器调 `iter()`，拿到迭代器对象
2. 迭代器必须实现 `__next__()`
3. `__next__()` 逐个返回元素，耗尽时抛 `StopIteration`，`for` 收到就停

照这个协议自己写一个反向迭代器，长这样。

```python
class Reverse:
    """反向遍历序列的迭代器"""
    def __init__(self, data):
        self.data = data
        self.index = len(data)

    def __iter__(self):        # 有 __next__ 时，返回 self 就够
        return self

    def __next__(self):
        if self.index == 0:
            raise StopIteration
        self.index -= 1
        return self.data[self.index]
```

`next(it)` 就是手动调一次 `__next__()`。

同样的事用生成器，五行。

```python
def reverse(data):
    for index in range(len(data) - 1, -1, -1):
        yield data[index]
```

`yield` 帮你自动做了三件事。

| 自动做的事 | 省掉的代码 |
|---|---|
| 实现 `__iter__` 和 `__next__` | 不用写迭代器类 |
| 保存局部变量和执行位置 | 不用 `self.index` 和 `self.data` |
| 结束时抛 `StopIteration` | 不用手写终止判断 |

每次 `next()` 都从上次离开的那一行接着跑，状态完整保留。这就是惰性求值，不调就不算，边算边给。

生成器表达式写法像列表推导，外层换成圆括号。

```python
gen = (i * i for i in range(10))    # 圆括号
sum(i * i for i in range(10))       # 直接喂给外层函数，最典型
```

三种形式挑一下。

| 形式 | 内存 | 能否反复遍历 | 灵活度 |
|---|---|---|---|
| 列表推导 `[f(x) for x in ...]` | 全量驻留 | 能 | 高 |
| 生成器表达式 `(f(x) for x in ...)` | 逐个产出 | 一次性 | 中 |
| `yield` 生成器函数 | 逐个产出 | 一次性 | 最高 |

判断标准很简单。数据要多次用就选列表，只“流过一遍”就选生成器。处理一个 G 的日志文件时，这个选择决定程序是跑完还是被 OOM 杀掉。

## 异常，别见一个抓一个

三个词别混。

| 词 | 含义 | 例子 |
|---|---|---|
| 解析错误 | 代码没通过解析，报错会带箭头指出位置 | 少了个冒号 |
| 异常 | 语法没问题，执行时炸 | `KeyError`、`ZeroDivisionError` |
| 错误信息结构 | 最后一行是异常类型，前面是堆栈回溯 | 看 traceback 就知道 |

完整的写法带 `else` 和 `finally`。

```python
import sys

for arg in sys.argv[1:]:
    try:
        f = open(arg, 'r')
    except OSError:
        print('cannot open', arg)
    except ValueError:
        print("Could not convert data to an integer.")
    else:
        print(arg, 'has', len(f.readlines()), 'lines')
        f.close()          # 只有 try 没抛异常才走到这
```

`except` 后面能绑一个变量接住异常实例，参数在 `instance.args` 里。它实现了 `__str__`，直接打印就是参数内容。

还有个容易忽略的点，异常处理的范围比你想的大。`try` 里调用的函数，它内部抛的异常同样会被这里的 `except` 接住，哪怕异常产生在几层调用之后。

主动抛异常用 `raise`。

```python
raise ValueError("bad input")   # 参数是异常实例或者异常类

try:
    risky()
except Exception:
    log()
    raise                       # 只记录不处理，原样再抛，栈信息保留
```

自定义异常有个规范。

```python
class AppError(Exception):
    """模块级基类"""

class ConfigError(AppError):
    """具体错误"""

class NetworkError(AppError):
    pass
```

都从 `Exception` 派生，名字以 `Error` 结尾，模块先定基类再定子类。这样调用方可以 `except AppError` 一次兜住整个模块，也能精确抓某一类。

`finally` 的四条规则背一下，都是踩过才知道疼的。

1. `try` 里的异常没被 `except` 处理，会在 `finally` 执行完才重新抛出
2. `except` 或 `else` 里抛的异常也一样，等 `finally` 执行完才重新抛出
3. `try` 里遇到 `break`、`continue`、`return`，`finally` 在跳转之前执行
4. `finally` 里写 `return` 会覆盖 `try` 里的返回值，一般别这样写

资源管理最后落到 `with`。

```python
with open("myfile.txt") as f:
    for line in f:
        print(line, end="")
```

不管中间抛不抛异常，退出 `with` 时文件一定关掉。文档里声明支持上下文管理的对象，都该这样用。

## 模块与包，把代码拆开

一个 `.py` 文件就是一个模块。

```python
# fibo.py
def fib(n): ...

print(__name__)     # 直接运行时是 "__main__"，被导入时是 "fibo"
```

模块里的语句只在第一次被导入时执行。所以改完模块要么重启解释器，要么 `importlib.reload(modulename)`。

每个模块有自己的私有符号表，模块作者用全局变量不会和调用方撞车。

`if __name__ == "__main__"` 这行是 Python 最重要的工程习惯之一。

```python
if __name__ == "__main__":
    import sys
    fib(int(sys.argv[1]))
```

```bash
python fibo.py 50    # __name__ 是 "__main__"，这段执行
import fibo          # __name__ 是 "fibo"，这段跳过
```

有了它，同一个文件既是能导入的库，又是能跑的 CLI，测试代码也不会在 import 时被触发。

导入有三种形式。

```python
import sound.effects.echo                  # 必须写全名 sound.effects.echo.xxx
from sound.effects import echo             # 用 echo.xxx
from sound.effects.echo import echofilter  # 直接用 echofilter()
```

`from pkg import *` 会塞一堆不知道是什么的名字进来，还可能覆盖你已有的定义。生产代码别用。

导入时找模块的顺序是先内置，再按 `sys.path` 找。`sys.path` 初始包含三样东西。

1. 输入脚本所在目录，没有脚本时是当前目录
2. `PYTHONPATH`
3. 安装相关的默认路径

脚本目录排在标准库路径前面，所以你自己写的 `random.py` 会盖掉标准库的 `random`。文件名别跟标准库撞。

包就是带点号的模块命名空间，目录下必须有 `__init__.py`，可以是空文件。

```python
# 同级包之间能用相对导入
from . import echo
from .. import formats
from ..filters import equalizer
```

相对导入基于当前模块名。主模块的 `__name__` 永远是 `"__main__"`，所以入口脚本只能用绝对导入，这点别记错。
