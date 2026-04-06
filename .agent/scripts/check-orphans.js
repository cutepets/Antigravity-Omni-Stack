const fs = require('fs');
const path = require('path');

const agentsDir = '.agent/agents';
const skillsDir = '.agent/skills';

function getFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

function extractSkillsFromFrontmatter(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const skills = [];
  let inSkills = false;

  for (const line of lines) {
    if (/^skills:\s*$/.test(line)) {
      inSkills = true;
      continue;
    }

    if (inSkills) {
      if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
        break;
      }

      const match = line.match(/^\s*-\s+(.+?)\s*$/);
      if (match) {
        skills.push(match[1]);
      }
    }
  }

  return skills;
}

if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) {
  console.error('[check-orphans] Missing .agent/agents or .agent/skills');
  process.exit(1);
}

const coveredSkills = new Set();
const agentFiles = fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'));

for (const agentFile of agentFiles) {
  const content = fs.readFileSync(path.join(agentsDir, agentFile), 'utf8');
  const frontmatter = getFrontmatter(content);
  for (const skill of extractSkillsFromFrontmatter(frontmatter)) {
    coveredSkills.add(skill);
  }
}

const skillFolders = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
  .map(entry => entry.name)
  .sort();

const orphans = skillFolders.filter(skill => !coveredSkills.has(skill));

console.log('\n[check-orphans]');
console.log(`- agents: ${agentFiles.length}`);
console.log(`- skill folders: ${skillFolders.length}`);
console.log(`- covered skills: ${coveredSkills.size}`);
console.log(`- orphan skills: ${orphans.length}`);

if (orphans.length > 0) {
  console.log('\nOrphan skills:');
  for (const skill of orphans) {
    console.log(`- ${skill}`);
  }
}
