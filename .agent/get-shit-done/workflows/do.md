<purpose>
Analyze freeform user intent and route to the most appropriate GSD command. This is a dispatcher only. It never does the work itself. Its routing must align with the canonical Quick / Standard / Heavy model from `.agent/docs/ANTIGRAVITY_ROUTING.md`.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<routing_model>
Classify every request on three axes before selecting a command:

1. work size: Quick, Standard, or Heavy
2. dominant specialization: bug, backend, frontend, architecture, ERP, verification, or research
3. artifact need: direct execution versus structured phase artifacts

Practical mapping:

- Quick -> `/gsd-quick`
- Standard -> `/gsd-plan-phase`, `/gsd-execute-phase`, or `/gsd-verify-work` depending on user intent
- Heavy -> `/gsd-add-phase` or a full phased workflow
</routing_model>

<process>

<step name="validate">
**Check for input.**

If `$ARGUMENTS` is empty, ask:

```
What would you like to do? Describe the task, bug, or idea and I will route it to the right GSD command.
```

Wait for response before continuing.
</step>

<step name="check_project">
**Check if project exists.**

```bash
INIT=$(node ".agent/get-shit-done/bin/gsd-tools.cjs" state load 2>/dev/null)
```

Track whether `.planning/` exists. Some routes require it, others do not.
</step>

<step name="route">
**Match intent to command.**

Evaluate `$ARGUMENTS` against these routing rules. Apply the **first matching** rule:

| If the text describes... | Route to | Why |
|--------------------------|----------|-----|
| Starting a new project, "set up", "initialize" | `/gsd-new-project` | Needs project initialization |
| Mapping or analyzing an existing codebase | `/gsd-map-codebase` | Discovery before execution |
| A bug, error, crash, failure, or something broken | `/gsd-debug` | Standard debugging path |
| Exploring, researching, comparing, or "how does X work" | `/gsd-research-phase` | Research before planning |
| Discussing vision, solution shape, or brainstorming | `/gsd-discuss-phase` | Context gathering before planning |
| A complex task: refactoring, migration, multi-file architecture, system redesign, ERP workflow changes, security-sensitive flow changes | `/gsd-add-phase` | Heavy work that needs structured planning |
| Planning a specific phase or "plan phase N" | `/gsd-plan-phase` | Standard or Heavy planning request |
| Executing a phase or "build phase N", "run phase N" | `/gsd-execute-phase` | Planned execution request |
| Running all remaining phases automatically | `/gsd-autonomous` | Full autonomous execution |
| A review or quality concern about existing work | `/gsd-verify-work` | Verification or UAT path |
| Checking progress, status, or "where am I" | `/gsd-progress` | Status check |
| Resuming work, "pick up where I left off" | `/gsd-resume-work` | Session restoration |
| A note, idea, or "remember to..." | `/gsd-add-todo` | Capture for later |
| Adding tests, "write tests", "test coverage" | `/gsd-add-tests` | Test generation |
| Completing a milestone, shipping, releasing | `/gsd-complete-milestone` | Milestone lifecycle |
| A specific, actionable, small task with clear scope and limited blast radius | `/gsd-quick` | Quick work should stay lightweight |

**Requires `.planning/` directory:** All routes except `/gsd-new-project`, `/gsd-map-codebase`, `/gsd-help`, and `/gsd-join-discord`. If the project does not exist and the route requires it, suggest `/gsd-new-project` first.

**Escalation rule:** If a request sounds small but changes workflow states, security boundaries, accounting logic, or multiple modules, prefer Standard or Heavy routing instead of `/gsd-quick`.

**Ambiguity handling:** If the text could reasonably match multiple routes, ask the user to choose between the top 2-3 options and explain the tradeoff briefly.
</step>

<step name="display">
**Show the routing decision.**

```
GSD ROUTING

Input: {first 80 chars of $ARGUMENTS}
Size: {Quick | Standard | Heavy}
Routing to: {chosen command}
Reason: {one-line explanation}
```
</step>

<step name="dispatch">
**Invoke the chosen command.**

Run the selected `/gsd-*` command, passing `$ARGUMENTS` as args.

If the chosen command expects a phase number and one was not provided in the text, extract it from context or ask the user.

After invoking the command, stop. The dispatched command handles everything from there.
</step>

</process>

<success_criteria>
- [ ] Input validated
- [ ] Work size classified
- [ ] Intent matched to exactly one GSD command
- [ ] Ambiguity resolved when needed
- [ ] Project existence checked for required routes
- [ ] Routing decision displayed before dispatch
- [ ] No work done directly
</success_criteria>
