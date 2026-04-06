---
description: Save a repo-local handoff snapshot so the next session can resume with minimal context loss.
---

# Save Session Command

Use `/save-session` to create a concise handoff snapshot inside this repository.

## Canonical Output Path

Write session handoffs to:

`.agent/memory/session-handoffs/YYYY-MM-DD-<short-id>.md`

Create the folder if needed:

```bash
New-Item -ItemType Directory -Force .agent/memory/session-handoffs
```

## What to Capture

1. Goal: what this session was trying to achieve.
2. Confirmed working state: only claims backed by evidence.
3. Failed approaches: exact dead ends and why they failed.
4. File state: what changed, what is incomplete, what is untouched.
5. Decisions: tradeoffs already made.
6. Blockers: unresolved questions or dependencies.
7. Exact next step: the first thing to do when resuming.

## Output Template

```markdown
# Session Handoff: YYYY-MM-DD

## Goal
[What this session was trying to achieve]

## Confirmed Working
- [Item] - evidence: [test, manual check, command, observed result]

## Failed Approaches
- [Approach] - failed because: [exact reason]

## File State
- `path/to/file` - complete | in progress | planned

## Decisions
- [Decision] - reason: [why]

## Blockers
- [Open question or dependency]

## Exact Next Step
[Single concrete next action]
```

## Guardrails

- Do not save vague summaries with no evidence.
- Do not omit failed approaches if they matter to future work.
- Prefer repo-local continuity over external home-directory storage.
