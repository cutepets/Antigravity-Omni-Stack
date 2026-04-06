# GSD Workflows

Canonical guidance for the `get-shit-done` execution engine.

This directory is the structured planning and execution layer behind Antigravity. It should follow the same routing model defined in:

- `.agent/docs/ANTIGRAVITY_ROUTING.md`
- `.agent/docs/CODEX_COLLABORATION.md`

## Directory Role

- route work to the right execution depth
- create phase and quick-task artifacts in `.planning/`
- execute planned work with verification and recovery loops

## Size Mapping

- Quick: `/gsd-quick`
- Standard: `/gsd-plan-phase` -> `/gsd-execute-phase` -> `/gsd-verify-work`
- Heavy: `/gsd-add-phase` or a full roadmap cycle, then phased planning and execution

## Dispatcher

- `/gsd-do` is the main router
- it should classify work by size, specialization, and whether structured planning artifacts are required
- it should never do the work itself

## Practical Rule

- prefer the smallest GSD path that still protects correctness
- do not send obvious one-file work into heavy phase machinery
- do not skip phase planning when requirements, workflow states, or cross-module risk are unclear

## Compatibility Rule

Many files here are operationally rich and intentionally detailed. If legacy wording inside a workflow conflicts with the routing model above, prefer the routing model above and keep the detailed execution steps only where they still fit.
