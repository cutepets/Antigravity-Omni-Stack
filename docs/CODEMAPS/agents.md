<!-- Generated: 2026-04-02 | Agents: 16 | Token estimate: ~750 -->

# Agents — Antigravity v5.0 (16 Agents)

## Model Distribution

| Tier | Model | Agents |
|------|-------|--------|
| 🔵 Deep Reasoning | `claude-opus-4-5` | ai-orchestrator, system-architect |
| 🟢 Balanced | `claude-sonnet-4-5` | 11 agents (production) |
| 🟡 Fast/Cheap | `claude-haiku-3-5` | code-reviewer, product-manager, research-specialist |

## Agent Roster

| Agent | Model | Skills | Domain |
|-------|-------|--------|--------|
| `ai-orchestrator` | opus-4-5 | ~39 | Điều phối tổng hợp, routing |
| `system-architect` | opus-4-5 | ~65 | Architecture, design patterns |
| `backend-specialist` | sonnet-4-5 | ~35 | APIs, services, databases |
| `frontend-specialist` | sonnet-4-5 | ~42 | React, UI/UX, browser testing |
| `database-architect` | sonnet-4-5 | ~26 | Schema, CQRS, query opt |
| `devops-engineer` | sonnet-4-5 | ~46 | CI/CD, containers, infra |
| `integration-engineer` | sonnet-4-5 | ~26 | APIs, voice AI, webhooks |
| `mcp-developer` | sonnet-4-5 | ~24 | MCP servers, protocols |
| `mobile-developer` | sonnet-4-5 | ~23 | React Native, iOS, Android |
| `performance-optimizer` | sonnet-4-5 | ~25 | Web vitals, profiling, monorepo |
| `python-specialist` | sonnet-4-5 | ~35 | Python, ML/AI pipelines, RAG |
| `qa-engineer` | sonnet-4-5 | ~31 | Testing, E2E, accessibility |
| `security-auditor` | sonnet-4-5 | ~29 | OWASP, SAST, secrets |
| `code-reviewer` | haiku-3-5 | ~25 | Review, quality, auto-fix |
| `product-manager` | haiku-3-5 | ~34 | PRD, SEO, roadmap |
| `research-specialist` | haiku-3-5 | ~21 | Research, web search, NotebookLM |

## File Locations

```
.agent/agents/
├── ai-orchestrator.md
├── backend-specialist.md
├── code-reviewer.md
├── database-architect.md
├── devops-engineer.md
├── frontend-specialist.md
├── integration-engineer.md
├── mcp-developer.md
├── mobile-developer.md
├── performance-optimizer.md
├── product-manager.md
├── python-specialist.md
├── qa-engineer.md
├── research-specialist.md
├── security-auditor.md
└── system-architect.md
```

## Routing Logic

```
Task type          → Agent triggered
──────────────────────────────────────
UI/Component       → frontend-specialist
API/Service        → backend-specialist
DB schema/query    → database-architect
Bug/Error          → (debugger via /debug workflow)
Performance        → performance-optimizer
Security audit     → security-auditor
Mobile feat        → mobile-developer
Data pipeline      → python-specialist
MCP server         → mcp-developer
Integration (3rd)  → integration-engineer
Complex plan       → system-architect
Multi-agent        → ai-orchestrator
```

## Tools Per Agent Type

| Tool | Agents with access |
|------|--------------------|
| `Bash` | All agents |
| `Edit/Write` | All + code-reviewer, security-auditor |
| `MultiEdit` | system-architect, database-architect, mcp-developer |
| `WebFetch` | frontend, qa, research, backend |
| `Grep/Glob` | mcp-developer, research-specialist |
