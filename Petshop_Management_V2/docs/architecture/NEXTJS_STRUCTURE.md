# 🐾 Petshop Service — Cấu trúc Dự án Mới (Next.js + NestJS Turborepo)

> **Stack mới:** Turborepo · pnpm workspaces · Next.js 14 App Router · NestJS · Prisma · BullMQ · PostgreSQL  
> **Ngày:** 2026-04-02

---

## Tổng quan cấu trúc

```
petshop-service/
├── apps/
│   ├── web/                    # Next.js 14 (App Router) — Frontend + BFF
│   ├── api/                    # NestJS — Core Backend API
│   └── worker/                 # NestJS — Background Job Worker
│
├── packages/
│   ├── core/                   # Domain logic thuần TS (không framework)
│   ├── database/               # Prisma schema + repository implementations
│   ├── auth/                   # JWT + RBAC logic (không framework)
│   ├── queue/                  # BullMQ job contracts & queue names
│   ├── config/                 # Env validation + app config
│   └── shared/                 # Types, utils, constants dùng chung
│
├── infra/                      # Docker, nginx, scripts
├── .github/workflows/          # CI/CD
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## apps/web — Next.js 14 (App Router)

> Frontend SPA + BFF (Backend for Frontend). Giao tiếp với `apps/api` qua HTTP hoặc gọi trực tiếp service layer (server components).

```
apps/web/
├── app/
│   ├── (auth)/                          # Layout group: không có sidebar
│   │   ├── layout.tsx                   # Minimal layout (chỉ có logo)
│   │   └── login/
│   │       └── page.tsx                 # Trang đăng nhập
│   │
│   ├── (pos)/                           # Layout group: fullscreen POS
│   │   ├── layout.tsx                   # Fullscreen, không AppLayout
│   │   └── orders/
│   │       └── new/
│   │           └── page.tsx             # POS — Point of Sale
│   │
│   ├── (dashboard)/                     # Layout group: có sidebar + header
│   │   ├── layout.tsx                   # AppLayout (Sidebar + Header)
│   │   ├── page.tsx                     # Dashboard — KPI + charts
│   │   │
│   │   ├── orders/
│   │   │   ├── page.tsx                 # Danh sách đơn hàng
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Chi tiết đơn hàng
│   │   │
│   │   ├── customers/
│   │   │   ├── page.tsx                 # Danh sách khách hàng
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Hồ sơ khách hàng + pets + lịch sử
│   │   │
│   │   ├── pets/
│   │   │   ├── page.tsx                 # Danh sách thú cưng
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Hồ sơ thú cưng + sức khỏe
│   │   │
│   │   ├── inventory/
│   │   │   ├── page.tsx                 # Kho hàng (tabs: SP + DV)
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx             # Chi tiết sản phẩm
│   │   │   └── service/
│   │   │       └── [id]/
│   │   │           └── page.tsx         # Chi tiết dịch vụ
│   │   │
│   │   ├── purchases/
│   │   │   ├── page.tsx                 # Phiếu nhập hàng
│   │   │   ├── new/
│   │   │   │   └── page.tsx             # Tạo phiếu nhập
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Chi tiết phiếu nhập
│   │   │
│   │   ├── grooming/
│   │   │   └── page.tsx                 # Quản lý phiên grooming
│   │   │
│   │   ├── hotel/
│   │   │   └── page.tsx                 # Pet hotel — check-in/out, bảng giá
│   │   │
│   │   ├── finance/
│   │   │   ├── page.tsx                 # Sổ quỹ
│   │   │   └── [voucherNumber]/
│   │   │       └── page.tsx             # Chi tiết phiếu thu/chi
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx                 # Báo cáo doanh thu + top SP/KH
│   │   │
│   │   ├── staff/
│   │   │   ├── page.tsx                 # Danh sách nhân viên
│   │   │   └── [code]/
│   │   │       └── page.tsx             # Hồ sơ nhân viên
│   │   │
│   │   ├── shifts/
│   │   │   └── page.tsx                 # Ca làm việc
│   │   │
│   │   └── settings/
│   │       └── page.tsx                 # Cài đặt (branch, configs, roles)
│   │
│   └── api/                             # Next.js API Routes (BFF layer)
│       ├── auth/
│       │   ├── login/route.ts           # POST — forward to NestJS /auth/login
│       │   ├── logout/route.ts          # POST — clear cookie
│       │   └── refresh/route.ts         # POST — refresh access token
│       └── upload/
│           └── image/route.ts           # POST — upload ảnh → forward to api
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx                # Wrapper: Sidebar + Header + main
│   │   ├── Sidebar.tsx                  # Navigation sidebar
│   │   ├── Header.tsx                   # Top bar (user menu, notifications)
│   │   └── PageLoader.tsx               # Spinner fallback (Suspense)
│   │
│   ├── ui/                              # Headless UI components (shadcn-style)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── form.tsx
│   │   ├── DataTable.tsx                # Generic table với sort, filter, pagination
│   │   ├── DataTableToolbar.tsx         # Toolbar search + filter toolbar
│   │   ├── ConfirmDialog.tsx            # Modal xác nhận hành động
│   │   ├── FormModal.tsx                # Modal dạng form
│   │   ├── ComboSelect.tsx              # Combobox (search + select)
│   │   ├── CurrencyInput.tsx            # Input số tiền VND
│   │   ├── FieldComponents.tsx          # Field wrappers cho react-hook-form
│   │   └── ...
│   │
│   ├── pos/                             # POS system components
│   │   ├── POSProvider.tsx              # Context + usePOSOrder hook
│   │   ├── POSContext.tsx               # React Context definition
│   │   ├── POSHeader.tsx                # Tab bar + nút tạo tab mới
│   │   ├── POSCustomerSection.tsx       # Tìm kiếm KH + panel đơn đang xử lý
│   │   ├── POSProductSearch.tsx         # Tìm kiếm sản phẩm/dịch vụ
│   │   ├── POSProductResults.tsx        # Dropdown kết quả tìm kiếm
│   │   ├── POSCartSection.tsx           # Giỏ hàng
│   │   ├── CartRowKV.tsx                # Dòng sản phẩm (Key-Value style)
│   │   ├── POSPaymentModal.tsx          # Modal thanh toán đa phương thức
│   │   ├── POSModals.tsx                # Grooming/hotel detail modals
│   │   ├── POSSettingsPanel.tsx         # Cài đặt hiển thị POS
│   │   ├── POSPetDetailModal.tsx        # Hồ sơ thú cưng trong POS
│   │   ├── PrintReceipt.tsx             # In hóa đơn 80mm thermal
│   │   └── hotel/                       # Hotel-specific components trong POS
│   │       ├── HotelBookingForm.tsx
│   │       └── HotelPriceCalculator.tsx
│   │
│   ├── customers/
│   │   ├── CustomerTable.tsx
│   │   ├── CustomerForm.tsx
│   │   └── CustomerGroupBadge.tsx
│   │
│   ├── pets/
│   │   ├── PetCard.tsx
│   │   ├── PetFormModal.tsx
│   │   ├── PetWeightChart.tsx           # Biểu đồ cân nặng (recharts)
│   │   ├── PetVaccinationList.tsx
│   │   ├── PetHealthNotes.tsx
│   │   └── PetSettingsModal.tsx         # Cài đặt species/breeds
│   │
│   ├── inventory/
│   │   ├── ProductTable.tsx
│   │   ├── ProductForm.tsx
│   │   ├── VariantTable.tsx
│   │   ├── ServiceTable.tsx
│   │   ├── ServiceForm.tsx
│   │   └── LowStockAlert.tsx
│   │
│   ├── grooming/
│   │   ├── GroomingBoard.tsx            # Kanban-style board
│   │   ├── GroomingCard.tsx
│   │   └── GroomingForm.tsx
│   │
│   ├── hotel/
│   │   ├── HotelStayTable.tsx
│   │   ├── HotelCheckinForm.tsx
│   │   ├── HotelRateTableManager.tsx
│   │   └── HotelPriceDisplay.tsx
│   │
│   ├── staff/
│   │   ├── StaffTable.tsx
│   │   ├── StaffForm.tsx
│   │   ├── StaffDetailModal.tsx
│   │   └── RolePermissionEditor.tsx     # JSON permissions editor
│   │
│   └── reports/
│       ├── RevenueChart.tsx             # Biểu đồ doanh thu (recharts)
│       ├── KPICards.tsx                 # Dashboard KPI cards
│       ├── TopCustomersTable.tsx
│       └── TopProductsTable.tsx
│
├── lib/
│   ├── api.ts                           # Axios/fetch client (baseURL, interceptors)
│   ├── api.service.ts                   # Tất cả API call functions (giống hiện tại)
│   ├── auth.ts                          # getSession, withAuth helper (server-side)
│   ├── query-client.ts                  # TanStack Query client config
│   └── utils.ts                         # cn(), formatCurrency(), formatDate()...
│
├── hooks/
│   ├── usePOSOrder.ts                   # POS state manager (tabs, cart, payments)
│   ├── usePOSSettings.ts                # POS display settings
│   ├── useInventoryData.ts              # Products + services data hooks
│   ├── useInventoryFilters.ts           # Filter state management
│   ├── useSocket.ts                     # Socket.io client hook
│   ├── useTheme.ts                      # Dark/light mode togglee
│   └── useFormKeyboard.ts               # Keyboard shortcuts cho form
│
├── stores/
│   └── auth.store.ts                    # Zustand auth store (user, token)
│
├── types/
│   ├── pos.types.ts                     # CartItem, OrderTab, PaymentEntry...
│   └── index.ts                         # Re-export từ packages/shared
│
├── middleware.ts                         # Next.js middleware — auth guard
│   # Kiểm tra JWT cookie/header
│   # Redirect /login nếu chưa auth
│   # Redirect / nếu đã auth và vào /login
│   # Protected routes: tất cả trừ /login, /api/auth/*
│
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                         # extends ../../tsconfig.base.json
└── package.json
```

---

## apps/api — NestJS Core Backend

> API server chính. Expose REST API cho `apps/web` và mobile (tương lai).  
> Dùng Clean Architecture: Controller → Service → Repository (từ packages/database).

```
apps/api/
├── src/
│   ├── main.ts                          # Bootstrap NestJS app
│   │   # Port: 3001
│   │   # Swagger UI: /api/docs (dev only)
│   │   # Global pipes: ValidationPipe (class-validator)
│   │   # Global interceptors: TransformInterceptor (wrap response)
│   │   # Global filters: HttpExceptionFilter
│   │
│   ├── app.module.ts                    # Root module — import tất cả modules
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts       # POST /auth/login, /auth/logout, /auth/refresh
│   │   │   ├── auth.service.ts          # login(), logout(), refreshToken()
│   │   │   └── dto/
│   │   │       ├── login.dto.ts         # { username, password }
│   │   │       └── refresh.dto.ts       # { refreshToken }
│   │   │
│   │   ├── customers/
│   │   │   ├── customers.module.ts
│   │   │   ├── customers.controller.ts  # GET/POST /customers, GET/PUT/DELETE /customers/:id
│   │   │   │                            # GET /customers/export, POST /customers/import
│   │   │   ├── customers.service.ts     # list(), get(), create(), update(), delete()
│   │   │   │                            # export(), import(), search()
│   │   │   └── dto/
│   │   │       ├── create-customer.dto.ts
│   │   │       ├── update-customer.dto.ts
│   │   │       └── list-customers.dto.ts  # query params (search, tier, page...)
│   │   │
│   │   ├── pets/
│   │   │   ├── pets.module.ts
│   │   │   ├── pets.controller.ts       # CRUD + sub-routes (weight, vaccinations, health-notes)
│   │   │   ├── pets.service.ts
│   │   │   ├── pet-health.controller.ts # GET|POST /pets/:id/weight, /vaccinations, /health-notes
│   │   │   ├── pet-health.service.ts    # addWeightLog() — ghi cả Pet.weight + PetWeightLog
│   │   │   └── dto/
│   │   │       ├── create-pet.dto.ts
│   │   │       ├── add-weight.dto.ts
│   │   │       └── add-vaccination.dto.ts
│   │   │
│   │   ├── inventory/
│   │   │   ├── inventory.module.ts
│   │   │   ├── products.controller.ts   # CRUD /inventory/products + variants
│   │   │   ├── products.service.ts
│   │   │   ├── services.controller.ts   # CRUD /inventory/services + variants
│   │   │   ├── services.service.ts
│   │   │   └── dto/
│   │   │       ├── create-product.dto.ts
│   │   │       ├── create-service.dto.ts
│   │   │       └── create-variant.dto.ts
│   │   │
│   │   ├── orders/
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.controller.ts     # CRUD + /pay, /complete, /cancel, /items/:id
│   │   │   ├── orders.service.ts        # createOrder(), payOrder(), completeOrder(), cancelOrder()
│   │   │   │   # completeOrder(): deduct stock, release reservedStock,
│   │   │   │   #                  complete GroomingSession/HotelStay, tạo ActivityLog
│   │   │   │   # payOrder(): hỗ trợ payments[] (multi-method) + backward compat paidAmount
│   │   │   └── dto/
│   │   │       ├── create-order.dto.ts
│   │   │       └── pay-order.dto.ts     # { payments: [{method, amount}] }
│   │   │
│   │   ├── grooming/
│   │   │   ├── grooming.module.ts
│   │   │   ├── grooming.controller.ts   # CRUD + PATCH /grooming/:id/status
│   │   │   ├── grooming.service.ts      # list(), get(), create(), updateStatus()
│   │   │   └── dto/
│   │   │       ├── create-grooming.dto.ts
│   │   │       └── update-status.dto.ts
│   │   │
│   │   ├── hotel/
│   │   │   ├── hotel.module.ts
│   │   │   ├── hotel.controller.ts      # CRUD + /checkin, /checkout, /calculate
│   │   │   ├── hotel.service.ts         # prebook(), checkin(), checkout(), calculatePrice()
│   │   │   ├── hotel-rate-table.controller.ts  # CRUD /hotel/rate-tables + /clone
│   │   │   ├── hotel-rate-table.service.ts     # calculatePrice(petId, dates, lineType)
│   │   │   └── dto/
│   │   │       ├── create-hotel-stay.dto.ts
│   │   │       ├── checkout.dto.ts
│   │   │       └── calculate-price.dto.ts
│   │   │
│   │   ├── stock/
│   │   │   ├── stock.module.ts
│   │   │   ├── stock.controller.ts      # /stock/receipts CRUD + /pay, /cancel, /receive
│   │   │   │                            # /stock/suppliers CRUD
│   │   │   │                            # /stock/transactions/:productId
│   │   │   │                            # /stock/suggestions
│   │   │   ├── stock.service.ts         # createReceipt(), receiveGoods(), getSuggestions()
│   │   │   └── dto/
│   │   │       ├── create-receipt.dto.ts
│   │   │       └── pay-receipt.dto.ts
│   │   │
│   │   ├── staff/
│   │   │   ├── staff.module.ts
│   │   │   ├── staff.controller.ts      # CRUD /users + /change-password, /documents
│   │   │   ├── staff.service.ts
│   │   │   ├── roles.controller.ts      # CRUD /roles
│   │   │   ├── roles.service.ts
│   │   │   ├── shifts.controller.ts     # /shifts/current, /start, /:id/end, /:id/summary
│   │   │   ├── shifts.service.ts
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       ├── update-user.dto.ts
│   │   │       └── create-role.dto.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── reports.module.ts
│   │   │   ├── reports.controller.ts    # /reports/dashboard, /revenue-chart, /top-*
│   │   │   │                            # /reports/transactions CRUD
│   │   │   ├── reports.service.ts
│   │   │   └── finance.service.ts       # Sổ quỹ — createTransaction(), listTransactions()
│   │   │
│   │   ├── customers-groups/
│   │   │   ├── customer-groups.module.ts
│   │   │   ├── customer-groups.controller.ts  # CRUD /customer-groups
│   │   │   └── customer-groups.service.ts
│   │   │
│   │   ├── settings/
│   │   │   ├── settings.module.ts
│   │   │   ├── settings.controller.ts   # /settings/configs, /settings/branches
│   │   │   └── settings.service.ts
│   │   │
│   │   ├── upload/
│   │   │   ├── upload.module.ts
│   │   │   ├── upload.controller.ts     # POST /upload/image (Multer)
│   │   │   └── upload.service.ts
│   │   │
│   │   └── activity-logs/
│   │       ├── activity-logs.module.ts
│   │       ├── activity-logs.controller.ts
│   │       └── activity-logs.service.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # Verify JWT — dùng packages/auth
│   │   │   └── roles.guard.ts           # Check role permissions
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts # Wrap response: { success, data }
│   │   │   └── logging.interceptor.ts   # Request logging
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts       # class-validator global pipe
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Format error response
│   │   └── decorators/
│   │       ├── current-user.decorator.ts # @CurrentUser()
│   │       └── roles.decorator.ts        # @Roles('ADMIN', 'SUPER_ADMIN')
│   │
│   └── config/
│       └── app.config.ts               # NestJS config module (dùng packages/config)
│
└── test/
    ├── auth.e2e-spec.ts
    ├── orders.e2e-spec.ts
    └── jest-e2e.json
```

---

## apps/worker — NestJS Background Worker

> Chạy riêng biệt. Consume BullMQ jobs từ Redis.  
> Không expose HTTP (trừ health check `/health`).

```
apps/worker/
├── src/
│   ├── main.ts                          # Bootstrap worker app (không HTTP)
│   │   # Chỉ khởi động BullMQ processors
│   │   # Health check endpoint /health (optional)
│   │
│   ├── worker.module.ts                 # Root module
│   │
│   └── processors/
│       ├── notification.processor.ts    # Queue: 'notification'
│       │   # Jobs:
│       │   # - grooming-complete: Thông báo grooming xong
│       │   # - hotel-checkin-reminder: Nhắc nhở check-in
│       │   # - low-stock-alert: Cảnh báo tồn kho thấp
│       │
│       ├── report.processor.ts          # Queue: 'report'
│       │   # Jobs:
│       │   # - daily-revenue: Tổng kết doanh thu cuối ngày
│       │   # - monthly-summary: Báo cáo tháng
│       │   # - export-excel: Export data lớn async
│       │
│       └── sync-misa.processor.ts       # Queue: 'misa-sync'  [FUTURE]
│           # Jobs:
│           # - sync-invoice: Đẩy hóa đơn sang MISA
│           # - sync-products: Đồng bộ sản phẩm
│           # (Tương lai: tích hợp phần mềm kế toán MISA)
│
└── test/
    └── processors.spec.ts
```

---

## packages/core — Domain Logic (Plain TypeScript)

> **Không import Express, NestJS, Prisma, hay bất kỳ framework nào.**  
> Đây là "trái tim" của hệ thống — business rules thuần túy.  
> Tất cả apps và packages khác đều depend vào package này.

```
packages/core/
├── src/
│   ├── entities/                        # Domain entities
│   │   ├── customer.entity.ts           # Customer, CustomerTier enum
│   │   ├── pet.entity.ts                # Pet, PetGender enum
│   │   ├── order.entity.ts              # Order, OrderStatus, PaymentStatus
│   │   │   # calcTotal(): tính tổng đơn
│   │   │   # canComplete(): validation business rule
│   │   │   # canCancel(): validation
│   │   ├── order-item.entity.ts         # OrderItem — product hoặc service
│   │   ├── product.entity.ts            # Product + ProductVariant
│   │   │   # availableStock: stock - reservedStock (computed)
│   │   ├── service-entity.ts            # Service (GROOMING/HOTEL/MEDICAL...)
│   │   ├── grooming-session.entity.ts   # GroomingSession với state machine
│   │   │   # transition(): PENDING→IN_PROGRESS→COMPLETED
│   │   ├── hotel-stay.entity.ts         # HotelStay
│   │   │   # calculateDuration(): số đêm
│   │   ├── staff.entity.ts              # Staff + StaffRole enum
│   │   └── transaction.entity.ts        # Transaction — INCOME/EXPENSE
│   │
│   ├── use-cases/                       # Business rules — 1 file = 1 use case
│   │   ├── orders/
│   │   │   ├── create-order.use-case.ts         # Validation, tạo order, reserve stock
│   │   │   ├── pay-order.use-case.ts            # Multi-payment, PARTIAL handling
│   │   │   ├── complete-order.use-case.ts       # Deduct stock, complete grooming/hotel
│   │   │   └── cancel-order.use-case.ts         # Release reservedStock
│   │   ├── inventory/
│   │   │   ├── reserve-stock.use-case.ts        # Tăng reservedStock khi tạo đơn
│   │   │   ├── release-stock.use-case.ts        # Giảm reservedStock khi cancel
│   │   │   └── deduct-stock.use-case.ts         # Giảm stock khi complete
│   │   ├── hotel/
│   │   │   ├── calculate-hotel-price.use-case.ts  # Tính giá theo bảng giá
│   │   │   └── checkin-pet.use-case.ts
│   │   ├── customers/
│   │   │   ├── add-loyalty-points.use-case.ts   # Cộng điểm sau khi mua
│   │   │   └── generate-customer-code.use-case.ts # KH-000001
│   │   └── pets/
│   │       ├── add-weight-log.use-case.ts       # Dual storage: Pet.weight + PetWeightLog
│   │       └── generate-pet-code.use-case.ts    # P1B2C3 (P + 5 hex)
│   │
│   ├── repositories/                    # Interfaces (abstract, không implement)
│   │   ├── customer.repository.ts       # interface ICustomerRepository
│   │   ├── pet.repository.ts            # interface IPetRepository
│   │   ├── order.repository.ts          # interface IOrderRepository
│   │   ├── product.repository.ts        # interface IProductRepository
│   │   ├── grooming.repository.ts
│   │   ├── hotel.repository.ts
│   │   ├── stock.repository.ts
│   │   └── transaction.repository.ts
│   │
│   └── events/                          # Domain events
│       ├── order-completed.event.ts     # Khi completeOrder() — trigger: deduct stock, loyalty
│       ├── order-paid.event.ts          # Khi payOrder() đủ tiền
│       ├── grooming-completed.event.ts  # Trigger: notification job
│       ├── hotel-checkin.event.ts       # Trigger: welcome notification
│       ├── low-stock.event.ts           # Trigger: stock alert notification
│       └── index.ts
│
├── package.json                         # name: "@petshop/core"
└── tsconfig.json
```

---

## packages/database — Prisma + Repository Implementations

> Implement các interfaces từ `packages/core/repositories`.  
> Là adapter giữa domain logic và database thực tế.

```
packages/database/
├── prisma/
│   ├── schema.prisma                    # PostgreSQL (production) / SQLite (dev)
│   │   # Models (24): User, Customer, Pet, PetWeightLog, PetVaccination,
│   │   #   PetHealthNote, Product, ProductVariant, Service, ServiceVariant,
│   │   #   Order, OrderItem, GroomingSession, HotelStay, HotelRateTable,
│   │   #   StockReceipt, StockTransaction, Supplier, Transaction,
│   │   #   ShiftSession, Branch, CustomerGroup, Role, ActivityLog
│   │   #
│   │   # Enums: OrderStatus, PaymentStatus, StaffRole, ServiceType,
│   │   #        GroomingStatus, HotelStatus, EmploymentType...
│   │
│   ├── migrations/                      # Prisma migrations (version-controlled)
│   │   └── 20260101000000_init/
│   │       └── migration.sql
│   │
│   └── seed.ts                          # Seed dữ liệu ban đầu + demo data
│       # Tạo: Super Admin, branches, customer groups, sample products/services
│       # Tạo demo: customers, pets, orders, grooming sessions
│
└── src/
    ├── prisma.service.ts                # PrismaClient singleton
    │   # NestJS service hoặc plain singleton
    │   # Duy nhất 1 instance trong toàn bộ app (tránh SQLite lock)
    │
    └── repositories/                    # Implements interfaces từ packages/core
        ├── customer.repository.impl.ts  # ICustomerRepository → Prisma queries
        │   # list(): search, filter tier, groupId, pagination
        │   # Diacritic-insensitive search (normalize NFD)
        ├── pet.repository.impl.ts
        ├── order.repository.impl.ts
        │   # Multi-value filter: paymentStatus.split(',') → Prisma { in: [...] }
        ├── product.repository.impl.ts
        ├── grooming.repository.impl.ts
        ├── hotel.repository.impl.ts
        │   # calculatePrice(): query rate table, áp dụng REGULAR/HOLIDAY
        ├── stock.repository.impl.ts
        └── transaction.repository.impl.ts
```

---

## packages/auth — Authentication & Authorization Logic

> **Không import NestJS hay Express.** Chỉ là pure TypeScript logic.  
> NestJS guards và Next.js middleware đều dùng package này.

```
packages/auth/
├── src/
│   ├── jwt/
│   │   ├── sign.ts                      # signAccessToken(payload, secret, expiresIn)
│   │   ├── verify.ts                    # verifyToken(token, secret) → JwtPayload | null
│   │   └── decode.ts                    # decodeToken(token) → JwtPayload (no verify)
│   │
│   ├── rbac/                            # Role-Based Access Control
│   │   ├── roles.ts                     # StaffRole enum: SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER
│   │   ├── permissions.ts               # Permission constants: 'order:create', 'staff:delete'...
│   │   ├── policy.ts                    # hasPermission(role, permission): boolean
│   │   │   # SUPER_ADMIN: all permissions
│   │   │   # ADMIN: all except system config
│   │   │   # MANAGER: orders, customers, pets, reports
│   │   │   # STAFF: orders, customers (read), pets
│   │   │   # VIEWER: read-only
│   │   └── role-hierarchy.ts            # Role inheritance chain
│   │
│   └── types/
│       ├── jwt-payload.ts               # interface JwtPayload { userId, role, iat, exp }
│       ├── role.ts                      # StaffRole type export
│       └── permission.ts               # Permission type export
│
├── package.json                         # name: "@petshop/auth"
└── tsconfig.json
```

---

## packages/queue — BullMQ Job Contracts

> Định nghĩa "hợp đồng" cho jobs. Cả producer (api) và consumer (worker) đều import từ đây.

```
packages/queue/
├── src/
│   ├── jobs/
│   │   ├── notification.job.ts          # NotificationJob types
│   │   │   # GroomingCompleteJob: { sessionId, customerId, petName }
│   │   │   # HotelCheckinReminderJob: { stayId, petId, checkInDate }
│   │   │   # LowStockAlertJob: { productId, productName, stock, minStock }
│   │   │
│   │   ├── report.job.ts                # ReportJob types
│   │   │   # DailyRevenueJob: { date }
│   │   │   # MonthlySummaryJob: { year, month }
│   │   │   # ExportExcelJob: { type: 'customers'|'orders', filters }
│   │   │
│   │   └── misa-sync.job.ts             # MisaSyncJob types [FUTURE]
│   │       # SyncInvoiceJob: { orderId }
│   │       # SyncProductsJob: { productIds[] }
│   │
│   ├── queues.ts                        # Queue name constants
│   │   # QUEUES = {
│   │   #   NOTIFICATION: 'notification',
│   │   #   REPORT: 'report',
│   │   #   MISA_SYNC: 'misa-sync',
│   │   #   STOCK_CHECK: 'stock-check',
│   │   # }
│   │
│   └── types.ts                         # JobResult, JobOptions types
│
├── package.json                         # name: "@petshop/queue"
└── tsconfig.json
```

---

## packages/config — Environment & App Config

> Single source of truth cho tất cả environment variables.

```
packages/config/
├── src/
│   ├── env.schema.ts                    # Zod schema validate env vars
│   │   # z.object({
│   │   #   NODE_ENV: z.enum(['development', 'production', 'test']),
│   │   #   DATABASE_URL: z.string().url(),
│   │   #   JWT_SECRET: z.string().min(32),
│   │   #   JWT_REFRESH_SECRET: z.string().min(32),
│   │   #   JWT_EXPIRES_IN: z.string().default('15m'),
│   │   #   JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
│   │   #   API_PORT: z.coerce.number().default(3001),
│   │   #   WEB_PORT: z.coerce.number().default(3000),
│   │   #   REDIS_URL: z.string().optional(),
│   │   #   CORS_ORIGINS: z.string(),   // comma-separated
│   │   #   UPLOAD_DIR: z.string().default('./uploads'),
│   │   #   MAX_FILE_SIZE: z.coerce.number().default(52428800), // 50MB
│   │   # })
│   │
│   ├── app.config.ts                    # Parsed config object
│   │   # export const config = {
│   │   #   env, database, jwt, api, web, redis, upload
│   │   # }
│   │
│   └── index.ts                         # Re-export
│
├── package.json                         # name: "@petshop/config"
└── tsconfig.json
```

---

## packages/shared — Dùng chung toàn bộ Monorepo

> DTOs, API types, utilities, constants dùng ở cả frontend lẫn backend.

```
packages/shared/
├── src/
│   ├── types/                           # Shared TypeScript interfaces
│   │   ├── api.types.ts                 # ApiResponse<T>, PaginatedResponse<T>, ListParams
│   │   ├── customer.types.ts            # Customer, CustomerTier, CustomerGroup
│   │   ├── pet.types.ts                 # Pet, PetVaccination, PetWeightLog
│   │   ├── order.types.ts               # Order, OrderItem, OrderStatus, PaymentStatus
│   │   ├── product.types.ts             # Product, ProductVariant
│   │   ├── service.types.ts             # Service, ServiceVariant, ServiceType
│   │   ├── grooming.types.ts            # GroomingSession, GroomingStatus
│   │   ├── hotel.types.ts               # HotelStay, HotelRateTable, HotelStatus
│   │   ├── staff.types.ts               # Staff, StaffRole, StaffStatus, EmploymentType
│   │   ├── stock.types.ts               # StockReceipt, Supplier, StockTransaction
│   │   ├── finance.types.ts             # Transaction (INCOME/EXPENSE)
│   │   ├── pos.types.ts                 # CartItem, OrderTab, PaymentEntry, PaymentMethod
│   │   └── index.ts                     # Re-export all
│   │
│   ├── utils/
│   │   ├── date.utils.ts                # formatDate(), toISOString(), msUntilMidnight()
│   │   ├── currency.utils.ts            # formatVND(), parseCurrency()
│   │   ├── pagination.utils.ts          # buildPaginationMeta(), calcOffset()
│   │   ├── search.utils.ts              # normalizeVietnamese() — diacritic-insensitive
│   │   │   # normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
│   │   ├── id.utils.ts                  # generateCustomerCode(), generatePetCode()
│   │   │   # KH-000001: padStart(6, '0')
│   │   │   # P1B2C3: 'P' + randomBytes(3).toString('hex').toUpperCase()
│   │   │   # ĐH-YYMMDD-XXXXX: date + padStart(5, '0')
│   │   └── index.ts
│   │
│   ├── constants/
│   │   ├── order.constants.ts           # ORDER_STATUS, PAYMENT_STATUS, ORDER_PREFIX
│   │   ├── payment.constants.ts         # PAYMENT_METHODS: CASH, BANK, MOMO, VNPAY, CARD, POINTS
│   │   ├── customer.constants.ts        # CUSTOMER_TIERS: BRONZE, SILVER, GOLD, PLATINUM, DIAMOND
│   │   ├── stock.constants.ts           # LOW_STOCK_THRESHOLD default
│   │   └── index.ts
│   │
│   └── errors/                          # Custom error classes
│       ├── app.error.ts                 # AppError base class
│       ├── not-found.error.ts           # NotFoundError(resource, id)
│       ├── validation.error.ts          # ValidationError(field, message)
│       ├── unauthorized.error.ts        # UnauthorizedError
│       ├── forbidden.error.ts           # ForbiddenError(requiredRole)
│       └── conflict.error.ts            # ConflictError (duplicate code...)
│
├── package.json                         # name: "@petshop/shared"
└── tsconfig.json
```

---

## infra/ — Infrastructure

```
infra/
├── docker/
│   ├── docker-compose.yml               # Development
│   │   # services:
│   │   #   postgres: image postgres:16, port 5432
│   │   #   redis: image redis:7-alpine, port 6379
│   │   #   api: build Dockerfile.api, port 3001, depends: postgres, redis
│   │   #   worker: build Dockerfile.worker, depends: postgres, redis
│   │   #   web: build Dockerfile.web, port 3000, depends: api
│   │
│   ├── docker-compose.prod.yml          # Production overrides
│   │   # Thêm: nginx, ssl volumes, restart policies
│   │   # Giảm: không expose internal ports
│   │
│   ├── Dockerfile.api                   # NestJS API
│   │   # FROM node:20-alpine AS builder
│   │   # pnpm install, pnpm build api
│   │   # FROM node:20-alpine AS runner
│   │   # Copy dist, node_modules
│   │   # CMD node dist/main.js
│   │
│   ├── Dockerfile.worker                # NestJS Worker
│   │   # Tương tự Dockerfile.api
│   │   # CMD node dist/worker/main.js
│   │
│   └── Dockerfile.web                   # Next.js
│       # FROM node:20-alpine AS builder
│       # pnpm build web → standalone output
│       # FROM node:20-alpine AS runner
│       # CMD node server.js
│
├── nginx/
│   ├── nginx.conf                       # Reverse proxy config
│   │   # server {
│   │   #   listen 80 → redirect 443
│   │   #   listen 443 ssl
│   │   #   location / → proxy web:3000
│   │   #   location /api → proxy api:3001
│   │   #   location /uploads → static files
│   │   # }
│   │
│   └── ssl/                             # SSL certificates (gitignored)
│       ├── cert.pem
│       └── key.pem
│
└── scripts/
    ├── migrate.sh                       # pnpm --filter @petshop/database db:migrate
    ├── seed.sh                          # pnpm --filter @petshop/database db:seed
    └── deploy.sh                        # git pull, pnpm install, build, restart docker
```

---

## .github/workflows/ — CI/CD

```
.github/workflows/
├── ci.yml                               # Pull Request checks
│   # on: [push, pull_request]
│   # jobs:
│   #   lint: pnpm turbo lint
│   #   type-check: pnpm turbo type-check
│   #   test: pnpm turbo test
│   #   build: pnpm turbo build
│
└── deploy.yml                           # Deploy khi merge vào main
    # on: push to main
    # jobs:
    #   deploy:
    #     - SSH vào server
    #     - git pull
    #     - pnpm install --frozen-lockfile
    #     - pnpm turbo build
    #     - docker-compose up -d --build
    #     - pnpm run migrate
```

---

## Root config files

```
turbo.json                               # Turborepo pipeline
# {
#   "pipeline": {
#     "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
#     "dev": { "cache": false, "persistent": true },
#     "lint": {},
#     "test": { "dependsOn": ["build"] },
#     "type-check": {}
#   }
# }

pnpm-workspace.yaml
# packages:
#   - 'apps/*'
#   - 'packages/*'

tsconfig.base.json
# {
#   "compilerOptions": {
#     "target": "ES2022",
#     "module": "NodeNext",
#     "moduleResolution": "NodeNext",
#     "strict": true,
#     "paths": {
#       "@petshop/core": ["./packages/core/src"],
#       "@petshop/shared": ["./packages/shared/src"],
#       "@petshop/auth": ["./packages/auth/src"],
#       "@petshop/queue": ["./packages/queue/src"],
#       "@petshop/config": ["./packages/config/src"],
#       "@petshop/database": ["./packages/database/src"]
#     }
#   }
# }

package.json (root)
# {
#   "name": "petshop-service",
#   "scripts": {
#     "dev": "turbo dev",
#     "build": "turbo build",
#     "test": "turbo test",
#     "lint": "turbo lint",
#     "db:migrate": "...",
#     "db:seed": "...",
#     "db:studio": "..."
#   },
#   "devDependencies": {
#     "turbo": "latest",
#     "typescript": "^5.x"
#   }
# }
```

---

## Dependency Graph (Package → Packages nó import)

```
apps/web        → @petshop/shared, @petshop/auth, @petshop/config
apps/api        → @petshop/core, @petshop/database, @petshop/auth,
                  @petshop/queue, @petshop/config, @petshop/shared
apps/worker     → @petshop/core, @petshop/database, @petshop/queue,
                  @petshop/config, @petshop/shared

packages/database   → @petshop/core, @petshop/shared
packages/core       → (không import gì bên ngoài — pure TS)
packages/auth       → @petshop/shared
packages/queue      → @petshop/shared
packages/config     → (chỉ dùng zod)
packages/shared     → (không phụ thuộc gì)
```

---

## Di chuyển từ dự án hiện tại

| Hiện tại | Chuyển sang |
|----------|-------------|
| `apps/backend/src/services/*.service.ts` | `apps/api/src/modules/*/service.ts` |
| `apps/backend/src/routes/*.routes.ts` | `apps/api/src/modules/*/controller.ts` |
| `apps/backend/src/middleware/auth.ts` | `packages/auth/` + `apps/api/common/guards/` |
| `apps/backend/src/config/database.ts` | `packages/database/src/prisma.service.ts` |
| `apps/backend/prisma/schema.prisma` | `packages/database/prisma/schema.prisma` |
| `apps/frontend/src/types/shared.types.ts` | `packages/shared/src/types/` |
| `apps/frontend/src/services/api.service.ts` | `apps/web/lib/api.service.ts` |
| `apps/frontend/src/stores/auth.store.ts` | `apps/web/stores/auth.store.ts` |
| `apps/frontend/src/hooks/usePOSOrder.ts` | `apps/web/hooks/usePOSOrder.ts` |
| `apps/frontend/src/components/pos/` | `apps/web/components/pos/` |
| `apps/backend/src/queue/` (stub) | `packages/queue/` + `apps/worker/` (real BullMQ) |
