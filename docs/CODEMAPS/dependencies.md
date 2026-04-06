<!-- Generated: 2026-04-06 | Managed by .agent/scripts/update-docs.js -->

# Dependencies - External Integrations

## AI Models / Providers

| Provider | Notes |
|----------|-------|
| Anthropic Claude | Agent frontmatter still documents Claude-family model intent for Antigravity specialists. |
| Google Gemini | Available as an alternative IDE/runtime surface in the broader Antigravity setup. |
| Codex | Used as a direct execution surface in this workspace. |

## MCP Servers

| Server | Purpose |
|--------|---------|
| GitNexus | Code graph navigation, impact analysis, and execution-flow tracing. |

## Framework Tooling

```
Node.js scripts live in .agent/scripts
Root package scripts expose the safe entrypoints used in this repo
```

Supported maintenance scripts:

- audit-workflows.js
- audit-skills.js
- check-orphans.js
- remove-ghosts.js
- gitnexus-sync.js
- update-docs.js

Legacy scripts kept only as disabled compatibility wrappers:

- fix-rules.js
- patch-hooks.js
- gen-agents.js
- remap.js
- remap-smart.js

## Version Tracking

| Component | Count |
|-----------|-------|
| Agents | 18 |
| Skills | 108 |
| Workflows | 88 |
| GSD Workflows | 57 |
| Rules | 40 |
| Scripts | 11 |
