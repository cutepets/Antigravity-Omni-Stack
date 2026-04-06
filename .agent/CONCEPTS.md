# Antigravity Concepts

This file defines the core building blocks of the Antigravity framework.

## 1. Rule

Rules define the operating constraints of the system:

- safety boundaries
- coding and review expectations
- routing and verification discipline
- cross-cutting behavior all specialists must respect

Canonical source:

- `.agent/rules/GEMINI.md`
- `.agent/rules/README.md`

## 2. Skill

Skills are reusable knowledge modules stored in `.agent/skills/*/SKILL.md`.

Use skills to:

- load domain-specific methods
- reuse battle-tested checklists or implementation patterns
- support a specialist with deeper context

Do not use skills to:

- replace routing
- replace ownership
- mass-regenerate agents or docs

Canonical source:

- `.agent/skills/README.md`

## 3. Agent

Agents are specialist playbooks stored in `.agent/agents/*.md`.

An agent defines:

- when it should be used
- what it owns
- what it must hand off
- what done looks like

Canonical source:

- `.agent/docs/AGENT_STANDARD.md`
- `.agent/docs/ANTIGRAVITY_ROUTING.md`

## 4. Workflow

Workflows are execution playbooks triggered by commands or operating phases.

There are two layers:

- `.agent/workflows/`
  User-facing entrypoints and specialist-facing task flows
- `.agent/get-shit-done/workflows/`
  Heavier project-management and phased execution flows

## 5. Work Size

Antigravity routes work by execution weight:

- `Quick`
  Small, local, low-risk work. Prefer one specialist and direct execution.
- `Standard`
  Medium complexity. Route to one lead specialist with light handoffs.
- `Heavy`
  High-risk or cross-cutting work. Use structured planning, staged execution, and verification.

Canonical source:

- `.agent/docs/ANTIGRAVITY_ROUTING.md`

## 6. Collaboration Model

In this workspace:

- Antigravity is the framework, routing discipline, and operating playbook
- specialists provide domain ownership
- Codex is a direct execution surface working inside that framework

Canonical source:

- `.agent/docs/CODEX_COLLABORATION.md`

## 7. Source Of Truth

When docs disagree, prefer this order:

1. `.agent/docs/ANTIGRAVITY_ROUTING.md`
2. `.agent/docs/AGENT_STANDARD.md`
3. `.agent/rules/GEMINI.md`
4. agent frontmatter and agent playbooks in `.agent/agents/`
5. skill docs in `.agent/skills/`
