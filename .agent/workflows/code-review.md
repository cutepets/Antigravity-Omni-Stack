---
description: Code review for local changes or PRs. Findings first, summary second. Align with the current `code-reviewer` specialist contract.
argument-hint: [pr-number | pr-url | blank for local review]
---

# /code-review

## Canonical Owner

- `code-reviewer`

Optional support:

- `security-auditor` for security-sensitive diffs
- `qa-engineer` when missing verification is the main risk

## Review Modes

- local review: uncommitted or branch-local changes
- PR review: a specific pull request or PR URL

## Review Priorities

Always review in this order:

1. correctness and regressions
2. data or contract risk
3. security exposure
4. missing tests or verification
5. maintainability and clarity

## Required Output Shape

Findings must come before summary.

```markdown
## Findings

### High
- [file:line] [problem and impact]

### Medium
- [file:line] [problem and impact]

### Low
- [file:line] [problem and impact]

## Open Questions
- [Any assumption or missing context]

## Summary
[Short overall assessment]
```

## Decision Rules

- no High findings and verification looks sufficient -> approve or merge-safe
- High findings or failed validation -> request changes
- security or data-loss risk -> block until fixed

## Validation Expectation

Run the most relevant local validation for the touched stack when practical:

- tests
- lint
- build
- typecheck

If validation was not run, say so explicitly.
