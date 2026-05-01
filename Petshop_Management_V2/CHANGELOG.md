# Changelog

Tất cả thay đổi quan trọng của Petshop Management V2 được ghi lại tại đây.
Format theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và [Semantic Versioning](https://semver.org/).

---

## [2.5.1] - 2026-05-01

### Documentation & Release
- Map lại hệ thống, CODEMAPS và giới thiệu trong Settings.
- Cập nhật tài liệu vận hành Docker Compose production và luồng deploy VPS.

### Customer / CRM
- Cập nhật hồ sơ khách hàng với ngày sinh, lịch sử điểm và dữ liệu chăm sóc chi tiết hơn.
- Hoàn thiện nhập xuất CRM, kiểm tra dữ liệu Excel và bộ test liên quan.
- Chuẩn hóa phân loại khách hàng, nhà cung cấp và staff trên API, shared DTO và frontend.

### DevOps
- Chuẩn bị đóng gói Docker production cho API/Web và deploy qua VPS script.

---

## [2.5.0] - 2026-04-25

### 🏨 Hotel Module
- Thêm overlap validation — chặn tạo stay trùng lịch cho cùng pet
- Thêm trường `secondaryPhone` trên hotel stay
- Auto-assign cage slot cho stay từ POS (không cần chọn cage thủ công)
- Cải thiện StayDetailsDialog UX, inline edit phone

### 🔄 Return / Exchange
- Sync DTO frontend ↔ backend (`CreateReturnRequestDto`)
- Logic stock restoration khi hoàn hàng
- Dark mode compatibility cho OrderReturnModal

### 🛒 POS
- Fix branch selection dropdown bị clip bởi overflow-hidden
- Fix "missing stock" error cho simple products (productVariantId matching)

### 📦 Storage
- Public asset endpoint — không cần auth để xem ảnh
- Image proxy rewrite trong Next.js config

### ⚙️ Settings
- Redesign Google Drive settings UI (file picker, inline guide)
- Backup registry cập nhật

### 🔐 Auth & Security
- ThrottlerGuard global binding
- Helmet security headers
- Auth rate limits hardening

### 🏗️ DevOps
- Tạo `deploy.sh` — script deploy chuẩn 6 bước
- Fix Dockerfile: prisma generate (pnpm exec + dummy DATABASE_URL)
- Sửa VPS build context → `./Petshop_Management_V2`
- Tạo skill `vps-docker-deploy`

### 🗃️ Database
- Migration: `add_order_return_window`
- Migration: `remove_hotel_daycare_combo`

---

## [2.0.0] - 2026-04-10

### Initial V2 Release
- Turborepo monorepo architecture
- NestJS API + Next.js 15 Web
- PostgreSQL + Redis + Docker Compose
- RBAC permission system
- POS, Orders, Inventory, Hotel, Grooming, Pets modules
- Branch-based multi-store support
