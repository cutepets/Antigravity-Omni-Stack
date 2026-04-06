---
description: Staged specialist orchestration for Heavy work, or for Standard work that truly needs handoffs across domains.
---

# /orchestrate

Use `/orchestrate` when one specialist is not enough and the task needs explicit handoffs.

This command should follow the current specialist set and the `HANDOFF` contract from `.agent/docs/AGENT_STANDARD.md`.

## Best Fit

- Heavy cross-module changes
- ERP flows with business and technical handoffs
- architecture plus implementation plus verification
- security-sensitive or high-risk changes

Do not use `/orchestrate` for trivial Quick work.

## Canonical Workflow Types

### feature

Recommended path:

`product-manager or erp-business-analyst -> system-architect if needed -> primary implementation specialist -> qa-engineer -> code-reviewer`

### bugfix

Recommended path:

`debug-specialist -> primary implementation specialist -> qa-engineer -> code-reviewer`

### refactor

Recommended path:

`system-architect -> backend-specialist or frontend-specialist -> code-reviewer`

### security

Recommended path:

`security-auditor -> backend-specialist or devops-engineer -> qa-engineer -> code-reviewer`

## Handoff Contract

Every stage should emit:

```markdown
## HANDOFF: [source-agent] -> [target-agent]

### Context
[What is being worked on and why]

### Findings
- [Key discovery]
- [Key decision]
- [Critical constraint]

### Files Modified
- [Path or "None"]

### Open Questions
- [Remaining ambiguity]

### Recommendations
- [Concrete next step]
```

## Routing Guidance

- Standard task with one main specialist -> prefer `/plan` or direct execution
- Heavy task with multiple specialist boundaries -> use `/orchestrate`
- Phase-based execution required -> hand off to GSD workflows

## Parallel Review

Independent review passes may run in parallel when the write scope is already stable:

- `qa-engineer`
- `code-reviewer`
- `security-auditor`

## Output

The final orchestration report should state:

- task summary
- specialists involved
- key decisions
- files or areas affected
- verification status
- ship / needs work / blocked recommendation
