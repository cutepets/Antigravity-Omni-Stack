# Error Log

Shared error log for recurring failures, root-cause tracking, and prevention notes.

Use this file when a failure is worth preserving across sessions or for team visibility.

## When To Log

- repeated failures
- production-impacting bugs
- incorrect assumptions that caused rework
- tool or workflow misuse that should not recur
- regressions with non-obvious root cause

## Template

```markdown
## [YYYY-MM-DD HH:MM] Short Error Title

- Type: [Syntax | Logic | Runtime | Integration | Security | Process | Agent]
- Severity: [Low | Medium | High | Critical]
- File: `path/to/file:line` or `N/A`
- Area: [backend | frontend | infra | workflow | docs | other]
- Agent: [agent name or runtime]
- Symptom: [what failed]
- Root Cause: [what actually caused it]
- Fix Applied: [what changed]
- Prevention: [how to avoid this next time]
- Status: [Fixed | Investigating | Deferred]
```

## Guidance

- Log the root cause, not just the symptom.
- Keep entries short and concrete.
- Do not paste large raw logs unless a short excerpt is necessary.
- If the issue revealed a missing rule or checklist, update the relevant workflow or agent spec too.
