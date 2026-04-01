---
name: moleculer-patterns
description: >
  Microservices design patterns từ Moleculer framework (moleculerjs/moleculer).
  Dùng khi thiết kế service architecture, implement fault tolerance, event-driven
  communication, hoặc cần reference production-grade Node.js patterns.
  📚 REFERENCE ONLY — dự án dùng NestJS. Học patterns từ đây và áp dụng vào NestJS,
  không dùng Moleculer trực tiếp. Invoke explicitly khi cần pattern reference.
---

# Moleculer Patterns — Production Microservices Reference

> **Source:** [moleculerjs/moleculer](https://github.com/moleculerjs/moleculer) — battle-tested từ 2016, ~6k stars.

Skill này không yêu cầu dùng Moleculer. Mục đích là **học patterns** và áp dụng vào bất kỳ stack nào (NestJS, Express, Fastify...).

> **⛔ Khi nào KHÔNG áp dụng skill này:**
> - App monolith đơn giản, không có external service dependencies
> - Team < 3 người hoặc project MVP giai đoạn đầu
> - Service không có inter-service communication
> - Đừng over-engineer — chỉ áp dụng từng pattern khi thực sự có pain point cụ thể
>
> **✅ Khi nào nên áp dụng:**
> - Thiết kế service mới có gọi external API / DB / queue
> - Cần fault tolerance (retry, timeout, circuit breaker)
> - Cần distributed tracing / structured logging xuyên suốt request chain
> - Refactor từ tight-coupling sang event-driven

---

## 🧠 Pattern 1: Service Broker (Message Bus)

**Vấn đề:** Services gọi nhau trực tiếp → tight coupling, khó test, khó scale.

**Giải pháp Moleculer:**
```js
// Thay vì: orderService.callInventory(data)
// Dùng:
broker.call("inventory.update", { orderId, items });
```

**Áp dụng vào NestJS:**
```ts
// Thay direct import, dùng EventEmitter hoặc message queue
@Injectable()
export class OrderService {
  constructor(private eventEmitter: EventEmitter2) {}

  async completeOrder(orderId: string) {
    await this.updateOrder(orderId, "COMPLETED");
    // Không gọi InventoryService trực tiếp
    this.eventEmitter.emit("order.completed", { orderId });
  }
}

// Inventory tự listen
@OnEvent("order.completed")
async handleOrderCompleted(payload: { orderId: string }) { ... }
```

**Khi nào dùng:** Khi 2 services cần communicate nhưng không nên biết nhau (orders → inventory, orders → notifications).

---

## 🔌 Pattern 2: Pluggable Architecture (Strategy Pattern)

**Bài học từ cấu trúc Moleculer:**
```
src/cachers/    → base-cacher.js + memory.js + redis.js
src/loggers/    → base.js + console.js + winston.js + pino.js
src/transporters/ → base.js + tcp.js + nats.js + kafka.js
```

Mỗi subsystem: **1 interface cố định + N implementations**.

**Áp dụng:**
```ts
// base interface
interface NotificationProvider {
  send(to: string, message: string): Promise<void>;
}

// implementations
class EmailProvider implements NotificationProvider { ... }
class SmsProvider implements NotificationProvider { ... }
class PushProvider implements NotificationProvider { ... }

// service chỉ biết interface, không biết implementation
@Injectable()
class NotificationService {
  constructor(
    @Inject("NOTIFICATION_PROVIDER")
    private provider: NotificationProvider
  ) {}
}
```

**Khi nào dùng:** Bất kỳ chỗ nào có thể cần swap: payment gateway, storage, notification provider, cache backend.

---

## 🛡️ Pattern 3: Fault Tolerance (Resilience Patterns)

Moleculer build sẵn 5 patterns:

### Circuit Breaker
```ts
// Nếu service fail > threshold, tự ngắt request (không chờ timeout)
// Sau cooldown period, thử lại 1 request — nếu OK thì mở lại
@Injectable()
class ExternalApiService {
  private failCount = 0;
  private circuitOpen = false;

  async call(endpoint: string) {
    if (this.circuitOpen) throw new ServiceUnavailableException("Circuit open");
    try {
      const result = await this.http.get(endpoint);
      this.failCount = 0;
      return result;
    } catch (err) {
      this.failCount++;
      if (this.failCount > 5) this.circuitOpen = true;
      throw err;
    }
  }
}
```

### Retry với Exponential Backoff
```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 500
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(baseDelay * 2 ** i); // 500ms → 1s → 2s
    }
  }
}
```

### Timeout
```ts
// Trong NestJS với HttpService
this.httpService.get(url, { timeout: 3000 })

// Hoặc manual
const result = await Promise.race([
  this.someService.slowOperation(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 3000)
  )
]);
```

**Khi nào dùng:** Mọi lúc gọi external API, database (slow queries), hoặc inter-service calls.

---

## 📡 Pattern 4: Context Propagation (Request Tracing)

**Bài học từ `src/context.js` và `src/async-storage.js`:**

Mỗi request trong Moleculer mang theo `ctx` object với `requestID`, `meta`, `span` — truyền tự động qua toàn bộ call chain.

**Áp dụng với AsyncLocalStorage trong NestJS:**
```ts
// request-context.middleware.ts
import { AsyncLocalStorage } from "async_hooks";

const requestContext = new AsyncLocalStorage<{ requestId: string; userId?: string }>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers["x-request-id"] as string || crypto.randomUUID();
    res.setHeader("x-request-id", requestId);
    requestContext.run({ requestId }, next);
  }
}

// Dùng ở bất kỳ đâu trong app, không cần pass param
export const getRequestId = () => requestContext.getStore()?.requestId;

// Trong logger
this.logger.log({ requestId: getRequestId(), message: "Processing order" });
```

**Khi nào dùng:** Luôn — đặc biệt khi cần trace log xuyên suốt nhiều services/functions.

---

## 📊 Pattern 5: Observability (Logs + Metrics + Traces)

Moleculer ship cả 3 từ core. Học cách tổ chức:

```
src/loggers/    → Structured logging
src/metrics/    → Business & system metrics
src/tracing/    → Distributed tracing
```

**Áp dụng — Structured Logging với Pino:**
```ts
// Không dùng console.log
// Dùng structured log với context
this.logger.log({
  level: "info",
  event: "order.completed",
  orderId,
  customerId,
  totalAmount,
  durationMs: Date.now() - startTime,
  requestId: getRequestId()
});
```

**3 pillars cần implement:**
| Pillar | Tool | Prioritize |
|--------|------|-----------|
| Logs | Pino (structured JSON) | Ngay bây giờ |
| Metrics | Prometheus counter/histogram | Phase 2 |
| Traces | OpenTelemetry + Jaeger | Phase 3 |

---

## 🗂️ Pattern 6: Centralized Error Hierarchy

**Bài học từ `src/errors.js`:**

Moleculer định nghĩa error tree theo domain, mỗi error có `code`, `type`, `data`:

```
MoleculerError
├── MoleculerRetryableError
├── ServiceNotFoundError
├── ValidationError
├── ServiceUnavailableError
└── RequestTimeoutError
```

**Áp dụng trong NestJS:**
```ts
// src/common/errors/index.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly data?: Record<string, unknown>
  ) {
    super(message);
  }
}

export class OrderError extends AppError {
  static notFound(orderId: string) {
    return new OrderError("ORDER_NOT_FOUND", `Order ${orderId} not found`, { orderId });
  }
  static alreadyPaid(orderId: string) {
    return new OrderError("ORDER_ALREADY_PAID", `Order ${orderId} is already paid`, { orderId });
  }
}

export class InventoryError extends AppError {
  static insufficientStock(productId: string, requested: number, available: number) {
    return new InventoryError("INSUFFICIENT_STOCK", "Not enough stock", {
      productId, requested, available
    });
  }
}
```

**Khi nào dùng:** Bất kỳ khi nào có thể throw error — thay `throw new Error("something wrong")` bằng typed errors.

> **⚠️ Reconciliation với `nestjs-clean-arch` skill:**
> Skill `nestjs-clean-arch` hướng dẫn `throw new NotFoundException()` trực tiếp trong service.
> Đây là shortcut ổn cho project đơn giản. Khi dùng pattern này:
> - ✅ **Service nhỏ / CRUD đơn giản**: throw `HttpException` trực tiếp — OK
> - ✅ **Domain phức tạp / nhiều error types**: throw `AppError` (domain) → ExceptionFilter map sang HTTP
> - ❌ **Không trộn lẫn**: chọn 1 cách và nhất quán trong toàn project

---

## 🏗️ Pattern 7: Service Mixin (Composition over Inheritance)

**Bài học:** Moleculer dùng mixin để reuse service behaviors.

**Áp dụng — Composable NestJS behaviors:**
```ts
// Thay vì: class OrderService extends BaseService
// Dùng: compose với mixins/interfaces

// timestampable.mixin.ts
export function withTimestamps<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base {
    createdAt = new Date();
    updatedAt = new Date();
    touch() { this.updatedAt = new Date(); }
  };
}

// softDeletable.mixin.ts  
export function withSoftDelete<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base {
    deletedAt: Date | null = null;
    softDelete() { this.deletedAt = new Date(); }
    isDeleted() { return this.deletedAt !== null; }
  };
}
```

---

## 📋 Checklist — Áp Dụng Vào Project

### Khi thiết kế service mới:
```
□ Services communicate qua events (emit/listen), không gọi nhau trực tiếp?
□ External calls có Circuit Breaker / Retry?
□ Mọi operation có timeout?
□ Errors là typed (domain errors), không phải generic Error?
□ Logs là structured JSON với requestId?
□ Business logic có thể hoán đổi implementation (payment, notification)?
```

### Khi debug production:
```
□ requestId có mặt trong tất cả logs liên quan?
□ Error message có đủ context (orderId, userId, data)?
□ Timing info (durationMs) có trong logs?
□ Circuit breaker có đang open không?
```

---

## 🎯 Quick Reference — Map Moleculer → NestJS

| Moleculer Concept | NestJS Equivalent |
|---|---|
| `ServiceBroker` | `EventEmitter2` / BullMQ |
| `broker.call()` | `eventEmitter.emit()` |
| `ctx.requestID` | `AsyncLocalStorage` |
| `ctx.meta` | Request-scoped context |
| Circuit Breaker | `@nestjs/circuit-breaker` / manual |
| Middleware | `NestMiddleware` / Interceptor |
| Mixin | Composition / Mixin pattern |
| Cacher | `@nestjs/cache-manager` |
| Transporter | BullMQ / RabbitMQ |

---

## 🔗 Related Skills

| Skill | Liên quan |
|---|---|
| `nestjs-clean-arch` | Implement patterns này vào NestJS modules/services |
| `fastify-patterns` | Hook system tương tự Moleculer middleware |
| `medusa-commerce` | Subscriber pattern tương đương event-driven ở đây; Workflow engine = distributed saga |
| `performance-engineer` | OpenTelemetry cho Pattern 5 (Observability) |
| `incident-responder` | Circuit Breaker + structured logging (Pattern 3 + 5) trong production incidents |

---

## 📚 Tài Liệu Gốc

- **Repo:** https://github.com/moleculerjs/moleculer
- **Docs:** https://moleculer.services/docs
- **Key files để đọc:**
  - `src/service-broker.js` — Core broker logic
  - `src/context.js` — Request context + tracing
  - `src/errors.js` — Error hierarchy pattern
  - `src/middleware.js` — Hook system
  - `src/middlewares/` — Circuit breaker, bulkhead, timeout implementations
