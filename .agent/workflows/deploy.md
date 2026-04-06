---
description: Deployment workflow for preview or production releases with preflight, runtime checks, and rollback awareness.
---

# /deploy

$ARGUMENTS

## Canonical Owner

- `devops-engineer`

Optional support:

- `security-auditor`
- `performance-optimizer`

## Workflow

### 1. Preflight

Confirm the release is actually deployable:

- build passes
- relevant tests pass
- env vars and secrets are present

### 2. Execute The Release

Use the target platform path and note the rollback strategy.

### 3. Verify Live Health

Check:

- app comes up
- critical route works
- key dependency connections succeed

## Output

- target environment
- deployment result
- health status
- rollback note if needed
