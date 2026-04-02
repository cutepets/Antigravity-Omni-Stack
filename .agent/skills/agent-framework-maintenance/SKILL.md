---
name: agent-framework-maintenance
description: Systematic protocol for auditing, maintaining, and evolving the Antigravity 17-agent framework. Covers orphan skill detection, agent creation, skill archival, and coverage verification.
evolved_from:
  - P003-orphan-detection-script
  - P006-skill-domain-rules
  - I01-archive-not-delete
  - I04-8-orphan-threshold
  - I05-verify-after-batch
version: 1.0.0
---

# Agent Framework Maintenance Skill

Systematic maintenance protocol for the Antigravity 17-agent framework.
Auto-triggers when: auditing agents, resolving orphan skills, creating new agents.

## 🔍 Step 1: Orphan Detection

Run this script to find all unassigned skills:

```javascript
// node -e "<script>" from repo root
const fs = require('fs'), path = require('path');
const agentsDir = '.agent/agents';
const coveredSkills = new Set();

fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).forEach(af => {
  const c = fs.readFileSync(path.join(agentsDir, af), 'utf8');
  [...c.matchAll(/^  - (.+)$/gm)].forEach(m => coveredSkills.add(m[1].trim()));
});

const skillFolders = fs.readdirSync('.agent/skills', { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_'))
  .map(d => d.name);

const orphans = skillFolders.filter(s => !coveredSkills.has(s));
console.log(`Total agents: ${fs.readdirSync(agentsDir).length}`);
console.log(`Skill folders: ${skillFolders.length}`);
console.log(`Covered: ${coveredSkills.size}`);
console.log(`Orphans (${orphans.length}):`, orphans.sort());
```

## 📐 Step 2: Skill Domain Assignment Rules

1. **Domain Match** → assign to closest expert agent
2. **Conflict** (fits 2 agents) → assign to the one that uses it most
3. **Archive** if skill is: niche-external, deprecated, never referenced in any workflow
4. **Create New Agent** if 8+ orphans share a domain with no existing home
5. **Verify** by re-running detection script after each batch assignment
6. **Comments** in YAML skills list — group with `# Category Name`

## 🗂️ Step 3: Archive Protocol

```bash
# Never delete — always archive
mkdir -p .agent/skills/_archive/{skill-name}
cp .agent/skills/{skill-name}/SKILL.md .agent/skills/_archive/{skill-name}/SKILL.md
# Original folder stays for rollback
```

Archive conditions:
- Skill hasn't been referenced in any workflow for 90+ days
- Skill is niche-external (e.g., `moodle-external-api-development`)
- Monolith skills replaced by granular alternatives (e.g., `python-master`)

## 🆕 Step 4: New Agent Creation Threshold

**Create a new specialist agent when:**
- 8+ orphan skills share a clear domain
- No existing agent covers that domain well
- The domain requires different reasoning depth than current agents

**Agent template:** See `agent-continuous-learning` P005 pattern.

**Model selection:**
- `claude-haiku-3-5` → Fast lookup, docs, simple transforms
- `claude-sonnet-4-5` → Reasoning, debugging, multi-step logic
- `claude-opus-4-5` → Orchestration, complex architecture decisions

## ✅ Step 5: Verification

After any agent modification:

```javascript
// Quick coverage check
const after = orphans.length;
console.log(`Orphans reduced: before → after`);
// Target: 0 true orphans (archived excluded)
```

Also update skill counts in agent body text:
```
You are granted access to N deep methodologies...
```

## 📋 Agent Roster (v5.0 — April 2026)

| Agent | Model | Skills | Domain |
|-------|-------|--------|--------|
| system-architect | sonnet | 49 | Architecture, patterns, migration |
| devops-engineer | sonnet | 46 | CI/CD, cloud, observability, infra |
| frontend-specialist | sonnet | 41 | React, UI/UX, a11y, D3 |
| ai-orchestrator | opus | 36 | Swarms, memory, routing |
| product-manager | haiku | 31 | Docs, planning, business |
| python-specialist | sonnet | 31 | Python, ML, data |
| backend-specialist | sonnet | 31 | Node, NestJS, APIs |
| qa-engineer | sonnet | 28 | E2E, TDD, accessibility |
| code-reviewer | haiku | 24 | Review, lint, bug detection |
| security-auditor | sonnet | 23 | OWASP, STRIDE, compliance |
| database-architect | sonnet | 20 | SQL, NoSQL, schema |
| integration-engineer | sonnet | 20 | Realtime, webhooks, payment |
| performance-optimizer | sonnet | 19 | Perf, profiling, bundles |
| research-specialist | haiku | 19 | Search, scrape, synthesis |
| **debug-specialist** | sonnet | 18 | **Runtime debug, RCA, incident** |
| mcp-developer | sonnet | 18 | MCP servers, tool building |
| mobile-developer | sonnet | 16 | React Native, iOS, Android |
