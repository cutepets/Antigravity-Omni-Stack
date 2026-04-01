---
name: smart-commit
description: Tạo commits theo conventional commit format với proper scope và meaningful messages. Dùng LUÔN khi commit code — không bao giờ commit trực tiếp mà không qua skill này. Kích hoạt khi có task liên quan đến git commit, save changes, hoặc commit message. Adapted từ Sentry commit conventions.
metadata:
  author: getsentry (adapted)
  source: https://github.com/getsentry/skills/tree/main/plugins/sentry-skills/skills/commit
  version: "1.0.0"
---

# Smart Commit

Tạo commits với proper conventional commit format, bao gồm scope, body, và references.

## Prerequisites

Trước khi commit, luôn check branch hiện tại:

```bash
git branch --show-current
```

**Nếu đang ở `main` hoặc `master`, PHẢI tạo feature branch trước** — trừ khi user yêu cầu commit vào main.

```bash
git checkout -b feat/order-payment-flow
```

## Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Header bắt buộc. Scope optional. Tất cả dòng phải dưới 100 ký tự.

## Commit Types

| Type | Mục đích |
|------|----------|
| `feat` | Feature mới |
| `fix` | Bug fix |
| `refactor` | Refactoring (không thay đổi behavior) |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `test` | Thêm hoặc sửa tests |
| `build` | Build system hoặc dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance tasks |
| `style` | Code formatting (không thay đổi logic) |

## Scopes theo Project Structure

| Scope | Phạm vi |
|-------|---------|
| `auth` | Authentication, JWT, guards |
| `orders` | Order management |
| `customers` | Customer management |
| `products` | Product/inventory |
| `payments` | Payment processing |
| `pos` | POS interface |
| `api` | API layer chung |
| `ui` | UI components |
| `db` | Database, Prisma schema |
| `config` | Configuration |
| `deps` | Dependencies |
| `agent` | AI agent skills/workflows |

## Subject Line Rules

- Dùng imperative, present tense: "Add feature" không phải "Added feature"
- Capitalize chữ đầu tiên
- Không có dấu chấm ở cuối
- Tối đa 70 ký tự
- **Dùng tiếng Anh** cho subject (dễ đọc trong git log)

## Body Guidelines

- Giải thích **what** và **why**, không phải how
- Dùng tiếng Việt cho body nếu cần giải thích chi tiết
- Include motivation cho thay đổi
- Contrast với previous behavior khi relevant

## Commit Command (Đúng Cách)

```bash
# ✅ Multi -m style
git commit \
  -m "feat(orders): Add payment status tracking" \
  -m "Track partial payment states (PENDING/PARTIAL/PAID) to allow
multi-payment flow in POS. Update order status automatically
when full payment is received.

Fixes #123"
```

```bash
# ❌ TUYỆT ĐỐI KHÔNG dùng \n literal trong message
git commit -m "feat: Add feature\nThis has a newline"  # WRONG — tạo literal \n
```

## Footer: Issue References

```
Fixes #1234       → closes issue khi merge
Refs #1234        → links không close
```

## Examples

### Bug fix với scope
```
fix(pos): Handle null remainingBalance in order completion

The 'Hoàn thành đơn' button was not appearing when order was fully paid
because remainingBalance comparison was using !== instead of Math.abs() check.

Fixes #89
```

### Feature
```
feat(products): Add bulk import from CSV

Support importing multiple products at once via CSV file upload.
Format: name, sku, price, stock, category.

Refs #45
```

### Refactor
```
refactor(orders): Extract payment processing to dedicated service

Move payment logic from OrdersService into PaymentService for
better separation of concerns and testability.
```

### Schema change
```
feat(db): Add OrderPayment table for payment history

Track all payment transactions per order to support:
- Multi-payment (partial payments)
- Payment method mixing
- Audit trail

BREAKING: Requires migration: npx prisma migrate deploy
```

### Chores / Agent work
```
chore(agent): Add react-best-practices and code-review skills

Import and adapt 6 community skills from awesome-agent-skills:
- react-best-practices (Vercel)
- react-composition-patterns (Vercel)
- code-review (Sentry)
- find-bugs (Sentry)
- postgres-best-practices (Supabase)
- security-review (OpenAI)
- smart-commit (Sentry)
```

## Breaking Changes

```
feat(api)!: Rename customerId to client_id in order responses

BREAKING CHANGE: Frontend phải update tất cả references từ
order.customerId sang order.client_id
```

## Principles

- Mỗi commit là một single, stable change
- Commits phải independently reviewable
- Repository phải ở working state sau mỗi commit
- Không bundle unrelated changes vào một commit

## Pre-Commit Checklist

Trước khi commit, verify:
- [ ] `tsc --noEmit` pass (TypeScript không có errors)
- [ ] Không có `console.log` debug statements
- [ ] Không có `.env` hay secrets trong staged files
- [ ] `git diff --staged` đã review
- [ ] Commit message follow format trên
