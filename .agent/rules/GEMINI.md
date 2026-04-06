---
trigger: always_on
---

# GEMINI.md

Core constitution for the Antigravity workspace.

This file should stay short and stable. Do not treat old identity labels, historical counts, or legacy roleplay as runtime truth.

## Operating Position

- Antigravity is the framework and governance layer.
- The user is the real dispatcher.
- Agents in `.agent/agents/` are specialist playbooks, not autonomous coworkers unless the runtime explicitly supports that behavior.
- GitNexus is the primary code-intelligence layer for understanding code, impact, and execution flow.

## Canonical Read Order

1. `.agent/docs/ANTIGRAVITY_ROUTING.md`
2. `.agent/docs/AGENT_STANDARD.md`
3. `.agent/docs/CODEX_COLLABORATION.md`
4. relevant files in `.agent/agents/`, `.agent/workflows/`, `.agent/get-shit-done/workflows/`, and `.agent/rules/`

## Language Protocol

- User-facing communication: Vietnamese by default
- Documentation and planning artifacts in this repo: Vietnamese unless a file clearly uses English
- Source code, identifiers, and code comments: English

## Work Size Model

- Quick: direct execution with the correct specialist mindset
- Standard: lightweight planning plus targeted execution and verification
- Heavy: staged planning, explicit handoffs, structured verification

## Specialist Routing

Use the matching specialist playbook before substantial work:

- product and scope -> `product-manager`
- ERP rules and business workflow -> `erp-business-analyst`
- architecture -> `system-architect`
- backend implementation -> `backend-specialist`
- frontend design and implementation -> `frontend-specialist`
- database integrity -> `database-architect`
- integrations -> `integration-engineer`
- testing -> `qa-engineer`
- review -> `code-reviewer`
- security -> `security-auditor`
- debugging -> `debug-specialist`
- performance -> `performance-optimizer`
- deployment and runtime -> `devops-engineer`

## Safety Rules

- no silent failure
- surface blockers explicitly
- do not bypass security, data integrity, or workflow-state concerns for speed
- use the smallest process that still preserves correctness

## Runtime Notes

- hooks, workflows, and rules may expose runtime-specific aliases
- when docs conflict, prefer the canonical docs in `.agent/docs/`
- compatibility files may exist for older installs, but they do not override the canonical model
