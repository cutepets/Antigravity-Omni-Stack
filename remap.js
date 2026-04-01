const fs = require('fs');
const path = require('path');

const agentsDir = '.agent/agents';
const skillsDir = '.agent/skills';

// 1. Get all 344 skills
const allSkills = fs.readdirSync(skillsDir)
  .filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());

// 2. Define exactly 15 Agents
const definitions = [
  {
    id: 'frontend-specialist',
    desc: 'Front-End UI/UX Designer & Accessibility Expert. You implement React/Next.js UI, canvas, CSS themes, and handle WCAG compliance, scroll effects, interactivity.',
    triggers: 'ui, ux, theme, react, nextjs, frontend, css, a11y, accessibility, figma, design, browser, canvas',
    tools: ['Read', 'Edit', 'Write', 'MultiEdit', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'backend-specialist',
    desc: 'Backend Logic & Architecture Specialist. You write Node.js, GraphQl API, Nest.js, handle legacy migrations, backtesting, state management and general application features.',
    triggers: 'backend, node, nest, api, endpoints, graphql, business logic, feature, typescript',
    tools: ['Read', 'Edit', 'Write', 'MultiEdit', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'database-architect',
    desc: 'Database Architect. You design Schemas, handle Postgres, Clickhouse, NoSQL, ORM, and SQL optimization.',
    triggers: 'sql, database, postgres, clickhouse, orm, prisma, schema, nosql, query',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'devops-engineer',
    desc: 'DevOps, Network & OS Automator. You write Bash scripts, configure mTLS/mesh networks, CI/CD, docker, CLI tools, and Linux/Busybox utilities.',
    triggers: 'devops, ci/cd, docker, kubernetes, mtls, bash, network, cli tool, automation, powershell',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'security-auditor',
    desc: 'Security Auditor & Cryptographer. You perform OWASP scanning, WCAG security audits, threat modeling, JWT/Auth validation, and Web3 Smart Contracts testing.',
    triggers: 'security, audit, pentest, threat, crypto, blockchain, web3, jwt, gdpr, compliance',
    tools: ['Read', 'Grep', 'Glob', 'Bash']
  },
  {
    id: 'mobile-developer',
    desc: 'Mobile App Developer. You bootstrap React Native, Flutter, offline-first iOS/Android architectures.',
    triggers: 'flutter, react native, ios, android, mobile',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'performance-optimizer',
    desc: 'Performance Optimization Hacker. You optimize bundles, setup caching (Turborepo), improve Web Vitals and general system DX speed.',
    triggers: 'performance, optimize, cache, fast, vitals, turbo, dx, productivity',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'code-reviewer',
    desc: 'Code Quality Inspector. You enforce Antfu style, clean code, code review checklists and language mastery (TS, Python semantics).',
    triggers: 'review, clean code, lint, refactor, style, plankton, antfu',
    tools: ['Read', 'Grep', 'Glob', 'Bash']
  },
  {
    id: 'qa-engineer',
    desc: 'QA, Automation & TDD Specialist. You oversee Playwright, E2E tests, unit tests, evaluate harness and QA regression.',
    triggers: 'test, tdd, playwright, e2e, unit testing, qa, regression, coverage',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'system-architect',
    desc: 'System Integrator & Software Architect. You draw C4 diagrams, define Monorepo structures, Event Sourcing, Microservices, and overall application bootstrap.',
    triggers: 'architecture, c4, diagram, monorepo, microservices, bootstrap, event-sourcing',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'python-specialist',
    desc: 'Python & Data Scientist. You build AI/ML pipelines, handle data-engineering (Spark, Airflow), Data Quality, and vector index tuning.',
    triggers: 'python, data, ml, spark, airflow, vector, index, pipeline',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'product-manager',
    desc: 'Product Manager & Documentation Specialist. You write concise plans, track KPIs, perform A/B tests, maintain changelogs, API specs, and write documentation.',
    triggers: 'product, pm, plan, track, kpi, story, doc, changelog, communication, write, ab-test',
    tools: ['Read', 'Edit', 'Write']
  },
  {
    id: 'research-specialist',
    desc: 'Trawler & Fact Finder. You use Exa, Tavily, Firecrawl to deep research the web, scrape content, and acquire 30day recent context.',
    triggers: 'search, scrape, research, crawler, exa, tavily, browser',
    tools: ['Read', 'Write']
  },
  {
    id: 'integration-engineer',
    desc: 'Third-Party Integration Engineer. You connect Webhooks, Stripe, Twilio, Salesforce, Payment gateways, and other external APIs.',
    triggers: 'integration, stripe, payment, twilio, salesforce, webhook, external api, zapier',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  },
  {
    id: 'ai-orchestrator',
    desc: 'AI Swarm Orchestrator & MCP Developer. You manage Agent boundaries, Memory, Context Budgets, parallel swarms, and develop Model Context Protocol solutions.',
    triggers: 'orchestrate, swarm, multi-agent, memory, context, token budget, evaluate, eval, protocol, mcp',
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']
  }
];

const mapped = {};
definitions.forEach(d => mapped[d.id] = []);

// Regex mappings - first match wins
const mappingRules = [
  { match: /frontend|ui-|ux-|css|tailwind|theme|canvas|design|web-design|react|nextjs|interactive|scroll|accessib|wcag|web-artifact/i, id: 'frontend-specialist' },
  { match: /backend|node|api-|graphql|nest|state-management|anti-reversing|backtest/i, id: 'backend-specialist' },
  { match: /database|sql|postgres|clickhouse|nosql|prisma|projection/i, id: 'database-architect' },
  { match: /devops|ci-cd|bash|cli-|network|mtls|service-mesh|istio|linkerd|powershell|busybox|shell|cicd|server-management|hybrid-cloud|monitoring/i, id: 'devops-engineer' },
  { match: /security|auth|jwt|gdpr|pci-|threat|vulnerab|crypto|web3|blockchain|visa-doc/i, id: 'security-auditor' },
  { match: /mobile|ios|android|react-native|flutter|multi-platform/i, id: 'mobile-developer' },
  { match: /performance|turbo|cache|dx-|productivity|optimize/i, id: 'performance-optimizer' },
  { match: /review|clean-code|lint|style|antfu|plankton|quality-nonconformance|coding-standards/i, id: 'code-reviewer' },
  { match: /test|tdd|playwright|e2e|qa-|mock|harness|browser-qa/i, id: 'qa-engineer' },
  { match: /architect|c4-|monorepo|nx-|event-store|saga|app-builder|bootstrap|scaffold|game-dev|framework-migration/i, id: 'system-architect' },
  { match: /python|data-|ml-|machine-learning|spark|airflow|vector|similarity/i, id: 'python-specialist' },
  { match: /plan|product|kpi-|story|doc|changelog|writing|schema-markup|ab-test|kaizen|team-comp|sales-automator|project-guide/i, id: 'product-manager' },
  { match: /research|scrape|tavily|exa-|firecrawl|last30day/i, id: 'research-specialist' },
  { match: /integrat|stripe|payment|twilio|salesforce|webhook|moodle|x-api|zapier|trigger|nutrient/i, id: 'integration-engineer' },
  { match: /orchestrat|agent|memory|context|token|eval|mcp|parallel|blockrun|skill-|infinite-gratitude|loki-|ralphinho|continuous-learn/i, id: 'ai-orchestrator' }
];

let fallbackCount = 0;
allSkills.forEach(skill => {
  let matched = false;
  for (const rule of mappingRules) {
    if (rule.match.test(skill)) {
      mapped[rule.id].push(skill);
      matched = true;
      break;
    }
  }
  if (!matched) {
    // Fallback logic manually
    if (skill.includes('error') || skill.includes('debug') || skill.includes('bug') || skill.includes('incident')) {
      mapped['devops-engineer'].push(skill);
    } else if (skill.includes('repo') || skill.includes('git')) {
      mapped['devops-engineer'].push(skill);
    } else {
      mapped['ai-orchestrator'].push(skill);
      fallbackCount++;
    }
  }
});

console.log('Orphan / fallback count:', fallbackCount);

// 3. Delete all agents in agentsDir
fs.readdirSync(agentsDir).forEach(file => {
  if (file.endsWith('.md')) {
    fs.unlinkSync(path.join(agentsDir, file));
  }
});

// 4. Create the 15 exact files
definitions.forEach(agent => {
  const content = `---
name: ${agent.id}
description: >
  ${agent.desc}
  Triggers on ${agent.triggers}.
model: claude-sonnet-4-5
tools:
${agent.tools.map(t => '  - ' + t).join('\n')}
skills:
${mapped[agent.id].map(s => '  - ' + s).join('\n')}
---

# ${agent.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}

${agent.desc}

## 🛠️ Specialized Skills Context
You are granted access to ${mapped[agent.id].length} deep methodologies inside your \`.agent/skills\` context.
When encountering logic gaps, you must refer to these libraries mentally (via Search/Read) to ensure no hallucinations occur in implementation.
`;
  fs.writeFileSync(path.join(agentsDir, agent.id + '.md'), content, 'utf8');
});

console.log('Successfully mapped ' + allSkills.length + ' skills into 15 agents.');
