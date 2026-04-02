const fs = require('fs');
const path = require('path');
const dir = '.agent/workflows';

let missingFrontmatter = [];
let hasPlanning = [];
let hasGSD = [];
let hasECC = [];

fs.readdirSync(dir).forEach(f => {
  if(!f.endsWith('.md')) return;
  const c = fs.readFileSync(path.join(dir,f), 'utf8');
  if(!c.startsWith('---')) {
    missingFrontmatter.push(f);
  }
  if(c.includes('.planning')) {
    hasPlanning.push(f);
  }
  if(c.includes('/gsd') || c.includes('gsd-')) {
    hasGSD.push(f);
  }
  if(c.includes('ECC') || c.includes('everything-claude-code')) {
    hasECC.push(f);
  }
});

console.log('Missing/Bad Frontmatter Count:', missingFrontmatter.length);
console.log('Has .planning refs:', hasPlanning.length, hasPlanning.join(', '));
console.log('Has /gsd or gsd- refs:', hasGSD.length, hasGSD.join(', '));
console.log('Has ECC refs:', hasECC.length, hasECC.join(', '));
