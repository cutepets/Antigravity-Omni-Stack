---
name: domain-driven-hexagon
description: Domain-Driven Design (DDD) and Hexagonal Architecture boilerplate patterns for Node.js / TypeScript. Use when designing business modules, commands, queries, entities, or any aspect of a robust architecture.
---

# Domain-Driven Hexagon (Architecture Skill)

This skill encompasses best practices from the **Sairyss/domain-driven-hexagon** repository for Node.js/TypeScript. It combines Domain-Driven Design (DDD), Hexagonal (Ports and Adapters) Architecture, and CQRS.

## Core Layers
The architecture is structured across three main layers:

### 1. Domain Layer (Application Core)
Contains the enterprise-wide business rules and attributes.
- **Entities:** Always valid (protect their invariants). Compare identity via IDs, not properties. Don't use primitives (Primitive Obsession); use Value Objects for properties.
- **Aggregates:** A cluster of Entities/Value Objects treated as a single unit. Root gateway to the aggregate. Modifying Aggregates must be entirely transactional (all or nothing). Raise Domain Events.
- **Value Objects:** Immutable Objects lacking identity, compared by value (e.g., `Address`, `Email`). Use them instead of raw primitives.
- **Domain Events:** Raised when significant business events occur. Handled within the same transactional boundary using an Event Bus.
- **Domain Services:** Hold business logic that involves multiple Aggregates or doesn't belong to any single Entity.

### 2. Application Layer (Application Core)
Orchestrates use cases and domain workflows. It does NOT contain business logic.
- **Application Services / Use Cases:** Orchestrate Domain objects and infrastructure boundaries. Provide APIs for Interface Adapters.
- **CQRS:** 
  - **Commands:** Describe intents to modify states (`CreateUserCommand`). DO NOT return business data. Executed via Command Bus.
  - **Queries:** Retrieve data. Query Handlers can bypass the Domain and access the database directly for performance. Executed via Query Bus.
- **Ports (Interfaces):** Define contracts for external dependencies (e.g., Output Ports, Repository Interfaces, External services interfaces) using Dependency Inversion. Core logic must rely on Ports, not Adapters.

### 3. Interface & Infrastructure Layers (Outer Loop)
Translates outer communications to the core, and vice versa.
- **Interface Adapters (Controllers, Resolvers):** Receive external DTO requests, validate inputs, map to Commands/Queries.
- **Infrastructure (Adapters/Repositories):** Implementations of specific Ports. Connects to the Database (Prisma, TypeORM, Slonik, etc.), Message Brokers (RabbitMQ), or APIs.

## Key Principles & Best Practices
- **Make Illegal States Unrepresentable:** Ensure all data at runtime strictly conforms to valid Domain object models. Use type states and Value Objects validation.
- **Guarding vs Validation:**
  - *Validation* occurs at Interface Layers to check incoming DTO structure/types.
  - *Guarding* occurs in Domain objects to ensure invariants (Fail Fast on rule violations).
- **Errors as Results (Monads):** Use `Result<Success, DefaultError>` (like Either) instead of throwing `Exceptions`. Map errors explicitly at the Controller level (e.g. 409 Conflict).
- **Integration Events:** Trigger out-of-process communications AFTER the database transaction commits.

## Folder Structure Guideline (Vertical Slicing)
Group code by **Business Module / Bounded Context** rather than technical layers.
```
src/
  libs/                 (Shared Utils, Base Classes, Value Objects)
  modules/              (Bounded Contexts e.g., 'user', 'wallet')
    [module_name]/
      application/      (Event Handlers)
      commands/         (CQRS Commands, Use Cases grouped by feature folder)
      queries/          (CQRS Queries)
      database/         (Repositories, Mappers)
      domain/           (Entities, Value Objects, Domain Events, Invariants)
      dtos/             (Request/Response Types)
```

**When taking action inside projects:** 
ALWAYS follow these DDD guidelines when scaffolding new subdomains or migrating legacy architectures. Use `AggregateRoot.base.ts`, `Entity.base.ts`, `ValueObject.base.ts` implementations as a foundation.
