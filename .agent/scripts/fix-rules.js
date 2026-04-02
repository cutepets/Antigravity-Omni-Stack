const fs = require('fs');
const path = require('path');

const rulesDir = '.agent/rules';

const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md') && f !== 'README.md');

files.forEach(file => {
  let content = fs.readFileSync(path.join(rulesDir, file), 'utf8');
  let body = content;
  
  if (content.trim().startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      parts.shift(); 
      parts.shift(); 
      body = parts.join('---').trimStart();
    }
  }

  let newFrontmatter = '';

  if (file.startsWith('python-')) {
    newFrontmatter = `---
trigger: glob
glob: "**/*.py"
---

`;
  } else if (file.startsWith('typescript-')) {
    newFrontmatter = `---
trigger: glob
glob: "**/*.{ts,tsx}"
---

`;
  } else if (file === 'backend.md' || file === 'frontend.md' || file === 'architecture-review.md' || file === 'business.md' || file === 'compliance.md' || file === 'testing-standard.md') {
    let expectedGlob = '"**/*"';
    if (file === 'backend.md') expectedGlob = '"**/*.{py,js,ts,go,rs,sql,php,java,dockerfile,tf,yaml,yml}"';
    if (file === 'frontend.md') expectedGlob = '"**/*.{ts,tsx,js,jsx,css,scss,html,vue,svelte}"';
    if (file === 'architecture-review.md') expectedGlob = '"**/*.{md,txt,puml,mmd,json,yaml}"';
    if (file === 'business.md') expectedGlob = '"**/*.{md,txt,csv,json}"';
    if (file === 'compliance.md') expectedGlob = '"**/*.{md,txt}"';
    if (file === 'testing-standard.md') expectedGlob = '"**/*.{spec,test}.{js,ts,py,go}"';
    newFrontmatter = `---
trigger: glob
glob: ${expectedGlob}
---

`;
  } else if (file === 'GEMINI.md' || file === 'runtime-watchdog.md' || file === 'security.md') {
    newFrontmatter = `---
trigger: always_on
---

`;
  } else {
    let desc = "When the user asks about this topic.";
    if (file === 'code-quality.md') desc = "When writing production code, refactoring, or ensuring code quality.";
    if (file === 'common-agents.md') desc = "When coordinating multi-agent workflows or assigning responsibilities.";
    if (file === 'common-code-review.md') desc = "When performing code reviews or acting as a code-reviewer.";
    if (file === 'common-coding-style.md') desc = "When asked about coding standards, formatting, or naming conventions.";
    if (file === 'common-development-workflow.md') desc = "When iterating on a feature, checking out branches, or preparing for PR.";
    if (file === 'common-git-workflow.md') desc = "When using git commands, smart commits, or rebasing.";
    if (file === 'common-hooks.md') desc = "When setting up github actions, pre-commit hooks, or linting automation.";
    if (file === 'common-patterns.md') desc = "When asked about architectural patterns, clean architecture, or design patterns.";
    if (file === 'common-performance.md') desc = "When optimizing code performance, profiling, or reducing bundle size.";
    if (file === 'common-security.md') desc = "When performing general security audits or reviewing IAM.";
    if (file === 'common-testing.md') desc = "When writing unit tests, mocking, or implementing TDD.";
    if (file === 'gitnexus-integration.md') desc = "When using GitNexus MCP tools or exploring the codebase graph.";
    if (file === 'system-update.md') desc = "When updating project configurations, scripts, or systemic tooling.";
    
    if (file === 'docs-update.md') desc = "When generating, updating, or fixing documentation, READMEs, or specs.";
    if (file === 'error-logging.md') desc = "When encountering errors, reporting bugs, or analyzing test failures.";
    if (file === 'malware-protection.md') desc = "When installing new dependencies, dealing with untrusted links, or auditing supply chains.";
    
    if (file === 'debug.md') desc = "When the user asks to fix bugs, analyze errors, investigate issues, run tests, or troubleshoot code.";

    newFrontmatter = `---
trigger: model_decision
description: "${desc}"
---

`;
  }

  fs.writeFileSync(path.join(rulesDir, file), newFrontmatter + body, 'utf8');
});

console.log('Fixed rules and optimized their frontmatters!');
