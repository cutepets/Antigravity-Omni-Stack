---
name: ts-ddd-infrastructure
description: >
  TypeScript DDD (Domain-Driven Design) patterns - Infrastructure Layer.
  Tập trung vào Repositories implementation, Mapper (Domain ↔ Persistence),
  Integration Events, Transaction Outbox, và CQRS Repository Split.
trigger:
  - implement CQRS repository, outbox pattern
  - thiết kế persistence model, mapper, Sequelize/Prisma
  - thiết lập Unit of Work, Nested Transactions
---

# TypeScript DDD — Infrastructure Layer

Nằm ở biên ngoài của hệ thống (Hexagonal architecture). Tương tác trực tiếp với Database, Message Broker, và API bên ngoài.

## 🗃️ Persistence Model Separation
Mô hình cấu trúc bảng CSDL thường không trùng với Domain Entity. Cần dùng **Mapper** để convert hai chiều:

```typescript
export class UserMapper {
  static toPersistence(entity: UserEntity): UserModel {
    return {
      id: entity.id.value,
      email: entity.email.value,
      country: entity.address.country, // nested Object -> Flattening DB
    }
  }

  static toDomain(record: UserModel): UserEntity {
    return UserEntity.reconstitute({
      id: new UserId(record.id),
      email: new UserEmail(record.email)
    })
  }
}
```

## 📂 CQRS Repository Split

Tách hệ thống ghi/đọc (Read Repo vs Write Repo):
1. **BaseReadRepository**: Dùng eager loading, joins, view projections, trả thẳng về Model hoặc DTO nguyên thủy. Không đụng tới Domain entity để lấy hiệu năng.
2. **BaseWriteRepository**: Dùng transaction lock, sau đó chuyển (map) về `AggregateRoot`. Gọi `.toPersistence` khi persist.

## 🔄 Nested Transaction Propagation
Hỗ trợ Dependency Injection của Database Transactions (T) đi xuyên Use-case mà không cần global context. Cấu trúc `beginTransaction(parentT)`:
1. Nếu usecase nhận Argument Transaction -> Dùng nó tiếp. (Atomicity).
2. Nếu không -> Tạo mới. (Rollback trên top-level try-catch block).

## 🚀 Integration Events & Outbox Pattern
Domain Events là đồng bộ nội vi (Process/Context cục bộ), Integration events dùng để ném ra ngoài ranh giới cho Async services (RabbitMQ/Kafka).
Dùng pattern:
1. Ghi Aggregate Entity vào DB.
2. Đồng thời lưu List `IntegrationEvents` vào 1 bảng `Outbox` cùng `Db Transaction`.
3. 1 cronjob riêng ở infra layer chạy ngầm, scan hàng chờ Outbox để publish lên Queue (đảm bảo *Eventual Consistency* - At-Least-Once Delivery).
