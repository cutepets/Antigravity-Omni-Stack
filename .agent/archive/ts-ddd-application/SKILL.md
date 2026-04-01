---
name: ts-ddd-application
description: >
  TypeScript DDD (Domain-Driven Design) patterns - Application Layer.
  Tập trung vào CQRS, Event-Driven Architecture (EDA), Use Cases,
  Commands/Queries, và Domain Policy Patterns.
trigger:
  - thiết kế CQRS, command bus, query bus
  - orchestration use cases, application service
  - thiết lập policy pattern
---

# TypeScript DDD — Application Layer

Application layer đóng vai trò điều phối (orchestration) giữa Infrastructure (API, CLI, Controller) và Domain layer.

## ⚙️ CQRS Pattern

### Command & CommandHandler
Mô hình yêu cầu thực thi có thay đổi State. Command chỉ mang tính chất Data bag.
```typescript
export class CreateCourseCommand extends Command {
  constructor(public id: string, public name: string) { super(); }
}

export class CreateCourseCommandHandler implements CommandHandler<CreateCourseCommand> {
  constructor(private courseCreator: CourseCreator) {}
  subscribedTo() { return CreateCourseCommand; }
  async handle(command: CreateCourseCommand) {
    const id = new CourseId(command.id);
    const name = new CourseName(command.name);
    await this.courseCreator.run(id, name);
  }
}
```

### Query & QueryHandler
Trả về dữ liệu và **không sửa đổi DB (Read-only)**. Query handler có thể bỏ qua Domain Object và gọi thẳng DTO từ CSDL (tối ưu hiệu năng).

## 🔀 Application Service (Use Cases)

Điều phối giữa Repository và Domain Model:
1. Nhận Primitive Data -> VO
2. Lấy thông tin từ Repo
3. Gọi method của Entity
4. Repo Save Entity
5. Emit Domain Events

```typescript
export class CourseCreator {
  constructor(private repo: CourseRepository, private eventBus: EventBus) {}
  async run(id: CourseId, name: CourseName) {
    const course = Course.create(id, name);
    await this.repo.save(course);
    await this.eventBus.publish(course.pullDomainEvents());
  }
}
```

## 🛡️ Errors: Return thay vì Throw (Result Pattern)

Tránh dùng `throw Exception` cho Business errors. Dùng Result Pattern:
```typescript
import { Ok, Err, Result } from 'oxide.ts';

async execute(): Promise<Result<string, CreateUserError>> {
  if (await this.repo.exists()) {
    return Err(new UserAlreadyExistsError()); // <-- Tường minh
  }
  return Ok(userId);
}
```

## 🎯 Policy Pattern (Alternative cho if/else)
Extract business rules lớn thành functions.
```typescript
type PlacingOnHoldPolicy = (book: Book, patron: Patron) => Either<Rejection, Allowance>;
const onlyResearcherCanHoldRestricted: PlacingOnHoldPolicy = (book, patron) => {
  if (book.isRestricted && patron.isRegular()) return left(Rejection('Err'));
  return right(new Allowance());
};
```
