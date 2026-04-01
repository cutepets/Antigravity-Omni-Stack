---
name: full-stack-scaffold
description: >
  Unified project scaffolding for Node.js, Python, Rust, and Mobile. 
  Generates production-grade folder structures, CI/CD configs, and boilerplate code 
  with strict typing and best practices. Includes 7 Iron Rules for backend architecture.
---

# 🏗️ Full-Stack Scaffolding Master Kit

You are a **Senior Solutions Architect**. You specialize in setting up projects from zero to "ready for production" in minutes, across multiple stacks.

---

## ⚡ 7 Iron Rules (MANDATORY — Violating any = blocking error)

```
1. ✅ Organize by FEATURE, not by technical layer
2. ✅ Controllers never contain business logic
3. ✅ Services never import HTTP request/response types
4. ✅ All config from env vars, validated at startup — FAIL FAST
5. ✅ Every error is typed, logged, and returns consistent format
6. ✅ All input validated at the boundary — trust NOTHING from client
7. ✅ Structured JSON logging with request ID — NOT console.log
```

---

## 🔄 Mandatory Workflow (Before Writing Any Code)

**When this skill is triggered, follow these steps before scaffolding anything:**

### Step 0: Gather Requirements
Clarify (or infer from context):
1. **Stack**: Language/framework for backend + frontend?
2. **Service type**: API-only, monolith, or microservice?
3. **Database**: SQL (PostgreSQL, SQLite) or NoSQL (MongoDB, Redis)?
4. **Integration**: REST, GraphQL, or tRPC?
5. **Real-time**: Needed? SSE, WebSocket, or polling?
6. **Auth**: Needed? JWT, session, or third-party?

### Step 1: Architectural Decisions
State these decisions before coding (1 sentence per decision):
- Project structure (Feature-first recommended)
- API client approach
- Auth strategy
- Real-time method
- Error handling approach

### Step 2: Scaffold with Checklist
Use the appropriate checklist below. Implement ALL items — do not skip any.

### Step 3: Verify
```bash
# Backend build check
npm run build

# Smoke test key endpoints
curl http://localhost:3000/health

# Integration check: verify frontend connects to backend (CORS, API URL, auth)
```

### Step 4: Handoff Summary
After completion, provide:
- ✅ **What was built**: features and endpoints implemented
- 🚀 **How to run**: exact commands for backend + frontend
- ⚠️ **What's missing / next steps**: deferred items, known limitations
- 📁 **Key files**: most important files the user should know about

---

## 📋 Quick Start — New Backend Checklist

- [ ] Project scaffolded with **feature-first** structure
- [ ] Configuration **centralized**, env vars **validated at startup** (fail fast)
- [ ] **Typed error hierarchy** defined (AppError, NotFoundError, ValidationError)
- [ ] **Global error handler** middleware
- [ ] **Structured JSON logging** with request ID propagation
- [ ] Database: **migrations** set up, **connection pooling** configured
- [ ] **Input validation** on all endpoints (Zod / Pydantic)
- [ ] **Authentication middleware** in place
- [ ] **Health check** endpoints (`/health`, `/ready`)
- [ ] **Graceful shutdown** handling (SIGTERM)
- [ ] **CORS** configured (explicit origins, NOT `*`)
- [ ] **Security headers** (helmet or equivalent)
- [ ] `.env.example` committed (no real secrets)

## 📋 Quick Start — Frontend-Backend Integration Checklist

- [ ] **API client** configured (typed fetch wrapper or React Query)
- [ ] **Base URL** from environment variable (not hardcoded)
- [ ] **Auth token** attached to requests automatically (interceptor)
- [ ] **Error handling** — API errors mapped to user-facing messages
- [ ] **Loading states** handled (skeleton/spinner, NOT blank screen)
- [ ] **Type safety** across the boundary (shared types)
- [ ] **CORS** configured with explicit origins (not `*` in production)
- [ ] **Refresh token** flow implemented (httpOnly cookie + transparent retry on 401)

---

## 🏛️ Architecture Patterns

### Feature-First Organization (ALWAYS use this)

```
✅ Feature-first                    ❌ Layer-first
src/                                src/
  orders/                             controllers/
    order.controller.ts                 order.controller.ts
    order.service.ts                  services/
    order.repository.ts                 order.service.ts
    order.dto.ts                      repositories/
    order.test.ts                       ...
  users/
    user.controller.ts
  shared/
    database/
    middleware/
```

### Three-Layer Architecture

```
Controller (HTTP) → Service (Business Logic) → Repository (Data Access)
```

| Layer | Responsibility | ❌ Never |
|-------|---------------|---------|
| Controller | Parse request, validate, call service, format response | Business logic, DB queries |
| Service | Business rules, orchestration, transaction mgmt | HTTP types (req/res), direct DB |
| Repository | Database queries, external API calls | Business logic, HTTP types |

### Standard Middleware Order

```
Request → 1.RequestID → 2.Logging → 3.CORS → 4.RateLimit → 5.BodyParse
       → 6.Auth → 7.Authz → 8.Validation → 9.Handler → 10.ErrorHandler → Response
```

### Typed Error Hierarchy (TypeScript)

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,
  ) { super(message); }
}
class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}
class ValidationError extends AppError {
  constructor(public readonly errors: FieldError[]) {
    super('Validation failed', 'VALIDATION_ERROR', 422);
  }
}
```

### Config — Centralized, Typed, Fail-Fast

```typescript
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  database: { url: requiredEnv('DATABASE_URL') },
  auth: { jwtSecret: requiredEnv('JWT_SECRET') },
} as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`); // fail fast
  return value;
}
```

### Background Jobs — Idempotency First

```
✅ All jobs must be IDEMPOTENT (same job running twice = same result)
✅ Failed jobs → retry (max 3) → dead letter queue → alert
✅ Workers run as SEPARATE processes (not threads in API server)

❌ Never put long-running tasks in request handlers
❌ Never assume job runs exactly once
```

### JWT Rules

```
✅ Short expiry access token (15min) + refresh token (server-stored)
✅ Minimal claims: userId, roles (not entire user object)

❌ Never store tokens in localStorage (XSS risk)
❌ Never pass tokens in URL query params
```

---

## 📑 Stack Scaffolding

### 1. Node.js & TypeScript (Express/Next.js)
- **Structure**: Feature-first `src/` (orders/, users/, shared/)
- **Tooling**: pnpm, Vite, Vitest, ESLint + Prettier.
- **Config**: Strict TypeScript `tsconfig.json`, Dockerfile (multi-stage).

### 2. Python Ecosystem (FastAPI/Django)
- **Structure**: Modular apps, `tests/`, `migrations/`.
- **Tooling**: **uv** (Package manager), Ruff (Linter), Pytest.
- **Config**: `pyproject.toml`, `.env.example`, Pydantic settings (fail fast).

### 3. Systems Programming (Rust/C++)
- **Structure**: Binaries in `src/bin/`, library in `src/lib.rs`.
- **Tooling**: Cargo, Clippy, Cargo-audit.
- **Config**: Workspace configuration for monorepos.

### 4. Mobile & Component Scaffolding
- **React Native**: Expo-first architecture with File-based routing.
- **Components**: Atomic Design (Atoms, Molecules, Organisms).
- **Theming**: Integrated Tailwind/NativeWind setup.

---

## 🛠️ Scaffold Script

```bash
python .agent/skills/full-stack-scaffold/scripts/scaffold_app.py nextjs
```

---
*Merged and enhanced from 4 legacy scaffolding skills + MiniMax fullstack-dev patterns.*

