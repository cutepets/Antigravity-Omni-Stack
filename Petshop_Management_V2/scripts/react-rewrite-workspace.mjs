#!/usr/bin/env node
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..')
const cliRoot = path.join(workspaceRoot, 'apps', 'web', 'node_modules', 'react-rewrite-cli')
const realCliRoot = fs.realpathSync(cliRoot)
const cliDependencyRoot = path.dirname(realCliRoot)

const [
  { default: chalk },
  { default: open },
  { createProxyServer },
  { createSketchServer },
  { logger, setLogLevel },
  { healthCheck },
] =
  await Promise.all([
    import(pathToFileURL(path.join(cliDependencyRoot, 'chalk', 'source', 'index.js')).href),
    import(pathToFileURL(path.join(cliDependencyRoot, 'open', 'index.js')).href),
    import(pathToFileURL(path.join(cliRoot, 'dist', 'inject.js')).href),
    import(pathToFileURL(path.join(cliRoot, 'dist', 'server.js')).href),
    import(pathToFileURL(path.join(cliRoot, 'dist', 'logger.js')).href),
    import(pathToFileURL(path.join(cliRoot, 'dist', 'detect.js')).href),
  ])

async function assertPortAvailable(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', () => {
      reject(new Error(`${label} port ${port} is already in use. Stop the old ui:editor process first.`))
    })
    server.once('listening', () => {
      server.close(() => resolve())
    })
    server.listen(port)
  })
}

const args = process.argv.slice(2)
const portArg = args.find((arg) => /^\d+$/.test(arg))
const targetPort = portArg ? Number(portArg) : 3000
const hostIndex = args.indexOf('--host')
const host = hostIndex >= 0 && args[hostIndex + 1] ? args[hostIndex + 1] : 'localhost'
const shouldOpen = !args.includes('--no-open')
const verbose = args.includes('--verbose') || process.env.LOG_LEVEL === 'debug'

if (verbose) {
  setLogLevel('debug')
}

process.chdir(workspaceRoot)

logger.info(chalk.cyan('\n  ReactRewrite') + chalk.dim(' — Petshop workspace overlay\n'))
logger.info(chalk.dim('  Workspace root: ') + chalk.white(workspaceRoot))
logger.info(chalk.dim('  React app: ') + chalk.white('apps/web'))
logger.info(chalk.dim('  Dev server: ') + chalk.white(`http://${host}:${targetPort}`))

logger.info(chalk.dim('  Checking dev server...'))
await healthCheck(targetPort, host)

const proxyPort = 3456
const wsPort = 3457
await assertPortAvailable(proxyPort, 'Proxy')
await assertPortAvailable(wsPort, 'WebSocket')

const sketchServer = createSketchServer({ port: wsPort })
const proxyServer = createProxyServer({
  targetPort,
  targetHost: host,
  proxyPort,
  wsPort,
  getActiveClient: sketchServer.getActiveClient,
})

proxyServer.listen(proxyPort, () => {
  logger.info(chalk.dim('  Proxy: ') + chalk.green(`http://localhost:${proxyPort}`))
  logger.info(chalk.dim('  WebSocket: ') + chalk.green(`ws://localhost:${wsPort}`))
  logger.info(chalk.dim('\n  Press ') + chalk.white('Ctrl+C') + chalk.dim(' to stop\n'))
  if (shouldOpen) {
    open(`http://localhost:${proxyPort}`)
  }
})

const shutdown = () => {
  logger.info(chalk.dim('\n  Shutting down...\n'))
  proxyServer.close()
  sketchServer.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
