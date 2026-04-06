# Antigravity Resources

Reference list for important internal and external resources used by this framework.

## Internal Sources Of Truth

- `.agent/rules/GEMINI.md` -> governance and safety
- `.agent/docs/ANTIGRAVITY_ROUTING.md` -> routing by work size and specialization
- `.agent/docs/AGENT_STANDARD.md` -> canonical agent contract
- `.agent/docs/CODEX_COLLABORATION.md` -> Codex + Antigravity operating model
- `.agent/skills/README.md` -> skill layer guide
- `.agent/workflows/README.md` -> workflow entrypoints
- `.agent/get-shit-done/workflows/README.md` -> heavy workflow engine

## Repository Metadata

- `.agent/ecc-install-state.json` -> historical install metadata from the original framework import
- `.agent/gsd-file-manifest.json` -> GSD manifest and file fingerprint data

## External References

- Model Context Protocol: `https://modelcontextprotocol.io/`
- MCP Servers Registry: `https://github.com/modelcontextprotocol/servers`
- GitNexus docs and CLI: project-local via `gitnexus` and MCP tools

## Maintenance Notes

- Treat internal `.agent/docs`, `.agent/rules`, `.agent/agents`, `.agent/skills`, and workflow files as canonical over older historical material.
- Treat `ecc-install-state.json` as historical provenance, not a runtime control surface.
