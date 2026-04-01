const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[GitNexus Sync] Running npx gitnexus analyze --embeddings...');
try {
  execSync('npx gitnexus analyze --embeddings', { stdio: 'inherit' });
} catch (error) {
  console.error('[GitNexus Sync] Failed to run analyze.', error.message);
}

// 1. Copy & Move skills
const sourceSkills = path.join(process.cwd(), '.claude', 'skills', 'gitnexus');
const destSkills = path.join(process.cwd(), '.agent', 'skills', 'gitnexus');

if (fs.existsSync(sourceSkills)) {
  console.log('[GitNexus Sync] Integrating skills to .agent/skills/gitnexus...');
  if (fs.existsSync(destSkills)) {
    fs.rmSync(destSkills, { recursive: true, force: true });
  }
  fs.cpSync(sourceSkills, destSkills, { recursive: true });
  fs.rmSync(sourceSkills, { recursive: true, force: true });
}

// 2. Cleanup leftovers
const claudeDir = path.join(process.cwd(), '.claude');
const claudeMd = path.join(process.cwd(), 'CLAUDE.md');

if (fs.existsSync(claudeDir)) {
  console.log('[GitNexus Sync] Pruning dummy .claude directory...');
  fs.rmSync(claudeDir, { recursive: true, force: true });
}
if (fs.existsSync(claudeMd)) {
  console.log('[GitNexus Sync] Removing redundant CLAUDE.md...');
  fs.rmSync(claudeMd, { force: true });
}

// 3. Patch AGENTS.md
const agentsMd = path.join(process.cwd(), 'AGENTS.md');
if (fs.existsSync(agentsMd)) {
  console.log('[GitNexus Sync] Patching AGENTS.md paths to map with .agent architecture...');
  let content = fs.readFileSync(agentsMd, 'utf8');
  // GitNexus forces .claude paths, we replace them back to .agent
  content = content.replace(/\.claude\/skills\/gitnexus/g, '.agent/skills/gitnexus');
  fs.writeFileSync(agentsMd, content);
}

console.log('[GitNexus Sync] Successfully tamed GitNexus! System is clean.');
