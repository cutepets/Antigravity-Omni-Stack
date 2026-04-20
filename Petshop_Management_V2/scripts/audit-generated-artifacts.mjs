import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = process.cwd()
const trackedFiles = execFileSync(
  'git',
  ['ls-files', 'packages'],
  { cwd: repoRoot, encoding: 'utf8' },
)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

const artifactPattern =
  /^packages\/[^/]+\/src\/.*\.(js|d\.ts|js\.map|d\.ts\.map)$/

const codexBuildPattern =
  /^packages\/[^/]+\/\.codex-auth-build\//

const sourceAllowlist = new Set([
  'packages/ui/src/types/app-stubs.d.ts',
])

const violations = trackedFiles.filter(
  (file) =>
    (artifactPattern.test(file) || codexBuildPattern.test(file)) &&
    !sourceAllowlist.has(file) &&
    existsSync(resolve(repoRoot, file)),
)

if (violations.length === 0) {
  console.log('No tracked generated artifacts found in package source trees.')
  process.exit(0)
}

console.log('Tracked generated artifacts found:')
for (const file of violations) {
  console.log(`- ${file}`)
}
console.log(`Total: ${violations.length}`)
