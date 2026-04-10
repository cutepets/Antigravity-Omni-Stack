#!/usr/bin/env node
/**
 * @fileoverview UTF-8 Encoding Guard — Pre-commit hook & CI check
 * @encoding utf-8
 *
 * Scans all staged/tracked TypeScript, JavaScript, and config files for:
 *   1. Latin-1 mojibake sequences (sign that file was saved as cp1252)
 *   2. Unicode replacement characters U+FFFD (corrupted chars)
 *   3. Null bytes (binary corruption)
 *
 * Exit code 0 = clean, 1 = violations found (blocks commit).
 *
 * Usage:
 *   node scripts/check-utf8.mjs          # scan all source files
 *   node scripts/check-utf8.mjs --staged  # scan only git staged files
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname, basename } from 'path'
import { execSync } from 'child_process'

// ── Config ─────────────────────────────────────────────────────────────────
const ROOT = process.cwd()
const STAGED_ONLY = process.argv.includes('--staged')

const SCAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.prisma', '.sql', '.py', '.md', '.yml', '.yaml',
])

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.turbo', 'dist', 'build', '.next',
  'uploads', '__pycache__', '.cache', 'coverage', 'generated', '.prisma',
  'migrations', // prisma migrations are auto-generated
])

// Files that intentionally contain mojibake patterns (e.g., fix scripts, the checker itself)
const EXCLUDE_FILES = new Set([
  'check-utf8.mjs',        // this file contains patterns as string literals
  'fix_mojibake.py',       // fix script lists patterns
  'audit_encoding_v2.py',  // audit script lists patterns
  'fix_replacement_chars.py',
  'pre-commit-utf8.mjs',
])

// Patterns that indicate Latin-1 was used instead of UTF-8 (mojibake)
// These are stored as raw bytes that appear when cp1252 text is read as UTF-8.
// NOTE: These patterns are intentionally written as ESCAPED sequences to avoid
// triggering the scanner on itself. The scanner skips its own filename.
const MOJIBAKE_BYTE_PAIRS = [
  [0xC3, 0x83], // Ã
  [0xC3, 0x82], // Â
  [0xC3, 0xA0], // à (not Vietnamese, but common false trigger)
]

// We test string patterns at runtime by building them from char codes
const MOJIBAKE_REGEX = new RegExp(
  [
    // UTF-8 BOM mis-read as Latin-1 → produces EF BF BD or similar
    // Typical: "KhÃ´ng" = "Không" double-encoded
    String.fromCharCode(0xC3) + '[\\u0080-\\u00FF]', // Ã + non-ASCII
    String.fromCharCode(0xC2) + '[\\u0080-\\u00FF]', // Â + non-ASCII
    // Common Vietnamese mojibake fragments (built from char codes)
    String.fromCharCode(0xC3, 0xB4) + 'ng', // ông → Ã´ng
    String.fromCharCode(0xE1, 0xBA), // haỹ háº
    String.fromCharCode(0xC4, 0x83), // ă → Äƒ
    String.fromCharCode(0xC6, 0xB0), // ư → Æ°
    String.fromCharCode(0xC4, 0x91), // đ → Ä'
  ].join('|'),
)

// U+FFFD replacement character — original bytes were unrecoverable
const REPLACEMENT_CHAR = /\uFFFD/

// Null bytes — binary corruption
const NULL_BYTE = /\x00/

// ── File collection ────────────────────────────────────────────────────────
function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return out
      .split('\n')
      .filter(Boolean)
      .map((f) => join(ROOT, f))
      .filter((f) => SCAN_EXTENSIONS.has(extname(f)) && !EXCLUDE_FILES.has(basename(f)))
  } catch {
    return []
  }
}

function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walkDir(full, files)
    } else if (SCAN_EXTENSIONS.has(extname(full)) && !EXCLUDE_FILES.has(basename(full))) {
      files.push(full)
    }
  }
  return files
}

// ── Scanner ────────────────────────────────────────────────────────────────
function scanFile(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch (err) {
    return [{ type: 'READ_ERROR', line: 0, text: String(err) }]
  }

  const violations = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1

    // Check replacement chars
    if (REPLACEMENT_CHAR.test(line)) {
      violations.push({
        type: 'REPLACEMENT_CHAR',
        line: lineNo,
        text: line.trim().slice(0, 100),
      })
      continue // one violation per line
    }

    // Check null bytes
    if (NULL_BYTE.test(line)) {
      violations.push({
        type: 'NULL_BYTE',
        line: lineNo,
        text: '(binary data detected)',
      })
      continue
    }

    // Check mojibake
    if (MOJIBAKE_REGEX.test(line)) {
      violations.push({
        type: 'MOJIBAKE',
        line: lineNo,
        text: line.trim().slice(0, 100),
      })
    }
  }

  return violations
}

// ── Main ───────────────────────────────────────────────────────────────────
const files = STAGED_ONLY ? getStagedFiles() : walkDir(ROOT)
const results = []

for (const file of files) {
  const violations = scanFile(file)
  if (violations.length > 0) {
    results.push({ file: relative(ROOT, file), violations })
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║              UTF-8 Encoding Guard — Pre-commit               ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log(`  Mode    : ${STAGED_ONLY ? 'Staged files only' : 'Full project scan'}`)
console.log(`  Scanned : ${files.length} files`)
console.log('')

if (results.length === 0) {
  console.log('  ✅  All files are clean UTF-8. Commit allowed.')
  process.exit(0)
} else {
  console.error(`  ❌  ENCODING VIOLATIONS FOUND — Commit BLOCKED!\n`)

  for (const { file, violations } of results) {
    console.error(`  📄 ${file}`)
    for (const v of violations.slice(0, 5)) {
      const icon = v.type === 'MOJIBAKE' ? '🔤' : v.type === 'REPLACEMENT_CHAR' ? '⚠️ ' : '💥'
      console.error(`     ${icon} L${v.line} [${v.type}]: ${v.text}`)
    }
    if (violations.length > 5) {
      console.error(`     ... and ${violations.length - 5} more violations`)
    }
    console.error('')
  }

  console.error('  ══════════════════════════════════════════════════════════')
  console.error('  FIX: Run  python -X utf8 scripts/fix_mojibake.py')
  console.error('  Then review and re-stage affected files.')
  console.error('  ══════════════════════════════════════════════════════════')
  process.exit(1)
}
