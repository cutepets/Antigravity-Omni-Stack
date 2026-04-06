# Antigravity Architecture

Antigravity in this repository is a framework layer built around routing, specialist playbooks, workflow discipline, and maintenance utilities.

## System Layers

### 1. Governance

Files:

- `.agent/rules/`
- `.agent/docs/`

Purpose:

- define routing
- define shared guardrails
- define canonical operating contracts

### 2. Specialist Layer

Files:

- `.agent/agents/`
- `.agent/skills/`

Purpose:

- assign ownership by domain
- provide reusable specialist context
- support structured handoffs

### 3. Execution Layer

Files:

- `.agent/workflows/`
- `.agent/get-shit-done/workflows/`
- `.agent/hooks/`
- `.agent/settings.json`

Purpose:

- route direct commands
- enforce runtime checks
- run phased execution for larger work

### 4. Maintenance Layer

Files:

- `.agent/scripts/`
- `docs/CODEMAPS/`

Purpose:

- audit framework drift
- verify skill and workflow coverage
- regenerate lightweight metadata

## Design Principles

- prefer canonical docs over marketing-style overviews
- prefer additive maintenance over destructive regeneration
- prefer explicit routing over implicit persona theater
- keep heavy workflows available, but do not force them onto Quick work
- keep compatibility surfaces only when they do not fight the canonical layer

## Source Of Truth

Use this precedence order:

1. `.agent/docs/ANTIGRAVITY_ROUTING.md`
2. `.agent/docs/AGENT_STANDARD.md`
3. `.agent/docs/CODEX_COLLABORATION.md`
4. `.agent/rules/GEMINI.md`
5. `.agent/settings.json`

## Current Reality

The framework is no longer the old generated system.
It is now a maintained specialist framework with:

- explicit agent playbooks
- audited skill ownership
- hook-driven safety checks
- workflow routing by work size and specialty
