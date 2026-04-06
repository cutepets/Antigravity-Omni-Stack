# Scripts

This directory contains maintenance scripts for the Antigravity framework.

## Supported Scripts

- `node .agent/scripts/audit-workflows.js`
  Audit workflow markdown files for legacy references and missing frontmatter.
- `node .agent/scripts/check-orphans.js`
  Report skills that exist on disk but are not assigned in agent frontmatter.
- `node .agent/scripts/audit-skills.js`
  Audit active skills for missing `SKILL.md`, orphan assignments, and legacy references.
- `node .agent/scripts/remove-ghosts.js`
  Dry-run by default. Use `--write` to remove missing skills from agent frontmatter.
- `node .agent/scripts/gitnexus-sync.js`
  Run a safe GitNexus analyze pass and report path drift without deleting compatibility files.
- `node .agent/scripts/update-docs.js --write`
  Refresh generated framework metadata in `docs/CODEMAPS/dependencies.md`.

## Legacy Scripts

The scripts below are intentionally disabled because they were designed for the old generated-agent framework and can overwrite the current canonical docs and agents:

- `fix-rules.js`
- `patch-hooks.js`
- `gen-agents.js`
- `remap.js`
- `remap-smart.js`

If one of these scripts is needed again, rewrite it against:

- `.agent/docs/AGENT_STANDARD.md`
- `.agent/docs/ANTIGRAVITY_ROUTING.md`
- `.agent/docs/CODEX_COLLABORATION.md`
- `.agent/rules/GEMINI.md`
