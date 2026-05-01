#!/usr/bin/env node
import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { extname, join, relative, resolve } from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const EXCLUDE_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
])

const FORBIDDEN_PATTERNS = [
  {
    name: 'DISPLAY_VERSION constant',
    pattern: /\bconst\s+DISPLAY_VERSION\s*=\s*['"][^'"]+['"]/,
  },
  {
    name: 'hardcoded about version fallback',
    pattern: /aboutData\?\.version\s*\?\?\s*['"]\d+\.\d+\.\d+['"]/,
  },
]

function getTrackedFiles() {
  try {
    return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => resolve(ROOT, file))
  } catch {
    return walk(ROOT)
  }
}

function walk(dir) {
  const entries = readdirSync(dir)
  const files = []

  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      files.push(...walk(fullPath))
    } else {
      files.push(fullPath)
    }
  }

  return files
}

const violations = []

for (const file of getTrackedFiles()) {
  if (!existsSync(file) || !SCAN_EXTENSIONS.has(extname(file))) continue
  if (relative(ROOT, file).split(/[\\/]/).some((part) => EXCLUDE_DIRS.has(part))) {
    continue
  }

  const content = readFileSync(file, 'utf8')
  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(content)) {
      violations.push(`${relative(ROOT, file)}: ${rule.name}`)
    }
  }
}

if (violations.length > 0) {
  console.error('Hardcoded application version found:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  console.error('Use /settings/about metadata instead of UI version constants.')
  process.exit(1)
}

console.log('No hardcoded application version constants found.')
