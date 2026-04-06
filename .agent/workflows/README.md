# Workflow Commands

Canonical guidance for user-facing workflow entrypoints in this directory.

Use this directory for slash-command style entrypoints that help the user choose a working mode or specialist lens.
Do not treat every file here as equally canonical. The active routing model is defined in:

- `.agent/docs/ANTIGRAVITY_ROUTING.md`
- `.agent/docs/AGENT_STANDARD.md`
- `.agent/docs/CODEX_COLLABORATION.md`

## Directory Role

- `.agent/workflows/` contains human-facing command entrypoints
- `.agent/get-shit-done/workflows/` contains the heavier planning and execution engine

## Canonical Entry Commands

- `/plan`: lightweight planning entrypoint for Standard or Heavy work
- `/create`: full feature or product creation entrypoint
- `/orchestrate`: specialist handoff and staged execution guidance
- `/debug`: debugging and root-cause workflow
- `/test`: testing and verification workflow
- `/security`: security review or hardening workflow
- `/code-review`: maintainability and correctness review workflow
- `/ui-ux-pro-max`: frontend design-direction workflow

## Routing Rules

- Quick work: prefer direct execution with the right specialist mindset
- Standard work: use a lightweight plan, then execute and verify
- Heavy work: route into staged planning and handoff, often through GSD

## Compatibility Rule

If an older workflow file in this directory conflicts with the canonical docs above, the canonical docs win.
