const fs = require('fs');
const path = require('path');

const hooksDir = '.agent/hooks';
const settingsPath = '.agent/settings.json';

// 1. gsd-context-monitor.js
let monitor = fs.readFileSync(path.join(hooksDir, 'gsd-context-monitor.js'), 'utf8');
monitor = monitor.replace(/\.planning/g, '.agent');
monitor = monitor.replace(/config\.json/g, 'settings.json');
monitor = monitor.replace(/STATE\.md/g, 'settings.json'); // Detect Antigravity by checking standard file
monitor = monitor.replace(/isGsdActive/g, 'isAgentActive');
monitor = monitor.replace(/\/gsd:pause-work/, '/resume-session');
fs.writeFileSync(path.join(hooksDir, 'gsd-context-monitor.js'), monitor, 'utf8');

// 2. gsd-prompt-guard.js
let promptGuard = fs.readFileSync(path.join(hooksDir, 'gsd-prompt-guard.js'), 'utf8');
promptGuard = promptGuard.replace(
  /!filePath\.includes\('\.planning\/'\) && !filePath\.includes\('\.planning\\\\'\)/g,
  "(!filePath.includes('.agent/') && !filePath.includes('.agent\\\\') && !filePath.includes('.gemini/') && !filePath.includes('.gemini\\\\'))"
);
promptGuard = promptGuard.replace(/\.planning\//g, '.agent/ and .gemini/'); // description
fs.writeFileSync(path.join(hooksDir, 'gsd-prompt-guard.js'), promptGuard, 'utf8');

// 3. gsd-workflow-guard.js
let workflowGuard = fs.readFileSync(path.join(hooksDir, 'gsd-workflow-guard.js'), 'utf8');
workflowGuard = workflowGuard.replace(
  /filePath\.includes\('\.planning\/'\) \|\| filePath\.includes\('\.planning\\\\'\)/g,
  "(filePath.includes('.agent/') || filePath.includes('.agent\\\\') || filePath.includes('.gemini/') || filePath.includes('.gemini\\\\'))"
);
workflowGuard = workflowGuard.replace(/path\.join\(cwd, '\.planning', 'config\.json'\)/g, "path.join(cwd, '.agent', 'settings.json')");
workflowGuard = workflowGuard.replace(/\.planning/g, '.agent/.gemini');
workflowGuard = workflowGuard.replace(/\/gsd:fast/g, '/aside');
workflowGuard = workflowGuard.replace(/\/gsd:quick/g, '/plan');
fs.writeFileSync(path.join(hooksDir, 'gsd-workflow-guard.js'), workflowGuard, 'utf8');

// 4. Update settings.json to include Workflow Guard
let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
if (settings.hooks && settings.hooks.PreToolUse) {
  let hasWorkflowGuard = false;
  // Look through PreToolUse array
  for (let rule of settings.hooks.PreToolUse) {
    if (rule.matcher === "Write|Edit|MultiEdit") {
      let containsGuard = rule.hooks.some(h => h.command && h.command.includes('gsd-workflow-guard.js'));
      if (!containsGuard) {
        rule.hooks.push({
          type: "command",
          command: "node .agent/hooks/gsd-workflow-guard.js",
          timeout: 5
        });
      }
      hasWorkflowGuard = true;
    }
  }
}
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

console.log("Hooks patched to Antigravity v2.0 Architecture");
