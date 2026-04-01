const fs = require('fs');
const path = require('path');
const skillsDir = '.agent/skills';
const agentDir = '.agent/agents';

const skillSet = new Set(fs.readdirSync(skillsDir));
const agents = fs.readdirSync(agentDir).filter(f => f.endsWith('.md'));
let broken = [];

agents.forEach(a => {
  const content = fs.readFileSync(path.join(agentDir, a), 'utf8');
  const refs = [...content.matchAll(/^- ([a-z][a-z0-9-]{3,}): /gm)].map(m => m[1]);
  refs.forEach(r => {
    if (!skillSet.has(r)) broken.push({ agent: a, skill: r });
  });
});

console.log('total_skill_folders:', skillSet.size);
console.log('broken_agent_refs:', broken.length);
broken.forEach(b => console.log(' ', b.agent, '->', b.skill));
