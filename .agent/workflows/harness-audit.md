---
description: Audit the Antigravity framework layers and report remaining drift.
---

# Harness Audit Command

Run a repo-level framework audit for agents, skills, workflows, hooks, and maintenance scripts.

## Usage

`/harness-audit [scope] [--format text|json]`

- `scope` (optional): `repo` (default), `hooks`, `skills`, `workflows`, `agents`, `docs`
- `--format`: `text` (default) or `json`

## Canonical Checks

Use the repo-maintained scripts first:

```bash
npm run agent:audit-workflows
npm run agent:audit-skills
npm run agent:check-orphans
```

Optional safety scan:

```bash
npm run scan:agent
```

## What to Review

1. Workflow drift: legacy refs, stale paths, missing frontmatter
2. Skill coverage: active skills, orphan skills, legacy refs
3. Agent ownership: every active skill mapped to a live specialist
4. Hooks and rules alignment: canonical docs match runtime behavior
5. Root docs alignment: no duplicated or misleading source of truth

## Output Contract

Return:

- findings grouped by layer
- exact file paths for remaining drift
- high-confidence cleanup actions
- whether the framework is safe to treat as canonical
