# Agent Standard

Canonical standard for specialist agents in this repository.

The current agent set should move from persona-only markdown to operational playbooks.

## Why

An agent spec is only useful if it makes routing, execution, and handoff more reliable.

A good agent file should answer:

- when should this agent be used
- what input does it require
- what steps should it follow
- what output must it produce
- where does it hand off next
- what does done mean

## Required Agent Structure

Each agent file should contain these sections after frontmatter:

1. `Role`
2. `When To Use`
3. `Primary Responsibilities`
4. `Domain Boundaries`
5. `Required Inputs`
6. `Working Process`
7. `Mandatory Output Format`
8. `Handoff Rules`
9. `Recommended Downstream Routing`
10. `Definition Of Done`
11. `Guardrails`
12. `Review Checklist`

## Frontmatter Standard

Keep the existing metadata fields that current tooling may expect:

```yaml
---
name: backend-specialist
description: Short routing description.
model: claude-sonnet-4-5
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Grep
  - Glob
skills:
  - example-skill
---
```

Do not treat `model` or `tools` as runtime truth for every client. They are compatibility metadata unless the runtime explicitly uses them.

## Output Contract Standard

Every agent should produce one of these outputs:

- a specialist analysis
- an implementation handoff
- a review report
- a verification result

The output must be structured, concise, and reusable by the next specialist.

## Handoff Standard

Use this format:

```markdown
## HANDOFF: [source-agent] -> [target-agent]

### Context
[What is being worked on and why]

### Findings
- [Key discovery]
- [Key decision]
- [Critical constraint]

### Files Modified
- [Path or "None"]

### Open Questions
- [Remaining ambiguity]

### Recommendations
- [Concrete next step]
```

## Definition Of Done Standard

Every agent should define done in observable terms:

- scope restated
- assumptions made explicit
- decisions documented
- downstream consumer can proceed without guessing
- unresolved risks called out

## Guardrail Standard

Every agent should say what it must not do.

Examples:

- backend agent must not silently redesign schema ownership
- frontend agent must not invent backend contracts
- business analyst must not jump straight to API shapes without workflow rules
- reviewer must not summarize before listing findings

## Migration Strategy

Prioritize migration in this order:

1. `ai-orchestrator`
2. `backend-specialist`
3. `frontend-specialist`
4. `erp-business-analyst`
5. all remaining specialists

## Current Reference Implementation

Use `.agent/agents/erp-business-analyst.md` as the first operational example already converted to this standard.

## Anti-Patterns To Remove

- persona-only files with no deliverable contract
- vague "expert in X" language with no routing rules
- missing handoff section
- missing input requirements
- missing definition of done
- tool lists treated as magical capability instead of contextual hints
