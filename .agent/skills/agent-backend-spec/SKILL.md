---
name: agent-backend-spec
description: >
  Deep backend engineering methodology for the backend-specialist agent.
  Contains constraint analysis framework, API decision matrix, error handling
  3-layer protocol, anti-patterns list, and RCA troubleshooting matrix.
---

# Backend Deep Methodology

## 🧠 DEEP BACKEND THINKING (MANDATORY — BEFORE ANY ARCHITECTURE)

**⛔ DO NOT start coding until you complete this internal analysis!**

### Step 1: Constraint & Traffic Analysis

Answer before writing a single endpoint:
- **Traffic Profile:** Read-heavy or Write-heavy?
- **Consistency vs Availability:** ACID (Transactions) or BASE (Availability)?
- **Data Freshness:** Real-time or is 500ms lag acceptable?
- **Dependency Map:** Which external services are we blocking on?

### Step 2: Mandatory Critical Questions for the User

**MUST ask these if unspecified:**
- "How many requests/second during peak?"
- "What is the acceptable latency (p99) for this endpoint?"
- "Does data need strict consistency across all regions?"
- "Optimize for cost (Serverless) or performance/latency (Dedicated)?"

---

## API Decision Matrix

| Protocol | When to Use |
|----------|-------------|
| **REST** | Public APIs, standard CRUD, broad compatibility |
| **gRPC** | Internal service-to-service (low overhead, strict typing) |
| **GraphQL** | Complex nested data where frontend drives shape |
| **tRPC** | TypeScript-only full-stack (end-to-end type safety) |

---

## Error Handling Protocol (THE 3-LAYER RULE)

1. **Entry Layer (Validator)** — Bad inputs immediately → Return 400
2. **Logic Layer (Controller)** — Business rule violations → Return 422
3. **Resource Layer (Service/Repo)** — DB/External errors → Return 500/503

---

## Anti-Patterns (STRICTLY FORBIDDEN)

1. **Silent Fail** — Catch an error and do nothing. Always log + propagate.
2. **God Service** — One folder handling Auth, Payments, and Profiles.
3. **DB-to-JSON Direct** — Returning raw DB records without a DTO layer.
4. **Hardcoded Secrets** — API keys in `config.js` instead of `.env`.
5. **N+1 Logic** — Running a DB query inside a `.map()` loop.
6. **Blocking Hero** — Long-running tasks inside request/response cycle.

---

## Troubleshooting & Root Cause Analysis (RCA)

### Investigation Protocol
1. **Verification:** Check HTTP Status → Stack Trace → p99 Latency
2. **Isolation:** Binary-search the middleware chain. Reproduce with exact payload.

### Common Fixes Matrix

| Symptom | Probable Cause | FIX |
|---------|----------------|-----|
| **Latency Spikes** | Suboptimal Query / No Index | `EXPLAIN ANALYZE` + Create Index |
| **Memory Leak** | Unclosed DB connections | `.finally(() => connection.close())` |
| **504 Gateway Timeout** | Busy Event Loop / slow external API | Move to Queue (BullMQ/RabbitMQ) |
| **Data Inconsistency** | Race condition / Missing Transaction | Row Level Locking or DB Transactions |

---

## Scale-Aware Strategy

| Scale | Backend Strategy |
|-------|-----------------|
| **Instant (MVP)** | **Monolith-First**: Simple REST. Shared state is OK for speed. |
| **Creative (R&D)** | **Experimental**: Test new runtimes (Bun/Deno/Rust). |
| **SME (Enterprise)** | **Robustness**: Microservices/Modular Monolith. Event-driven. 99.9% uptime. |
