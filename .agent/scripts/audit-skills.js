const fs = require('fs');
const path = require('path');

const skillsDir = '.agent/skills';
const agentsDir = '.agent/agents';

function getFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

function extractAgentSkills(frontmatter) {
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

function readSkillDirectories() {
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

const allSkillDirs = readSkillDirectories();
const activeSkillDirs = allSkillDirs.filter(name => name !== '_archive');
const missingSkillMd = [];
const planningRefs = [];
const legacyAgentRefs = [];
const originEcc = [];
const richSkills = [];
const coveredSkills = new Set();

for (const agentFile of fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'))) {
  const content = fs.readFileSync(path.join(agentsDir, agentFile), 'utf8');
  for (const skill of extractAgentSkills(getFrontmatter(content))) {
    coveredSkills.add(skill);
  }
}

for (const skillDir of activeSkillDirs) {
  const skillRoot = path.join(skillsDir, skillDir);
  const skillPath = path.join(skillRoot, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    missingSkillMd.push(skillDir);
    continue;
  }

  const content = fs.readFileSync(skillPath, 'utf8');

  if (content.includes('.planning')) {
    planningRefs.push(skillDir);
  }

  if (/(project-planner|quality-inspector|security-reviewer|tdd-guide|explorer-agent|Dev3)/.test(content)) {
    legacyAgentRefs.push(skillDir);
  }

  if (/origin:\s*ECC/i.test(content)) {
    originEcc.push(skillDir);
  }

  const hasResources = ['references', 'resources', 'scripts', 'templates', 'sub-skills']
    .some(dirName => fs.existsSync(path.join(skillRoot, dirName)));

  if (hasResources) {
    richSkills.push(skillDir);
  }
}

const orphans = activeSkillDirs.filter(skill => !coveredSkills.has(skill));

console.log('\n[audit-skills]');
console.log(`- active skill dirs: ${activeSkillDirs.length}`);
console.log(`- archived skill dirs: ${allSkillDirs.includes('_archive') ? 1 : 0}`);
console.log(`- missing SKILL.md: ${missingSkillMd.length}`);
console.log(`- orphan skills: ${orphans.length}`);
console.log(`- active skills with .planning refs: ${planningRefs.length}`);
console.log(`- active skills with legacy agent refs: ${legacyAgentRefs.length}`);
console.log(`- active skills marked origin: ECC: ${originEcc.length}`);
console.log(`- active skills with extra resources/scripts/templates: ${richSkills.length}`);

function printList(label, items) {
  if (items.length === 0) {
    return;
  }

  console.log(`\n${label}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

printList('Missing SKILL.md', missingSkillMd);
printList('Orphan skills', orphans);
printList('Skills with .planning refs', planningRefs);
printList('Skills with legacy specialist refs', legacyAgentRefs);

const issueCount = missingSkillMd.length + orphans.length + planningRefs.length + legacyAgentRefs.length;
process.exitCode = issueCount > 0 ? 1 : 0;
