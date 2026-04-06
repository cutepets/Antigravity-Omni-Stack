---
description: Run a test-first implementation loop for changes where regression risk matters.
---

# TDD Command

Use `/tdd` when the safest path is to define behavior first, make it fail, then implement the smallest change that turns the test green.

## Primary Routing

- `qa-engineer` owns the test strategy and evidence.
- The implementation specialist owns the code change:
  - `backend-specialist`
  - `frontend-specialist`
  - `python-specialist`
  - another domain specialist as needed

## When to Use

Use `/tdd` when:

- implementing new features
- changing business logic
- fixing bugs where a regression should be reproduced first
- refactoring code with non-trivial behavior
- working on security, money, permissions, or state transitions

## Standard Loop

1. Define the behavior in plain language.
2. Add or update the narrowest test that proves that behavior.
3. Run the test and confirm it fails for the expected reason.
4. Implement the minimum change needed to pass.
5. Re-run the targeted test.
6. Refactor only while keeping tests green.
7. Run broader validation if the blast radius is larger than the changed area.

## Output Contract

Return:

- the behavior under test
- the test file(s) added or updated
- the command used to prove `red -> green`
- the implementation scope
- remaining risks or missing cases

## Guardrails

- Do not write production code before the first failing test unless the repo genuinely has no runnable test surface for this area.
- Prefer behavior tests over implementation-detail tests.
- For critical logic, add edge cases and error cases before declaring done.
- Pair `/tdd` with `/e2e` when the change spans UI and backend boundaries.

## Related Commands

- `/test` for broader verification
- `/e2e` for cross-surface journeys
- `/code-review` for regression review after the TDD loop
