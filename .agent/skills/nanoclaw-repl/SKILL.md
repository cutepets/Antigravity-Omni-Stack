---
name: nanoclaw-repl
description: Inspect and extend the local NanoClaw continuity layer used by this repository.
origin: antigravity-import
---

# NanoClaw REPL

Use this skill when working with the repo's NanoClaw continuity artifacts such as `claw-code/.port_sessions/`, `.agent/memory/`, and session audit logs.

## Capabilities

- raw session payload inspection
- continuity handoff support
- memory snapshot review
- audit trail review
- local session artifact hygiene

## Operating Guidance

1. Keep continuity artifacts task-focused and easy to resume from.
2. Prefer repo-local artifacts over external user-home storage.
3. Compact or summarize after major milestones.
4. Record exact next steps before handoff or archival.

## Extension Rules

- keep repo-local continuity deterministic and easy to inspect
- preserve compatibility with the local artifact layout
- avoid references to runtimes or launch scripts that are not present in this repo
