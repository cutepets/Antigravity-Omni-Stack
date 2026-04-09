#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { TextDecoder } from 'node:util'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const decoder = new TextDecoder('utf-8', { fatal: true })

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.css',
  '.scss',
  '.html',
  '.svg',
  '.txt',
])

const mojibakeMarkers = [
  '\u00C3',
  '\u00C2',
  '\u00C4\u2018',
  '\u00C4\u0090',
  '\u00C4\u0091',
  '\u00E2\u20AC\u201D',
  '\u00E2\u20AC\u201C',
  '\u00E2\u20AC\u0153',
  '\u00E2\u20AC\u009D',
  '\u00E2\u20AC\u02DC',
  '\u00E2\u20AC\u2122',
  '\u00E2\u20AC\u00A6',
  '\u00E2\u20AC\u00A2',
]

function getStagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()

  return output ? output.split(/\r?\n/).filter(Boolean) : []
}

function getTargetFiles(argv) {
  const explicitFiles = argv.filter((arg) => !arg.startsWith('--'))
  if (explicitFiles.length > 0) return explicitFiles
  return getStagedFiles()
}

function isTextFile(filePath) {
  return textExtensions.has(extname(filePath).toLowerCase())
}

function getLocation(text, index) {
  const prefix = text.slice(0, index)
  const lines = prefix.split('\n')

  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  }
}

function findMojibake(text) {
  let bestMatch = null

  for (const marker of mojibakeMarkers) {
    const index = text.indexOf(marker)
    if (index < 0) continue
    if (!bestMatch || index < bestMatch.index) {
      bestMatch = { marker, index }
    }
  }

  return bestMatch
}

function checkFile(relativePath) {
  if (!isTextFile(relativePath)) return []

  const absolutePath = resolve(repoRoot, relativePath)
  if (!existsSync(absolutePath)) return []

  const buffer = readFileSync(absolutePath)
  if (buffer.includes(0)) return []

  try {
    decoder.decode(buffer)
  } catch (error) {
    return [
      {
        file: relativePath,
        reason: 'invalid UTF-8 byte sequence',
        details: error instanceof Error ? error.message : String(error),
      },
    ]
  }

  const text = buffer.toString('utf8')
  const issues = []

  const replacementIndex = text.indexOf('\uFFFD')
  if (replacementIndex >= 0) {
    const location = getLocation(text, replacementIndex)
    issues.push({
      file: relativePath,
      reason: 'replacement character found',
      details: `line ${location.line}, column ${location.column}`,
    })
  }

  const mojibakeMatch = findMojibake(text)
  if (mojibakeMatch) {
    const location = getLocation(text, mojibakeMatch.index)
    issues.push({
      file: relativePath,
      reason: `possible mojibake sequence "${mojibakeMatch.marker}"`,
      details: `line ${location.line}, column ${location.column}`,
    })
  }

  return issues
}

const targets = getTargetFiles(process.argv.slice(2))
const issues = targets.flatMap(checkFile)

if (issues.length === 0) {
  console.log(`UTF-8 check passed for ${targets.length} file(s).`)
  process.exit(0)
}

console.error('UTF-8 check failed:')
for (const issue of issues) {
  console.error(`- ${issue.file}: ${issue.reason}${issue.details ? ` (${issue.details})` : ''}`)
}
console.error('Re-save the file as UTF-8 and fix mojibake text before committing.')
process.exit(1)
