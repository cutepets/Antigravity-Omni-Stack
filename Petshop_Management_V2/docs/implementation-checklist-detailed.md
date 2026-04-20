# Petshop Management V2 - Detailed Implementation Checklist

> Checklist nay duoc viet de mo ticket, assign owner, va theo doi tien do theo phase.
> Trang thai mac dinh:
> - `[ ]` Chua lam
> - `[-]` Dang lam
> - `[x]` Xong

## Phase 0 - Baseline va guardrails

### P0-01 Tai lieu va source of truth

- [ ] Doi chieu `docs/ROADMAP.md` voi code runtime thuc te.
- [ ] Doi chieu `docs/architecture/*` voi route/module hien co.
- [ ] Danh dau tai lieu nao con gia tri, tai lieu nao legacy.
- [ ] Cap nhat file mo ta "current architecture".
- [ ] Ghi ro package nao active, package nao placeholder.

### P0-02 Sua loi cau truc ro rang

- [ ] Xoa route trung `GET /orders/:id/timeline`.
- [ ] Chay route smoke test cho `orders`.
- [ ] Kiem tra cac controller co endpoint bi trung ten/duong dan khac.
- [ ] Chot naming rule cho controller methods va DTO exports.

### P0-03 Dat quality gate

- [ ] Chuan hoa script root: `lint`, `type-check`, `build`.
- [ ] Kiem tra Turbo tasks co phu hop workspace hien tai.
- [ ] Chuan hoa package scripts cho apps va packages.
- [ ] Chay baseline `pnpm lint`.
- [ ] Chay baseline `pnpm type-check`.
- [ ] Chay baseline `pnpm build`.

### P0-04 Don generated artifacts

- [ ] Liet ke toan bo `.js`, `.d.ts`, `.map` dang nam trong `packages/*/src`.
- [ ] Chot package nao can build ra `dist`.
- [ ] Sua `package.json`/`tsconfig` tung package de xuat build vao `dist`.
- [ ] Dua runtime shim can thiet ve vi tri ro rang.
- [ ] Them check chan artifact sai vi tri.

### P0-05 Kiem ke package/platform

- [ ] Xac minh `@petshop/ui` dang duoc dung o dau.
- [ ] Xac minh local copies cua data-list/layout dang duoc dung o dau.
- [ ] Xac minh `@petshop/queue` co dung runtime nao khong.
- [ ] Xac minh `@petshop/dataloader` co import nao khong.
- [ ] Ghi quyet dinh: keep, merge, deprecate, remove.

## Phase 1 - Auth va security hardening

### P1-01 Chot auth model moi

- [ ] Chon auth strategy cho browser: `HttpOnly cookie` hay cookie pair.
- [ ] Chot access token scope, refresh token scope, cookie flags.
- [ ] Chot same-site strategy cho local/staging/prod.
- [ ] Chot middleware web se xac thuc dua tren cookie nao.

### P1-02 Backend auth rewrite

- [ ] Refactor `auth.service.ts` de issue cookie thay vi tra raw token cho FE.
- [ ] Cap nhat `auth.controller.ts` cho login/refresh/logout/me.
- [ ] Cap nhat `jwt.strategy.ts` de extract token theo auth model moi.
- [ ] Kiem tra `JwtGuard` va route guards voi request cookie.
- [ ] Loai bo phu thuoc vao cookie marker fake.

### P1-03 Frontend auth rewrite

- [ ] Loai bo `localStorage` token handling trong `apps/web/src/lib/api.ts`.
- [ ] Loai bo `localStorage` token handling trong `apps/web/src/stores/auth.store.ts`.
- [ ] Cap nhat `middleware.ts` de redirect dung tren cookie auth that.
- [ ] Cap nhat login form flow va session bootstrap.
- [ ] Chot trang thai hydrate/authenticated cho client store.

### P1-04 Refresh token hardening

- [ ] Them hash refresh token truoc khi luu DB.
- [ ] Them compare hash khi refresh.
- [ ] Them revoke flow cho logout.
- [ ] Kiem tra race condition khi rotate refresh token.
- [ ] Kiem tra cleanup expired session.

### P1-05 SSE payment auth

- [ ] Kiem tra `EventSource` co tu dong mang cookie auth moi.
- [ ] Sua `payment-intent-stream.controller.ts` neu can.
- [ ] Sua `use-payment-intent-stream.ts` neu can.
- [ ] Test stream reconnect sau refresh/login.
- [ ] Test stream tu choi khi session het han.

### P1-06 Upload security

- [ ] Gom rules mime/ext/size vao utility dung chung.
- [ ] Gom path resolve/delete vao utility an toan.
- [ ] Kiem tra uploads image/file/settings/pet/reports/staff.
- [ ] Chan path traversal va file extension spoofing.
- [ ] Chot abstraction de sau nay day len S3/cloud storage.

### P1-07 Acceptance

- [ ] Khong con `access_token` va `refresh_token` trong `localStorage`.
- [ ] Login/refresh/logout/me pass integration tests.
- [ ] SSE payment hoat dong voi auth moi.
- [ ] Refresh token duoc hash trong DB.

## Phase 2 - Backend domain refactor

### Orders

- [ ] Liet ke tat ca use case cua `orders`.
- [ ] Tach commands/queries/use-cases khoi `orders.service.ts`.
- [ ] Tach payment intent flow khoi order aggregate logic.
- [ ] Tach debt, stock export, settlement thanh service/policy rieng.
- [ ] Chot mapper/view model cho order detail/list/timeline/payment-intent.
- [ ] Them integration tests cho create/pay/complete/cancel/refund/export-stock/settle.

### Reports/Finance

- [ ] Tach dashboard KPI khoi analytics va cashbook CRUD.
- [ ] Tach transaction/voucher helpers ra utility/domain service.
- [ ] Chot response shape cho dashboard, charts, debt, cashbook.
- [ ] Test report queries tren seed data.
- [ ] Kiem tra hieu nang query nhe va nang.

### Stock

- [ ] Liet ke use case: receipt create/update/pay/receive/return/refund.
- [ ] Tach `stock.service.ts` theo use case.
- [ ] Chuan hoa stock transaction write path.
- [ ] Chuan hoa supplier payment va supplier refund flow.
- [ ] Them tests cho receive/refund/return.

### Inventory

- [ ] Tach CRUD product/service khoi import/export/excel.
- [ ] Chot service layer cho variants.
- [ ] Test CRUD va variant batch flow.

### Stock-count

- [ ] Tach session lifecycle khoi item counting.
- [ ] Tach approval/variance/reconciliation.
- [ ] Chuan hoa branch scope.
- [ ] Test create/count/approve flow.

### Settings/Staff/Roles

- [ ] Tach module config, upload, audit logs, customer groups khoi `settings.service.ts`.
- [ ] Xu ly TODO multi-branch role mapping trong `staff.service.ts`.
- [ ] Chot branch role model neu can migration.
- [ ] Kiem tra role/permission CRUD tu dau den cuoi.

### Phase 2 Acceptance

- [ ] Khong con god service o cac module backend lon.
- [ ] Mỗi use case chinh co diem vao ro rang.
- [ ] Branch scope va permission write path duoc dung chung.
- [ ] Regression tests pass cho doanh thu va ton kho.

## Phase 3 - Platform va frontend convergence

### Shared UI convergence

- [ ] Chot source of truth cho DataList.
- [ ] Chot source of truth cho layout primitives.
- [ ] Chot source of truth cho RoleGate/auth presentation.
- [ ] Xoa hoac deprecate local copies khong dung.
- [ ] Cap nhat imports toan app.

### API client split

- [ ] Tach auth layer khoi `lib/api.ts`.
- [ ] Tao clients theo domain: orders, reports, stock, inventory, settings, staff.
- [ ] Chot cho nao dung `packages/api-client`, cho nao dung web-only adapter.
- [ ] Chuan hoa error mapping va branch header behavior.

### Workspace split

- [ ] Tach orders workspace theo shell/hook/panels.
- [ ] Tach reports workspace theo page shell + filter panel + charts panel + data panel.
- [ ] Tach inventory receipt forms theo hook + sections.
- [ ] Tach product/service pricing workspaces.
- [ ] Giam kich thuoc cac file >1000-1500 dong.

### Auth/permission UI

- [ ] Chuan hoa `useAuthorization`.
- [ ] Doi chieu frontend permission checks voi backend guards.
- [ ] Kiem tra branch selector/header/sidebar theo permission that.

### Phase 3 Acceptance

- [ ] Shared UI co mot implementation chinh.
- [ ] `lib/api.ts` khong con la file tong hop moi thu.
- [ ] Workspace lon duoc tach de co the giao viec song song.

## Phase 4 - Queue, realtime, cross-cutting

### Queue

- [ ] Chot use cases can queue that su.
- [ ] Thiet ke queue contracts va payloads.
- [ ] Tao worker entrypoint.
- [ ] Implement low-stock alert job.
- [ ] Implement report export hoac cleanup/payment post-processing job.
- [ ] Them retry/backoff/logging.

### Realtime

- [ ] Chot rule dung SSE hay socket cho tung use case.
- [ ] Kiem tra grooming/hotel realtime hien co.
- [ ] Kiem tra order payment realtime.
- [ ] Chuan hoa FE reconnect/error UI.

### Cross-cutting policy

- [ ] Chuan hoa `FULL_BRANCH_ACCESS` va `branch.access.all`.
- [ ] Chuan hoa branch policy util.
- [ ] Chuan hoa `ModuleGuard` va `RequireModule`.
- [ ] Kiem tra module toggle khong bi bypass.

### Phase 4 Acceptance

- [ ] `@petshop/queue` co runtime va jobs that.
- [ ] Realtime co guideline ro rang.
- [ ] Branch/module/permission policy thong nhat.

## Phase 5 - Testing, CI, release hardening

### Testing

- [ ] Chot smoke suite bat buoc.
- [ ] Them integration tests auth.
- [ ] Them integration tests orders/payment.
- [ ] Them integration tests stock/stock-count.
- [ ] Them integration tests reports/cashbook.
- [ ] Chon e2e chinh cho web.

### CI

- [ ] Tao workflow PR check.
- [ ] Chay lint, type-check, build, tests.
- [ ] Chan generated artifacts sai cho.
- [ ] Chan env example/secrets leak.

### Release/runbook

- [ ] Viet local setup guide.
- [ ] Viet staging/prod checklist.
- [ ] Viet migration/deploy/rollback guide.
- [ ] Viet operational notes cho uploads, Redis, Postgres, JWT secrets.

### Phase 5 Acceptance

- [ ] Moi PR phai qua CI.
- [ ] Co smoke suite cho critical flows.
- [ ] Co runbook release va rollback.

## Tracking board de xep ticket

| Epic | Gom cac phan |
| --- | --- |
| EPIC-01 Platform Stabilization | Phase 0 |
| EPIC-02 Auth Security Rewrite | Phase 1 |
| EPIC-03 Orders Domain Refactor | Phase 2 Orders |
| EPIC-04 Reports and Stock Refactor | Phase 2 Reports/Stock/Inventory/Stock-count |
| EPIC-05 Frontend Convergence | Phase 3 |
| EPIC-06 Queue and Realtime | Phase 4 |
| EPIC-07 Testing and Release Hardening | Phase 5 |

## Recommended weekly cadence

- Tuan 1: Phase 0 + bat dau Phase 1
- Tuan 2: Hoan tat Phase 1 + kick off Orders
- Tuan 3: Orders + Reports
- Tuan 4: Stock + Inventory + Stock-count
- Tuan 5: Frontend convergence
- Tuan 6: Queue/realtime + testing/CI

Neu doi nhieu nguoi, tach theo 3 track:

- Track A: platform/security
- Track B: backend domain
- Track C: frontend convergence
