const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const statusOnly = args.has('--status-only');
const forceEmbeddings = args.has('--embeddings');
const cwd = process.cwd();
const metaPath = path.join(cwd, '.gitnexus', 'meta.json');

function readEmbeddingCount() {
  if (!fs.existsSync(metaPath)) {
    return 0;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return Number(meta?.stats?.embeddings || 0);
  } catch {
    return 0;
  }
}

function scanLegacyGitnexusPaths() {
  const targets = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'docs/CODEMAPS/dependencies.md'];
  const hits = [];

  for (const relativePath of targets) {
    const filePath = path.join(cwd, relativePath);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('.claude/skills/gitnexus')) {
      hits.push(relativePath);
    }
  }

  return hits;
}

const embeddingCount = readEmbeddingCount();
const useEmbeddings = forceEmbeddings || embeddingCount > 0;
const command = useEmbeddings ? 'npx gitnexus analyze --embeddings' : 'npx gitnexus analyze';

console.log('\n[gitnexus-sync]');
console.log(`- embeddings detected: ${embeddingCount}`);
console.log(`- analyze command: ${command}`);

const legacyPathHits = scanLegacyGitnexusPaths();
console.log(`- legacy .claude GitNexus path refs: ${legacyPathHits.length}`);
for (const hit of legacyPathHits) {
  console.log(`  - ${hit}`);
}

if (statusOnly) {
  process.exit(0);
}

try {
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  console.error(`[gitnexus-sync] Analyze failed: ${error.message}`);
  process.exit(1);
}
