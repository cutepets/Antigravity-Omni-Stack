---
name: connection-health-check
description: Auto-trigger khi agent sắp sửa bất kỳ DANGER FILE nào liên quan đến kết nối backend/frontend. Bắt buộc chạy check trước và sau khi chỉnh sửa.
---

# 🩺 Connection Health Check Skill

## Khi nào dùng skill này

Skill này **BẮT BUỘC** kích hoạt khi agent sắp sửa đổi bất kỳ file nào trong danh sách DANGER FILES:

| File | Tại sao nguy hiểm |
|------|-------------------|
| `apps/frontend/vite.config.ts` | Điều khiển proxy `/api` → backend port |
| `apps/frontend/src/lib/api.ts` | baseURL của mọi API call |
| `apps/backend/src/index.ts` | PORT, CORS, mount điểm `/api` |
| `apps/backend/src/routes/index.ts` | Đăng ký tất cả sub-routes |
| `.env` hoặc `.env.example` | Biến môi trường quan trọng |

---

## ⚙️ Kiến trúc kết nối (KHÔNG ĐƯỢC PHÁ VỠ)

```
Frontend :5173  →  Vite Proxy /api  →  Backend :3000/api  →  Routes
     │                    │                     │
  api.ts            vite.config.ts          index.ts
 baseURL:'/api'    target:':3000'         PORT=3000
```

**Ba giá trị này PHẢI ĐỒNG BỘ với nhau:**
- `PORT` trong `.env` = số port trong `vite.config.ts` proxy target = port backend listen
- `CORS_ORIGIN` trong `.env` = URL frontend = `http://localhost:5173`
- `baseURL: '/api'` trong `api.ts` = prefix trong vite proxy = prefix mount backend

---

## 📋 Checklist bắt buộc (chạy theo thứ tự)

### TRƯỚC khi sửa DANGER FILE

```bash
# 1. Chạy health check
npm run check:connections
```

- Nếu có `❌ FAIL` → **DỪNG NGAY**, sửa lỗi cũ trước khi tạo lỗi mới
- Nếu tất cả `✅ PASS` → ghi nhớ state hiện tại, tiếp tục

### KHI sửa DANGER FILE

- [ ] Tham khảo `CONNECTION_MAP.md` để biết giá trị đúng
- [ ] Không đổi port một mình — phải đổi cả 3 chỗ cùng lúc (`.env`, `vite.config.ts`, backend)
- [ ] Không đổi prefix `/api` — nếu đổi phải cập nhật `api.ts` baseURL VÀ vite proxy key VÀ backend mount

### SAU khi sửa DANGER FILE

```bash
# 2. Chạy lại health check
npm run check:connections
```

- Nếu có `❌ FAIL` → **ROLLBACK NGAY** — không commit, không push
- Nếu tất cả `✅ PASS` → tiếp tục thực thi

---

## 🚨 Các lỗi phổ biến (DO NOT DO)

```typescript
// ❌ SAI — đổi target nhưng không đổi .env PORT
proxy: { '/api': { target: 'http://localhost:4000' } }
// PORT trong .env vẫn là 3000 → sẽ kết nối đến cổng sai

// ❌ SAI — đổi prefix proxy nhưng không đổi api.ts
proxy: { '/backend': { target: 'http://localhost:3000' } }
// api.ts vẫn baseURL: '/api' → mọi request đều 404

// ❌ SAI — hardcode URL trong service thay vì dùng api client
const res = await fetch('http://localhost:3000/api/customers')
// Sẽ bị CORS block trên production
```

---

## 🔧 Quick Fix Guide

### Lỗi "ERR_CONNECTION_REFUSED" hoặc "Network Error"
1. Backend chưa chạy → `npm run dev` trong thư mục backend
2. Sai port → check `vite.config.ts` target vs `.env PORT`

### Lỗi "404 Not Found" trên `/api/xxx`
1. Route chưa đăng ký → check `routes/index.ts`
2. Sai prefix → `api.ts` baseURL phải là `/api`, không thêm `/api/api`

### Lỗi "CORS blocked"
1. `CORS_ORIGIN` trong `.env` phải match frontend URL chính xác (kể cả port)

---

## 📑 Tài liệu tham khảo

- `CONNECTION_MAP.md` — Sơ đồ đầy đủ, bảng mapping endpoint
- `ERRORS.md` — Log lỗi đã từng xảy ra, đặc biệt lỗi 2026-03-18
- `npm run check:connections` — Tool tự động xác minh
