# Antigravity Routing

Canonical routing guide for choosing the right execution path by task size, risk, and specialization.

## Core Model

Antigravity should route work across three axes:

- work size
- domain specialization
- execution surface

The goal is not "always multi-agent". The goal is "minimum process that still protects quality".

## Work Size Routing

### Quick

Use for:

- typo fixes
- text changes
- single-file UI tweaks
- isolated config updates
- small bug fixes with clear root cause
- narrow refactors with obvious blast radius

Default behavior:

- pick one primary specialist
- execute directly
- keep planning in chat or a short note
- verify locally

Do not start heavy orchestration for Quick work.

### Standard

Use for:

- one feature in one bounded area
- multi-file backend work in one module
- moderate frontend implementation from a clear UI concept
- API plus schema adjustment with known scope
- bug fixing that requires investigation but not full project re-planning

Default behavior:

- pick one primary specialist
- optionally consult one supporting specialist
- create a lightweight plan
- produce a short handoff if another specialist must continue
- verify before closing

### Heavy

Use for:

- architectural changes
- ERP workflow changes
- state machine changes
- cross-module refactors
- security-sensitive flows
- multi-team or multi-surface features
- any work where unclear requirements can cause rework

Default behavior:

- route through orchestrated planning
- define scope, risks, and handoffs first
- execute in stages
- verify with QA or reviewer pass
- keep artifacts in structured docs if the workflow requires it

## Specialization Routing

### Analysis and Product Shaping

- `product-manager`: PRD, scope, tradeoffs, acceptance criteria
- `erp-business-analyst`: business rules, state machines, accounting logic, anti-fraud paths
- `research-specialist`: external technical exploration and comparative options

### Architecture and Data

- `system-architect`: architecture, modularization, long-horizon structure
- `database-architect`: schema, integrity, constraints, auditability
- `mcp-developer`: MCP servers, tools, plugin interfaces, protocol boundaries

### Implementation

- `backend-specialist`: API, services, workers, auth, domain logic
- `frontend-specialist`: UI, UX, accessibility, design systems, browser behavior
- `mobile-developer`: native or React Native implementation
- `integration-engineer`: webhooks, third-party sync, provider integrations
- `python-specialist`: Python tooling, AI pipelines, data-heavy scripting

### Verification and Reliability

- `qa-engineer`: test strategy, regression, E2E, acceptance coverage
- `code-reviewer`: maintainability, code smell, structural correctness
- `security-auditor`: privilege boundaries, attack surface, secrets, auth abuse
- `performance-optimizer`: latency, bundle size, memory, throughput bottlenecks
- `debug-specialist`: difficult failures, root-cause diagnosis, runtime anomalies
- `devops-engineer`: deploy, CI/CD, cloud runtime, operational safety

## Execution Surface Routing

### Antigravity-Led

Best when:

- frontend direction is unclear
- visual polish matters
- the user wants structured planning artifacts
- multiple specialist perspectives are needed before execution

Antigravity should lead with:

- routing
- planning
- handoff documents
- UX and artifact structure

### Codex-Led

Best when:

- backend logic is the core task
- the code change is concrete and implementation-heavy
- blast radius must be handled precisely
- the user wants fast direct execution in the repo

Codex should lead with:

- codebase exploration
- GitNexus impact checks
- implementation
- verification

### Hybrid

Best when:

- frontend and backend both matter
- business rules must be translated before coding
- Antigravity has stronger design or planning context
- Codex has stronger implementation depth in backend or integration work

Hybrid pattern:

1. Antigravity defines scope or UI or business artifacts.
2. Codex implements the technical core.
3. Antigravity or a reviewer pass checks polish, alignment, or UX.

## Recommended Routing Matrix

| Task Type | Size | Lead | Support |
|-----------|------|------|---------|
| Backend feature | Standard | `backend-specialist` or Codex-led backend flow | `database-architect`, `qa-engineer` |
| UI-heavy page or redesign | Standard or Heavy | `frontend-specialist` or Antigravity-led | `code-reviewer`, `qa-engineer` |
| ERP workflow change | Heavy | `erp-business-analyst` | `backend-specialist`, `database-architect`, `qa-engineer` |
| Architecture refactor | Heavy | `system-architect` | `backend-specialist`, `code-reviewer` |
| Production bug | Quick or Standard | `debug-specialist` | `backend-specialist`, `qa-engineer` |
| Security review | Standard or Heavy | `security-auditor` | `backend-specialist`, `code-reviewer` |
| Integration or webhook work | Standard | `integration-engineer` | `backend-specialist`, `qa-engineer` |
| Performance bottleneck | Standard | `performance-optimizer` | `frontend-specialist` or `backend-specialist` |

## Frontend Guidance

Antigravity has a real advantage on frontend when the work depends on:

- visual direction
- strong composition
- design systems
- animation and polish
- accessibility review

For frontend-heavy work, prefer this sequence:

1. `frontend-specialist` creates UI intent, structure, and constraints.
2. Implementation follows that spec.
3. `qa-engineer` or `code-reviewer` verifies usability and regressions.

## Backend Guidance

Codex-led backend execution is preferred when the work depends on:

- precise repository edits
- API or service logic
- data flow reasoning
- refactor safety
- code intelligence and impact analysis

For backend-heavy work, prefer this sequence:

1. Clarify business or architectural constraints if needed.
2. Use GitNexus for impact and execution flow.
3. Implement directly.
4. Run verification and review.

## Escalation Rules

Escalate from Quick to Standard if:

- more than one module is involved
- a data contract changes
- the root cause is not obvious
- a second specialist is needed

Escalate from Standard to Heavy if:

- requirements are ambiguous
- a business workflow changes state transitions
- security or accounting correctness is involved
- multiple surfaces need coordinated changes

## Handoff Minimum

Any cross-specialist handoff should contain:

- context
- findings
- files touched or expected
- open questions
- recommendations

Use the `HANDOFF` structure already used in the repo.

## Canonical Decision

Antigravity should optimize for:

- the smallest process that preserves correctness
- specialist clarity over agent theater
- real handoffs over vague persona roleplay
