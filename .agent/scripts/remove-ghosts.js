const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');
const agentsDir = '.agent/agents';
const skillsDir = '.agent/skills';

function getFrontmatterMatch(content) {
  return content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
}

function cleanAgentSkills(content, validSkills) {
  const match = getFrontmatterMatch(content);
  if (!match) {
    return { content, removed: [] };
  }

  const frontmatter = match[1];
  const lines = frontmatter.split(/\r?\n/);
  const rebuilt = [];
  const removed = [];
  let inSkills = false;

  for (const line of lines) {
    if (/^skills:\s*$/.test(line)) {
      inSkills = true;
      rebuilt.push(line);
      continue;
    }

    if (inSkills) {
      if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
        inSkills = false;
        rebuilt.push(line);
        continue;
      }

      const skillMatch = line.match(/^(\s*)-\s+(.+?)\s*$/);
      if (skillMatch) {
        const indent = skillMatch[1] || '  ';
        const skillName = skillMatch[2];
        if (validSkills.has(skillName)) {
          rebuilt.push(`${indent}- ${skillName}`);
        } else {
          removed.push(skillName);
        }
        continue;
      }
    }

    rebuilt.push(line);
  }

  if (removed.length === 0) {
    return { content, removed };
  }

  return {
    content: content.replace(match[1], rebuilt.join('\n')),
    removed,
  };
}

if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) {
  console.error('[remove-ghosts] Missing .agent/agents or .agent/skills');
  process.exit(1);
}

const validSkills = new Set(
  fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name),
);

let changedAgents = 0;
let removedSkills = 0;

console.log(`\n[remove-ghosts] mode=${writeMode ? 'write' : 'dry-run'}`);

for (const file of fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'))) {
  const filePath = path.join(agentsDir, file);
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const result = cleanAgentSkills(originalContent, validSkills);

  if (result.removed.length === 0) {
    continue;
  }

  changedAgents += 1;
  removedSkills += result.removed.length;
  console.log(`- ${file}`);
  for (const skill of result.removed) {
    console.log(`  - removed missing skill: ${skill}`);
  }

  if (writeMode) {
    fs.writeFileSync(filePath, result.content, 'utf8');
  }
}

console.log(`\nSummary: ${changedAgents} agent files, ${removedSkills} missing skills${writeMode ? ' removed' : ' found'}.`);
