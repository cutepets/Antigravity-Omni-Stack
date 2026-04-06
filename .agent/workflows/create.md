---
description: Full-cycle feature or product creation entrypoint. Use for Standard-to-Heavy work that needs shaping, design, implementation, and verification.
---

# /create

$ARGUMENTS

Use `/create` when the request is larger than a direct fix and should move through a structured creation flow.

## Canonical Flow

### 1. Scope And Outcome

Primary specialist:

- `product-manager`

Optional support:

- `erp-business-analyst`
- `system-architect`

Goal:

- restate the problem
- define the target outcome
- classify work as `Standard` or `Heavy`
- identify acceptance criteria

### 2. Solution Framing

Primary specialist:

- `system-architect` for architecture-heavy work
- `erp-business-analyst` for ERP or business-rule-heavy work
- `frontend-specialist` for UI-led creation

Goal:

- define implementation boundaries
- clarify data contracts or workflow rules
- decide whether phased execution is needed

### 3. Implementation

Route to the primary builder:

- `backend-specialist`
- `frontend-specialist`
- `mobile-developer`
- `integration-engineer`
- `python-specialist`

Support specialists join only when the task truly crosses boundaries.

### 4. Verification And Release Readiness

Primary specialists:

- `qa-engineer`
- `code-reviewer`
- `security-auditor` when auth, payments, secrets, or external exposure matter

## Routing Rule

- Small and self-contained -> prefer direct execution instead of `/create`
- Standard -> lightweight plan plus targeted implementation
- Heavy -> use staged planning, handoffs, and verification

If phased artifacts are needed, route into `.agent/get-shit-done/workflows/`.

## Required Deliverables

- scope and acceptance criteria
- architecture or workflow decisions when needed
- implementation handoff
- verification result

## Frontend Rule

When the task is UI-heavy, `/create` should route through `frontend-specialist` and may use `/ui-ux-pro-max` before implementation.

## Examples

- `/create customer portal with role-based access`
- `/create ERP stock adjustment workflow with audit trail`
- `/create admin dashboard with backend API and responsive UI`
