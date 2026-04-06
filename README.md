# Antigravity Workspace

This repository uses Antigravity as its AI workflow and governance layer.

Do not treat older marketing text, manual counts, or legacy examples as runtime truth. The active operating model lives under [`.agent/`](c:\Dev2\.agent).

## Read Order

1. [`.agent/START_HERE.md`](c:\Dev2\.agent\START_HERE.md)
2. [`.agent/rules/GEMINI.md`](c:\Dev2\.agent\rules\GEMINI.md)
3. [`.agent/docs/ANTIGRAVITY_ROUTING.md`](c:\Dev2\.agent\docs\ANTIGRAVITY_ROUTING.md)
4. [`.agent/docs/AGENT_STANDARD.md`](c:\Dev2\.agent\docs\AGENT_STANDARD.md)
5. [`.agent/docs/CODEX_COLLABORATION.md`](c:\Dev2\.agent\docs\CODEX_COLLABORATION.md)

## Operating Model

- Antigravity is the framework and governance layer.
- The user is the real dispatcher.
- Specialist agents in [`.agent/agents/`](c:\Dev2\.agent\agents) are operational playbooks.
- GitNexus is the primary code intelligence layer for understanding code, impact, and execution flow.

## Work Modes

- `Quick`: direct execution with the right specialist mindset
- `Standard`: lightweight plan plus bounded execution
- `Heavy`: structured planning, handoff, staged execution, verification

The canonical routing matrix lives in [`.agent/docs/ANTIGRAVITY_ROUTING.md`](c:\Dev2\.agent\docs\ANTIGRAVITY_ROUTING.md).

## Directory Guide

- [`.agent/rules/`](c:\Dev2\.agent\rules): governance and safety
- [`.agent/agents/`](c:\Dev2\.agent\agents): specialist playbooks
- [`.agent/skills/`](c:\Dev2\.agent\skills): deep methods loaded when relevant
- [`.agent/workflows/`](c:\Dev2\.agent\workflows): workflow entrypoints and slash-command docs
- [`.agent/get-shit-done/workflows/`](c:\Dev2\.agent\get-shit-done\workflows): structured execution workflows
- [`.planning/`](c:\Dev2\.planning): planning and execution artifacts when a workflow creates them

## Root File Roles

- [GEMINI.md](c:\Dev2\GEMINI.md): compatibility pointer to the canonical rule file
- [AGENTS.md](c:\Dev2\AGENTS.md): root assistant instructions surface
- [CLAUDE.md](c:\Dev2\CLAUDE.md): compatibility mirror for runtimes that read Claude-style instructions
- [ERRORS.md](c:\Dev2\ERRORS.md): shared error log template
- [mcp.json](c:\Dev2\mcp.json): MCP server configuration for this repo
- [package.json](c:\Dev2\package.json): helper scripts for GitNexus sync and agent scanning

## Scripts

- `npm run gitnexus-update`
- `npm run scan:agent`

## Notes

- Keep root docs short and stable.
- Put workflow truth in `/.agent`, not in duplicate root summaries.
- If root docs and `/.agent` docs disagree, `/.agent` wins.
