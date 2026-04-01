const fs = require('fs');
const path = require('path');

const orphansFile = 'C:\\Dev2\\temp_orphans.txt';
if (!fs.existsSync(orphansFile)) {
    console.log("No orphans file.");
    process.exit(1);
}

const orphans = fs.readFileSync(orphansFile, 'utf8').trim().split(/\r?\n/).filter(Boolean);

const groups = {
  'product-manager': {
    desc: 'Product Manager. Defines requirements, tracks KPIs, writes plans.',
    triggers: 'product, manager, kpi, planning, sprint',
    keywords: ['plan', 'product', 'kpi', 'analytic', 'team', 'story', 'track', 'guideline', 'ab-test']
  },
  'technical-writer': {
    desc: 'Technical Writer. Creates clear documentation, changelogs, API specs.',
    triggers: 'documentation, docs, diagram, sequence, changelog, readme',
    keywords: ['doc', 'write', 'changelog', 'communication', 'schema']
  },
  'research-specialist': {
    desc: 'Research Specialist. Bypasses paywalls, scrapes data, browses the web.',
    triggers: 'research, search, web, scrape, exa, tavily, crawl',
    keywords: ['research', 'scrape', 'search', '30day', 'firecrawl', 'tavily', 'exa']
  },
  'integration-engineer': {
    desc: 'Integration Engineer. Connects Webhooks, Payments, CRM, external APIs.',
    triggers: 'stripe, payment, twilio, salesforce, webhook, zapier',
    keywords: ['integration', 'sales', 'payment', 'twilio', 'moodle', 'x-api', 'zapier', 'trigger', 'firebase', 'stripe']
  },
  'ai-orchestrator': {
    desc: 'AI Orchestrator. Manages multi-agent swarms, token budgets, context.',
    triggers: 'orchestrate, swarm, multi-agent, memory, context, token budget',
    keywords: ['agent', 'context', 'memory', 'token', 'orchestrat', 'eval', 'parallel', 'skill', 'blockrun']
  },
  'data-scientist': {
    desc: 'Data Scientist & AI. Builds ML pipelines, Airflow DAGs, data models.',
    triggers: 'data pipeline, spark, airflow, data quality, etl',
    keywords: ['data', 'spark', 'airflow', 'nosql', 'machine-learning', 'model']
  },
  'network-admin': {
    desc: 'Network & Security Admin. Configures mTLS, Istio, Linkerd, hybrid cloud.',
    triggers: 'service mesh, networking, istio, linkerd, mtls, vpn',
    keywords: ['network', 'mesh', 'mtls', 'linkerd', 'istio', 'cloud', 'server']
  },
  'automation-engineer': {
    desc: 'Automation Engineer. Creates CLI tools, workflows, bash configs.',
    triggers: 'bash, cli tool, automation, powershell, busybox',
    keywords: ['automation', 'tool', 'busybox', 'powershell', 'shell', 'setup', 'environment']
  },
  'debug-specialist': {
    desc: 'Tier-3 Support & Debugger. Dives into crash dumps, massive stack traces.',
    triggers: 'debug, bug, crash, stack trace, error, incident',
    keywords: ['debug', 'error', 'bug', 'crash', 'conformance', 'incident', 'fix']
  },
  'mcp-developer': {
    desc: 'MCP Developer. Writes Model Context Protocol servers.',
    triggers: 'mcp, model context protocol',
    keywords: ['mcp', 'protocol']
  },
  'legacy-modernizer': {
    desc: 'Migration Expert. Migrates legacy apps, upgrades dependencies.',
    triggers: 'migrate, upgrade, legacy, dependency update',
    keywords: ['migrat', 'upgra', 'legacy', 'refactor', 'dependenc', 'anti-reversing']
  },
  'ui-ux-designer': {
    desc: 'UI/UX Visual Designer. Refines aesthetics, accessibility, layouts.',
    triggers: 'wcag, a11y, accessibility, theme, ui, ux, visual',
    keywords: ['theme', 'ui-', 'visual', 'wcag', 'accessib', 'scroll', 'canvas', 'frontend', 'browser', 'web', 'interactive']
  },
  'blockchain-engineer': {
    desc: 'Web3 Engineer. Solves cryptographic challenges, writes smart contracts.',
    triggers: 'crypto, blockchain, web3, smart contract',
    keywords: ['web3', 'crypto', 'blockchain']
  },
  'fullstack-architect': {
    desc: 'Fullstack Systems Integrator. Bootstraps massive setups.',
    triggers: 'bootstrap, bazel, monorepo, nx, turbo',
    keywords: ['monorepo', 'nx', 'turbo', 'bazel', 'full-stack', 'app-builder', 'game-development', 'backend-', 'nodejs', 'typescript']
  },
  'productivity-hacker': {
    desc: 'Productivity Hacker. Speeds up workflows with DX tools, caching.',
    triggers: 'dx, developer experience, fast, productivity',
    keywords: ['dx', 'productivity', 'cache', 'fast', 'kaizen', 'smart-commit', 'blueprint']
  }
};

const assigned = Object.keys(groups).reduce((acc, k) => { acc[k] = []; return acc; }, {});
let remaining = [...orphans];

// Distribute by keywords
Object.keys(groups).forEach(agent => {
  if (groups[agent].keywords.length > 0) {
    for (let i = remaining.length - 1; i >= 0; i--) {
      const skill = remaining[i];
      if (groups[agent].keywords.some(kw => skill.includes(kw))) {
        assigned[agent].push(skill);
        remaining.splice(i, 1);
      }
    }
  }
});

// For remaining skills, distribute to the agent with the least skills to balance
let agentKeys = Object.keys(assigned);
for (const skill of remaining) {
  agentKeys.sort((a, b) => assigned[a].length - assigned[b].length);
  assigned[agentKeys[0]].push(skill);
}

let totalAgents = 0;
Object.keys(assigned).forEach(agent => {
  const skills = assigned[agent];
  if (skills.length === 0) return;
  totalAgents++;
  
  const content = `---
name: ${agent}
description: >
  ${groups[agent].desc} Triggers on ${groups[agent].triggers}.
model: claude-sonnet-4-5
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Grep
  - Glob
skills:
${skills.map(s => '  - ' + s).join('\n')}
---

# ${agent.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}

${groups[agent].desc}

You only use the specific skills attached to you to supply context on deep problems. Do not make assumptions when a skill provides precise methodologies.
`;

  fs.writeFileSync(path.join('.agent/agents', agent + '.md'), content, 'utf8');
  console.log('Created ' + agent + '.md with ' + skills.length + ' skills.');
});

console.log('Total new agents created: ' + totalAgents);
