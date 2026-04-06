---
description: Analyze a draft prompt and return a stronger Antigravity-ready execution prompt without running it.
---

# /prompt-optimize

Analyze and optimize the user's draft prompt for the current Antigravity and Codex workflow.

## Your Task

Follow this pipeline:

1. `Intent Detection` -> classify the task type
2. `Scope Assessment` -> map it to `quick`, `standard`, or `heavy`
3. `Routing` -> recommend the primary agent mindset and any supporting specialist
4. `Context Gaps` -> identify missing inputs that would materially change execution
5. `Execution Shape` -> decide whether the prompt should ask for direct execution, planning, review, or advisory work
6. `Prompt Rewrite` -> produce a cleaned-up prompt ready to paste into a fresh session

## Output Requirements

- Present diagnosis, recommended routing, and an optimized prompt
- Provide both a `Full Version` and a `Quick Version`
- Respond in the same language as the user's input
- The optimized prompt must be complete and ready to paste into a new session
- End with either a refinement question or a clear next step

## Critical

Do not execute the task. Return analysis and rewritten prompt only.

## User Input

$ARGUMENTS
