---
description: Inspect local session artifacts for Claw and Antigravity continuity.
---

# Sessions Command

Use `/sessions` to inspect session artifacts already present in this repo rather than relying on an external helper runtime.

## Usage

`/sessions [list|show|memory|audit|help]`

## Canonical Sources

- `claw-code/.port_sessions/` -> raw session payloads
- `.agent/memory/` -> compaction snapshots
- `.agent/logs/session-audit.log` -> session close-out log

## Actions

### List Sessions

```bash
Get-ChildItem claw-code/.port_sessions
```

### Show Session

Open a specific session JSON file and summarize its state.

```bash
/sessions show <session-file>
```

### Show Memory Snapshots

```bash
Get-ChildItem .agent/memory
```

### Show Audit Log

```bash
Get-Content .agent/logs/session-audit.log -Tail 50
```

## Output Contract

Return:

- available session files
- current or selected session artifact
- latest memory snapshot, if present
- latest audit status
- continuity gaps that need manual follow-up

## Notes

- This workflow is repo-local and artifact-first.
- Do not assume alias management or external session helpers exist unless they are present in the repo.
