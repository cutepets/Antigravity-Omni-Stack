---
description: Performance optimization workflow for frontend, backend, or full-stack bottlenecks. Start with measurement, then optimize.
---

# /performance

$ARGUMENTS

## Canonical Routing

- frontend speed issue -> `performance-optimizer + frontend-specialist`
- backend latency or throughput issue -> `performance-optimizer + backend-specialist`
- infra bottleneck -> `performance-optimizer + devops-engineer`

## Workflow

### 1. Measure First

Primary specialist:

- `performance-optimizer`

Capture baseline metrics before proposing fixes.

### 2. Isolate Bottlenecks

Look for:

- large bundles or slow hydration
- inefficient queries or missing indexes
- network waterfalls
- cache misses
- memory or CPU hot spots

### 3. Optimize The Right Layer

Bring in the specialist that owns the bottleneck instead of applying generic tweaks everywhere.

### 4. Verify The Delta

Report before vs after metrics and any tradeoffs introduced.

## Output

- baseline
- bottleneck summary
- fixes applied or recommended
- measured improvement
