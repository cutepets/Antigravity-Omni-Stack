---
description: Load a repo-local session handoff and orient before continuing work.
---

# Resume Session Command

Use `/resume-session` to load the latest handoff from this repository before continuing work.

## Canonical Input Path

Default search location:

`.agent/memory/session-handoffs/`

## Usage

```text
/resume-session
/resume-session 2026-04-06
/resume-session .agent/memory/session-handoffs/2026-04-06-abc123de.md
```

## Standard Loop

1. If no argument is provided, load the most recently modified file in `.agent/memory/session-handoffs/`.
2. If a date is provided, load the most recent matching file for that date.
3. If a file path is provided, load that file directly.
4. Read the full handoff.
5. Summarize the goal, confirmed state, failed approaches, blockers, and exact next step.
6. Wait for the user before touching files.

## Output Contract

Return:

- loaded file path
- what the previous session was doing
- what is already confirmed working
- what should not be retried
- blockers and open questions
- the exact next step, if one exists

## Guardrails

- Do not modify the handoff file while loading it.
- Do not start execution automatically unless the user explicitly tells you to continue.
- If no handoff exists, say so clearly and stop.
