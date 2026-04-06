---
description: Observability and health workflow for services, jobs, pipelines, and critical paths.
---

# /monitor

$ARGUMENTS

## Canonical Routing

- runtime health and alerting -> `devops-engineer`
- debugging noisy or missing telemetry -> `debug-specialist + devops-engineer`
- user-facing performance signals -> `performance-optimizer`

## Workflow

### 1. Map The Critical Path

Primary specialist:

- `devops-engineer`

Identify:

- services
- queues
- databases
- external dependencies
- CI or deploy surfaces

### 2. Define Healthy State

Specify the metrics and thresholds that actually matter:

- latency
- error rate
- saturation
- availability

### 3. Instrument And Alert

Add or refine telemetry, dashboards, and alert routing.

### 4. Prove It Works

Run a smoke failure or controlled check and confirm the signal appears where expected.

## Output

- monitoring scope
- signals added or reviewed
- alerting posture
- remaining blind spots
