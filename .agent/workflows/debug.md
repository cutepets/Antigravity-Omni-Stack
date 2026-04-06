---
description: Debugging workflow for Quick or Standard bug work. Start with evidence, isolate root cause, then route to the right implementation specialist.
---

# /debug

$ARGUMENTS

## Canonical Routing

- Quick bug with clear root cause -> `debug-specialist` plus direct fix
- Standard bug requiring investigation -> `debug-specialist -> implementation specialist -> qa-engineer`
- Heavy incident spanning architecture or operations -> escalate to `/orchestrate` or GSD

## Workflow

### 1. Evidence Collection

Primary specialist:

- `debug-specialist`

Read:

- stack traces
- logs
- failing test output
- reproduction steps
- recent change context

### 2. Root-Cause Framing

The debug pass should identify:

- failing surface
- likely root cause
- confidence level
- smallest safe fix

### 3. Repair

Route to:

- `backend-specialist`
- `frontend-specialist`
- `integration-engineer`
- `devops-engineer`

depending on where the failure actually lives.

### 4. Verification

Use:

- targeted reproduction
- automated test where practical
- regression check

`qa-engineer` should join when the bug affects user-visible flows or risky behavior.

## Expected Output

```markdown
## Debug Report: [Issue]

### Root Cause
[Most likely cause and confidence]

### Fix Strategy
- [Smallest safe change]

### Verification
- [How the bug was reproduced]
- [How the fix was checked]

### Escalations
- [Any remaining risk or follow-up]
```
