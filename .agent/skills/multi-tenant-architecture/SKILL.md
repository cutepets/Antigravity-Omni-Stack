---
name: multi-tenant-architecture
description: Multi-tenant architecture design patterns including Row-Level Security, Database-per-tenant, schema-per-tenant, and data isolation strategies for SaaS applications.
---

# Multi-Tenant Architecture

## Core Principles
1. **Data Isolation**: Never allow tenant data leakage. Use Row-Level Security (RLS) in PostgreSQL or append `tenant_id` to every query explicitly.
2. **Resource Scaling**: Decide between Shared Database/Shared Schema, Shared Database/Isolated Schema, or Isolated Database based on compliance and scale needs.
3. **Cross-Tenant Prevention**: Enforce middleware guards that extract tenant context from the request (e.g., JWT token `shop_id`) and inject it into the ORM context.

## Best Practices
- Every core entity must have a `shop_id` or `tenant_id` field unless it is a global configuration.
- Unique constraints should scope by `tenant_id` (e.g., `UNIQUE(tenant_id, product_sku)`).
- Provide centralized query wrappers to automatically apply tenant scopes to prevent developers from forgetting the `WHERE tenant_id = ?` clause.
