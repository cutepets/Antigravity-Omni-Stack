---
name: python-async
description: >
  Advanced Python — asyncio, concurrent programming, performance optimization,
  and modern Python 3.12+ patterns (uv, ruff, pydantic, FastAPI async).
  Load khi cần I/O-bound optimization, async APIs, hay bottleneck profiling. ~15KB.
trigger:
  - async python
  - asyncio
  - concurrent
  - python performance
  - python async
  - fastapi async
  - python 3.12
  - python optimization
origin: split-from-python-master-v5
---

# Python Async & Performance

> **Prerequisite**: Load `python-core` trước nếu chưa có.  
> Skill này chuyên về concurrency, async patterns, và performance tuning.

---

## Merged from async-python-patterns

# Async Python Patterns

## When to Use

- Building async web APIs (FastAPI, aiohttp)
- Concurrent I/O operations (database, file, network)
- Real-time applications (WebSocket servers)
- Processing multiple independent tasks
- I/O-bound workloads requiring non-blocking operations

## Core Async Patterns

### asyncio.gather — Concurrent Tasks

```python
import asyncio

async def fetch_async(url: str) -> str:
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

async def fetch_all(urls: list[str]) -> dict[str, str]:
    tasks = [fetch_async(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return dict(zip(urls, results))
```

### asyncio.Queue — Backpressure Control

```python
async def producer(queue: asyncio.Queue, items: list):
    for item in items:
        await queue.put(item)
    await queue.put(None)  # Sentinel

async def consumer(queue: asyncio.Queue):
    while True:
        item = await queue.get()
        if item is None:
            break
        await process(item)
        queue.task_done()

async def pipeline(items: list):
    queue = asyncio.Queue(maxsize=10)  # Backpressure: max 10 items buffered
    await asyncio.gather(producer(queue, items), consumer(queue))
```

### Timeout & Cancellation

```python
async def fetch_with_timeout(url: str, timeout: float = 5.0) -> str:
    try:
        async with asyncio.timeout(timeout):
            return await fetch_async(url)
    except asyncio.TimeoutError:
        raise RuntimeError(f"Timeout fetching {url}")
```

### Structured Concurrency (Python 3.11+)

```python
async def fetch_multiple(urls: list[str]) -> list[str]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_async(url)) for url in urls]
    return [t.result() for t in tasks]
```

## Threading vs Asyncio Decision

| Use Case | Solution |
|---|---|
| I/O-bound (network, disk) | `asyncio` |
| CPU-bound computation | `ProcessPoolExecutor` |
| Blocking third-party lib | `ThreadPoolExecutor` + `run_in_executor` |
| Mixed workloads | `asyncio` + executor |

```python
# Run blocking code in thread without blocking event loop
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

async def run_blocking(func, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)
```

---

## Merged from python-performance-optimization

# Python Performance Optimization

## When to Use

- Identifying bottlenecks in Python applications
- Reducing latency and response times
- Optimizing CPU-intensive operations
- Reducing memory leaks

## Profiling

```bash
# CPU profiling
python -m cProfile -o output.prof script.py
python -m pstats output.prof

# Memory profiling
pip install memory-profiler
python -m memory_profiler script.py

# Line profiling
pip install line_profiler
kernprof -l -v script.py
```

## Key Optimizations

```python
# 1. __slots__ — reduce memory for many instances
class Point:
    __slots__ = ['x', 'y']
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

# 2. Generator over list — lazy evaluation
total = sum(x * x for x in range(1_000_000))  # ✅
# total = sum([x * x ...])  # ❌ creates full list

# 3. Join over concatenation
result = "".join(str(item) for item in items)  # ✅ O(n)
# result = ""
# for item in items: result += str(item)  # ❌ O(n²)

# 4. lru_cache — memoize pure functions
from functools import lru_cache

@lru_cache(maxsize=128)
def fib(n: int) -> int:
    return n if n < 2 else fib(n-1) + fib(n-2)
```

## 🧠 Sub-skills (Fractal)

- `./sub-skills/implementation-playbook.md`

---

## Merged from python-pro

# Python 3.12+ Modern Features

> Expert Python developer. Runtime: Python 3.12+. Tooling: uv, ruff, pydantic v2, FastAPI.

## Modern Features (3.10-3.12)

```python
# Pattern matching (3.10+)
match command:
    case "quit":
        quit()
    case "help":
        show_help()
    case str(cmd) if cmd.startswith("!"):
        run_shell(cmd[1:])
    case _:
        print(f"Unknown: {command}")

# Exception groups (3.11+)
try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(task1())
        tg.create_task(task2())
except* ValueError as eg:
    for exc in eg.exceptions:
        handle_value_error(exc)

# TypeVar syntax with | (3.10+)
def first(items: list[int | str]) -> int | str | None:
    return items[0] if items else None
```

## Modern Toolchain

```bash
# uv — tốc độ cao, thay pip
uv add fastapi
uv run python app.py
uv sync  # install from lockfile

# ruff — linter + formatter (thay black + isort + flake8)
ruff check . --fix
ruff format .
```

## Pydantic v2 Patterns

```python
from pydantic import BaseModel, field_validator, model_validator

class UserCreate(BaseModel):
    name: str
    email: str
    age: int

    @field_validator('email')
    @classmethod
    def email_must_contain_at(cls, v: str) -> str:
        if '@' not in v:
            raise ValueError('Invalid email')
        return v.lower()

    model_config = {"str_strip_whitespace": True}
```

## 🧠 Sub-skills (Fractal)

- `./sub-skills/modern-python-features.md`
- `./sub-skills/modern-tooling-development-environment.md`
- `./sub-skills/performance-optimization.md`
- `./sub-skills/web-development-apis.md`
