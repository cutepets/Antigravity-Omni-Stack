---
description: Security review and hardening workflow for Standard or Heavy work, especially around auth, secrets, external exposure, and privilege boundaries.
---

# /security

$ARGUMENTS

## Canonical Routing

- narrow review of one concrete risk -> `security-auditor`
- security fix requiring code changes -> `security-auditor -> backend-specialist or devops-engineer`
- cross-surface security effort -> `/orchestrate` or phased GSD execution

## Workflow

### 1. Map The Attack Surface

Primary specialist:

- `security-auditor`

Look at:

- public endpoints
- auth and authorization paths
- secrets handling
- third-party integrations
- logs and data exposure

### 2. Assess Risk

Classify issues by:

- exploitability
- data impact
- privilege impact
- exposure surface

### 3. Harden

Route to:

- `backend-specialist` for application-layer fixes
- `devops-engineer` for deployment, runtime, or secret-management fixes
- `integration-engineer` when provider contracts or webhooks are involved

### 4. Re-Verify

Confirm the risky path is closed and that no new breakage was introduced.

## Expected Output

```markdown
## Security Review: [Scope]

### Findings
- [Severity] [Issue]

### Required Fixes
- [Concrete change]

### Verification
- [How the risk was checked after remediation]
```
