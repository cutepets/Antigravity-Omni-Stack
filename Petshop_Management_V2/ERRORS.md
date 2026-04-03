# Lịch sử & Kinh nghiệm Xử lý Lỗi (ERRORS.md)

Đây là tài liệu ghi nhận các lỗi quan trọng gặp phải trong quá trình phát triển để tránh lặp lại trong tương lai.

## Lỗi 1: Prisma Client Typing Mismatch trong NX Monorepo
**Hiện tượng:** 
Sau khi sửa đổi `schema.prisma` và thêm bảng mới (ví dụ: `Role`) hoặc field liên kết mới, chạy lệnh sinh mã (`prisma generate`). Tuy nhiên, TypeScript (đặc biệt là VS Code hoặc `tsc`) liên tục báo lỗi các thuộc tính/hàm mới không tồn tại trên `PrismaClient` (ví dụ: `Property 'isSystem' does not exist on type...`).
Ngoài ra, đôi khi lệnh sinh mã npm script như `db:generate` ở packages database không được cấu hình trong Turborepo/Nx nên không tự động copy type mới.

**Nguyên nhân:**
- File API (`apps/api/...`) dùng `@petshop/database` package. Các package dạng workspace đôi khi giữ bản cache `.d.ts` hoặc yêu cầu phải restart TS Server/chạy lại compiler để Typescript bắt kịp.
- Trong quá trình phát triển đôi khi TS Server lock cache `node_modules/.prisma/client`.

**Cách giải quyết nhanh (Bypass) cho Development:**
Khi gặp trường hợp thay vì bị block quá lâu vào quá trình rebuild/restart TS trong CI hoặc IDE, có thể thực hiện ép kiểu `(this.db.user as any)` hoặc `(this.db.role as any)` trước khi gọi DB trong code NestJS nếu đang cần test khẩn cấp.
Về dài hạn, nên có setup `build` command hoàn chỉnh ở `@petshop/database`, cập nhật Prisma generation output (custom output path) và restart TypeScript Language Server sau mỗi lần `db push`.

## Lỗi 2: Thuộc tính `legacyRole` trên object được ánh xạ
**Hiện tượng:** 
`Object literal may only specify known properties, and 'legacyRole' does not exist in type 'UserSelect<DefaultArgs>'.`

**Nguyên nhân:**
Khi di chuyển từ enum cứng sang Database table cho Role, Prisma Model `User` bị mất một property (ví dụ được rename thành `legacyRole` hoặc xóa đi). Tuy nhiên, các service cũ (`auth.service.ts`, `staff.service.ts`) vẫn fetch `legacyRole`.

**Cách sửa:**
Xóa các select `legacyRole: true` ở tất cả các query và thay thế bằng `role: { select: { code: true, permissions: true } }` thông qua relation `roleId`.
