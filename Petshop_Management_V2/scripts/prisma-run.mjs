import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Usage: node scripts/prisma-run.mjs <prisma args>')
  process.exit(1)
}

const workspaceRoot = findWorkspaceRoot(process.cwd())
const prismaBin = resolvePrismaBin(process.cwd(), workspaceRoot)
const maxAttempts = shouldRetry(args) ? 3 : 1

let exitCode = 1

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = await runPrisma(prismaBin, args, process.cwd())
  exitCode = result.code

  if (exitCode === 0) {
    process.exit(0)
  }

  if (!isWindowsEngineLock(result.combinedOutput) || attempt === maxAttempts) {
    if (isWindowsEngineLock(result.combinedOutput)) {
      printWindowsLockHint(workspaceRoot)
    }
    process.exit(exitCode ?? 1)
  }

  const delayMs = attempt * 1200
  console.error(
    `[prisma-run] Prisma engine is locked by another process. Retrying in ${delayMs}ms (${attempt}/${maxAttempts})...`,
  )
  await sleep(delayMs)
}

process.exit(exitCode)

function shouldRetry(commandArgs) {
  const command = commandArgs.join(' ')
  return (
    command.startsWith('generate') ||
    command.startsWith('migrate dev') ||
    command.startsWith('migrate deploy') ||
    command.startsWith('migrate reset') ||
    command.startsWith('db push')
  )
}

function findWorkspaceRoot(startDir) {
  let current = startDir

  while (true) {
    const packageJsonPath = path.join(current, 'package.json')
    const pnpmLockPath = path.join(current, 'pnpm-lock.yaml')
    if (existsSync(packageJsonPath) && existsSync(pnpmLockPath)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return startDir
    }
    current = parent
  }
}

function resolvePrismaBin(cwd, workspaceRoot) {
  const extension = process.platform === 'win32' ? '.cmd' : ''
  const candidates = [
    path.join(cwd, 'node_modules', '.bin', `prisma${extension}`),
    path.join(workspaceRoot, 'node_modules', '.bin', `prisma${extension}`),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
}

function runPrisma(command, commandArgs, cwd) {
  return new Promise((resolve) => {
    const spawnConfig = getSpawnConfig(command, commandArgs, cwd)
    const child = spawn(spawnConfig.command, spawnConfig.args, spawnConfig.options)

    let combinedOutput = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      combinedOutput += text
      process.stdout.write(text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      combinedOutput += text
      process.stderr.write(text)
    })

    child.on('close', (code) => resolve({ code, combinedOutput }))
  })
}

function getSpawnConfig(command, commandArgs, cwd) {
  const options = {
    cwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  }

  if (process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')) {
    const comspec = process.env['ComSpec'] || 'cmd.exe'
    return {
      command: comspec,
      args: ['/d', '/s', '/c', command, ...commandArgs],
      options,
    }
  }

  return {
    command,
    args: commandArgs,
    options,
  }
}

function isWindowsEngineLock(output) {
  return (
    process.platform === 'win32' &&
    output.includes('EPERM: operation not permitted, rename') &&
    output.includes('query_engine-windows.dll.node')
  )
}

function printWindowsLockHint(workspaceRoot) {
  const relativeRoot = path.basename(workspaceRoot)
  console.error('[prisma-run] Prisma could not replace the Windows query engine because it is locked.')
  console.error(
    `[prisma-run] Stop Node dev servers or scripts still using Prisma in ${relativeRoot}, then run the command again.`,
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
