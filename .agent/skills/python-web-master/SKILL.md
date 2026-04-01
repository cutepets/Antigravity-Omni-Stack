---
description: Unified Django & FastAPI master skill
---

# Python Web Master
This file distills the best practices for building Python web applications (Django, FastAPI), kept intentionally concise to prevent bloat.

## 1. Fast & Scalable Architecture
- **FastAPI**: Use for high-performance, async-first microservices or purely logic/AI-driven APIs. Rely heavily on Pydantic validation.
- **Django**: Use for monolithic, content-heavy, or standard web applications to leverage its built-in admin, ORM, and auth.

## 2. API Design
- Always use API routing prefix (e.g., /api/v1/).
- Enforce strict typing (def get_users(limit: int) -> list[User]:).
- Follow REST standards for nouns and HTTP methods.

## 3. Database & Security
- Keep business logic in services or domain layer, NOT in routers/views.
- Enforce CSRF, CORS, and strong parameter validation universally.
- Follow "Fat Models, Skinny Views" concept for Django if using Active Record.
