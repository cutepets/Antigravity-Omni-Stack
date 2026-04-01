---
name: nestjs
description: Architecture patterns, REST API design, Dependency Injection, and Module orchestration for NestJS. Use when designing business modules or backend core structures that require progressive Node.js framework standards.
---

# NestJS + DDD Hexagon Integration Skill

This skill encompasses best practices for building scalable backend systems using the **NestJS** framework, specifically tailored to align with the **Domain-Driven Hexagon** architecture skill.

## Core Framework Principles

### 1. Module Architecture (Feature-Scoped)
NestJS uses Modules (`@Module()`) to organize code.
- **Vertical Slicing:** Group components by feature/Bounded Context (e.g., `UserModule`, `WalletModule`), not by technical layer (e.g., don't create a global `ControllersModule`).
- **Encapsulation:** Ensure that a module only exports what is strictly necessary (e.g., Services that act as Use Cases). Don't export Controllers.
- **Shared Modules:** Use a `DatabaseModule` or `CoreModule` to provide shared infrastructure like Prisma/TypeORM or external API clients.

### 2. Dependency Injection & Providers
Everything from Repositories to Use Cases should be registered as Providers (`@Injectable()`).
- **Ports & Adapters Binding:** In Hexagonal Architecture, Use Cases depend on Interfaces (Ports). In NestJS, you must implement inversion of control by injecting the Port using a custom token:
  ```typescript
  @Inject('IUserRepository') private readonly userRepository: IUserRepository
  ```
- **Custom Providers:** Bind the interface token to its concrete adapter implementation explicitly inside the Module's `providers` array.
  ```typescript
  providers: [{ provide: 'IUserRepository', useClass: PostgresUserRepository }]
  ```

### 3. Interface Adapters (Controllers & Resolvers)
Controllers (`@Controller()`) map HTTP requests to CQRS Commands or Queries.
- **Thin Controllers:** Controllers must NOT contain business logic. Their sole responsibility is parsing the request, passing it to the Command/Query Bus, and formatting the response.
- **Data Transfer Objects (DTO):** Define explicit DTOs for `Request` and `Response`.
- **Validation:** Use `class-validator` and `class-transformer` decorators heavily on Request DTOs.
- **Global Pipes:** Enable `ValidationPipe` globally with `whitelist: true` and `transform: true` to strip malicious input and automatically cast DTOs.

### 4. Exception Handling (The Result Monad Bridge)
Instead of Controllers aggressively checking for errors, let the domain return explicit Error Types (Monads).
- If using `Result<Success, DomainError>`, map these DomainErrors into HTTP Exceptions (`BadRequestException`, `ConflictException`) right inside the Controller block, OR use an `@Catch(DomainError)` Exception Filter to globally translate them to HTTP responses.

### 5. CQRS Integration
Use the `@nestjs/cqrs` module to decouple Use Cases from the entry point.
- **Command Bus:** Execute commands that mutate state. Create `@CommandHandler()` classes for business rules.
- **Query Bus:** Execute queries for data fetching. Create `QueryHandler()` classes that can bypass the Domain and access Repositories/DB directly.

**When generating NestJS code:**
Always adhere to these guidelines. Wrap your implementations in `@Injectable()`, declare explicit DTO boundaries, and leverage NestJS IOC to satisfy Hexagonal dependency rules.
