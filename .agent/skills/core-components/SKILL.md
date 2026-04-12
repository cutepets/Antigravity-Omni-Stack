---
version: 4.1.0-fractal
name: core-components
description: Core component library and design system patterns. Use when building UI, using design tokens, or working with the component library.
---

# Core Components

## Design System Overview

Use components from your core library instead of raw platform components. This ensures consistent styling and behavior.

## Design Tokens

**NEVER hard-code values. Always use design tokens.**

## Petshop Design Token Reference

Dự án dùng Tailwind với các convention sau (xem `apps/web/src/app/globals.css` để confirm):

| Token | Tailwind Class | Dùng cho |
|-------|---------------|---------|
| Brand primary | `primary-500` | Buttons, links, active states |
| Background base | `background-base` | Page bg |
| Background secondary | `background-secondary` | Cards, panels |
| Foreground | `foreground` | Heading text |
| Foreground muted | `foreground-muted` | Labels, secondary text |
| Border | `border` | Card borders, dividers |
| Error | `rose-500` | Error states |
| Warning | `amber-500` | Warning states |

**Border radius conventions:**
- Cards/Panels: `rounded-[28px]` hoặc `rounded-2xl`
- Inputs: `rounded-xl`
- Buttons: `rounded-2xl` (large), `rounded-xl` (small)
- Badges: `rounded-full`

**Height conventions:**
- Large button/input: `h-11` hoặc `h-12`
- Standard button: `h-10`
- Small button: `h-9`
- Table row height: implicit, padding `py-2` hoặc `py-3`

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Spacing Tokens](./sub-skills/spacing-tokens.md)
### 2. [Color Tokens](./sub-skills/color-tokens.md)
### 3. [Typography Tokens](./sub-skills/typography-tokens.md)
### 4. [Box](./sub-skills/box.md)
### 5. [HStack / VStack](./sub-skills/hstack-vstack.md)
### 6. [Text](./sub-skills/text.md)
### 7. [Button](./sub-skills/button.md)
### 8. [Input](./sub-skills/input.md)
### 9. [Card](./sub-skills/card.md)
### 10. [Screen Layout](./sub-skills/screen-layout.md)
### 11. [Form Layout](./sub-skills/form-layout.md)
### 12. [List Item Layout](./sub-skills/list-item-layout.md)
