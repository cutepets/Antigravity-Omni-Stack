---
description: Mobile application workflow for React Native or native surfaces. Use when touch behavior, device constraints, or mobile release quality matter.
---

# /mobile

$ARGUMENTS

## Canonical Owner

- `mobile-developer`

Optional support:

- `frontend-specialist` for shared design systems
- `qa-engineer` for device and regression coverage

## Workflow

### 1. Frame The Mobile Surface

Clarify:

- platform scope
- device constraints
- online or offline expectations
- navigation and state model

### 2. Implement For Real Device Behavior

Account for:

- safe areas
- touch targets
- performance on lower-end devices
- network and sync behavior

### 3. Verify On Device Classes

Run the right mix of:

- simulator or emulator checks
- device-specific regression checks
- release-readiness checks

## Output

- implementation scope
- device constraints
- validation status
- store or release blockers if any
