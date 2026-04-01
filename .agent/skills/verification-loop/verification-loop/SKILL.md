---
name: verification-loop
description: >
  Continuous verification workflow sau khi hoàn thành feature hoặc fix lớn.
  Chạy một chuỗi kiểm tra có hệ thống để đảm bảo không tạo regression.
  Đặc biệt cần sau khi thay đổi business logic, payment flows, hoặc database schema.
---

# Verification Loop — Post-Change Regression Prevention

## Khi Nào Dùng Skill Này

Kích hoạt sau khi:
- Hoàn thành feature mới (>3 files thay đổi)
- Fix bug phức tạp trong business/payment flow
- Thay đổi database schema
- Sửa API endpoints
- Refactor component lớn

## Verification Loop — 5 Bước

### Bước 1: TypeScript Compile Check
```bash
# Chạy từ root project hoặc từng package
npx tsc --noEmit --skipLibCheck 2>&1 | head -30

# Monorepo (thay đường dẫn phù hợp với project)
# cd apps/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -30
# cd apps/backend && npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```
**Pass điều kiện:** 0 errors. Warnings OK nhưng cần ghi nhận.

---

### Bước 2: Import/Export Consistency
```bash
# Tìm broken imports (thay src/ bằng đường dẫn source của project)
grep -r "from '.*/.*'" src/ --include="*.ts" --include="*.tsx" | \
  grep -v "node_modules" | head -20

# Check re-exports
grep -r "export \* from" src/ --include="*.ts" -l
```
**Pass điều kiện:** Không có circular imports, không import từ file không tồn tại.

---

### Bước 3: API Contract Check (Frontend ↔ Backend)
```bash
# Frontend API calls (thay đường dẫn và keyword phù hợp)
grep -r "fetch\|axios\|api\." src/ --include="*.ts" --include="*.tsx" | \
  grep -E "'/api/" | head -20

# Backend routes
grep -rE "(get|post|put|patch|delete)\(" src/ --include="*.ts" | \
  grep "router\|app" | head -20
```
**Pass điều kiện:** Endpoints frontend gọi phải tồn tại trong backend routes.

---

### Bước 4: Business Logic Spot Check
Kiểm tra các điểm dễ regression nhất trong project:

```
□ State machine chính của domain (ví dụ: order status flow) — còn đúng không?
□ Tính toán quan trọng (ví dụ: balance, price, totals) — kết quả có thay đổi?
□ Access control — chỉ đúng role/owner mới thực hiện được?
□ Data integrity — foreign keys, unique constraints còn hợp lệ?
```

**Cách verify (thay tên file/field phù hợp với project):**
```bash
# Tìm logic liên quan đến domain chính
grep -n "status\|balance\|total" src/services/main.service.ts | head -30
```

---

### Bước 5: Smoke Test — Dev Server Check
```bash
# Server đang chạy không?
curl -s http://localhost:3001/health | head -5
# hoặc
curl -s http://localhost:5173 | head -5
```

Nếu server chạy: thử thủ công 1-2 luồng quan trọng liên quan đến thay đổi.

---

## Verification Report Template

Sau khi chạy tất cả steps, output report này:

```markdown
## ✅/❌ Verification Report — [feature/fix name] — [date]

### TypeScript
- Frontend: [PASS / X errors]
- Backend: [PASS / X errors]

### API Contract
- Endpoints checked: [list]
- Mismatches found: [None / list]

### Business Logic
- Order flow: [OK / Issue: ...]
- Payment logic: [OK / Issue: ...]

### Dev Server
- Status: [Running / Error]
- Manual test: [Tested X flow — OK / Failed]

### Verdict
[✅ PASS — safe to commit] 
[⚠️ PASS WITH WARNINGS — commit after review]
[❌ FAIL — do NOT commit, fix: ...]
```

## Fast Track (Quick Verify — 2 phút)

Khi thay đổi nhỏ (1-2 files, không phải logic):
```bash
# Chỉ cần pass bước này (thay đường dẫn phù hợp)
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | wc -l
# Kết quả = 0 → OK
```

## Escalate Nếu

- TypeScript errors tăng lên so với trước khi thay đổi
- API endpoint bị rename nhưng frontend chưa update
- Database schema thay đổi nhưng service chưa update queries
