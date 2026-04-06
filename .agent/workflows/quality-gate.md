---
description: Run the local quality pipeline on demand for a file or project scope.
---

# Quality Gate Command

Use `/quality-gate` to run the repo's available quality checks on demand for a path or the whole project.

## Usage

`/quality-gate [path|.] [--fix] [--strict]`

- default target: current directory (`.`)
- `--fix`: allow autofix where the repo supports it
- `--strict`: fail on warnings where the toolchain supports it

## Pipeline

1. Detect language and toolchain for the target.
2. Run formatter checks.
3. Run lint and type checks when available.
4. Run targeted tests when the affected area has them.
5. Produce a concise remediation list.

## Notes

- Prefer existing repo scripts over invented commands.
- If a quality layer is missing, report that gap explicitly instead of pretending it passed.
