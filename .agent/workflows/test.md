---
description: Testing and verification workflow. Use for targeted checks, regression coverage, or stronger QA on Standard and Heavy work.
---

# /test

$ARGUMENTS

## Canonical Routing

- Quick change -> targeted local verification
- Standard feature or bugfix -> `qa-engineer` defines and runs the right test mix
- Heavy or risky workflow -> testing becomes a required verification gate before close-out

## Workflow

### 1. Scope The Risk

Primary specialist:

- `qa-engineer`

Identify:

- changed behavior
- critical paths
- regression surfaces
- whether unit, integration, E2E, or manual checks are needed

### 2. Define The Test Set

The test set should be proportional:

- Quick -> minimal targeted checks
- Standard -> focused regression and acceptance coverage
- Heavy -> full behavior coverage for the affected workflow

### 3. Execute And Record

Run the relevant checks and report:

- what was executed
- what passed
- what failed
- what remains unverified

### 4. Escalate If Needed

Bring in:

- `security-auditor` for auth, payments, PII, or trust boundaries
- `code-reviewer` for maintainability gaps
- `debug-specialist` when a test exposes a non-obvious failure

## Expected Output

```markdown
## Verification Report: [Scope]

### Coverage
- [Unit]
- [Integration]
- [E2E or manual]

### Results
- [Pass or fail summary]

### Gaps
- [What is still not proven]
```
