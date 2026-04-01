---
name: find-bugs
description: Tìm bugs, security vulnerabilities, và code quality issues trong local branch changes. Dùng khi được yêu cầu review changes, find bugs, security review, hoặc audit code trên current branch. Kích hoạt trước khi commit/deploy quan trọng. Adapted từ Sentry engineering practices cho NestJS + Prisma + React stack.
metadata:
  author: getsentry (adapted)
  source: https://github.com/getsentry/skills/tree/main/plugins/sentry-skills/skills/find-bugs
  version: "1.0.0"
---

# Find Bugs

Review changes trên branch này để tìm bugs, security vulnerabilities, và code quality issues.

## Phase 1: Complete Input Gathering

```bash
# Lấy full diff so với main branch
git diff main...HEAD

# Nếu output bị truncate, đọc từng file thay đổi
git diff main...HEAD --name-only
```

Phải đọc **mọi dòng thay đổi** trước khi tiếp tục. List tất cả modified files trước.

## Phase 2: Attack Surface Mapping

Với mỗi file thay đổi, identify và list:

- Tất cả **user inputs** (request params, headers, body, URL, query strings)
- Tất cả **database queries** (Prisma calls, raw SQL)
- Tất cả **authentication/authorization checks** (Guards, decorators)
- Tất cả **session/state operations** (JWT, cookies, cache)
- Tất cả **external calls** (HTTP APIs, webhooks, third-party services)
- Tất cả **cryptographic operations** (hashing, signing, encryption)

## Phase 3: Security Checklist (check MỌI item với MỌI file)

### Universal Checks
- [ ] **Injection**: SQL, command, template, header injection
- [ ] **XSS**: Tất cả outputs trong templates được escape đúng chưa?
- [ ] **Authentication**: Auth checks trên tất cả protected operations?
- [ ] **Authorization/IDOR**: Access control verified, không chỉ auth?
- [ ] **CSRF**: State-changing operations được protected?
- [ ] **Race conditions**: TOCTOU trong bất kỳ read-then-write patterns?
- [ ] **Session**: Fixation, expiration, secure flags?
- [ ] **Cryptography**: Secure random, proper algorithms, secrets không có trong logs?
- [ ] **Information disclosure**: Error messages, logs, timing attacks?
- [ ] **DoS**: Unbounded operations, missing rate limits, resource exhaustion?
- [ ] **Business logic**: Edge cases, state machine violations, numeric overflow?

### NestJS-Specific Checks
- [ ] **Guards missing**: Endpoints cần auth có `@UseGuards(JwtAuthGuard)` không?
- [ ] **DTO validation**: Input DTOs có `class-validator` decorators không?
- [ ] **Prisma over-fetch**: `findMany()` không có `select` có thể leak sensitive data?
- [ ] **N+1 queries**: Loops chứa database calls?
- [ ] **Unhandled rejections**: Async functions không có try-catch?
- [ ] **Module leakage**: Services exported từ module khi không cần?

### React-Specific Checks
- [ ] **useEffect deps**: Tất cả dependencies có trong array không?
- [ ] **Unhandled promises**: Event handlers có await/catch không?
- [ ] **XSS via dangerouslySetInnerHTML**: Có sanitize input không?
- [ ] **Secret in frontend code**: API keys, tokens trong client-side code?
- [ ] **Infinite re-renders**: Object/array literals trong deps array?

## Phase 4: Verification

Với mỗi potential issue:

- Kiểm tra xem nó có already handled ở nơi khác trong code không
- Search cho existing tests covering scenario
- Đọc surrounding context để verify issue là real

## Phase 5: Pre-Conclusion Audit

Trước khi kết luận, PHẢI:

1. List mọi file đã review và confirm đã đọc hoàn toàn
2. List mọi checklist item và note xem found issues hay confirmed clean
3. List các areas **không thể** fully verify và lý do
4. Chỉ sau đó mới cung cấp final findings

## Output Format

**Ưu tiên**: security vulnerabilities > bugs > code quality

**Skip**: stylistic/formatting issues

Với mỗi issue:

```
**File:Line** - Brief description
**Severity**: Critical | High | Medium | Low
**Problem**: Vấn đề gì
**Evidence**: Tại sao đây là real issue (không phải đã fix, không có test)
**Fix**: Concrete suggestion với code example
**References**: OWASP, NestJS docs, etc. nếu applicable
```

**Nếu không tìm thấy gì đáng kể, nói rõ — đừng invent issues.**

> ⚠️ **Chỉ báo cáo, không sửa.** User sẽ quyết định address cái gì.

## Severity Guide

| Level | Meaning | Examples |
|-------|---------|---------|
| Critical | Có thể exploit ngay, data breach, production down | Auth bypass, SQL injection, secret exposure |
| High | Quan trọng, cần fix sớm | N+1 trong endpoint chính, missing auth check |
| Medium | Code quality, minor risk | Unhandled error path, missing validation |
| Low | Improvement opportunity | Unused import, non-optimal query |
