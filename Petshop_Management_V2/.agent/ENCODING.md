# ENCODING STANDARD — Petshop Management V2
# ⚠️  AI AGENTS: READ THIS BEFORE TOUCHING ANY FILE IN THIS PROJECT

## Mandatory Rule: All Files = UTF-8

```
ENCODING = UTF-8
NO EXCEPTIONS.
```

This project stores Vietnamese content (UI labels, product names, error messages,
business logic strings). Any encoding mismatch causes **silent, invisible corruption**
that breaks the UI and is very hard to detect.

---

## AI Tool Instructions (Critical)

### When reading files:
```python
# Python
with open(filepath, 'r', encoding='utf-8') as f: ...

# Node.js
fs.readFileSync(filepath, 'utf8')

# PowerShell
Get-Content file.ts -Encoding UTF8
```

### When writing files:
```python
# Python
with open(filepath, 'w', encoding='utf-8') as f: ...

# NEVER use default open() on Windows — defaults to cp1252!
```

### When running Python scripts:
```bash
# Always use UTF-8 mode on Windows:
python -X utf8 script.py
```

---

## What's Protected at Each Layer

| Layer | Mechanism | File |
|-------|-----------|------|
| Editor | EditorConfig `charset=utf-8` | `.editorconfig` |
| Git | `.gitattributes` + `working-tree-encoding=UTF-8` | `.gitattributes` |
| Pre-commit | Husky → `check-utf8.mjs` (blocks mojibake) | `.husky/pre-commit` |
| API responses | Express middleware `Content-Type: charset=utf-8` | `apps/api/src/main.ts` |
| Database | PostgreSQL `INITDB_ARGS=--encoding=UTF8` | `docker-compose.yml` |
| Source schema | Comment header in `schema.prisma` | `packages/database/prisma/schema.prisma` |
| Frontend | Next.js default (UTF-8), verified by pre-commit | `apps/web/` |

---

## Forbidden Patterns — Never Do This

```typescript
// ❌ NEVER hardcode business-critical Vietnamese strings in logic:
if (status === 'Đã hoàn thành') { ... }

// ✅ DO use enum constants:
if (status === OrderStatus.COMPLETED) { ... }
```

```typescript
// ❌ NEVER use magic string labels in code
throw new Error('Không tìm thấy đơn hàng')  // buried in business logic

// ✅ DO centralize messages
import { MSG } from '@/constants/messages'
throw new Error(MSG.ORDER_NOT_FOUND)
```

```python
# ❌ On Windows, this defaults to cp1252 and WILL corrupt Vietnamese:
with open('file.ts', 'r') as f: ...

# ✅ Always explicit:
with open('file.ts', 'r', encoding='utf-8') as f: ...
```

---

## How to Run Encoding Checks

```bash
# Full project scan (all source files):
pnpm utf8:check

# Staged files only (same as pre-commit):
node scripts/check-utf8.mjs --staged

# Deep scan with Python (finds subtle mojibake):
python -X utf8 scripts/audit_encoding_v2.py
```

---

## If You Find Corrupted Text

1. **Do NOT edit manually** unless you know the correct Vietnamese text.
2. Run `python -X utf8 scripts/fix_replacement_chars.py` for automated recovery.
3. If the original text is unknown, look at Git history or the prisma seed file.
4. After fixing: run `pnpm utf8:check` to verify.

---

## Encoding Contract (Sign off)

Every file in `apps/` and `packages/` **must pass** `pnpm utf8:check` before merge.
The pre-commit hook enforces this automatically for staged files.

> Last updated: 2026-04-10 | Status: ENFORCED via pre-commit hook
