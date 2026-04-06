<!-- Generated: 2026-04-02 | Rules: 37 | Token estimate: ~600 -->

# Rules & Knowledge — Antigravity Framework

## Directory: `.agent/rules/`

## Always-Loaded Rules (baseline cost per request)

| Rule File | Size | Trigger | Mô tả |
|-----------|------|---------|-------|
| `GEMINI.md` | 4.3KB | always | Agent constitution & language protocol |
| `README.md` | 4.3KB | always | Framework overview |
| `runtime-watchdog.md` | 3KB | always | Hang detection & execution safety |
| `security.md` | 1.5KB | always | Security guardrails (no hardcode secrets) |
| `typescript-coding-style.md` | 4.4KB | always | TS formatting & naming standards |
| `error-logging.md` | 3.6KB | always | ERRORS.md logging format |
| `common-code-review.md` | 3.6KB | always | Code review standards |
| `docs-update.md` | 2.8KB | always | Documentation update protocol |

**Baseline estimate: ~24KB → ~7,000 tokens loaded every request**

## Conditional Rules (trigger-based)

| Rule File | Size | Trigger |
|-----------|------|---------|
| `common-agents.md` | 1.7KB | multi-agent coordination |
| `common-development-workflow.md` | 2.4KB | iterating on feature |
| `system-update.md` | 2.4KB | updating project configs |
| `common-patterns.md` | 1.2KB | architecture/design patterns |
| `common-security.md` | 1KB | security audit |
| `common-performance.md` | 1.7KB | performance work |
| `common-testing.md` | 0.9KB | writing tests |
| `common-git-workflow.md` | 0.7KB | git commands |
| `common-coding-style.md` | 1.5KB | coding standards |
| `common-hooks.md` | 0.9KB | GitHub actions/hooks |
| `debug.md` | 1.1KB | bugs/debugging |
| `malware-protection.md` | 2.3KB | installing dependencies |
| `gitnexus-integration.md` | 1.8KB | GitNexus MCP tools |
| `architecture-review.md` | 1.3KB | architecture changes |
| `compliance.md` | 1.3KB | legal/privacy concerns |
| `backend.md` | 1.5KB | backend work |
| `frontend.md` | 1.4KB | frontend work |
| `business.md` | 1.5KB | business logic |

## Python-Specific Rules

| File | Size |
|------|------|
| `python-coding-style.md` | 0.7KB |
| `python-hooks.md` | 0.4KB |
| `python-patterns.md` | 0.8KB |
| `python-security.md` | 0.5KB |
| `python-testing.md` | 0.6KB |

## TypeScript-Specific Rules

| File | Size |
|------|------|
| `typescript-coding-style.md` | 4.4KB |
| `typescript-hooks.md` | 0.5KB |
| `typescript-patterns.md` | 1KB |
| `typescript-security.md` | 0.5KB |
| `typescript-testing.md` | 0.3KB |

## Memory / Snapshots

```
.agent/memory/        ← /compact snapshots (created on demand)
  compact-YYYY-MM-DD-HH.md
```

## Session Persistence

```
.agent/memory/session-handoffs/  ← /save-session output
  YYYY-MM-DD-<short-id>.md
```

## Knowledge Accumulation Files

| File | Mục đích |
|------|---------|
| `ERRORS.md` | Known bugs & lessons learned |
| `STATE.md` | Current project state |
| `CONCEPTS.md` | Domain concepts & glossary |
| `ROADMAP.md` | Future features |

## GitNexus Index (Code Intelligence)

```
.gitnexus/
  meta.json    ← 46 symbols, 40 relationships indexed
```
