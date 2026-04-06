---
description: Visualization workflow for turning system logic, architecture, or flows into diagrams that aid explanation and review.
---

# /visually

$ARGUMENTS

## Canonical Routing

- architecture diagrams -> `system-architect`
- execution or dependency diagrams -> `backend-specialist` or `debug-specialist`
- documentation visuals -> `/document`

## Workflow

### 1. Choose The Diagram Type

- flowchart
- sequence
- component map
- state diagram

### 2. Extract The Minimum Accurate Model

Only include relationships that can be defended from code or documented behavior.

### 3. Render For Reuse

Target outputs that can live in docs or PR discussions cleanly.

## Output

- diagram type
- scope
- assumptions
- export format
