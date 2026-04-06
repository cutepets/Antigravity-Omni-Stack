---
description: Release-readiness or quality audit across correctness, verification, and compliance. Use near handoff or before shipping.
---

# /audit

$ARGUMENTS

## Canonical Routing

- implementation quality audit -> `code-reviewer`
- security-sensitive audit -> `security-auditor`
- release-readiness audit -> `qa-engineer + code-reviewer`, with `security-auditor` when needed

## Workflow

### 1. Gather Evidence

Review:

- changed files
- validation results
- known issues
- unresolved risks

### 2. Run The Audit Lenses

Use the right mix:

- `code-reviewer` for correctness and maintainability
- `qa-engineer` for verification coverage
- `security-auditor` for security or data exposure

### 3. Report Release Readiness

The result should clearly say:

- ready
- needs work
- blocked

## Output

```markdown
## Audit Report: [Scope]

### Findings
- [Severity] [Issue]

### Verification Status
- [What was checked]

### Recommendation
- [Ready | Needs work | Blocked]
```
