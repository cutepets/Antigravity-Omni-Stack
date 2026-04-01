---
description: Unified TypeScript and JavaScript master skill
---

# TypeScript & JavaScript Master
This file combines core JS/TS idioms and DDD structural concepts in one highly optimized place.

## 1. Type Safety First
- Always use strict: true in 	sconfig.json.
- Avoid ny. Use unknown and perform type narrowing.
- Rely on structural typing and utility types (Omit, Pick, Record).

## 2. Domain-Driven Design (DDD) Lightweight
- Isolate business logic into small, testable pure functions or domains.
- Do not let infrastructure details (e.g., Express req/res or ORM entities) leak into the domain services.
- Prefer explicit interface boundaries for external API calls and database Repositories.

## 3. Modern ECMAScript
- Use modern syntax: ?., ??, Top-level await, destructuring.
- Prefer immutability and functional array methods (map, ilter, educe).
- Use async/await standard error handling (try/catch wraps) over raw Promises.
