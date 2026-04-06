const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');
const outputPath = path.join(process.cwd(), 'docs', 'CODEMAPS', 'dependencies.md');
const generatedDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Saigon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

function countMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  return fs.readdirSync(dir).filter(file => file.endsWith('.md')).length;
}

function countDirectories(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .length;
}

const counts = {
  agents: countMarkdownFiles('.agent/agents'),
  skills: countDirectories('.agent/skills'),
  workflows: countMarkdownFiles('.agent/workflows'),
  gsdWorkflows: countMarkdownFiles('.agent/get-shit-done/workflows'),
  rules: countMarkdownFiles('.agent/rules'),
  scripts: fs.existsSync('.agent/scripts')
    ? fs.readdirSync('.agent/scripts').filter(file => file.endsWith('.js')).length
    : 0,
};

const content = `<!-- Generated: ${generatedDate} | Managed by .agent/scripts/update-docs.js -->

# Dependencies - External Integrations

## AI Models / Providers

| Provider | Notes |
|----------|-------|
| Anthropic Claude | Agent frontmatter still documents Claude-family model intent for Antigravity specialists. |
| Google Gemini | Available as an alternative IDE/runtime surface in the broader Antigravity setup. |
| Codex | Used as a direct execution surface in this workspace. |

## MCP Servers

| Server | Purpose |
|--------|---------|
| GitNexus | Code graph navigation, impact analysis, and execution-flow tracing. |

## Framework Tooling

\`\`\`
Node.js scripts live in .agent/scripts
Root package scripts expose the safe entrypoints used in this repo
\`\`\`

Supported maintenance scripts:

- audit-workflows.js
- audit-skills.js
- check-orphans.js
- remove-ghosts.js
- gitnexus-sync.js
- update-docs.js

Legacy scripts kept only as disabled compatibility wrappers:

- fix-rules.js
- patch-hooks.js
- gen-agents.js
- remap.js
- remap-smart.js

## Version Tracking

| Component | Count |
|-----------|-------|
| Agents | ${counts.agents} |
| Skills | ${counts.skills} |
| Workflows | ${counts.workflows} |
| GSD Workflows | ${counts.gsdWorkflows} |
| Rules | ${counts.rules} |
| Scripts | ${counts.scripts} |
`;

console.log('\n[update-docs]');
console.log(`- write mode: ${writeMode}`);
console.log(`- output: ${outputPath}`);
console.log(`- agents: ${counts.agents}`);
console.log(`- skills: ${counts.skills}`);
console.log(`- workflows: ${counts.workflows}`);
console.log(`- gsd workflows: ${counts.gsdWorkflows}`);
console.log(`- rules: ${counts.rules}`);
console.log(`- scripts: ${counts.scripts}`);

if (writeMode) {
  fs.writeFileSync(outputPath, content, 'utf8');
}
