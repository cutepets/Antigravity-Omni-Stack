# Antigravity Omni-Stack: Directory Structure

## Root

```
c:\Dev2\
├── .agent/                    # Antigravity Agent Framework Core
│   ├── agents/                # 16 Specialized Agent definitions
│   ├── skills/                # 344 Deep-methodology skill files
│   ├── workflows/             # 84 Slash-command workflow scripts
│   ├── rules/                 # 37 Context-triggering rule files
│   ├── hooks/                 # Runtime hook scripts (Node.js)
│   ├── get-shit-done/         # GSD Project Management Framework (v1.30.0)
│   ├── .shared/               # 17 Shared DNA blueprints
│   ├── scripts/               # Utility scripts (gitnexus-sync, etc.)
│   ├── settings.json          # Hook registration & permissions config
│   └── ARCHITECTURE.md        # Framework architecture documentation
│
├── .planning/                 # GSD Project State (DO NOT EDIT MANUALLY)
│   ├── PROJECT.md             # Living project context & requirements
│   ├── ROADMAP.md             # Milestone roadmap with phases & plans  
│   ├── STATE.md               # Current position & session continuity
│   ├── phases/                # Per-phase: CONTEXT, PLAN, SUMMARY, VERIFICATION
│   ├── milestones/            # Completed milestone archives
│   └── codebase/             # Auto-generated codebase maps
│
├── .gitnexus/                 # GitNexus code intelligence index
├── .git/                      # Git version control
├── node_modules/              # Node.js dependencies (moleculer, gitnexus)
├── GEMINI.md                  # Core Constitution / Agent Identity v4.0
├── AGENTS.md                  # GitNexus integration rules
├── ERRORS.md                  # Error log for continuous learning
└── README.md                  # Project overview & documentation
```

## `.agent/agents/` — 16 Core Agents

| Agent | Role |
|-------|------|
| `ai-orchestrator.md` | Meta-orchestrator & multi-agent coordinator |
| `backend-specialist.md` | Node.js, APIs, microservices |
| `code-reviewer.md` | Code quality, security audit, refactoring |
| `database-architect.md` | PostgreSQL, schema design, query optimization |
| `devops-engineer.md` | CI/CD, Docker, cloud deploy |
| `frontend-specialist.md` | React, Next.js, UI/UX implementation |
| `integration-engineer.md` | MCP servers, API integrations, webhooks |
| `mcp-developer.md` | Model Context Protocol server development |
| `mobile-developer.md` | React Native, iOS, Android |
| `performance-optimizer.md` | Profiling, optimization, bundle size |
| `product-manager.md` | Planning, roadmap, requirements |
| `python-specialist.md` | Python, data engineering, ML pipelines |
| `qa-engineer.md` | Testing, TDD, E2E, coverage |
| `research-specialist.md` | Research, documentation, technical writing |
| `security-auditor.md` | Security scanning, STRIDE, pen testing |
| `system-architect.md` | Architecture decisions, design patterns |

## `.agent/skills/` — 344 Skills (Organized by Domain)

Skills are **loaded on-demand** by agents. Each skill is a `SKILL.md` file following the format:
```yaml
---
name: skill-name
description: When to use this skill
---
[Detailed methodology, matrices, anti-patterns]
```

Domain clusters:
- **Frontend**: react-master, nextjs-master, tailwind-patterns, ui-ux-pro-max-skill (~60 skills)
- **Backend**: api-design, backend-patterns, nestjs, bullmq-specialist (~45 skills)
- **DevOps**: agent-devops-spec, vercel-deploy, cicd-automation (~20 skills)
- **Testing**: tdd-master-workflow, e2e-testing, test-fixing (~25 skills)
- **Security**: vulnerability-scanner, stride-analysis, attack-tree (~15 skills)
- **AI/Agents**: blockrun, parallel-agents, agent-memory-mcp (~30 skills)
- **Database**: postgres-patterns, nosql-expert, database-design (~20 skills)
- **Mobile**: react-native-master, mobile-design, agent-mobile-spec (~15 skills)
- **Misc**: brainstorming, clean-code, documentation-templates, etc. (~114 skills)

## `.agent/workflows/` — 84 Slash Commands

All workflows have YAML `description:` frontmatter for IDE slash-command visibility.

Key workflow groups:
- **Planning**: `/plan`, `/create`, `/orchestrate`, `/prp-plan`, `/prp-implement`
- **Multi-Agent**: `/multi-workflow`, `/multi-frontend`, `/multi-backend`, `/devfleet`
- **Quality**: `/code-review`, `/tdd`, `/test`, `/e2e`, `/santa-loop`
- **GSD Lifecycle**: `/gsd:autonomous`, `/gsd:progress`, `/gsd:health`, etc.
- **Utilities**: `/debug`, `/backup`, `/deploy`, `/security`, `/seo`

## `.agent/rules/` — 37 Rules

Rules use two trigger modes:
- `trigger: always_on` — Always loaded (GEMINI.md, security.md, runtime-watchdog.md)
- `trigger: glob` — Loaded for specific file patterns (typescript, python, backend)
- `trigger: model_decision` — Loaded by agent when relevant (code-quality, docs-update)

## `.agent/hooks/` — Runtime Guards

| Hook | Event | Purpose |
|------|-------|---------|
| `gsd-prompt-guard.js` | PreToolUse | Scan for prompt injection in .agent/ & .gemini/ writes |
| `gsd-context-monitor.js` | AfterTool | Warn agent when context window is low |
| `gsd-workflow-guard.js` | PreToolUse | Nudge agent to use /plan when making unstructured edits |
| `gsd-check-update.js` | SessionStart | Check for GSD framework updates |
| `session-stop-audit.js` | Stop | Log session end, verify no secrets committed |
