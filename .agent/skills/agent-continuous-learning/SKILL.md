---
name: agent-continuous-learning
description: Extract reusable patterns from sessions and save as learned skills. Run at session end to distill what was learned into permanent knowledge.
author: affaan-m (extended by Antigravity)
version: 4.2.0
---

# Agent Continuous Learning

Automatically evaluates sessions to extract reusable patterns — saved as project skills, rules, or .gitignore entries.

## When to Activate

- At the END of a productive coding/config session
- When user explicitly runs `/agent-continuous-learning`
- After fixing a recurring pattern, bug-type, or workflow pain-point
- After creating/modifying any agent, skill, or workflow

## Extraction Process

### Step 1: Scan Session for Patterns
Look for:

| Pattern Type | What to look for |
|---|---|
| `error_resolution` | Error → fix sequences |
| `user_corrections` | Times AI got it wrong, user corrected |
| `workarounds` | Non-obvious solutions to env/tooling quirks |
| `debugging_techniques` | Systematic approaches that worked |
| `project_specific` | Conventions, templates, naming rules |

### Step 2: Classify & Score
- **HIGH value** → Save as skill or rule
- **MEDIUM value** → Add to COMMANDS.md or agent doc
- **LOW value** → Skip (one-off, external API issue, typo)

### Step 3: Save to Appropriate Location

| Destination | When to use |
|---|---|
| `.agent/rules/` | Cross-cutting rules that ALL agents must follow |
| `.agent/skills/{name}/SKILL.md` | Reusable methodology for a specific domain |
| `.agent/agents/{name}.md` | Agent-specific context |
| `.agent/COMMANDS.md` | User-facing command reference |
| `.gitignore` | Recurring "should be ignored" discoveries |

---

## Learned Patterns (Antigravity Project)

### [P001] Windows PowerShell Cross-Platform Safety
**Type:** `workarounds` | **Value:** HIGH

```powershell
# ❌ Linux-style (breaks on PowerShell)
cmd | head -30
echo "line\n"

# ✅ Windows-safe equivalents
cmd | Select-Object -First 30
Add-Content file.txt -Value "`n..."   # backtick, not backslash
git log --oneline -5                  # safe cross-platform
```

### [P002] Targeted Git Add (Avoid Blocking on Large Repos)
**Type:** `workarounds` | **Value:** HIGH

```bash
# ❌ Blocks on large repos with background processes
git add .

# ✅ Target changed directories explicitly
git add .agent/ GEMINI.md README.md docs/ package.json .gitignore
git commit -m "Auto Backup: $(date)"
```

### [P003] Orphan Skill Detection Script
**Type:** `debugging_techniques` | **Value:** HIGH

```javascript
// Run from repo root: node -e "..."
const fs = require('fs'), path = require('path');
const agentsDir = '.agent/agents';
const coveredSkills = new Set();
fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).forEach(af => {
  const c = fs.readFileSync(path.join(agentsDir, af), 'utf8');
  [...c.matchAll(/^  - (.+)$/gm)].forEach(m => coveredSkills.add(m[1].trim()));
});
const orphans = fs.readdirSync('.agent/skills', { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_'))
  .map(d => d.name)
  .filter(s => !coveredSkills.has(s));
console.log('Orphans:', orphans.length, orphans);
```

### [P004] .gitignore Defaults for Antigravity Projects
**Type:** `project_specific` | **Value:** HIGH

Always include in `.gitignore`:
```
.gitnexus/          # local code graph DB (regenerated)
.reports/           # generated audit reports
check-gsd.js        # one-off debug scripts at root
gsd-boot.js
skill-audit.js
```

### [P005] New Agent Creation Template
**Type:** `project_specific` | **Value:** HIGH

```yaml
---
name: {agent-name}
description: >
  {Job title}. {Stack/tools}. {Key capabilities}.
  Triggers on {kw1}, {kw2}, {kw3}.
model: claude-haiku-3-5       # fast/cheap for simple tasks
# model: claude-sonnet-4-5   # use for reasoning/multi-step
tools: [Read, Edit, Write, Bash, Grep, Glob]
skills:
  # {Category}
  - {skill-a}
  - {skill-b}
---

# {Agent Title}

{2-line value description.}

## 🛠️ Specialized Skills Context
You are granted access to N deep methodologies inside your `.agent/skills` context.

## 📐 Domain Boundaries
- ✅ What this agent OWNS
- ❌ What delegates → `{other-agent}`
```

### [P006] Agent Skill Domain Assignment Rules
**Type:** `project_specific` | **Value:** HIGH

When assigning orphan skills to agents:
1. **Primary rule**: Domain match → assign to closest expert agent
2. **Conflict rule**: If skill fits 2 agents, assign to the one that uses it most
3. **Archive rule**: Archive if skill is: niche-external, deprecated, never referenced in workflows
4. **New agent rule**: If 8+ orphans share a domain with no home → create new specialist agent
5. **Verify**: Run orphan-detection script after each batch assignment

---

## Session History

| Date | Session | Patterns Extracted |
|------|---------|-------------------|
| 2026-04-02 | Agent Framework v5.0 Optimization | P001–P006 (6 patterns) |
