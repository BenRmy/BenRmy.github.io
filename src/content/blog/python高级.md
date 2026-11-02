---
title: python高级教程
pubDate: 2018-09-02
description: 属性访问、动态能力、迭代协议、模块包和异常的组织方式。
category: 编程语言
image: ""
draft: false
slugId: python-3level
---

# Python 高级，搞清楚它为什么这么设计

## 先把最底层那条说清，变量是名字

变量是对象的引用，不是装值的盒子。这句话听着像概念题，实际上决定了你后面所有的调试方向。

```python
class Student:
    name = "xxx"

    def __init__(self, name, age):
        self.name = name      # 建的是实例属性，不是改类属性
        self._age = age

a = Student("xxx", 25)
print(id(a.name), id(Student.name))   # 两个 id 相同，指向同一个字符串对象
print(Student.name)                   # 还是 "xxx"，类属性没动
```

从类继承到的属性不是复制出来的副本，是指向同一个对象。这一条推下去有三个后果，每个都会咬人。

| 现象 | 机制 | 后果 |
|---|---|---|
| `self.name = name` 写在 `__init__` 里 | 建实例属性，把同名类属性挡住 | 类属性原值不变，你只是看不见它 |
| 传对象给函数“代价很小” | 传的是指针 | 函数里改了对象，调用方看得见 |
| list 能“id 不变而内容变” | 容器可变，改的是内部元素 | 默认参数陷阱、浅拷贝问题全从这来 |

```python
def mutate(items):
    items.append(99)     # 原地改，调用方看得见

data = [1, 2]
mutate(data)
print(data)              # [1, 2, 99]
```

所以 Python 里没有“值传递还是引用传递”这个二选一，只有传对象引用。不想被改，函数里先 `copy()`，或者约定只返回新对象。

## 可见性这件事，Python 只有约定

C++ 和 Java 有 `public`、`private`。Python 没有，只有命名约定。

| 写法 | 约定 | 实际行为 |
|---|---|---|
| `name` | 公开 | 随便访问 |
| `_name` | 内部用 | 照样能访问，只是提醒你别碰 |
| `__name` | 私有 | 名字被改写（name mangling）成 `_ClassName__name` |
| `__name__` | 双下划线包围 | 系统保留，别自己造 |

`__` 开头的东西在类外面直接访问会失败。

```python
class Student:
    __version = "1.0"

s = Student()
# s.__version          # AttributeError
print(s._Student__version)   # "1.0"  改写后照样能强行访问
```

能强行访问说明它不是锁，是挡板。防误用可以，别当安全边界。

## 只读属性，两条路各有代价

默认所有实例成员都可读可写。要“只读”或者“写入时校验”，有两种做法。

### 路线一，`@property`，大多数情况选它

```python
class Student:
    def __init__(self, name, age):
        self.name = name
        self._age = age
        self._like = "cook"

    @property                      # 读，访问 a.like 就是调这个函数取返回值
    def like(self):
        return self._like

    @property
    def age(self):
        return self._age

    @age.setter                    # 写，赋值时做校验
    def age(self, val):
        if val > 30 or val < 10:
            raise Exception("age 要在 10-30 之间")
        self._age = val
```

```python
a = Student("xxx", 25)
print(a.like)     # cook
a.age = 60        # 抛异常，age 要在 10-30 之间
# a.like = "book" # 没有 setter，AttributeError
```

三个要点。只写 `@property` 不写 setter 就是只读，赋值直接报错。真实数据放 `self._age`，对外露 `age`，读写都过一道函数。校验逻辑收在 setter 里，调用方不用背规则。

### 路线二，`__setattr__`，拦所有赋值

`__setattr__(self, attr, val)` 在任何成员被赋值时都会调用。因为所有属性都走这一个入口，函数里必须先判断属性名。

```python
def __setattr__(self, attr, val):
    if attr == "like":                     # 只读属性
        raise AttributeError("不能修改 like 属性")
    self.__dict__[attr] = val              # 其余照常写
```

它能做的事比 property 多，范围检查、类型检查、审计日志、拦截任意动态属性。

两个副作用得知道。第一，`__setattr__` 会盖掉 `@property` 的 setter，两个同时用，setter 就是死代码。实测过，赋值只走 `__setattr__`，`_age` 都不会变。

```python
class Q:
    def __init__(self): self._v = 1

    @property
    def v(self): return self._v

    @v.setter
    def v(self, val):
        print("setter called")     # 永远不打印
        self._v = val

    def __setattr__(self, k, val):
        print("setattr", k, val)
        self.__dict__[k] = val

q = Q(); q.v = 9
print(q.v)      # 1，setter 没跑，_v 没更新
```

第二个，在 `__setattr__` 里写 `self.x = v` 会无限递归，必须走 `self.__dict__[attr] = val` 或者 `object.__setattr__(self, attr, val)`。

## 反射四件套，不认识对象也能操作它

| 函数 | 等价写法 | 干什么 |
|---|---|---|
| `getattr(obj, "attr")` | `obj.attr` | 读 |
| `setattr(obj, "attr", v)` | `obj.attr = v` | 改或者新增 |
| `hasattr(obj, "attr")` | | 探测 |
| `delattr(obj, "attr")` | `del obj.attr` | 删 |

价值在于不知道类长什么样，也能按名字操作属性。配置驱动、序列化、插件调用、ORM 字段映射全靠这套。

```python
cfg = {"host": "1.2.3.4", "port": 8080}
client = Client()
for k, v in cfg.items():
    if hasattr(client, k):
        setattr(client, k, v)
```

`getattr` 能带默认值，比 `hasattr` 稳。`hasattr` 碰上 property 内部抛异常会吞成 False，你以为没这个属性，其实是它报错了。

```python
val = getattr(obj, "maybe", None)
```

## 三种方法到底差在哪

| 类型 | 定义 | 第一个参数 | 怎么调 | 干什么用 |
|---|---|---|---|---|
| 实例方法 | `def m(self)` | `self`，实例 | `obj.m()` | 绝大多数逻辑 |
| 静态方法 | `@staticmethod` | 没有 | `obj.m()` 或 `Class.m()` | 纯工具函数，不需要 self 和 cls |
| 类方法 | `@classmethod` | `cls`，类本身 | `obj.m()` 或 `Class.m()` | 多路构造、操作类级状态 |

```python
class Student:
    @staticmethod
    def static_func():
        print("static func")     # 没有 self，也就碰不到 self.xxx

    @classmethod
    def cls_func(cls, xx):
        print(xx)                # cls 是类，能 cls.attr，也能 cls(...) 造实例
```

类方法最实用的地方是多路构造。

```python
class Config:
    def __init__(self, data): ...
    @classmethod
    def from_file(cls, path):    # 子类继承时 cls 自动变成子类
        return cls(load(path))
```

还有个偏门的玩法，把外部函数挂成对象方法。Python 里变量和函数地位相同，运行时加方法完全合法。方法约定第一个参数是 self，外部函数没这约定，就把 `__self__` 指过去。

```python
def obj_func():
    print("call obj_func")

class Student:
    def update_method(self, func):
        self.new_method = func
        func.__self__ = self

a = Student()
a.update_method(obj_func)
a.new_method()      # call obj_func
```

能用但少用。等价写法是 `types.MethodType(func, a)` 或者 `func.__get__(a)`，都比手改 `__self__` 干净。而且这东西一多，IDE 补全和类型检查全废。

## 继承，多重继承的真实规则

```python
class Student(Person):
    def __init__(self, fname, lname):
        super().__init__(fname, lname)     # 不用写父类名
```

单继承里 `super()` 只是省事。多重继承里它是沿着 MRO 链找下一个，所以菱形继承下每个类只会被调一次。

规则一句话，多个基类有同名属性时，排在前面的生效。

```python
class A:
    x = "A"
class B:
    x = "B"
class C(A, B):
    pass

C.x           # "A"，按 (C, A, B) 的顺序找，最先命中的赢
C.__mro__     # 想看完整顺序就打印它
```

真实顺序由 C3 线性化算出来，你不用手算，但要记住两件事。写 `class C(A, B)` 和 `class C(B, A)` 行为可能完全不同。混用多重继承加 `super()` 时，某个基类的 `__init__` 忘了调 `super().__init__()`，整条链就断在那。

工程上的建议只有一条。多重继承留给 Mixin，一个主基类加若干只提供方法、不定义 `__init__` 的混入类。真拿它当多父类继承用，维护起来是灾难。

## 迭代协议和生成器，内存是怎么省下来的

```python
for x in obj:
    ...
```

等价于这样一段。

```python
it = iter(obj)              # 调 __iter__()，拿迭代器
while True:
    try:
        x = next(it)        # 调 __next__()
    except StopIteration:   # 耗尽信号
        break
    ...
```

自己写的时候有个致命细节，结束时必须 `raise StopIteration`，不能用 `return None`。返回 None 的意思是这个迭代器永远有下一个元素，而且都是 None，直接死循环。

```python
class Reverse:
    def __init__(self, data):
        self.data = data
        self.index = len(data)

    def __iter__(self):
        return self                # 自己就是迭代器

    def __next__(self):
        if self.index == 0:
            raise StopIteration    # 不能写 return None
        self.index -= 1
        return self.data[self.index]
```

生成器是编译器帮你把上面这套写好了。

```python
def reverse(data):
    for index in range(len(data) - 1, -1, -1):
        yield data[index]
```

省下的不只是几行代码。

| 维度 | 类迭代器 | 生成器 |
|---|---|---|
| 状态保存 | 手写实例变量 | 自动保存局部变量和执行位置 |
| 迭代方法 | 手写 `__iter__` 和 `__next__` | 自动生成 |
| 结束信号 | 手写 `raise StopIteration` | 自动抛 |
| 可读性 | 状态散在 `__init__` 和 `__next__` | 逻辑顺序就是代码顺序 |
| 能否重入 | 自己负责 reset | 用完即废，不可重入 |

关键机制，每次 `next()` 都从上次 `yield` 之后那一行恢复，栈帧整个被冻住保存。这已经是协程的雏形，看懂这一层，`async/await` 就不神秘了。

生成器表达式还要提醒一句，它是一次性的。

```python
g = (i for i in range(3))
list(g)     # [0, 1, 2]
list(g)     # []      已耗尽，不会重来
```

## 模块和包的工程细节

`__pycache__` 里放的是编译后的模块，文件名 `module.version.pyc`。版本字段编码了字节码格式，所以多个 Python 版本能共存。过期判断靠源文件修改时间，全自动。

三个点值得记。

1. `.pyc` 只加速载入，不加速运行。从 `.pyc` 读出来的程序跑得和 `.py` 一样快，快的是启动那一下。
2. 命令行直接运行的模块从不使用缓存，每次重新编译而且不落盘。没有源文件的时候也不检查缓存，这样才支持只发 `.pyc` 的发行方式。
3. `-O` 去掉 assert，`-OO` 连 `__doc__` 一起去掉，产物带 `opt-` 标签、体积更小。只在确认代码不依赖 assert 和 docstring 时用，批量生成交给 `compileall`。

`dir()` 用来探查。

```python
dir(mod)                 # 列出模块内所有名称，已排序
import builtins
dir(builtins)            # dir() 不列内置函数，内置的在 builtins 里
```

`__init__.py` 不只是个标记文件，它干三件事。

| 作用 | 说明 |
|---|---|
| 初始化 | 导入包时执行一次，做注册、配置、兼容性 patch |
| 暴露接口 | `from .core import Client`，让用户直接 `from pkg import Client` |
| 定义 `__all__` | 控制 `from pkg import *` 的边界 |

```python
# pkg/__init__.py
from .core import Client, Config
__all__ = ["Client", "Config"]
__version__ = "1.2.0"
```

`__all__` 的价值不在支持 `import *`，生产代码本来就不该用它。它管的是这个包的公共接口。文档、类型检查、`__all__` 三者一致，包才算有风格。

`from pkg import *` 到底导什么，三种情况。

| 情况 | 行为 |
|---|---|
| `__init__.py` 定义了 `__all__` | 按列表导，作者说了算 |
| 没定义 `__all__` | 不会导入所有子模块，只导入包里已定义的名字，含 `__init__.py` 里定义的、以及之前被显式加载的子模块 |
| 模块级 `import *` | 导入所有不以 `_` 开头的名字 |

`if __name__ == "__main__"` 前面提过，这里补一句它和相对导入的关系。主模块的 `__name__` 恒为 `"__main__"`，所以入口脚本只能用绝对导入，写 `from . import x` 必炸。

`__path__` 是包的搜索路径列表，初始化成含 `__init__.py` 的目录。它能改，改了会影响后续子模块和子包的搜索。插件系统和命名空间包就这么扩展的，日常开发碰不到。

## 异常体系，设计比捕获重要

```python
class AppError(Exception):
    """本模块所有异常的基类"""

class ConfigError(AppError):
    """配置非法"""

class NetworkError(AppError):
    """网络层失败"""

class RequestTimeout(NetworkError):
    """超时，NetworkError 的特例"""
```

设计上四条规矩。都从 `Exception` 派生，别碰 `BaseException`，那个是给 `SystemExit` 和 `KeyboardInterrupt` 留的。名字以 `Error` 结尾，跟标准库保持一致。模块先定基类再定子类，调用方可以粗粒度 `except AppError`，也能精确定位。类保持简单，带几个能描述错误的属性就够。

`finally` 的四条规则单独列一遍，全是坑。

| 场景 | 行为 |
|---|---|
| `try` 抛异常且没被 `except` 抓住 | `finally` 执行完才重新抛出 |
| `except` 或 `else` 里抛异常 | 一样等 `finally` 完事 |
| `try` 里 `break`、`continue`、`return` | `finally` 在跳转之前跑 |
| `finally` 里写 `return` | 覆盖 `try` 的返回值，还顺手吞异常，坚决别写 |

资源管理落到 `with`。

```python
with open("myfile.txt") as f:
    for line in f:
        print(line, end="")
```

不管中间出什么事，退出时一定清理。原理是上下文管理协议，`__enter__` 和 `__exit__`。自己写的资源类也该实现它，而不是甩一个 `close()` 让调用方记着调。

## 这个阶段的避坑清单

| 坑 | 症状 | 正解 |
|---|---|---|
| `def f(x=[])` | 多次调用共享同一张列表 | 默认值用 `None`，函数内初始化 |
| 把 `b = a` 当复制 | 改 b 影响 a | `a.copy()`、`list(a)`、`deepcopy` |
| `__setattr__` 里写 `self.x = v` | RecursionError | 走 `self.__dict__[k]` 或 `object.__setattr__` |
| `__setattr__` 和 property setter 并存 | setter 静默失效 | 二选一 |
| 迭代器用 `return None` 表示结束 | 死循环产出 None | `raise StopIteration` |
| 生成器被遍历两次 | 第二次拿到空 | 要复用就返回 list |
| `finally` 里 `return` | 异常和返回值被吞 | 永不这么写 |
| `except Exception: pass` | bug 消失，无从排查 | 至少 `raise` 或记日志 |
| 入口脚本用相对导入 | ImportError | 入口只用绝对导入 |
| 自己写个 `random.py` | 覆盖标准库 | 别跟标准库同名 |
| 多重继承链断 | 父类 `__init__` 没跑，属性缺失 | 基类都调 `super().__init__()`，或者改用 Mixin |
| 指望 `.pyc` 提速运行 | 没变快 | 它只加速载入 |

## 一套能落地的工程约定

写在项目的 `CONTRIBUTING.md` 里，比收藏十篇最佳实践有用。

1. 不可变优先，能用 tuple、frozenset 就别用 list、set
2. 函数默认值只用不可变对象
3. 对外属性用 `@property`，内部存储用 `_name`，别拿 `__name` 当私有
4. 异常分层，每个包一个 `AppError` 基类，禁止裸 `except:`
5. 资源一律 `with`，自己写的资源类实现 `__enter__` 和 `__exit__`
6. 入口脚本只写 `main()` 加 `if __name__ == "__main__"`，业务逻辑全放包里
7. 包必须有 `__init__.py` 和 `__all__`，声明公共接口
8. 生成器用于单次流式处理，要多次遍历或者随机访问就先落到 list
9. 多重继承只用于 Mixin，Mixin 不定义 `__init__`
10. 不用 `from x import *`，除非在 REPL 里省打字
