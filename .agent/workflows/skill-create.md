---
name: skill-create
description: Create a new local skill or refresh an existing one using the Antigravity skill standard.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /skill-create

Use `/skill-create` when the framework needs a new reusable skill or a rewrite of an existing one.

## Standard Loop

1. Identify the repeatable workflow, decision pattern, or tool usage that deserves a skill.
2. Find the owning specialist agent for that domain.
3. Inspect neighboring skills in `.agent/skills/` and the canonical rules in `.agent/docs/AGENT_STANDARD.md`.
4. Draft or update `.agent/skills/<skill-name>/SKILL.md`.
5. If the skill is active, add or confirm ownership in the matching agent file under `.agent/agents/`.
6. Run the skill audits and fix any orphan or legacy refs.

## Deliverables

- a new or updated `SKILL.md`
- agent ownership for active skills
- any needed support files such as examples or helper scripts
- passing audit results from:

```bash
npm run agent:audit-skills
npm run agent:check-orphans
```

## Guardrails

- Do not create a skill if the behavior is one-off or project-specific noise.
- Prefer adapting an existing skill before adding a near-duplicate.
- Keep the skill executable and local-first; avoid references to external plugin runtimes that are not present in this repo.
