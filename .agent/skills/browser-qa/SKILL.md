---
name: browser-qa
description: >
  Automated visual testing và UI interaction verification sau khi deploy feature.
  Dùng sau khi sửa UI lớn, trước khi ship, hoặc khi review PR động đến frontend.
  4 phases: Smoke → Interaction → Visual → Accessibility. Output report với verdict
  SHIP / SHIP WITH FIXES / BLOCK.
---

# Browser QA — Automated Visual Testing & Interaction

Kiểm tra UI như một real user — verify layouts, forms, interactions thực sự hoạt động.

## Khi nào dùng skill này

- Sau khi deploy feature lên staging/preview
- Trước khi ship lên production
- Khi review PR chạm đến frontend code
- Sau khi sửa responsive layout hoặc logic form
- Audit accessibility định kỳ

## Stack của Project

- **Local dev**: `http://localhost:5173` (Vite frontend)
- **Backend API**: `http://localhost:3001` (NestJS)
- **Browser tool**: Antigravity browser subagent

---

## Phase 1: Smoke Test (bắt buộc)

```
1. Navigate đến target URL
2. Kiểm tra console errors:
   - Filter noise: analytics, third-party scripts, HMR warnings
   - Flag: JavaScript errors, failed imports, 404 on assets

3. Check network requests:
   - Không có 4xx/5xx từ API calls
   - Không có failed resource loads

4. Core Web Vitals (DevTools → Lighthouse):
   - LCP < 2.5s  ✅ / > 4.0s 🚨
   - CLS < 0.1   ✅ / > 0.25 🚨
   - INP < 200ms ✅ / > 500ms 🚨

5. Screenshot: above-the-fold desktop (1440px) + mobile (375px)
```

## Phase 2: Interaction Test

### Navigation
```
□ Tất cả nav links hoạt động — không dead links
□ Active state hiển thị đúng route hiện tại
□ Breadcrumb (nếu có) đúng
□ Back button không crash
```

### Forms (critical cho Petshop)
```
□ Submit với valid data → success state hiển thị
□ Submit với invalid data → error messages rõ ràng
□ Required fields validation khi submit empty
□ Loading state khi đang submit (disable button + spinner)
□ Error từ API được hiển thị user-friendly
□ Form reset sau khi submit thành công
```

### Business Flows — Petshop Specific
```
□ Tạo order mới: chọn customer → thêm items → checkout
□ POS flow: chọn sản phẩm → thanh toán → hoàn thành đơn
□ Inventory: thêm/sửa/xóa sản phẩm
□ Customer management: CRUD
□ Order status transitions: PENDING → PAID → COMPLETE
```

### Auth (nếu có)
```
□ Login với đúng credentials → redirect đúng
□ Login với sai credentials → error message
□ Protected pages redirect về login khi chưa auth
□ Logout → clear session → redirect login
```

## Phase 3: Visual Regression

### Breakpoints cần test
```
375px  — Mobile (iPhone SE)
768px  — Tablet
1280px — Laptop
1440px — Desktop
```

### Checklist
```
□ Không có horizontal overflow (scrollbar ngang)
□ Text không bị clipped hoặc overflow container
□ Images load đầy đủ (không placeholder mãi)
□ Buttons/links có đủ touch target (min 44×44px mobile)
□ Tables responsive — có horizontal scroll hoặc stack
□ Modals/dialogs không bị cắt ngoài viewport
□ Dark mode consistent (nếu có)
```

## Phase 4: Accessibility (a11y)

```
□ Tất cả images có alt text có nghĩa
□ Form inputs có label liên kết (htmlFor/id matching)
□ Màu sắc contrast đủ WCAG AA (4.5:1 cho text)
□ Interactive elements focus-visible khi Tab
□ Modals có focus trap (không tab ra ngoài)
□ Error messages được announce (aria-live hoặc role="alert")
□ Headings hierarchy đúng (h1 → h2 → h3)
```

**Tool gợi ý**: axe DevTools extension, Lighthouse Accessibility audit

---

## Output Report Format

```markdown
## QA Report — [URL] — [timestamp]

### Phase 1: Smoke Test
- Console errors: [N] critical, [N] warnings
- Network: [OK / X failures]
- LCP: [X]s [✅/⚠️/🚨] | CLS: [X] [✅/⚠️/🚨] | INP: [X]ms [✅/⚠️/🚨]

### Phase 2: Interaction
- [✅] Nav links: X/X working
- [🚨] Contact form: missing error state cho invalid email
- [✅] POS flow: hoàn thành end-to-end
- [⚠️] Loading state: spinner missing trên một số mutations

### Phase 3: Visual
- [🚨] Horizontal overflow trên 375px — OrderTable component
- [✅] Dark mode: consistent across all pages
- [⚠️] Image loading chậm — chưa có lazy loading

### Phase 4: Accessibility
- [🚨] 2 images thiếu alt text: hero banner, product placeholder
- [⚠️] Low contrast: footer links (#999 on #fff = 2.8:1, cần 4.5:1)
- [✅] Keyboard navigation: working end-to-end

---

### 🔍 Issues Summary
| Severity | Count | Examples |
|----------|-------|---------|
| 🚨 Block | 2 | Overflow mobile, missing alt |
| ⚠️ Fix soon | 3 | Contrast, spinner, lazy load |
| ℹ️ Nice to have | 1 | ... |

### ✅ Verdict: [SHIP / SHIP WITH FIXES / BLOCK]
**Lý do**: [1-2 câu]
**Cần sửa trước ship**: [list items nếu SHIP WITH FIXES]
```

## Verdict Criteria

| Verdict | Điều kiện |
|---------|-----------|
| **SHIP** ✅ | Không có blockers, tất cả interactions work |
| **SHIP WITH FIXES** ⚠️ | Có issues nhưng không block core user flow |
| **BLOCK** 🚨 | Core flow broken, data loss risk, major a11y violations |

## Quy Tắc Bất Biến
- **PHẢI** test trên cả desktop lẫn mobile viewport
- **PHẢI** test với invalid data, không chỉ happy path
- **KHÔNG** ship khi có console errors chưa resolve
- **PHẢI** note lại screenshots/evidence cho mỗi issue
- Dùng tiếng Việt trong output report
