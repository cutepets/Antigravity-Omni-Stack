---
description: Restate scope, classify work size, and produce a lightweight or staged plan before implementation when the task is Standard or Heavy.
---

# /plan

Use `/plan` when the work is too large or risky for direct Quick execution.

This command should align with `.agent/docs/ANTIGRAVITY_ROUTING.md`, not with older planner-only conventions.

## Canonical Role

`/plan` is the human-facing planning entrypoint for:

- Standard work that needs a short implementation plan
- Heavy work that needs staged execution, risks, and handoffs

It is not required for every Quick task.

## When To Use

Use `/plan` for:

- multi-file implementation in one bounded area
- architecture or data-contract changes
- ERP or workflow-state changes
- security-sensitive work
- tasks where ambiguity would cause rework

Skip `/plan` for:

- typo fixes
- tiny config changes
- isolated one-file edits with obvious blast radius

## Default Routing

- Quick -> execute directly with the right specialist mindset
- Standard -> `/plan`, then implement and verify
- Heavy -> `/plan`, then route into staged execution or GSD phase workflows

## Expected Output

The plan should produce:

1. scope restatement
2. size classification: `Quick`, `Standard`, or `Heavy`
3. primary specialist and optional support specialist
4. implementation slices or phases
5. risks, assumptions, and handoff points
6. explicit next step

## Confirmation Rule

User confirmation is strongly recommended before code work when:

- the task is Heavy
- the architecture may shift
- the user asked for a plan first

For Standard work, confirmation is optional if the requested task is already concrete and low ambiguity.

## Recommended Specialist Mapping

- product or scope shaping -> `product-manager`
- ERP rules -> `erp-business-analyst`
- architecture -> `system-architect`
- backend implementation plan -> `backend-specialist`
- frontend implementation plan -> `frontend-specialist`

## Next Commands

- direct execution after an approved Standard plan
- `/orchestrate` when handoffs across specialists are required
- GSD workflows when phase artifacts or staged execution are needed
