#!/usr/bin/env node
/**
 * @fileoverview UTF-8 Encoding Guard — Pre-commit hook (staged files only)
 * @encoding utf-8
 *
 * This is the Husky pre-commit hook entry point.
 * It runs check-utf8.mjs in --staged mode so only changed files are scanned.
 */
import { execSync } from 'child_process'

try {
  execSync('node scripts/check-utf8.mjs --staged', {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
} catch {
  process.exit(1)
}
