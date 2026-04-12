---
name: ui-ux-pro-max-skill
description: Premium micro-interactions and motion toolkit for ERP/dashboard surfaces.
category: design
version: 5.0.0
layer: execution-skill
---

# UI/UX Pro Max — Dashboard Execution Toolkit

> Context: Petshop Management V2 là ERP dashboard nội bộ. KHÔNG phải landing page.
> Priority: Data clarity > Wow factor. Consistency > Experimentation.

## 1. Micro-interactions (Mandatory)

- **Hover**: `scale-[1.02]` + `transition-colors duration-150` trên interactive elements
- **Click/Active**: `scale-[0.98]` (press feel) trong `active:` variant
- **Loading**: Skeleton placeholders với `animate-pulse` — KHÔNG dùng spinner cho table rows
- **Error state**: `border-rose-500/60 bg-rose-500/5` — không dùng màu đỏ đậm gây panic
- **Success toast**: slide-in từ top-right, auto-dismiss 3s

## 2. Motion Standards

```js
// Framer Motion — Standard enter animation
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
}
// Stagger children: 0.05s (KHÔNG dùng 0.1s+ — quá chậm cho dashboard)
```

- **prefers-reduced-motion**: MANDATORY. Dùng `useReducedMotion()` hook.
- **Exit animations**: Dùng `AnimatePresence` cho modal/drawer.
- **Layout shift**: `layout` prop cho reorder, NOT cho table resize.

## 3. Dashboard-Specific Patterns

- **Table rows**: hover `bg-primary-500/4` — subtle, không distract
- **Sidebar active**: `bg-primary-500/12 text-primary-500 font-semibold`
- **Badge**: solid background, KHÔNG dùng outline-only (khó đọc trong table)
- **Empty state**: Illustrative icon + action button — KHÔNG chỉ text thuần
- **Number animation**: Count-up cho KPI cards khi data load

## 4. Forbidden in Dashboard Context

- ❌ `backdrop-filter: blur` trên table/form elements — gây blur text
- ❌ Bento grid cho data tables — dùng proper `<table>`
- ❌ Parallax effects trong dashboard (gây nausea)
- ❌ Auto-playing video backgrounds
- ❌ Purple/violet primary (xem `agent-frontend-design-system`)

## 5. Accessibility (Non-negotiable)

- Focus ring: `focus-visible:ring-2 focus-visible:ring-primary-500`
- Color contrast: Text trên background tối thiểu 4.5:1
- Keyboard navigation: Tab order phải logical
- ARIA: Form labels, table headers, dialog roles

---
*v5.0.0 — Dashboard-tuned. Phù hợp ERP context.*
