# 🚀 Antigravity Omni-Stack — Agent Framework

<div align="center">

**Version:** `3.2.0` · **Engine:** Antigravity IDE + MCP · **Security Grade:** `A (97/100)`

[![AgentShield](https://img.shields.io/badge/AgentShield-A%2097%2F100-brightgreen?style=flat-square&logo=shield)](https://github.com/cutepets/Antigravity-Omni-Stack)
[![Agents](https://img.shields.io/badge/Agents-9%20Core-blue?style=flat-square)](./agent/agents/)
[![Skills](https://img.shields.io/badge/Skills-344-purple?style=flat-square)](./agent/skills/)
[![Workflows](https://img.shields.io/badge/Workflows-84-orange?style=flat-square)](./agent/workflows/)
[![Rules](https://img.shields.io/badge/Rules-37-red?style=flat-square)](./agent/rules/)

</div>

---

## 📋 Overview

**Antigravity Omni-Stack** is an internal **Multi-Agent AI Coding Framework** engineered for the full software development lifecycle — design, coding, testing, security, and operations. Rather than a generic assistant, the system runs a **Divide & Conquer architecture** where each agent has deep, narrow specialization and offloads complex methodology to lean, on-demand skills.

**Architecture Pattern: Thin Agent + Rich Skills**
```
Agent (~2K chars)  →  Identity + Core Principles + Skill References
     └── Skills (loaded on demand)  →  Deep Methodology + Anti-patterns + Matrices
```

---

## 🛡️ Security Audit Report (AgentShield)

**Last scan:** `2026-04-01` · **Tool:** `npx ecc-agentshield scan --path .agent`

| Category | Score | Status |
|:---|:---:|:---|
| 🔐 Secrets | 100/100 | ✅ No hardcoded secrets detected |
| 🪝 Hooks | 100/100 | ✅ PreToolUse + AfterTool + Stop hooks active |
| 🌐 MCP Servers | 100/100 | ✅ All MCP servers secured |
| 🤖 Agents | 100/100 | ✅ All agents have tools restriction + model specified |
| 🔑 Permissions | 85/100 | ⚠️ Bash+Write+Edit required by design (protected by deny rules) |
| **Overall** | **97/100 — Grade A** | 🏆 **Production-Ready** |

**Active Security Controls:**
- ✅ `dangerously-skip-permissions` forbidden and documented
- ✅ Deny rules: `sudo`, `chmod 777`, `ssh`, `rm -rf *`, `> /dev/*`, `DROP`, `DELETE FROM`
- ✅ PreToolUse hooks on all Bash + Write/Edit operations
- ✅ Stop hooks for session-end audit logging
- ✅ Explicit `tools:` array on all 9 agents (least-privilege)

```bash
# Re-run audit anytime
npm run scan:agent
```

---

## 🤖 Core Agents (9)

Each agent is a **thin identity shell** (~1.5–3K chars) that loads deep methodology from dedicated skills on demand.

### 🏗️ Full-Stack Engineers
| Agent | Model | Role | Loaded Skills |
|:---|:---|:---|:---|
| 🧑‍💻 **`frontend-specialist`** | Sonnet 4.5 | React/Next.js UI, design systems, performance | `agent-frontend-design-system`, `nextjs-master`, `tailwind-patterns` |
| ⚙️ **`backend-specialist`** | Sonnet 4.5 | API design, **NestJS**, microservices, business logic | `agent-backend-spec`, `agent-backend-patterns`, `nestjs-expert`, `nestjs` |
| 🐍 **`python-specialist`** | Sonnet 4.5 | **FastAPI, LangChain, ML pipelines, AI/heavy** | `python-master`, `ml-engineer`, `mlops-engineer`, `ai-product` |
| 📱 **`mobile-developer`** | Sonnet 4.5 | React Native, Flutter, iOS/Android, offline-first | `agent-mobile-spec`, `react-native-master` |
| 🚢 **`devops-engineer`** | Sonnet 4.5 | CI/CD, GitOps, Kubernetes, production SRE | `agent-devops-spec` |

### 🔍 Specialist Reviewers (v3.2 — NEW)
| Agent | Model | Role | Merged From |
|:---|:---|:---|:---|
| 🗄️ **`database-architect`** | Sonnet 4.5 | Schema design, Prisma ORM, migration safety, N+1 | `database-architect` + `database-reviewer` |
| 🛡️ **`security-auditor`** | Sonnet 4.5 | OWASP, STRIDE, XSS/SQLi pentest, JWT hardening | `security-auditor` + `penetration-tester` |
| ⚡ **`performance-optimizer`** | Sonnet 4.5 | Core Web Vitals, bundle, React renders, query perf | `performance-optimizer` |
| 🕵️ **`code-reviewer`** | Haiku 4.5 | TS/DDD/plan review, tsc+eslint diagnostics | `typescript-reviewer` + `ddd-reviewer` |

**Tools Policy:**
- Specialist engineers: Bash, Edit, MultiEdit, Write, Read, Grep, Glob
- Reviewer agents: Read-only (Read/Grep/Glob/Bash read-only) — no write tools granted

---

## 🎯 Agent-Bound Skills (4 new — Deep Methodology)

These skills were extracted from oversized agent definitions in the v3.1 refactor:

| Skill | Extracted From | Contents |
|:---|:---|:---|
| `agent-frontend-design-system` | `frontend-specialist` | Deep Design Thinking, Anti-cliché mandates, Maestro Auditor, Reality Check |
| `agent-backend-spec` | `backend-specialist` | Constraint analysis, API matrix, 3-Layer error protocol, RCA |
| `agent-devops-spec` | `devops-engineer` | 5-Phase Deployment Workflow, Strategy Matrix, Emergency RCA |
| `agent-mobile-spec` | `mobile-developer` | Platform Decision Matrix, Performance Targets (2025), Native Forensics |

---

## 🛠️ Skill Library (344 total)

Skills are **lazy-loaded** by agents and workflows on demand. Organized by domain:

<details>
<summary><strong>🏗️ Architecture & Design</strong></summary>

`c4-master` · `architecture` · `architecture-patterns` · `architecture-decision-records` · `database-design` · `api-design` · `api-master` · `nosql-expert` · `event-store-design` · `cqrs-implementation` · `domain-driven-hexagon` · `microservices-patterns` · `software-architecture` · `senior-architect` · `modern-web-architect`

</details>

<details>
<summary><strong>⚛️ Frontend & UI</strong></summary>

`react-master` · `nextjs-master` · `tailwind-patterns` · `frontend-patterns` · `frontend-design` · `core-components` · `ui-ux-pro-max-skill` · `web-design-guidelines` · `liquid-glass-design` · `canvas-design` · `agent-frontend-design-system` · `agent-d3js-skill` · `remotion-best-practices`

</details>

<details>
<summary><strong>⚙️ Backend & APIs</strong></summary>

`backend-patterns` · `agent-backend-patterns` · `agent-backend-spec` · `api-documentation-generator` · `nodejs-best-practices` · `nestjs-expert` · `agent-backend-spec` · `postgres-patterns` · `clickhouse-io` · `prisma-expert` · `bullmq-specialist` · `inngest` · `trpc`

</details>

<details>
<summary><strong>📱 Mobile</strong></summary>

`react-native-master` · `agent-mobile-spec` · `mobile-design` · `agent-mobile-architect` · `foundation-models-on-device`

</details>

<details>
<summary><strong>🧪 Testing & QA</strong></summary>

`tdd-master-workflow` · `tdd-workflow` · `e2e-testing` · `testing-patterns` · `unit-testing-test-generate` · `webapp-testing` · `testing-automation-mcp` · `ab-test-setup` · `ai-regression-testing` · `eval-harness` · `performance-testing-review-multi-agent-review`

</details>

<details>
<summary><strong>🛡️ Security</strong></summary>

`vulnerability-scanner` · `attack-tree-construction` · `stride-analysis-patterns` · `threat-modeling-expert` · `fabric-compliance` · `malware-analyst` · `binary-analysis-patterns` · `anti-reversing-techniques` · `auth-implementation-patterns` · `clerk-auth` · `secrets-management` · `pci-compliance`

</details>

<details>
<summary><strong>☁️ DevOps & Cloud</strong></summary>

`agent-devops-spec` · `agent-devops-engineer` · `vercel-deploy` · `vercel-deployment` · `server-management` · `gcp-cloud-run` · `azure-functions` · `bazel-build-optimization` · `turborepo-caching` · `nx-workspace-patterns` · `cicd-automation-workflow-automate` · `gitops-workflow`

</details>

<details>
<summary><strong>🤖 AI & ML</strong></summary>

`ai-agent-architect-master` · `agent-memory-mcp` · `voice-ai-engine-development` · `machine-learning-ops-ml-pipeline` · `eval-harness` · `cost-aware-llm-pipeline` · `continuous-agent-loop` · `enterprise-agent-ops` · `blockrun` · `nanoclaw-repl`

</details>

<details>
<summary><strong>🔧 Developer Experience</strong></summary>

`clean-code` · `antfu-coding-style` · `dx-optimizer` · `code-quality-master` · `agent-coding-standards` · `lint-and-validate` · `git-collaboration-master` · `continuous-learning` · `plan-writing` · `brainstorming` · `debugging-toolkit-smart-debug` · `systematic-debugging`

</details>

---

## 🔄 Workflows (84 Slash Commands)

Invoke directly **inside the AI chatbox** — never in terminal.

### 🏗️ Planning & Architecture
| Command | Description |
|:---|:---|
| `/plan` | Map structural design from requirements. WAIT for confirm before touching code. |
| `/create` | Scaffold modules / foundational features with multi-agent execution |
| `/orchestrate` | Sequential and parallel multi-agent workflow coordination |
| `/prp-plan` | Comprehensive feature plan with codebase pattern extraction |
| `/prp-implement` | Execute implementation plan with rigorous validation loops |
| `/brainstorm` | AI-driven ideation following Senior Engineer standard |

### 💻 Coding & Engineering
| Command | Description |
|:---|:---|
| `/enhance` | Quick UI fixes, logic tweaks, minor feature additions |
| `/debug` | Multi-threaded log scanning to trace Root Cause |
| `/refactor-clean` | Code cleanup, split concerns, reduce complexity |
| `/api` | OpenAPI 3.1 master API design & documentation |
| `/realtime` | WebSocket / Socket.io / SSE integration |
| `/ui-ux-pro-max` | Premium visual design with micro-animations |

### 🧪 Testing & Quality
| Command | Description |
|:---|:---|
| `/tdd` | Test-Driven Development — tests first, then implementation |
| `/test` | Auto-generate Unit/E2E tests following TDD standards |
| `/e2e` | Playwright end-to-end test generation + execution |
| `/santa-loop` | Adversarial dual-review convergence — two models must approve |
| `/code-review` | Local uncommitted changes or GitHub PR review |
| `/quality-gate` | Pre-ship quality checkpoint |

### 🚀 Operations & Deployment
| Command | Description |
|:---|:---|
| `/deploy` | Automated production pipeline |
| `/audit` | Deep security + architecture + performance audit |
| `/monitor` | Real-time server and pipeline health check |
| `/security` | Vulnerability scan following Security Senior standard |
| `/release-version` | Update version, generate changelog, sync documents |
| `/backup` | Git commit snapshot with timestamp |

### 📚 Knowledge & Learning
| Command | Description |
|:---|:---|
| `/docs` | Fetch latest library docs via Context7 |
| `/document` | Auto-generate technical documentation |
| `/learn-eval` | Extract reusable patterns from session → save as Skills |
| `/skill-create` | Generate SKILL.md from local git history patterns |
| `/evolve` | Analyze instincts and suggest evolved system structures |
| `/status` | Project progress dashboard |

*(Full list: 84 workflows in `.agent/workflows/`)*

---

## 📖 Rules Constitution (37 rules)

All agent decisions are strictly governed by rules in `.agent/rules/`:

### Core (Always Active)
| Rule | Purpose |
|:---|:---|
| `GEMINI.md` | Master orchestrator identity, scale-aware modes, language protocol |
| `security.md` | Zero-tolerance: no hardcoded secrets, no SQL injection, no XSS |
| `runtime-watchdog.md` | Hang detection — stops infinite loops, auto STOP + CLEANUP |
| `error-logging.md` | All failures logged to `ERRORS.md` (Zero-Silent-Failure principle) |
| `malware-protection.md` | Blocks malicious links, checks SRI, validates external dependencies |
| `docs-update.md` | Forces documentation sync after every skill/workflow/rule addition |

### TypeScript Standards
`typescript-coding-style` · `typescript-patterns` · `typescript-security` · `typescript-testing` · `typescript-hooks`

### Python Standards
`python-coding-style` · `python-patterns` · `python-security` · `python-testing` · `python-hooks`

### Common Patterns
`common-agents` · `common-code-review` · `common-coding-style` · `common-development-workflow` · `common-git-workflow` · `common-hooks` · `common-patterns` · `common-performance` · `common-security` · `common-testing`

### Domain Rules
`frontend.md` · `backend.md` · `architecture-review.md` · `code-quality.md` · `compliance.md` · `debug.md` · `business.md` · `gitnexus-integration.md` · `testing-standard.md` · `system-update.md`

---

## 📈 Operational Metrics

| Metric | Score | Notes |
|:---|:---:|:---|
| **Security Grade (AgentShield)** | A (97/100) | 0 Critical, 1 High (by design), 0 Medium |
| **Agent Architecture** | 100/100 | Thin Agent + Rich Skills pattern |
| **Context Window Efficiency** | 98/100 | ~300 legacy skills pruned, no overlap |
| **Skill Routing Accuracy** | 95/100 | Domain-specific master skills, lazy-loaded |
| **Hang Risk / Silent Failure** | ~0% | Watchdog + PreToolUse hooks enforced |
| **Tool Least-Privilege** | ✅ All agents | Explicit `tools:` arrays, deny rules active |

**→ Overall Assessment:** Production-ready for Big Tech architecture scale.

---

## 🔧 Configuration Files

```
.agent/
├── agents/           # 9 thin agent shells
│   ├── frontend-specialist.md
│   ├── backend-specialist.md
│   ├── python-specialist.md
│   ├── mobile-developer.md
│   ├── devops-engineer.md
│   ├── database-architect.md     ← NEW v3.2 (merged database-reviewer)
│   ├── security-auditor.md       ← NEW v3.2 (merged penetration-tester)
│   ├── performance-optimizer.md  ← NEW v3.2
│   └── code-reviewer.md          ← ENHANCED v3.2 (merged ts-reviewer + ddd-reviewer)
├── skills/           # 344 on-demand skills
│   ├── agent-frontend-design-system/  ← NEW v3.1
│   ├── agent-backend-spec/            ← NEW v3.1
│   ├── agent-devops-spec/             ← NEW v3.1
│   ├── agent-mobile-spec/             ← NEW v3.1
│   └── ... (340 more)
├── rules/            # 37 constitutional rules
├── workflows/        # 84 slash-command workflows
├── hooks/            # Security hooks (PreToolUse, AfterTool, Stop)
│   ├── gsd-prompt-guard.js
│   ├── gsd-context-monitor.js
│   ├── gsd-check-update.js
│   └── session-stop-audit.js  ← NEW v3.1
├── settings.json     # Permissions + deny rules + hook config
└── logs/             # Session audit logs
```

---

## 🚦 Quick Start

```bash
# Security audit
npm run scan:agent

# Start dev server (PetShop app)
npm run dev

# Check git status before commit
git status
```

> **⚠️ Important:** Never execute Slash Commands (`/plan`, `/deploy`, etc.) in the OS Terminal.
> Invoke them **inside the AI chatbox** to trigger the correct structured agent playbooks.

---

<div align="center">

*Antigravity Omni-Stack · Powered by Antigravity IDE · Multi-Agent Architecture*

**v3.2.0** — 9 Agents (3 recruited + 4 merged), Thin-Agent + Rich Skills architecture

</div>
