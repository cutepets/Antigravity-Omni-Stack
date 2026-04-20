# Petshop Management V2 - Implementation Master Plan

> Last updated: 2026-04-20
> Scope baseline: codebase state in `Petshop_Management_V2`, not legacy roadmap assumptions

## 1. Muc tieu

Tai lieu nay chot ke hoach trien khai tong the de dua codebase ve trang thai:

- an toan hon o lop auth va security
- dong nhat hon ve kien truc backend/frontend
- de refactor, test, va mo rong theo multi-branch
- co the van hanh va release theo quy trinh ro rang

## 2. Nguyen tac trien khai

- Lam theo thu tu critical path, khong refactor tran lan.
- Khoa cac rui ro auth va permission truoc khi mo rong realtime, queue, va scale.
- Tiep tuc tan dung cac module da co nen CQRS tot (`pet`, `grooming`, `hotel`) de lam mau.
- Moi phase phai co tieu chi nghiem thu ro va co the verify bang command/test.
- Tai lieu va code phai dong bo; khong giu roadmap "dep" nhung sai runtime.

## 3. Tong quan phase

| Phase | Ten | Thoi luong du kien | Muc tieu chinh | Dependency |
| --- | --- | --- | --- | --- |
| 0 | Baseline va guardrails | 3-4 ngay | Chot source of truth, sua loi cau truc ro rang, dat quality gate | None |
| 1 | Auth va security hardening | 5-7 ngay | Thong nhat auth model, giam rui ro token, sua SSE auth | Phase 0 |
| 2 | Refactor domain loi backend | 10-15 ngay | Tach `orders`, `reports`, `stock`, `inventory`, `stock-count` | Phase 1 |
| 3 | Hop nhat platform va frontend | 7-10 ngay | Dong nhat shared UI, API client, split workspace lon | Phase 2 co the overlap mot phan |
| 4 | Queue, realtime, cross-cutting | 5-7 ngay | Dua queue/realtime vao dung cho, hop nhat policy branch/module | Phase 1-3 |
| 5 | Testing, CI, release hardening | 7-10 ngay | Khoi tao release pipeline on dinh | Phase 0-4 |

## 4. Critical path

1. Phase 0
2. Phase 1
3. Phase 2A - Orders
4. Phase 2B - Reports va Stock
5. Phase 3 va Phase 4 co the chay so le theo nhom
6. Phase 5

Neu bo qua thu tu nay, nhom se gap 2 he qua:

- refactor xong lai phai sua lai vi auth va branch-scope doi
- realtime/queue duoc viet som nhung phai dap di lam lai khi policy backend thay doi

## 5. Chi tiet theo phase

### Phase 0 - Baseline va guardrails

#### 5.0.1 Muc tieu

- chot lai "hien trang dung" cua repo
- sua cac loi cau truc ro rang truoc khi lam viec lon
- dat quality gate toi thieu cho toan monorepo

#### 5.0.2 Dau viec

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P0-01 | Cap nhat tai lieu source of truth theo code thuc te | `docs/ROADMAP.md`, `docs/architecture/*`, `docs/implementation-checklist.md`, `README/STRUCTURE docs` | Tai lieu moi phan anh dung module/page hien co | Khong con muc "chua co" cho page/module da ton tai trong code |
| P0-02 | Sua route trung va loi cau truc ro rang | `apps/api/src/modules/orders/orders.controller.ts` | API route map sach, khong ambiguity | Khong con duplicate `GET /orders/:id/timeline` |
| P0-03 | Dat quality gate co ban | root `package.json`, `turbo.json`, scripts tung app/package | Chuan command lint/type-check/build | `pnpm lint`, `pnpm type-check`, `pnpm build` chay qua baseline |
| P0-04 | Don generated artifacts khoi `src` | `packages/*/src/*.js`, `*.d.ts`, `*.map`, `packages/database/index.js` va build config | `src` chi con source chinh | Artifacts sinh ra vao `dist`, CI chan generated files sai cho |
| P0-05 | Kiem ke package/platform dang do dang | `packages/ui`, `packages/queue`, `packages/dataloader`, `packages/database` | Danh sach package "active", "legacy", "placeholder" | Co quyet dinh ro package nao tiep tuc, package nao deprecate |

#### 5.0.3 Luu y thuc hien

- Khong doi business behavior trong phase nay.
- Uu tien commit nho, de rollback.
- Chi sua cac diem cau truc va tai lieu.

### Phase 1 - Auth va security hardening

#### 5.1.1 Muc tieu

- bo auth model dua vao `localStorage`
- thong nhat auth cho browser, API, middleware, SSE
- giam blast radius neu DB hoac client bi lo

#### 5.1.2 Dau viec

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P1-01 | Chot auth model moi | `apps/api/src/modules/auth/*`, `apps/web/src/lib/api.ts`, `apps/web/src/stores/auth.store.ts`, `apps/web/src/middleware.ts` | Auth flow thong nhat bang cookie-based session/token | Khong con doc/ghi `access_token`, `refresh_token` tu `localStorage` |
| P1-02 | Phat hanh access/refresh token qua cookie an toan | `auth.service.ts`, `auth.controller.ts`, response handling FE | Cookie strategy ro rang cho login/refresh/logout | Login, refresh, logout hoat dong o browser va protected routes |
| P1-03 | Hash refresh token khi luu DB | `auth.service.ts`, Prisma schema/migration cho `refresh_tokens` | DB khong luu raw refresh token | DB dump khong dung duoc de refresh session |
| P1-04 | Sua SSE payment auth | `apps/api/src/modules/orders/payment-intent-stream.controller.ts`, `apps/web/src/hooks/use-payment-intent-stream.ts`, `jwt.strategy.ts` | SSE dung chung auth model moi | EventSource nhan duoc stream hop le sau login |
| P1-05 | Chuan hoa cleanup va revoke session | `token-cleanup.service.ts`, queue/cron placeholder neu can | Session lifecycle ro | Token cu bi revoke sau refresh, logout xoa dung session |
| P1-06 | Hop nhat upload policy | `settings.controller.ts`, `reports.controller.ts`, `pet.controller.ts`, `staff.service.ts` | File validation va storage abstraction dung chung | Mime/ext/size/path traversal duoc chan va co test |

#### 5.1.3 Tieu chi nghiem thu phase

- Browser khong con token trong `localStorage`.
- Middleware web phan quyen dung ma khong can hack cookie marker.
- SSE payment hoat dong dung voi auth moi.
- Refresh token trong DB duoc hash.
- Co integration test cho login, refresh, logout, me, va payment stream auth.

### Phase 2 - Refactor domain loi backend

#### 5.2.1 Muc tieu

- tach business logic khoi "god service"
- dua cac module nghiep vu lon ve cau truc de test va mo rong
- hop nhat branch scope va permission policy cho write path

#### 5.2.2 Thu tu uu tien

1. Orders
2. Reports/Finance
3. Stock
4. Inventory
5. Stock-count
6. Settings/Staff/Roles

#### 5.2.3 Dau viec Orders

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P2-O1 | Tach `OrdersService` theo use case | `apps/api/src/modules/orders/orders.service.ts` va thu muc moi `application/`, `domain/`, `mappers/`, `policies/` | `OrdersService` chi con orchestration mong hoac duoc thay the | File chinh giam manh kich thuoc, use case tach ro |
| P2-O2 | Tach payment intent flow | `payment-webhook.service.ts`, `payment-intent-stream.controller.ts`, event service | Payment intent co lifecycle ro | Tao intent, stream, webhook update, settle dung flow |
| P2-O3 | Gom branch/policy o order flow | `orders.controller.ts`, branch scope util, permission checks | Write path khong lap lai branch logic | Create/pay/export-stock/settle deu qua policy chung |
| P2-O4 | Them test integration orders | specs va e2e moi | Regression net cho order | Test pass cho create, pay, complete, cancel, refund, export-stock |

#### 5.2.4 Dau viec Reports/Finance

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P2-R1 | Tach `ReportsService` thanh `dashboard`, `analytics`, `cashbook` | `apps/api/src/modules/reports/reports.service.ts`, controller va dto | Read model sach hon | KPI, chart, top data, debt, cashbook khong nam chung mot khoi lon |
| P2-R2 | Chuan hoa voucher/transaction flow | report cashbook files, finance util | Voucher va transaction mapping nhat quan | So lieu cashbook doi chieu dung voi orders/stock/payment |
| P2-R3 | Them test so lieu | report specs, seed test data | Regression cho analytics | Dashboard va revenue chart dung voi data seed known-good |

#### 5.2.5 Dau viec Stock/Inventory/Stock-count

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P2-S1 | Tach `StockService` theo use case | `apps/api/src/modules/stock/stock.service.ts`, thu muc application/policies | Receipt, receive, pay, return tach nho | Service giam kich thuoc va de test |
| P2-S2 | Tach `InventoryService` khoi CRUD va import/export | `inventory.service.ts`, `product-excel.ts` | Product/service management ro lane | CRUD va import/export khong tron |
| P2-S3 | Tach `StockCountService` khoi counting session va approval | `stock-count.service.ts` | Session, count, approval ro use case | Counting khong lap branch/permission logic |
| P2-S4 | Hop nhat stock transaction va branch write policy | stock + inventory + branch utils | Ton kho va transaction duoc ghi co kiem soat | Receive/refund/adjust/counting deu qua chung policy |

#### 5.2.6 Tieu chi nghiem thu phase

- `orders`, `reports`, `stock`, `inventory`, `stock-count` khong con service khong lo da nang.
- Moi module lon co use case layer ro rang.
- Branch access va permission duoc dung chung o write path.
- Co integration test cho flow doanh thu va ton kho quan trong.

### Phase 3 - Hop nhat platform va frontend

#### 5.3.1 Muc tieu

- dong nhat shared UI
- tach cac workspace frontend qua lon
- dua API client ve theo domain thay vi mot file tong hop

#### 5.3.2 Dau viec

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P3-01 | Chon mot nguon cho DataList va layout primitives | `packages/ui/src/*`, `apps/web/src/components/data-list/*`, `apps/web/src/components/layout/*` | Shared UI thong nhat | Khong con song song local va package cho cung primitive |
| P3-02 | Tinh gon API client | `apps/web/src/lib/api.ts`, `apps/web/src/lib/api/*`, `packages/api-client/src/*` | API client theo domain | Auth interceptor, branch header, error handling la shared layer; domain clients tach rieng |
| P3-03 | Split `orders` workspace frontend | `apps/web/src/app/(dashboard)/orders/_components/order/*` | Workspace theo shell + hook + panel | File workspace chinh giam manh, khong lap logic render |
| P3-04 | Split inventory/report/service-pricing workspaces | `reports-workspace.tsx`, `ServicePricingWorkspace.tsx`, receipt/product/supplier forms | Workspace lon duoc tach theo hook + panel | Khong con file 1500-2500 dong cho mot man hinh |
| P3-05 | Chuan hoa auth/permission UI | `useAuthorization.ts`, `RoleGate`, header/sidebar su dung branch scope | UI visibility policy thong nhat | Frontend permission check khop backend policy |

#### 5.3.3 Tieu chi nghiem thu phase

- Shared UI co mot source of truth.
- `lib/api.ts` khong con la noi chua tat ca domain.
- Cac man hinh lon duoc tach theo pattern thong nhat.
- Team co the giao viec frontend theo panel/hook ma khong xung dot lon.

### Phase 4 - Queue, realtime, cross-cutting consistency

#### 5.4.1 Muc tieu

- dua queue va realtime vao dung cho
- chot cross-cutting rules cho module, branch, permission

#### 5.4.2 Dau viec

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P4-01 | Bien `@petshop/queue` thanh package thuc su | `packages/queue/src/*`, worker entrypoints, env/docker docs | Job layer dung duoc | Package queue khong con `export {}` |
| P4-02 | Chon chien luoc realtime | order SSE, grooming/hotel socket, provider wiring FE | Rule SSE vs socket ro rang | Realtime auth, reconnect, failure state duoc mo ta va hoat dong |
| P4-03 | Hop nhat branch/module/permission policy | common guards/decorators/utils o API, hooks UI | Cross-cutting logic thong nhat | Khong con logic "FULL_BRANCH_ACCESS" va `branch.access.all` xu ly mo ho |
| P4-04 | Chuan hoa module toggle | `ModuleGuard`, `RequireModule`, settings module config | Module gating de quan ly | Module disable/enable khong gay bypass route |

#### 5.4.3 Tieu chi nghiem thu phase

- Queue duoc dung cho it nhat 2-3 use case co gia tri.
- Realtime payment va event nghiep vu co policy thong nhat.
- Branch/module/permission policy dung chung o backend va bieu hien dung o frontend.

### Phase 5 - Testing, CI, release hardening

#### 5.5.1 Muc tieu

- bien codebase thanh trang thai co the release va maintain
- co pipeline verify tu dong

#### 5.5.2 Dau viec

| Ma cong viec | Dau viec | File/pham vi anh huong | Dau ra | Tieu chi nghiem thu |
| --- | --- | --- | --- | --- |
| P5-01 | Dung test matrix nghiep vu | API specs, integration, web e2e | Smoke suite co gia tri | Auth, order, payment, stock, stock-count, reports deu co regression |
| P5-02 | Them CI workflow | `.github/workflows/*`, scripts, turbo tasks | Pipeline PR | PR fail neu lint/type-check/test/build fail |
| P5-03 | Them quality checks bo sung | check generated artifacts, env leaks, migration drift | Guardrails release | Commit khong the dua artifact sai va secret mau vao repo |
| P5-04 | Chuan hoa release runbook | docs deploy/ops, docker/env docs | Runbook dev/staging/prod | Dev moi dung duoc moi truong tu dau, release checklist ro |

#### 5.5.3 Tieu chi nghiem thu phase

- Co CI workflow bat buoc cho PR.
- Co smoke/regression suite cho flow nghiep vu chinh.
- Co runbook release va rollback ro rang.

## 6. Team split de xep viec

### Track A - Platform/Security

- Phase 0
- Phase 1
- Phase 4 policy work
- Phase 5 CI/release

### Track B - Backend Domain

- Phase 2 Orders
- Phase 2 Reports/Finance
- Phase 2 Stock/Inventory/Stock-count

### Track C - Frontend Convergence

- Phase 3 API client split
- Phase 3 shared UI convergence
- Phase 3 workspace split

Track C chi nen vao manh sau khi Phase 1 da on va Orders backend da co huong refactor ro.

## 7. Definition of done

Mot phase duoc xem la xong khi dong thoi dat du 4 dieu kien:

1. Code da merge va khong de TODO blocker mo ra trong critical path.
2. Tieu chi nghiem thu cua phase duoc verify bang command/test/behavior.
3. Tai lieu lien quan da cap nhat cung luc.
4. Khong mo them divergence moi giua local app code va shared package/platform.

## 8. Deliverables cuoi cung

Sau khi hoan tat ke hoach, repo phai co:

- auth model thong nhat va an toan hon
- backend domain lon duoc tach theo use case
- frontend biet compose tren shared primitives va API domain clients
- queue/realtime dung cho dung bai toan
- CI va test matrix du de bao ve refactor tiep theo
