# Rules

Canonical index for the rule layer in this repository.

The rule system is now organized as a flat file set in `.agent/rules/`, not as nested `common/` and language directories.

## Structure

### Core Rules

- `GEMINI.md` -> top-level constitution and operating posture
- `common-agents.md` -> specialist routing expectations
- `common-development-workflow.md` -> development lifecycle expectations
- `common-code-review.md` -> review standards
- `common-code-review-reception.md` -> how to process review feedback
- `common-coding-style.md` -> general coding standards
- `common-testing.md` -> testing requirements
- `common-security.md` -> security requirements
- `common-hooks.md` -> hook model and runtime notes
- `common-performance.md` -> performance expectations
- `common-patterns.md` -> shared design and implementation patterns
- `common-git-workflow.md` -> commit and branch expectations

### Language-Specific Rules

- `typescript-*` -> TypeScript and JavaScript specifics
- `python-*` -> Python specifics

### Domain Rules

- `backend.md`
- `frontend.md`
- `business.md`
- `security.md`
- `debug.md`
- `architecture-review.md`
- `testing-standard.md`

## Rule Model

- common rules define defaults
- language-specific rules extend or refine those defaults
- domain rules provide narrower operating guidance for specific surfaces

## Linking Convention

Because the rule tree is flat, cross-links should target the actual flat filenames:

- `common-coding-style.md`
- `common-testing.md`
- `common-security.md`
- `common-hooks.md`
- `common-patterns.md`
- `common-git-workflow.md`

Do not use legacy links like `../common/testing.md`.

## Relationship To Other Layers

- rules tell the system what standards and guardrails apply
- agents define specialist playbooks and deliverables
- workflows define operational processes
- skills provide deeper methods or references

## Canonical Source

If a rule conflicts with `.agent/docs/ANTIGRAVITY_ROUTING.md` or `.agent/docs/AGENT_STANDARD.md`, the docs layer wins and the rule should be updated.
