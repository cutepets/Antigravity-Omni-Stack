---
trigger: model_decision
description: "When coordinating multi-agent workflows or assigning responsibilities."
---

# Agent Orchestration

## Available Agents

Located in `.agent/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| product-manager | Scope and acceptance criteria | Product shaping, tradeoffs |
| erp-business-analyst | Business workflow rules | ERP logic, states, invariants |
| system-architect | System design | Architectural decisions |
| backend-specialist | Backend implementation | APIs, services, domain logic |
| frontend-specialist | Frontend implementation | UI, UX, accessibility |
| database-architect | Data integrity | Schema, constraints, migrations |
| code-reviewer | Code review | After writing code |
| qa-engineer | Testing and verification | Regression, acceptance, E2E |
| security-auditor | Security analysis | Before commits |
| debug-specialist | Root-cause diagnosis | Bugs, crashes, difficult failures |
| performance-optimizer | Performance analysis | Bottlenecks, latency, memory |
| devops-engineer | Runtime and deployment | CI/CD, infra, operations |

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use `product-manager`, `erp-business-analyst`, or `system-architect` as appropriate
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix - Use `debug-specialist`, then route to the owning implementation specialist
4. Architectural decision - Use **system-architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
