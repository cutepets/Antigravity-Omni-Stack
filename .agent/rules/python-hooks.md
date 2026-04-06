---
trigger: glob
glob: "**/*.py"
---

# Python Hooks

> This file extends [common-hooks.md](./common-hooks.md) with Python specific content.

## PostToolUse Hooks

Some runtimes expose this as `AfterTool`.

Configure in `~/.claude/settings.json`:

- **black/ruff**: Auto-format `.py` files after edit
- **mypy/pyright**: Run type checking after editing `.py` files

## Warnings

- Warn about `print()` statements in edited files (use `logging` module instead)
