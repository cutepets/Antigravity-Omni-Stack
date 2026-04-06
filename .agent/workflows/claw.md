---
description: Inspect Claw session artifacts and continuity data stored in this repository.
---

# Claw Command

Use `/claw` when you need to inspect, explain, or hand off the local Claw runtime state rather than launch an external REPL.

## Canonical Artifact Locations

- `claw-code/.port_sessions/` -> raw session payloads
- `.agent/memory/` -> compaction or memory snapshots
- `.agent/logs/session-audit.log` -> end-of-session audit trail

## Standard Loop

1. Inspect the active session payload in `claw-code/.port_sessions/`.
2. Check whether a memory compaction snapshot exists in `.agent/memory/`.
3. Review `.agent/logs/session-audit.log` for recent close-out status.
4. Summarize current state, continuity risk, and missing artifacts.

## Output Contract

Return:

- active session file
- last memory snapshot, if any
- audit status
- missing continuity artifacts
- recommended next operator action

## Guardrails

- Do not claim a launch script exists unless it is present in the repo.
- Treat the repo artifacts as the source of truth for local Claw continuity.
