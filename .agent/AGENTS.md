# Antigravity Agents

This file is the overview for the specialist roster inside `.agent/agents/`.

## Core Roles

### Orchestration and product

- `ai-orchestrator`
- `product-manager`
- `erp-business-analyst`

### Engineering

- `system-architect`
- `backend-specialist`
- `frontend-specialist`
- `mobile-developer`
- `database-architect`
- `python-specialist`
- `mcp-developer`
- `integration-engineer`

### Quality, safety, and operations

- `qa-engineer`
- `code-reviewer`
- `security-auditor`
- `debug-specialist`
- `performance-optimizer`
- `devops-engineer`
- `research-specialist`

## How To Read The Roster

Each agent file defines:

- when to use it
- what it owns
- what it must not own
- required inputs
- working process
- mandatory output format
- handoff rules

Canonical source:

- `.agent/agents/*.md`
- `.agent/docs/AGENT_STANDARD.md`
- `.agent/docs/ANTIGRAVITY_ROUTING.md`

## Skill Ownership Status

The current framework state is:

- all `108` active skills are assigned to agents
- `0` orphan active skills
- `0` active skills missing `SKILL.md`

Verify with:

- `npm run agent:audit-skills`
- `npm run agent:check-orphans`

## Maintenance Rule

Do not regenerate the roster with legacy remap scripts.
Update the specialist files directly and keep skill ownership auditable.
