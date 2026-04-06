const fs = require('fs');
const path = require('path');

const targets = [
  '.agent/workflows',
  '.agent/get-shit-done/workflows',
];

const checks = [
  {
    key: 'missingFrontmatter',
    label: 'Missing frontmatter',
    test: ({ content, filePath }) =>
      filePath.startsWith(path.join('.agent', 'workflows')) &&
      path.basename(filePath).toLowerCase() !== 'readme.md' &&
      !content.startsWith('---'),
  },
  { key: 'eccRefs', label: 'Legacy ECC refs', test: ({ content }) => /everything-claude-code|\bECC\b/.test(content) },
  {
    key: 'legacyAgents',
    label: 'Legacy specialist refs',
    test: ({ content }) => /(project-planner|quality-inspector|security-reviewer|tdd-guide|explorer-agent)/.test(content),
  },
  {
    key: 'legacyPrpPaths',
    label: 'Legacy .claude PRP paths',
    test: ({ content }) => content.includes('.claude/PRPs'),
  },
  {
    key: 'staleRuntimeRefs',
    label: 'Stale runtime refs',
    test: ({ content }) => /(scripts\/claw\.js|scripts\/harness-audit\.js|skills-health\.js)/.test(content),
  },
];

const findings = Object.fromEntries(checks.map(check => [check.key, []]));

for (const dir of targets) {
  if (!fs.existsSync(dir)) {
    continue;
  }

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const check of checks) {
      if (check.test({ content, filePath })) {
        findings[check.key].push(filePath);
      }
    }
  }
}

console.log('\n[workflow-audit]');

for (const check of checks) {
  const matches = findings[check.key];
  console.log(`- ${check.label}: ${matches.length}`);
  if (matches.length > 0) {
    for (const match of matches) {
      console.log(`  - ${match}`);
    }
  }
}

const issueCount = checks.reduce((sum, check) => sum + findings[check.key].length, 0);
process.exitCode = issueCount > 0 ? 1 : 0;
