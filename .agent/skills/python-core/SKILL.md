---
name: python-core
description: >
  Core Python development — Pythonic idioms, PEP 8, type hints, dataclasses,
  project scaffolding (uv/FastAPI/Django), packaging, and PyPI distribution.
  Load này TRƯỚC TIÊN cho mọi task Python. ~12KB.
trigger:
  - python
  - python core
  - pythonic
  - type hints
  - dataclass
  - scaffold
  - packaging
  - pyproject
origin: split-from-python-master-v5
---

# Python Core Skill

> **Scope**: Pythonic patterns + project scaffold + packaging.  
> Cho advanced async/perf → load `python-async`.  
> Cho testing/review → load `python-qa`.

---

## Merged from python-patterns

---
name: python-patterns
description: Pythonic idioms, PEP 8 standards, type hints, and best practices for building robust, efficient, and maintainable Python applications.
origin: ECC
---

# Python Development Patterns

Idiomatic Python patterns and best practices for building robust, efficient, and maintainable applications.

## When to Activate

- Writing new Python code
- Reviewing Python code
- Refactoring existing Python code
- Designing Python packages/modules

## Core Principles

### 1. Readability Counts

Python prioritizes readability. Code should be obvious and easy to understand.

```python
# Good: Clear and readable
def get_active_users(users: list[User]) -> list[User]:
    """Return only active users from the provided list."""
    return [user for user in users if user.is_active]


# Bad: Clever but confusing
def get_active_users(u):
    return [x for x in u if x.a]
```

### 2. Explicit is Better Than Implicit

Avoid magic; be clear about what your code does.

```python
# Good: Explicit configuration
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Bad: Hidden side effects
import some_module
some_module.setup()  # What does this do?
```

### 3. EAFP - Easier to Ask Forgiveness Than Permission

Python prefers exception handling over checking conditions.

```python
# Good: EAFP style
def get_value(dictionary: dict, key: str) -> Any:
    try:
        return dictionary[key]
    except KeyError:
        return default_value
```

## Type Hints

### Basic Type Annotations

```python
from typing import Optional, List, Dict, Any

def process_user(
    user_id: str,
    data: Dict[str, Any],
    active: bool = True
) -> Optional[User]:
    """Process a user and return the updated User or None."""
    if not active:
        return None
    return User(user_id, data)
```

### Modern Type Hints (Python 3.9+)

```python
# Python 3.9+ - Use built-in types
def process_items(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}
```

### Protocol-Based Duck Typing

```python
from typing import Protocol

class Renderable(Protocol):
    def render(self) -> str:
        """Render the object to a string."""

def render_all(items: list[Renderable]) -> str:
    return "\n".join(item.render() for item in items)
```

## Error Handling Patterns

```python
# Good: Catch specific exceptions
def load_config(path: str) -> Config:
    try:
        with open(path) as f:
            return Config.from_json(f.read())
    except FileNotFoundError as e:
        raise ConfigError(f"Config file not found: {path}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"Invalid JSON in config: {path}") from e
```

## Data Classes and Named Tuples

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    """User entity with automatic __init__, __repr__, and __eq__."""
    id: str
    name: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True
```

## Generators & Comprehensions

```python
# Good: Generator for lazy evaluation
total = sum(x * x for x in range(1_000_000))

# Good: Generator for large files
def read_large_file(path: str) -> Iterator[str]:
    with open(path) as f:
        for line in f:
            yield line.strip()
```

## Python Tooling

```bash
black .          # Format
isort .          # Sort imports
ruff check .     # Lint
mypy .           # Type check
pytest --cov     # Test + coverage
bandit -r .      # Security scan
```

---

## Merged from python-packaging

---
name: python-packaging
description: Create distributable Python packages with pyproject.toml and publishing to PyPI.
---

# Python Packaging

## pyproject.toml (Modern Standard)

```toml
[project]
name = "mypackage"
version = "1.0.0"
description = "A sample Python package"
requires-python = ">=3.10"
dependencies = ["requests>=2.28.0", "pydantic>=2.0.0"]

[project.optional-dependencies]
dev = ["pytest", "mypy", "ruff", "black"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 88
target-version = "py310"

[tool.mypy]
strict = true
```

## Build & Publish

```bash
# Build
uv build        # or: python -m build

# Test on TestPyPI first
uv publish --index testpypi

# Publish to PyPI
uv publish
```

---

## Merged from python-development-python-scaffold

---
name: python-development-python-scaffold
description: Python project architecture expert specializing in scaffolding production-ready applications with uv, FastAPI, Django.
---

# Python Project Scaffolding

## Modern Project Layout

```
myproject/
├── src/
│   └── mypackage/
│       ├── __init__.py
│       ├── main.py
│       ├── api/
│       ├── models/
│       └── utils/
├── tests/
│   ├── conftest.py
│   └── test_*.py
├── pyproject.toml
└── README.md
```

## Initialize with uv (Recommended)

```bash
uv init myproject --python 3.12
uv add fastapi uvicorn pydantic
uv add --dev pytest mypy ruff black
```

## FastAPI Scaffold

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="My API", version="1.0.0")

class UserCreate(BaseModel):
    name: str
    email: str

@app.post("/users", status_code=201)
async def create_user(user: UserCreate):
    return {"id": 1, **user.model_dump()}
```

## Django Scaffold

```bash
django-admin startproject myproject .
python manage.py startapp myapp
```

## 🧠 Sub-skills (Fractal)

- `./sub-skills/1-analyze-project-type.md`
- `./sub-skills/2-initialize-project-with-uv.md`
- `./sub-skills/3-generate-fastapi-project-structure.md`
- `./sub-skills/7-configure-development-tools.md`
