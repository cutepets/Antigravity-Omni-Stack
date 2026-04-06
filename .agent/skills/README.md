# Skills

This directory stores reusable domain knowledge for Antigravity specialists.

## What A Skill Is

A skill is a focused playbook or knowledge module stored in `SKILL.md`.
Agents use skills as supporting context, not as a replacement for routing, ownership, or verification.

## Canonical Usage

- Load only the skills relevant to the current task.
- Prefer agent frontmatter as the primary routing signal for specialist-owned skills.
- Use a skill directly when the task clearly matches the domain even if the agent is not being explicitly "switched".
- Treat `_archive/` as historical reference only, not active runtime context.

## Active Skill Families

- Product and orchestration:
  `ai-product`, `agent-framework-maintenance`, `agent-continuous-learning`, `nanoclaw-repl`
- Backend and architecture:
  `backend-patterns`, `architecture-patterns`, `domain-driven-hexagon`, `microservices-patterns`, `nestjs`, `graphql-architect`
- Data and platform:
  `database-design`, `postgres-patterns`, `sql-optimization-patterns`, `multi-tenant-architecture`, `vector-index-tuning`
- Frontend and design:
  `frontend-design`, `frontend-patterns`, `ui-ux-pro-max-skill`, `react-master`, `nextjs-master`, `tailwind-patterns`
- QA and security:
  `e2e-testing`, `tdd-workflow`, `testing-patterns`, `threat-modeling-expert`, `stride-analysis-patterns`, `screen-reader-testing`
- Ops and deployment:
  `devops-infrastructure-master`, `gitops-workflow`, `grafana-dashboards`, `prometheus-configuration`, `vercel-deploy`

## Maintenance Rules

- Every active skill directory should contain `SKILL.md`.
- Skill references in agent frontmatter should point only to active skill directories.
- Historical or deprecated skills belong in `_archive/`.
- Prefer additive maintenance over mass regeneration.
- Do not use legacy remap scripts to rewrite skills or agents.

## Audit Commands

- `npm run agent:audit-skills`
- `npm run agent:check-orphans`
- `npm run agent:remove-ghosts`
