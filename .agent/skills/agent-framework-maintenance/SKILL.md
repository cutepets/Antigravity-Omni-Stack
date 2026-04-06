---
name: agent-framework-maintenance
description: Systematic protocol for auditing, maintaining, and evolving the Antigravity specialist-agent framework. Covers orphan skill detection, assignment hygiene, archival, and coverage verification.
evolved_from:
  - P003-orphan-detection-script
  - P006-skill-domain-rules
  - I01-archive-not-delete
  - I04-8-orphan-threshold
  - I05-verify-after-batch
version: 1.0.0
---

# Agent Framework Maintenance Skill

Systematic maintenance protocol for the Antigravity specialist-agent framework.
Auto-triggers when: auditing agents, resolving orphan skills, creating new agents.

## 🔍 Step 1: Orphan Detection

Run the canonical audit scripts from repo root:

```javascript
node .agent/scripts/audit-skills.js
node .agent/scripts/check-orphans.js
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
# Never mass-delete. Archive or mark legacy deliberately.
mkdir -p .agent/skills/_archive/{skill-name}
cp .agent/skills/{skill-name}/SKILL.md .agent/skills/_archive/{skill-name}/SKILL.md
# Move supporting resources only if the skill is truly retired.
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

**Agent template:** See `.agent/docs/AGENT_STANDARD.md`.

**Model selection:**
- `claude-haiku-3-5` → Fast lookup, docs, simple transforms
- `claude-sonnet-4-5` → Reasoning, debugging, multi-step logic
- `claude-opus-4-5` → Orchestration, complex architecture decisions

## ✅ Step 5: Verification

After any agent modification:

```bash
node .agent/scripts/audit-skills.js
node .agent/scripts/check-orphans.js
```

Do not maintain static roster counts inside this skill. Use the audit scripts and current agent files as the source of truth.
