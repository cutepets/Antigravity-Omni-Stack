---
description: Plan, run, and summarize end-to-end coverage for critical user journeys.
---

# E2E Command

Use `/e2e` when the change must be validated across real application boundaries such as UI -> API -> database -> background work.

## Primary Routing

- `qa-engineer` owns the journey and evidence.
- `frontend-specialist` helps when selectors, UI states, or responsive behavior matter.
- `backend-specialist` or another domain specialist helps when setup data or API contracts are part of the risk.

## When to Use

Use `/e2e` when:

- testing critical user journeys
- verifying multi-step flows end to end
- validating integration between frontend and backend
- checking release readiness for risky changes

## Standard Loop

1. Identify the business journey and its must-pass checkpoints.
2. Define setup data, environment, and fixtures.
3. Add or update the narrowest E2E scenario that covers the risk.
4. Run the targeted E2E command for the affected area.
5. Capture artifacts for failures or notable regressions.
6. Summarize pass/fail status, flakiness, and follow-up work.

## Output Contract

Return:

- the journey under test
- the environment or fixture assumptions
- the test file(s) added or updated
- the command(s) executed
- artifact locations when failures occur
- known gaps that remain outside E2E coverage

## Guardrails

- Do not run destructive payment, trading, or production data flows against production systems.
- Prefer stable selectors and explicit waits over brittle timing assumptions.
- Use E2E for critical journeys, not every edge case.
- If a test is flaky, report the root cause and next fix path instead of silently trusting the pass.

## Related Commands

- `/tdd` for lower-level confidence
- `/test` for broader automated verification
- `/code-review` for release-readiness review
