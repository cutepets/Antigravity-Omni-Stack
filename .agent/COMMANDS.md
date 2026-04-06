# Antigravity Commands

This file is a human-readable map of the command layer.
It intentionally avoids hardcoded counts because the command surface evolves over time.

## Canonical Locations

- `.agent/workflows/`
  Primary command entrypoints
- `.agent/get-shit-done/workflows/`
  Heavy and phased execution workflows

## Primary Command Families

### Planning and orchestration

- `/plan`
- `/create`
- `/orchestrate`
- `/brainstorm`
- `/status`

### Build, debug, and implementation

- `/debug`
- `/enhance`
- `/api`
- `/mobile`
- `/document`

### Quality and verification

- `/test`
- `/e2e`
- `/code-review`
- `/audit`
- `/security`

### Frontend and experience

- `/ui-ux-pro-max`
- `/performance`
- `/visually`

### Sessions and context

- `/compact`
- `/save-session`
- `/resume-session`
- `/checkpoint`
- `/context-budget`

## Command Routing Principles

- Use `.agent/workflows/` for direct specialist work.
- Use `.agent/get-shit-done/workflows/` when the task is Heavy or phase-driven.
- Prefer the smallest command that safely solves the problem.
- Do not treat all commands as equal-weight entrypoints.

## Source Of Truth

If this file drifts, prefer:

1. `.agent/workflows/README.md`
2. `.agent/get-shit-done/workflows/README.md`
3. the actual markdown files in those directories
