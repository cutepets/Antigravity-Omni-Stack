---
name: finite-state-machine
description: Design highly predictable order flows, lifecycles, and transactions using Finite State Machines (FSM).
---

# Finite State Machine (FSM) Design

## Core Principles
1. **Deterministic Transitions**: An entity (e.g., Order, Booking, Stock Transfer) can only move from state A to state B if a valid transition is explicitly defined.
2. **State Decoupling**: Centralize transition logic so arbitrary state modifications (e.g., `status = 'COMPLETED'`) are forbidden outside the state machine controller.

## Implementation Pattern
- Use strict Enums for states (e.g., `PENDING`, `IN_PROGRESS`, `FULFILLED`, `CANCELLED`).
- Map out allowed transitions: `PENDING -> IN_PROGRESS`, `IN_PROGRESS -> FULFILLED`.
- Require specific events/actions to trigger transitions.
- Implement invariant checking (Guard Clauses) before allowing a transition, returning domain-specific exception types if the transition is invalid.
