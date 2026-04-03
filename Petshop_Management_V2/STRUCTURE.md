# Kiến Trúc Dòng Chảy Monorepo (Turborepo) - Petshop Management V2

Dự án này sử dụng kiến trúc Monorepo thông qua **Turborepo** và Package Manager **pnpm**.

## 1. Cấu trúc thư mục (Apps)

Các ứng dụng (applications) chính được đặt tại thư mục `apps/`:

- **apps/web**: Frontend của hệ thống (Next.js 14/15 App Router). Đảm nhận phần UI/UX người dùng, giao diện quản lý (Dashboard, POS, Admin) và tương tác với các server/backend.
- **apps/api**: Backend chính (NestJS). Đảm nhận expose REST/GraphQL API, phân quyền, authentication, và business logic tổng hợp.

## 2. Cấu trúc các gói lõi (Packages)

Mọi code có thể tái sử dụng đều được tách thành các private package (phân tách theo Domain-Driven Design) nằm trong thư mục `packages/`:

- **packages/database**: Thao tác và kết nối Database chính. Tích hợp Prisma ORM, chứa các file Schema, Migration, Seed scripts, và `bcryptjs`.
- **packages/auth**: Xử lý logic chứng thực người dùng (Authentication & Authorization).
- **packages/core**: Các phần tử cốt lõi, business entities (mô hình nghiệp vụ), interfaces chung mà hệ thống sử dụng không phụ thuộc framework cụ thể.
- **packages/queue**: Xử lý logic hàng đợi, cron-jobs, background tasks (dựa trên BullMQ / Redis).
- **packages/shared**: Chứa DTO, Zod validation, TS Interfaces, Enums mà cả Backend (NestJS) và Frontend (Next.js) đều cần để đồng bộ kiểu dữ liệu (Types).
- **packages/config**: Chứa cấu hình dùng chung như ESLint, Prettier, TypeScript config, Tailwind config.

## 3. Quy chuẩn luồng Imports
- `apps/web` có thể import `@petshop/shared`, `@petshop/auth`, `@petshop/config`.
- `apps/api` có thể import `@petshop/database`, `@petshop/core`, `@petshop/queue`, `@petshop/auth`, `@petshop/shared`.
- **Tuyệt đối không** import code trực tiếp bằng đường dẫn chéo kiểu `../../packages` ngoại trừ qua cấu hình monorepo alias. Tất cả giao tiếp qua tiền tố tên package (`@petshop/tên_package`).

## 4. Quy chuẩn Database (PostgreSQL ONLY)
- Hệ thống V2 **ĐÃ CHUYỂN HOÀN TOÀN** sang PostgreSQL thay vì SQLite như bản cũ.
- **TUYỆT ĐỐI KHÔNG** sử dụng bất kỳ references, context, cấu hình hoặc tư duy code nào liên quan đến SQLite. Tất cả kiến trúc, ORM schema (Prisma), và raw SQL đều phải tuân theo tiêu chuẩn của **PostgreSQL 16**.
- Mọi database constraints, transactions, column typing đều phải tuân thủ PostgreSQL (ví dụ `@db.Timestamptz`, `id String @id @default(uuid())`, raw sql cần quote identifier `"columnName"` một cách chính xác).
