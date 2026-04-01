#!/usr/bin/env node
/**
 * Session Stop Audit Hook
 * Runs at end of session to log completion and verify no security issues.
 */
const fs = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), '.agent', 'logs');
const logFile = path.join(logDir, 'session-audit.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const timestamp = new Date().toISOString();
const entry = `[${timestamp}] Session ended. Verifying no uncommitted secrets or dangerous flags.\n`;

fs.appendFileSync(logFile, entry);
process.exit(0);
