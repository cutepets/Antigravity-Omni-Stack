---
description: "When architecting new features, exploring the project, writing API/UI, or modifying the system."
---

# PETSHOP MANAGEMENT V2 - MONOREPO KNOWLEDGE

Hệ thống Petshop Management V2 là một **Turborepo Monorepo** với pnpm. Nó được thiết kế với sự giao tiếp giữa các package lõi và các application (web/api).

Mọi Agent trước khi thực hiện **bất kỳ task viết code, debug hoặc phân tích nào** đều phải hiểu và tuân thủ chặt chẽ tài liệu gốc về kiến trúc tại tệp `c:/Dev2/Petshop_Management_V2/STRUCTURE.md`.

## QUY TẮC CỐT LÕI (CORE MANDATES)
1. **Luôn sử dụng Package Alias**: Không được phép sử dụng relative paths (`../../packages/shared`) khi import từ các package khác trong không gian monorepo. BẮT BUỘC phải sử dụng `@petshop/{package_name}` (ví dụ: `import { UserDto } from '@petshop/shared'`).
2. **Không phá vỡ ranh giới module**:
   - UI logic chỉ được nằm ngoài `apps/web`.
   - Business Logic / Database access phải nằm ở `apps/api` hoặc `packages/database`, `packages/core`.
   - Các định nghĩa chia sẻ (Enums, Zod schema, TS Interface) phải thuộc về `packages/shared`.
3. **Database Rules**: Khi cần kết nối Prisma, phải gọi thông qua `packages/database`. Đội frontend không được lấy trực tiếp DB connection, chỉ thông qua REST API do `apps/api` xuất ra.

Nếu chưa rõ vị trí của module nào, hãy đọc kỹ `C:\Dev2\Petshop_Management_V2\STRUCTURE.md` trước khi action.
