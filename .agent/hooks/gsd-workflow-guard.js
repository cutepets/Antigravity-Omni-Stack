#!/usr/bin/env node
// gsd-hook-version: 1.30.0
// GSD Workflow Guard - PreToolUse hook
// Detects direct edits outside a tracked workflow context and emits an advisory warning.

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name;

    if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'MultiEdit') {
      process.exit(0);
    }

    if (data.tool_input?.is_subagent || data.session_type === 'task') {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path || data.tool_input?.path || '';
    if (filePath.includes('.agent/') || filePath.includes('.agent\\') || filePath.includes('.gemini/') || filePath.includes('.gemini\\')) {
      process.exit(0);
    }

    const allowedPatterns = [
      /\.gitignore$/,
      /\.env/,
      /CLAUDE\.md$/,
      /AGENTS\.md$/,
      /GEMINI\.md$/,
      /settings\.json$/,
    ];
    if (allowedPatterns.some(pattern => pattern.test(filePath))) {
      process.exit(0);
    }

    const cwd = data.cwd || process.cwd();
    const configPath = path.join(cwd, '.agent', 'settings.json');
    if (!fs.existsSync(configPath)) {
      process.exit(0);
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      process.exit(0);
    }

    if (!config.hooks?.workflow_guard) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `\u26a0\ufe0f WORKFLOW ADVISORY: You're editing ${path.basename(filePath)} directly without a tracked Antigravity workflow. ` +
          'This edit will not be reflected in workflow state artifacts automatically. ' +
          'Consider using /plan or the appropriate GSD workflow if you want state tracking. ' +
          'If the user explicitly asked for a direct edit, proceed normally.'
      }
    };

    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exit(0);
  }
});
