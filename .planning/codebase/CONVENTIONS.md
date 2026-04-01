# Antigravity Omni-Stack: Coding Conventions

## Agent File Format

All agent files follow a strict template:

```markdown
---
name: agent-name
description: "Short description for routing"
model: claude-sonnet-4-5          # or gemini-3-pro
tools: [Read, Edit, Write, Bash, Grep, Glob, Agent, Task]  # least-privilege
---

# Role: [Agent Name]

## Identity
[2-3 sentence description of specialty and responsibility]

## Core Principles
1. [Principle]
2. [Principle]
3. [Principle]

## Skills
- skill-name: [when to invoke]
- skill-name: [when to invoke]

## Workflow
[Step-by-step approach for this agent's tasks]
```

**Rules:**
- Agent file size target: ~2K characters (thin agent)
- Must have `tools:` array (least-privilege — no unused tools)
- Must reference specific skills in `Skills:` section
- No methodology detail in agent file — delegate to skills

## Skill File Format

```markdown
---
name: skill-name
description: "Trigger condition / when to use"
---

# [Skill Name]

## Purpose
[1-2 sentences]

## Methodology
[Detailed step-by-step]

## Anti-patterns
- [What NOT to do]

## Decision Matrix (if applicable)
| Condition | Action |
|-----------|--------|
```

## Workflow (Slash Command) Format

```markdown
---
description: short description for slash command menu
---

[Workflow steps]
```

**Rules:**
- MUST have YAML frontmatter `description:` for slash command visibility
- Steps should be actionable and numbered
- Use `// turbo` annotation above steps safe for auto-execution
- Use `// turbo-all` at the top if ALL steps are auto-safe

## Rule File Format

```markdown
---
description: "When to apply this rule"
trigger: glob | always_on | model_decision
globs: "**/*.ts,**/*.tsx"           # only for trigger: glob
---

[Rule content in markdown]
```

**Trigger Strategy:**
- `always_on`: Only for core Constitution (GEMINI.md, security.md, runtime-watchdog.md)
- `glob`: For language/framework-specific rules (TypeScript, Python, backend patterns)
- `model_decision`: For situational rules — agent decides when relevant (code-quality, docs-update)

## Naming Conventions

| Component | Convention | Example |
|-----------|------------|---------|
| Agent files | kebab-case.md | `frontend-specialist.md` |
| Skill files | kebab-case/ + SKILL.md | `react-master/SKILL.md` |
| Workflow files | kebab-case.md | `multi-workflow.md` |
| Rule files | kebab-case.md | `typescript-coding-style.md` |
| Hook files | camelCase.js | `gsdContextMonitor.js` |
| Phase dirs | 2-digit padded | `08/`, `09/`, `10/` |
| Plan files | {phase}-{plan}-PLAN.md | `08-01-PLAN.md` |

## Skill Routing (Regex Router)

The `remap-smart.js` script auto-assigns skills to agents via keyword matching.

**Matching Priority:**
1. Explicit agent keyword match in skill name (e.g., "mobile" → mobile-developer)
2. Domain cluster match (e.g., "postgres" → database-architect)
3. Fallback to most relevant generalist agent

**To add a new skill:**
1. Create `.agent/skills/[skill-name]/SKILL.md`
2. Run `node remap-smart.js` to auto-assign to appropriate agent
3. Verify assignment in agent's `Skills:` section

## GSD State Files

**Never edit manually:**
- `.planning/STATE.md` — Updated by `gsd-tools.cjs` after each phase transition
- `.planning/phases/*/` — Created by GSD workflows
- `.planning/gsd-state.json` — Ephemeral, auto-regenerated

**Safe to edit:**
- `.planning/PROJECT.md` — Requirements & decisions (evolves with product)
- `.planning/ROADMAP.md` — Phases & success criteria (add phases as needed)

## Git Conventions

- Commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `refactor`, `chore`
- Scope: agent name, skill name, or component (e.g., `frontend-specialist`, `hooks`)
- No emoji in commits (keep machine-parseable)
