# 🐾 Petshop Management V2 — Kế hoạch Hoàn thiện

> **Version:** 1.0 · **Cập nhật:** 2026-04-03  
> **Stack:** Turborepo · pnpm · Next.js 14 App Router · NestJS · Prisma · PostgreSQL · BullMQ  
> **Mục tiêu:** Production-ready cho 1 cửa hàng, sẵn sàng scale multi-branch

---

## 📊 Trạng thái Hiện tại (Baseline)

| Hạng mục | Tình trạng |
|----------|-----------|
| Kiến trúc Monorepo (Turborepo) | ✅ Hoàn thành |
| DB Schema (Prisma, 24 models) | ✅ Hoàn thành |
| Auth (JWT + RBAC) | ✅ Hoàn thành |
| POS — Multi-tab, Multi-payment | ✅ Hoàn thành |
| CRM — Khách hàng, Thú cưng | ✅ Hoàn thành |
| Grooming Module | ✅ Hoàn thành |
| Hotel Module | ✅ Hoàn thành |
| Kho hàng cơ bản | ✅ Hoàn thành |
| Nhân sự (Staff + CRUD) | ✅ Hoàn thành |
| Báo cáo Dashboard KPI | ✅ Hoàn thành |
| **Backend — Inventory/Stock/Reports/Settings** | ⚠️ Controller thiếu |
| **Frontend — Inventory, Finance, Settings pages** | ❌ Chưa có |
| **E2E Integration (FE ↔ BE)** | ⚠️ Một phần |
| **Chi nhánh (Multi-branch)** | ❌ Chưa có |
| **Realtime (Socket.io)** | ❌ Chưa kết nối FE |
| **Testing (Unit + E2E)** | ❌ Chưa có |
| **Production Deploy** | ❌ Chưa có |

---

## 🗺️ ROADMAP — 4 Giai Đoạn

```
Phase 1 (Tuần 1-2): API Backend hoàn chỉnh
Phase 2 (Tuần 3-4): Frontend hoàn thiện tất cả pages
Phase 3 (Tuần 5-6): Integration + Realtime + Testing
Phase 4 (Tuần 7-8): Production hardening + Deploy
```

---

## Phase 1 — Backend API hoàn chỉnh 🔧

> **Owner:** Backend Team  
> **Deadline:** Tuần 1-2  
> **Mục tiêu:** Tất cả API endpoints theo spec `docs/architecture/NEXTJS_MIGRATION.md` phải hoạt động 100%

### 1.1 Các Module Backend còn thiếu

| Module | Files cần tạo | API Endpoints |
|--------|--------------|--------------|
| **Inventory** | `inventory.module.ts`, `inventory.controller.ts`, `inventory.service.ts` | Products CRUD, Services CRUD, Variants batch |
| **Stock / Kho** | `stock.module.ts`, `stock.controller.ts`, `stock.service.ts` | Receipts, Suppliers, Transactions, Suggestions |
| **Reports** | `reports.module.ts`, `reports.controller.ts`, `reports.service.ts` | Dashboard KPI, Revenue chart, Top customers/products |
| **Finance** | (merge vào reports module) | Transactions (Sổ quỹ) CRUD |
| **Settings** | `settings.module.ts`, `settings.controller.ts`, `settings.service.ts` | Branches, Configs, Upload image |
| **Activity Logs** | `activity-log.module.ts` | Danh sách logs, stats |
| **Customer Groups** | (merge vào customer module) | CRUD customer groups |
| **Roles** | (merge vào staff module) | CRUD custom roles + permissions |
| **Shifts** | (merge vào staff module) | Open/close ca, summary |

### 1.2 Checklist API cần hoàn thiện

**Inventory:**
```
[ ] GET  /inventory/products          (+ lowStock filter)
[ ] POST /inventory/products
[ ] GET  /inventory/products/:id      (kèm variants[])
[ ] PUT  /inventory/products/:id
[ ] DELETE /inventory/products/:id
[ ] POST /inventory/products/:id/variants/batch
[ ] PUT  /inventory/products/variants/:vid
[ ] DELETE /inventory/products/variants/:vid
[ ] GET  /inventory/services
[ ] POST /inventory/services
[ ] GET  /inventory/services/:id
[ ] PUT  /inventory/services/:id
[ ] DELETE /inventory/services/:id
[ ] POST /inventory/services/:id/variants/batch
```

**Stock:**
```
[ ] GET  /stock/receipts
[ ] POST /stock/receipts
[ ] GET  /stock/receipts/:id
[ ] PUT  /stock/receipts/:id         (DRAFT only)
[ ] PATCH /stock/receipts/:id/pay
[ ] PATCH /stock/receipts/:id/cancel
[ ] PATCH /stock/receipts/:id/receive (tăng stock)
[ ] POST /stock/receipts/:id/returns
[ ] GET  /stock/transactions/:productId
[ ] GET  /stock/suggestions          (lowStock products)
[ ] GET  /stock/suppliers
[ ] POST /stock/suppliers
[ ] GET  /stock/suppliers/:id
[ ] PUT  /stock/suppliers/:id
```

**Reports & Finance:**
```
[ ] GET  /reports/dashboard
[ ] GET  /reports/revenue-chart      (?days=7|30|90)
[ ] GET  /reports/top-customers
[ ] GET  /reports/top-products
[ ] GET  /reports/transactions        (Sổ quỹ — INCOME/EXPENSE)
[ ] POST /reports/transactions
[ ] GET  /reports/transactions/:voucherNumber
```

**Settings:**
```
[ ] GET  /settings/configs
[ ] PUT  /settings/configs
[ ] GET  /settings/branches
[ ] POST /settings/branches
[ ] PUT  /settings/branches/:id
[ ] DELETE /settings/branches/:id
[ ] POST /upload/image               (multipart, max 50MB)
[ ] GET  /customer-groups
[ ] POST /customer-groups
[ ] PUT  /customer-groups/:id
[ ] DELETE /customer-groups/:id
[ ] GET  /activity-logs
[ ] GET  /activity-logs/stats
```

**Staff extras:**
```
[ ] GET  /users/:id/stats
[ ] GET  /users/:id/changelog
[ ] POST /users/:id/documents
[ ] DELETE /users/:id/documents/:docId
[ ] GET  /roles
[ ] POST /roles
[ ] PUT  /roles/:id
[ ] DELETE /roles/:id
[ ] GET  /shifts
[ ] GET  /shifts/current
[ ] POST /shifts/start
[ ] GET  /shifts/:id/summary
[ ] POST /shifts/:id/end
```

**Customers extras:**
```
[x] Removed customer import/export endpoints from product scope.
```

**Pets extras:**
```
[ ] GET  /pets/:id/service-history
```

---

## Phase 2 — Frontend hoàn thiện 🎨

> **Owner:** Frontend Team  
> **Deadline:** Tuần 3-4  
> **Mục tiêu:** Tất cả pages hoạt động đầy đủ, UI tiếng Việt, responsive

### 2.1 Pages hiện có — cần hoàn thiện

| Page | Vấn đề cần fix |
|------|----------------|
| `/pos` | Checkout Modal — verify toàn bộ flow với BE thực |
| `/customers` | Thêm Import/Export Excel buttons |
| `/pets` | Thêm tab service-history |
| `/grooming` | KanbanBoard — kiểm tra realtime socket.io |
| `/hotel` | CageGrid/CageMap — verify dữ liệu thực |
| `/staff` | Thêm tab shifts, documents, changelog |
| `/orders` | Hoàn thiện trang list orders với filter đầy đủ |

### 2.2 Pages cần TẠO MỚI

| Route | Component chính | Mức độ |
|-------|----------------|--------|
| `/inventory` | `InventoryTable.tsx` + form modal | 🔴 Critical |
| `/inventory/products/:id` | `ProductDetail.tsx` (variants management) | 🔴 Critical |
| `/inventory/services` | `ServiceTable.tsx` + form modal | 🔴 Critical |
| `/stock` | `StockDashboard.tsx` | 🟡 High |
| `/stock/receipts` | `ReceiptList.tsx` + `ReceiptFormModal.tsx` | 🟡 High |
| `/stock/suppliers` | `SupplierList.tsx` + form modal | 🟡 High |
| `/finance` | `FinanceDashboard.tsx` (Sổ quỹ) | 🟡 High |
| `/finance/transactions` | `TransactionList.tsx` + form modal | 🟡 High |
| `/reports` | `ReportsDashboard.tsx` (mở rộng từ dashboard) | 🟡 High |
| `/settings` | `SettingsPage.tsx` (branches, config, theme) | 🟠 Medium |
| `/settings/branches` | `BranchManager.tsx` | 🟠 Medium |

### 2.3 Shared Components cần tạo

```
components/
├── ui/
│   ├── data-table.tsx          ← Table chuẩn (sort, filter, pagination)
│   ├── date-range-picker.tsx   ← Filter ngày tháng
│   ├── excel-import.tsx        ← Import Excel dialog
│   ├── image-upload.tsx        ← Upload ảnh (products, customers)
│   ├── confirm-delete.tsx      ← Delete confirmation dialog
│   └── empty-state.tsx         ← UI khi không có data
├── charts/
│   ├── revenue-chart.tsx       ← Recharts line chart
│   ├── product-bar-chart.tsx   ← Top products bar
│   └── donut-chart.tsx         ← Phân tích chi phí
└── layout/
    └── page-header.tsx         ← Tiêu đề + breadcrumbs chuẩn
```

### 2.4 API Client Layer (FE)

Tạo `apps/web/src/lib/api/` với đầy đủ:
```
api/
├── inventory.ts        ← inventoryApi.getProducts(), getServices(), etc.
├── stock.ts            ← stockApi.getReceipts(), createReceipt(), etc.
├── reports.ts          ← reportsApi.getDashboard(), getRevenueChart(), etc.
├── finance.ts          ← financeApi.getTransactions(), etc.
└── settings.ts         ← settingsApi.getBranches(), uploadImage(), etc.
```

---

## Phase 3 — Integration + Realtime + Testing 🔗

> **Owner:** Full team  
> **Deadline:** Tuần 5-6

### 3.1 Socket.io Integration (Frontend)

```typescript
// apps/web/src/lib/socket.ts
// Cần implement:
socket.on('grooming:updated', ({ sessionId, status }) => {
  queryClient.invalidateQueries(['grooming'])
})
socket.on('hotel:updated', ({ stayId, status }) => {
  queryClient.invalidateQueries(['hotel'])
})
socket.on('stock:alert', ({ productId, stock }) => {
  toast.warning(`Tồn kho thấp: ${productName} còn ${stock} sản phẩm`)
})
```

**Files cần tạo/sửa:**
- `apps/web/src/lib/socket.ts` — socket client singleton
- `apps/web/src/components/providers.tsx` — thêm SocketProvider
- `apps/web/src/app/(dashboard)/grooming/page.tsx` — subscribe events
- `apps/web/src/app/(dashboard)/hotel/page.tsx` — subscribe events

### 3.2 BullMQ Jobs Kiểm tra

| Job | Status | Cần làm |
|-----|--------|---------|
| `grooming-complete` | ⚠️ | Verify trigger khi COMPLETED |
| `hotel-checkin-reminder` | ⚠️ | Test cron schedule |
| `low-stock-alert` | ⚠️ | Verify midnight cron |
| `daily-revenue` | ⚠️ | Verify + test report data |
| `export-excel` | ❌ | Implement worker + download flow |

### 3.3 Testing Strategy

**Unit Tests (Backend):**
```
apps/api/src/modules/orders/orders.service.spec.ts
  ✓ completeOrder() deducts stock correctly
  ✓ payOrder() calculates partial payment
  ✓ cancelOrder() releases reservedStock
  ✓ Multi-value filter parses correctly

apps/api/src/modules/hotel/hotel.service.spec.ts
  ✓ calculatePrice() returns correct nights × rate
  ✓ checkout() sets paymentStatus=PAID
```

**Integration Tests (E2E — Playwright):**
```
tests/
├── auth.spec.ts          ← Login / logout / token refresh
├── pos-flow.spec.ts      ← Tạo đơn → thanh toán → hoàn thành → in bill
├── grooming.spec.ts      ← Tạo phiên → chuyển trạng thái
├── hotel.spec.ts         ← Đặt phòng → check-in → check-out
├── inventory.spec.ts     ← CRUD sản phẩm + variants
└── stock.spec.ts         ← Tạo phiếu nhập → receive → check stock
```

---

## Phase 4 — Production Hardening & Deploy 🚀

> **Owner:** DevOps + Lead Dev  
> **Deadline:** Tuần 7-8

### 4.1 Security Hardening

```
[ ] HTTPS enforced (SSL certificate)
[ ] CORS config đúng production domain
[ ] Rate limiting: 100 req/min per IP
[ ] Helmet.js headers
[ ] Input sanitization (DOMPurify FE)
[ ] SQL injection: đảm bảo 100% Prisma ORM (không raw query)
[ ] Secrets: tất cả trong .env, không hardcode
[ ] .env.example đầy đủ (không chứa secrets thật)
```

### 4.2 Performance

```
[ ] Next.js Image optimization (next/image)
[ ] API response caching (Redis) cho: products, services lists
[ ] DB indexes: kiểm tra explain analyze trên queries chậm
[ ] Prisma connection pool config
[ ] Bundle size: next build + analyze
[ ] React Query staleTime config hợp lý
```

### 4.3 Infrastructure (Docker + CI/CD)

```yaml
# docker-compose.yml (production)
services:
  postgres:    image: postgres:16
  redis:       image: redis:7-alpine
  api:         build: apps/api
  web:         build: apps/web
  worker:      build: apps/worker   # ← cần tạo apps/worker
```

```
[ ] Dockerfile cho apps/api    ← multi-stage build
[ ] Dockerfile cho apps/web    ← next build + standalone
[ ] Dockerfile cho apps/worker ← BullMQ worker
[ ] GitHub Actions CI pipeline:
    - on push → pnpm install → typecheck → test → build
[ ] GitHub Actions CD pipeline:
    - on merge to main → build docker → push registry → deploy
```

### 4.4 Monitoring & Observability

```
[ ] Health check endpoint: GET /health ✅ (đã có)
[ ] Application logs: Winston + file rotation
[ ] Error tracking: Sentry (FE + BE)
[ ] Uptime monitoring: UptimeRobot hoặc Better Uptime
[ ] DB backup: daily pg_dump → S3/GCS
```

### 4.5 Data & Migration

```
[ ] Seed data (staging): customers mẫu, products mẫu, staff mẫu
[ ] Migration từ hệ thống cũ (nếu có):
    - Use one-off migration scripts; do not rely on customer import/export endpoints.
[ ] Backup strategy: daily backup DB 30 ngày retention
```

---

## 🏁 Definition of Done (DoD)

Một feature/module được coi là **DONE** khi:
1. ✅ API endpoint hoạt động đúng spec (NEXTJS_MIGRATION.md)
2. ✅ Frontend page hiển thị đúng dữ liệu thực từ API
3. ✅ Error states được xử lý (empty state, loading, error toast)
4. ✅ UI labels toàn bộ tiếng Việt
5. ✅ Responsive (mobile + tablet + desktop)
6. ✅ Không có TypeScript errors
7. ✅ Unit test pass (backend service layer)

---

## 📋 Phân công Gợi ý

| Team Member | Phase 1 Backend | Phase 2 Frontend |
|-------------|----------------|-----------------|
| Dev 1 | Inventory + Stock modules | `/inventory` pages |
| Dev 2 | Reports + Finance modules | `/finance` + `/reports` pages |
| Dev 3 | Settings + ActivityLog modules | `/settings` + shared components |
| Dev 4 | Staff extras + Roles + Shifts | `/staff` improvements + testing |
| Lead | Review, Architecture, Deploy | E2E tests + CI/CD setup |

---

## ⚠️ Rủi ro & Phương án dự phòng

| Rủi ro | Mức độ | Phương án |
|--------|--------|-----------|
| BE chậm → FE blocked | 🔴 High | Mock API với MSW (Mock Service Worker) trong dev |
| DB schema thay đổi | 🟡 Medium | Mọi thay đổi schema → migration file mới, không edit trực tiếp |
| Route conflict (wildcard vs specific) | 🟡 Medium | Luôn register cụ thể trước `/:id` (L004 lesson learned) |
| Multi-branch scope creep | 🟠 Low | Freeze multi-branch cho Phase 5 (hậu launch) |
| Package version conflict (pnpm) | 🟠 Low | Lock versions trong workspace root `package.json` |

---

## 🔗 Tài liệu Liên quan

| File | Nội dung |
|------|---------|
| `docs/architecture/NEXTJS_MIGRATION.md` | Full API contracts, Business logic, Domain types |
| `docs/architecture/NEXTJS_STRUCTURE.md` | Cấu trúc thư mục chi tiết |
| `STRUCTURE.md` | Sơ đồ import rules monorepo |
| `CHANGELOG.md` | Lịch sử thay đổi |

---

*Cập nhật bởi AI Orchestrator · 2026-04-03*
