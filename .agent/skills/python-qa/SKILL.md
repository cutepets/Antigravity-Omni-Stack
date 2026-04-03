---
name: python-qa
description: >
  Python testing & quality assurance — pytest, TDD (red-green-refactor), fixtures,
  parametrize, mocking, async testing, coverage, and code review checklist.
  Load khi viết tests, làm code review Python, hay setup CI test pipeline. ~16KB.
trigger:
  - python test
  - pytest
  - python tdd
  - python mock
  - python review
  - python coverage
  - python quality
  - python code review
origin: split-from-python-master-v5
---

# Python QA — Testing & Code Review

> **Scope**: pytest patterns + TDD + mocking + python-reviewer checklist.  
> Dùng cùng `python-core` cho full Python development stack.

---

## Part 1: Python Testing (pytest)

### TDD Cycle — Always Follow

```
RED   → Write failing test first
GREEN → Minimal code to pass
REFACTOR → Improve, keep tests green
```

**Coverage Target**: 80%+ overall, 100% critical paths.

```bash
pytest --cov=mypackage --cov-report=term-missing --cov-report=html
```

### Test Structure

```python
import pytest

def test_user_creation():
    """Descriptive name: what it tests and what to expect."""
    user = User(name="Alice", email="alice@example.com")
    assert user.name == "Alice"
    assert user.email == "alice@example.com"
```

### Fixtures

```python
@pytest.fixture
def database():
    """Fixture with setup and teardown."""
    db = Database(":memory:")
    db.create_tables()
    yield db      # provide to test
    db.close()   # teardown

# Scopes: function (default) | module | session
@pytest.fixture(scope="session")
def shared_resource():
    resource = ExpensiveResource()
    yield resource
    resource.cleanup()

# conftest.py — shared fixtures across files
@pytest.fixture
def client():
    app = create_app(testing=True)
    with app.test_client() as c:
        yield c
```

### Parametrize

```python
@pytest.mark.parametrize("email,valid", [
    ("valid@email.com", True),
    ("invalid",         False),
    ("@no-domain.com",  False),
], ids=["valid", "missing-at", "missing-domain"])
def test_email_validation(email, valid):
    assert is_valid_email(email) is valid
```

### Mocking

```python
from unittest.mock import patch, Mock, AsyncMock

# Mock external API
@patch("mypackage.external_api_call")
def test_with_mock(api_mock):
    api_mock.return_value = {"status": "success"}
    result = my_function()
    api_mock.assert_called_once()
    assert result["status"] == "success"

# Mock exception
@patch("mypackage.api_call")
def test_error_handling(api_mock):
    api_mock.side_effect = ConnectionError("Network error")
    with pytest.raises(ConnectionError):
        api_call()

# Mock file
@patch("builtins.open", new_callable=mock_open)
def test_file_reading(mock_file):
    mock_file.return_value.read.return_value = "file content"
    result = read_file("test.txt")
    assert result == "file content"
```

### Async Testing

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await async_add(2, 3)
    assert result == 5

@pytest.fixture
async def async_client():
    app = create_app()
    async with app.test_client() as client:
        yield client

@pytest.mark.asyncio
@patch("mypackage.async_api_call")
async def test_async_mock(api_mock):
    api_mock.return_value = {"ok": True}
    result = await my_async_function()
    api_mock.assert_awaited_once()
```

### Exception Testing

```python
def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_custom_exception():
    with pytest.raises(ValueError, match="invalid input"):
        validate_input("bad")

def test_exception_attributes():
    with pytest.raises(CustomError) as exc_info:
        raise CustomError("error", code=400)
    assert exc_info.value.code == 400
```

### Test Organization

```
tests/
├── conftest.py           # Shared fixtures
├── unit/                 # Fast, isolated
│   ├── test_models.py
│   └── test_services.py
├── integration/          # Database, API
│   └── test_api.py
└── e2e/                  # Full flow
    └── test_user_flow.py
```

### pytest.ini Config

```ini
[pytest]
testpaths = tests
addopts =
    --strict-markers
    --cov=mypackage
    --cov-report=term-missing
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: integration tests
    unit: unit tests
```

### Testing Best Practices

**DO:**
- Test behavior, not implementation
- One assertion concept per test
- Use descriptive names: `test_user_login_with_invalid_credentials_fails`
- Mock external dependencies
- Test edge cases: `None`, empty, boundary values

**DON'T:**
- `except: pass` — never catch exceptions in tests
- Share state between tests
- Test third-party libraries
- Use print() — use assertions + pytest output

---

## Part 2: Python Code Reviewer

> Invoked by: `qa-engineer`, `python-specialist`, `/python-review`

### When invoked:
1. Run `git diff -- '*.py'` to see changes
2. Run static analysis: `ruff check . && mypy . && black --check .`
3. Review modified `.py` files

### Review Priorities

**CRITICAL — Security:**
- SQL Injection: f-strings in queries → use parameterized
- Command Injection: unvalidated input in shell → use `subprocess` with list args
- Path Traversal: user paths → validate with `normpath`, reject `..`
- `eval/exec` abuse, unsafe deserialization, hardcoded secrets
- Weak crypto (MD5/SHA1 for security), `yaml.load()` unsafe

**CRITICAL — Error Handling:**
- `except: pass` — bare except swallows all errors
- Silent failures — log and handle
- Missing `with` for file/resource management

**HIGH — Type Hints:**
- Public functions without annotations
- `Any` when specific types are possible
- Missing `Optional` for nullable parameters

**HIGH — Pythonic Patterns:**
- List comprehensions over C-style loops
- `isinstance()` not `type() ==`
- `Enum` not magic numbers
- `"".join()` not string concatenation in loops
- Mutable default args: `def f(x=[])` → `def f(x=None)`

**HIGH — Code Quality:**
- Functions > 50 lines → split
- > 5 parameters → use dataclass
- Deep nesting (> 4 levels) → extract functions
- Duplicate logic → DRY

**MEDIUM — Best Practices:**
- PEP 8: import order, naming (snake_case)
- Missing docstrings on public functions
- `print()` instead of `logging`
- `from module import *` — namespace pollution
- `value == None` → `value is None`
- Shadowing builtins: `list`, `dict`, `str`

### Diagnostic Commands

```bash
mypy .                                           # Type checking
ruff check .                                     # Fast linting
black --check .                                  # Format check
bandit -r .                                      # Security scan
pytest --cov=app --cov-report=term-missing       # Test coverage
```

### Review Output Format

```text
[SEVERITY] Issue title
File: path/to/file.py:42
Issue: Description
Fix:   What to change
```

### Approval Criteria

| Outcome | Condition |
|---|---|
| ✅ Approve | No CRITICAL or HIGH issues |
| ⚠️ Warning | MEDIUM issues only — can merge with caution |
| ❌ Block | Any CRITICAL or HIGH issue found |

### Framework-Specific Checks

- **FastAPI**: CORS config, Pydantic validation, no blocking in async routes
- **Django**: `select_related`/`prefetch_related` for N+1, `atomic()` for multi-step, migrations versioned
- **Flask**: Proper error handlers, CSRF protection enabled
