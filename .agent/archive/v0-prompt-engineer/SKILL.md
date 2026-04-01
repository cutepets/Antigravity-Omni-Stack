---
name: v0-prompt-engineer
description: Dùng v0.dev như công cụ brainstorm & tinh chỉnh prompt UI trước khi giao cho Antigravity code. Áp dụng cho Vite/React, Next.js, và bất kỳ stack nào.
---

# v0-prompt-engineer

Kỹ thuật dùng **v0.dev như một "prompt lab"** — không lấy code từ v0, mà dùng nó để xây dựng mô tả UI cực kỳ chi tiết, rồi đưa cho Antigravity thực thi trực tiếp trong codebase của mình.

> **Nguyên tắc cốt lõi**: v0.dev giỏi *hiểu ý tưởng mơ hồ và cụ thể hóa nó*, Antigravity giỏi *viết code đúng vào dự án thực*. Kết hợp hai điểm mạnh đó.

---

## 🎯 Khi nào dùng skill này?

- Khi có ý tưởng UI nhưng chưa biết mô tả chính xác bằng lời
- Khi muốn thiết kế một component mới (form, table, dashboard card, modal...)
- Khi cần layout phức tạp và không chắc cách sắp xếp
- Khi muốn explore các kiểu thiết kế khác nhau trước khi commit vào code

---

## 🔄 Workflow 4 bước

### Bước 1: Brainstorm với v0.dev

1. Mở [https://v0.dev](https://v0.dev)
2. Viết **ý tưởng ban đầu** bằng ngôn ngữ tự nhiên, không cần hoàn hảo:
   ```
   "A POS order creation page with product list on the left and cart on the right"
   ```
3. v0 sẽ render giao diện. **Quan sát**, không cần hài lòng ngay.

### Bước 2: Iterate để tinh chỉnh prompt (QUAN TRỌNG NHẤT)

Sử dụng chat của v0 để **bổ sung yêu cầu từng lớp**. Mỗi lần chat = thêm một tầng chi tiết:

```
Layer 1 — Layout:
"Split into 2 columns: 65% product grid, 35% cart panel"

Layer 2 — Visual style:
"Use a clean light mode. Blue header bar. Compact density for POS use."

Layer 3 — Components:
"Add a search bar on top of product grid. Cart shows item name, qty stepper, price, delete button."

Layer 4 — Behavior/UX:
"Highlight selected products. Show total at bottom of cart in large bold red text."

Layer 5 — Edge cases:
"Empty cart shows a placeholder message. Search with no results shows 'Không tìm thấy sản phẩm'."
```

> **Mục tiêu**: Sau 4-6 lần iterate, bạn có một đoạn mô tả đủ chi tiết để bất kỳ AI nào cũng code được đúng.

### Bước 3: Thu hoạch "Super Prompt"

Sau khi hài lòng với giao diện preview trên v0, **hãy tổng hợp lại toàn bộ yêu cầu** thành một prompt hoàn chỉnh. Đây là "Super Prompt" — bản thiết kế bằng lời:

```markdown
## Super Prompt Template

### Layout
[Mô tả cấu trúc tổng thể, tỉ lệ cột, container]

### Visual Style
[Màu sắc, light/dark mode, density, font nếu cần]

### Components chi tiết
[Từng section, từng element quan trọng]

### Behavior & Interactions
[Hover states, transitions, empty states, loading states]

### Data & Business Logic
[Các rule nghiệp vụ cần phản ánh trong UI]

### Tech Constraints (QUAN TRỌNG)
[Stack thực tế: Vite/React/TypeScript, CSS variables, không dùng shadcn, v.v.]
```

### Bước 4: Giao cho Antigravity với Super Prompt

Paste Super Prompt vào Antigravity kèm context cụ thể:

```
Implement this UI component for our [Project Name].

Tech stack: [Vite + React + TypeScript / Next.js / etc.] + [CSS framework]
File to edit: [path/to/TargetComponent.tsx]
Existing patterns: [mô tả patterns đang dùng trong project]

[Paste Super Prompt vào đây]
```

---

## 📐 Kỹ thuật iterate hiệu quả trên v0.dev

### Thứ tự ưu tiên khi refine

```
1. STRUCTURE (layout, grid, columns)
   → Phải đúng trước khi lo style

2. CONTENT (what info goes where)
   → Xác định dữ liệu nào hiển thị ở đâu

3. STYLE (colors, typography, spacing)
   → Chỉnh sau khi structure đã ổn

4. INTERACTION (hover, click, animation)
   → Layer cuối cùng
```

### Câu lệnh iterate mẫu theo từng layer

**Structure:**
```
"Move the search bar to the top full width"
"Make the right panel fixed width 380px instead of percentage"
"Add a sticky header to the cart panel"
```

**Content:**
```
"Show product SKU code below product name in smaller text"
"Add 'Còn hàng: X' stock indicator on each product card"
"Cart summary: subtotal, discount row, total — stacked at bottom"
```

**Style:**
```
"More compact — reduce padding, smaller font for secondary info"
"Product cards: white bg, subtle border, soft shadow on hover"
"Total amount: 22px bold, color #DC2626 (red-600)"
```

**Interaction:**
```
"Product card: blue border highlight when in cart"
"Qty stepper: disable minus when qty = 1"
"Cart item row: show delete button only on hover"
```

---

## 🚫 Anti-patterns cần tránh

| Sai | Đúng |
|-----|------|
| Copy code từ v0 vào project | Chỉ lấy **prompt/mô tả**, không lấy code |
| Dùng v0 một lần rồi lấy prompt ngay | Iterate ít nhất 3-4 lần để prompt đủ chi tiết |
| Quên ghi Tech Constraints | Luôn nêu rõ stack thực tế (Vite, không có shadcn, v.v.) |
| Prompt quá chung chung | Càng cụ thể càng tốt — số liệu, màu hex, tên field |
| Để Antigravity đoán layout | Luôn mô tả rõ structure trước tiên |

---

## 💡 Tips nâng cao

### Dùng v0 để so sánh variants

Tạo 2-3 prompt khác nhau trên v0 để so sánh hướng thiết kế:
```
Variant A: "Compact grid layout, 4 products per row"
Variant B: "List layout with large product image, one per row"
Variant C: "Mixed: featured products + grid below"
```
Chọn variant ưng nhất → tinh chỉnh tiếp → harvest Super Prompt.

### Prompt cho component tái sử dụng

Khi design component dùng nhiều lần, thêm phần này vào Super Prompt:
```
### Props Interface
- variant: 'default' | 'compact' | 'featured'
- showStock: boolean
- onSelect: callback khi click
```

### Checklist trước khi giao Antigravity

- [ ] Layout structure đã rõ ràng (columns, rows, sizing)
- [ ] Visual style đã cụ thể (màu, spacing density)
- [ ] Data fields đã liệt kê đủ
- [ ] Edge cases đã đề cập (empty, loading, error)
- [ ] Tech constraints đã nêu
- [ ] File target đã chỉ định

---

## 🔗 Resources

- [v0.dev](https://v0.dev) — Prompt lab chính
- [Skill ui-ux-pro-max](../ui-ux-pro-max/SKILL.md) — Dùng kết hợp: ui-ux-pro-max để chọn design system, v0-prompt-engineer để tinh chỉnh prompt cụ thể
