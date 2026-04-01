---
name: ts-ddd-domain
description: >
  TypeScript DDD (Domain-Driven Design) patterns - Core Domain Layer.
  Tập trung vào Value Objects, Entities, Aggregate Roots, và Domain Events.
trigger:
  - khi thiết kế domain model, aggregate root, entity
  - khi nhắc đến value object, invariant
  - khi tạo domain event
---

# TypeScript DDD — Core Domain Layer

Domain layer hoàn toàn độc lập, không phụ thuộc framework hay cơ sở dữ liệu.

## 🧱 Shared Domain Primitives

### ValueObject
- Dùng cho các thành phần có thuộc tính thay đổi theo giá trị (vd: Email, Name).
- Bao hàm Guard clauses (vd: `email must contain @`). Không bao giờ có entity ở trạng thái lỗi.

```typescript
export abstract class ValueObject<T> {
  readonly value: T;
  constructor(value: T) {
    this.value = value;
    this.ensureValueIsDefined(value);
  }
}
export class CourseName extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    if (value.length > 30) throw new Error('Too long');
  }
}
```

### AggregateRoot
- Điểm vào (entry point) của mọi thao tác trên Domain. Chứa các Entities và Value Objects.
- Phát ra Domain Event thông qua method `record(event)`.

```typescript
export abstract class AggregateRoot {
  private domainEvents: Array<DomainEvent> = [];
  pullDomainEvents(): Array<DomainEvent> {
    const events = this.domainEvents.slice();
    this.domainEvents = [];
    return events;
  }
  record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
}
```

### Domain Event
- Sự kiện nội bộ xảy ra ngay khi aggregate thay đổi trạng thái.

```typescript
export class CourseCreatedDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'course.created';
  constructor(params: { aggregateId: string; name: string }) {
    super({ eventName: CourseCreatedDomainEvent.EVENT_NAME, ...params });
  }
}
```

## 📜 Quy tắc thiết kế Domain
1. **Tinh khiết (Pure)**: Không `@Injectable()`, không dùng package framework, không biết DB.
2. **Luôn Hợp lệ (Always Valid)**: Dữ liệu truyền vào VO phải bị chặn ngay tại block constructor nếu sai.
3. **Event-First Pattern**: Aggregate có thể trả về Event thay vì trực tiếp thực thi (return events thay vì void).
