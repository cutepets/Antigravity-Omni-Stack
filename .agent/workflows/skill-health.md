---
name: skill-health
description: Audit the active skill portfolio and summarize ownership, drift, and cleanup actions.
command: true
---

# Skill Health Dashboard

Use `/skill-health` to audit the current skill portfolio with the scripts that exist in this repo.

## Canonical Commands

```bash
npm run agent:audit-skills
npm run agent:check-orphans
```

## What to Report

- active skill count
- orphan skill count
- missing `SKILL.md` count
- legacy refs or stale ownership if any
- skills that need rewrite, archival, or reassignment

## Output Contract

Return:

- the audit totals
- any exact file paths that failed checks
- whether all active skills are owned by live agents
- the next cleanup action if the portfolio is not healthy

## Notes

- This workflow uses the repo-local audits, not an external dashboard runtime.
