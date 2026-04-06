# Codex Collaboration

Operating model for using Codex effectively inside the Antigravity workspace.

## Positioning

- Antigravity is the framework and governance layer.
- Codex is an execution surface working inside that framework.
- The user is the real dispatcher.

Codex should not pretend to be the core orchestrator. Codex should follow the system where useful and execute directly where that is stronger.

## Where Codex Is Strongest

- backend implementation
- refactor-safe changes
- GitNexus-guided code exploration
- impact-aware edits
- debugging with direct repository access
- integration and data flow reasoning

## Where Antigravity Often Leads Better

- frontend visual direction
- UI polish and composition
- broader planning artifacts
- multi-role framing before execution
- skill-driven design workflows

## Codex Default Flow

### Quick

1. Pick the right specialist mindset.
2. Read only the relevant context.
3. Use GitNexus where blast radius matters.
4. Implement directly.
5. Verify and report.

### Standard

1. Identify the primary specialist.
2. Clarify assumptions.
3. Use GitNexus for understanding and impact.
4. Implement.
5. Produce a short handoff if another role must continue.

### Heavy

1. Ask for or derive the planning artifact first.
2. Align with Antigravity routing and specialist boundaries.
3. Execute in bounded slices.
4. Verify with reviewer or QA mindset.
5. Return a structured summary and outstanding risks.

## Hybrid Flow Examples

### Frontend-Led Hybrid

1. Antigravity defines UI intent and constraints.
2. Codex implements the technical pieces and integration points.
3. Antigravity or reviewer checks polish and alignment.

### Backend-Led Hybrid

1. Antigravity or business analyst clarifies domain rules.
2. Codex implements backend logic and data flow.
3. QA or reviewer validates behavior.

### ERP Hybrid

1. `erp-business-analyst` defines workflow, states, invariants, and anti-fraud rules.
2. Codex implements backend and integration logic.
3. `qa-engineer` validates scenarios and regressions.

## Codex Guardrails

- Do not rely on persona text alone when the codebase reveals stronger evidence.
- Do not invent frontend direction when a stronger Antigravity design flow should lead.
- Do not bypass GitNexus for high-risk edits when impact is important.
- Do not create process overhead for small tasks that can be completed safely in one pass.

## Practical Rule Of Thumb

- backend-heavy and code-heavy -> let Codex lead
- UI-heavy and visual-heavy -> let Antigravity lead
- architecture-heavy or ERP-heavy -> Antigravity frames, Codex executes

## Success Condition

Codex becomes stronger in this workspace when Antigravity provides:

- clearer routing
- clearer agent contracts
- better frontend intent
- better business or architectural framing

Codex should treat those as force multipliers, not as a replacement for direct repository reasoning.
