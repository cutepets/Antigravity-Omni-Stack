#!/usr/bin/env node
/**
 * Session Stop Audit Hook
 * Runs at end of session to log completion and do a lightweight scan for
 * obvious secrets or dangerous permission flags in changed files.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logDir = path.join(process.cwd(), '.agent', 'logs');
const logFile = path.join(logDir, 'session-audit.log');
const MAX_SCAN_BYTES = 512 * 1024;
const TEXT_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.mdx', '.yml',
  '.yaml', '.env', '.txt', '.sh', '.ps1', '.toml', '.ini', '.cfg', '.conf',
]);
const SECRET_PATTERNS = [
  { label: 'api-key', regex: /\b(?:api[_-]?key|secret[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9_/+=-]{12,}/i },
  { label: 'bearer-token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]+/i },
  { label: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'aws-key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
];
const DANGEROUS_FLAG_PATTERNS = [
  { label: 'dangerously-skip-permissions', regex: /--dangerously-skip-permissions\b/i },
  { label: 'dangerouslySkipPermissions', regex: /\bdangerouslySkipPermissions\b/i },
];
const DANGEROUS_FLAG_EXTENSIONS = new Set([
  '.json', '.md', '.mdx', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
  '.txt', '.sh', '.ps1'
]);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getChangedFiles() {
  try {
    const output = execSync('git status --porcelain', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.replace(/^[A-Z? ]+/, '').trim())
      .map(line => line.includes(' -> ') ? line.split(' -> ').pop().trim() : line)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isTextCandidate(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || path.basename(filePath).toLowerCase().startsWith('.env');
}

function scanFile(filePath) {
  const findings = [];
  if (!fs.existsSync(filePath) || !isTextCandidate(filePath)) {
    return findings;
  }

  const stat = fs.statSync(filePath);
  if (stat.size > MAX_SCAN_BYTES) {
    return findings;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(content)) {
      findings.push(pattern.label);
    }
  }
  if (DANGEROUS_FLAG_EXTENSIONS.has(ext) || path.basename(filePath).toLowerCase().startsWith('.env')) {
    for (const pattern of DANGEROUS_FLAG_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push(pattern.label);
      }
    }
  }
  return findings;
}

const timestamp = new Date().toISOString();
const findings = [];
for (const relativePath of getChangedFiles()) {
  const absolutePath = path.join(process.cwd(), relativePath);
  const fileFindings = scanFile(absolutePath);
  if (fileFindings.length > 0) {
    findings.push(`${relativePath}: ${fileFindings.join(', ')}`);
  }
}

const status = findings.length > 0 ? `WARN ${findings.length} file(s)` : 'OK';
const detail = findings.length > 0 ? ` Findings: ${findings.join(' | ')}` : '';
const entry = `[${timestamp}] Session ended. Stop audit status=${status}.${detail}\n`;

fs.appendFileSync(logFile, entry);
process.exit(0);
