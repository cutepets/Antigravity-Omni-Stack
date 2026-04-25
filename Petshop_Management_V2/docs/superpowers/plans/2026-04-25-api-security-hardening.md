# API Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining backend security gaps after commit `4314248`, especially public sensitive uploads, default admin bootstrap risk, proxy-aware rate limiting, and token exposure in JSON responses.

**Architecture:** Keep public assets and private documents on separate access paths. All sensitive files are stored outside the public static mount and downloaded only through authenticated controllers. Auth bootstrap must fail closed in production, and rate limiting must identify the real client behind Cloudflare/reverse proxies.

**Tech Stack:** NestJS 11, Express 5, `@nestjs/throttler`, Helmet, Multer, Jest/Supertest, pnpm workspace.

---

## File Structure

- Modify `apps/api/src/main.ts`: remove global public serving of all `uploads`, add proxy trust config, optionally serve only explicitly-public assets.
- Modify `apps/api/src/app.module.ts`: keep global `ThrottlerGuard`; optionally wire custom throttler guard if proxy tracker is needed.
- Create `apps/api/src/common/security/request-ip.util.ts`: normalize trusted client IP from Express/Cloudflare headers.
- Create `apps/api/src/common/security/proxy-throttler.guard.ts`: use normalized IP for throttler tracking if Nest's default guard does not respect `req.ip` after `trust proxy`.
- Modify `apps/api/src/modules/auth/auth.controller.ts`: stop returning raw tokens in JSON when cookies are used.
- Modify `apps/api/src/modules/auth/bootstrap.service.ts`: remove default production password fallback and remove credential logging/comment.
- Modify `apps/api/src/modules/staff/staff.controller.ts`: stream real document files through guarded route.
- Modify `apps/api/src/modules/staff/staff.service.ts`: store staff documents under a private directory and resolve paths safely.
- Modify `apps/api/src/modules/reports/reports.controller.ts`: store finance attachments privately or move them behind a guarded download route.
- Modify `apps/api/src/modules/reports/reports.service.ts`: persist/access private finance attachment paths if current transaction flow stores returned URLs.
- Modify `.env.example` and `.env.production.example`: document `BOOTSTRAP_ADMIN_PASSWORD`, trusted proxy settings, public/private upload directories.
- Modify `pnpm-lock.yaml`: include committed `helmet` dependency update.
- Add or update tests in `apps/api/test/auth.e2e-spec.ts`, `apps/api/src/modules/auth/auth.service.spec.ts`, `apps/api/src/modules/staff/staff.controller.spec.ts`, and `apps/api/src/modules/reports/reports.controller.spec.ts`.

---

### Task 1: Confirm Impact Scope Before Any Code Edits

**Files:**
- No source edits.

- [ ] **Step 1: Run GitNexus impact for changed symbols**

Run:

```bash
gitnexus_impact({target: "bootstrap", direction: "upstream", repo: "Dev2", includeTests: true})
gitnexus_impact({target: "AppModule", direction: "upstream", repo: "Dev2", includeTests: true})
gitnexus_impact({target: "AuthController", direction: "upstream", repo: "Dev2", includeTests: true})
gitnexus_impact({target: "StaffController", direction: "upstream", repo: "Dev2", includeTests: true})
gitnexus_impact({target: "StaffService", direction: "upstream", repo: "Dev2", includeTests: true})
gitnexus_impact({target: "ReportsController", direction: "upstream", repo: "Dev2", includeTests: true})
gitnexus_impact({target: "ReportsService", direction: "upstream", repo: "Dev2", includeTests: true})
```

Expected: report each risk level. If any result is HIGH or CRITICAL, stop and warn before continuing.

- [ ] **Step 2: Snapshot the exact current security diff**

Run:

```bash
git show --stat --oneline 4314248
git status --short
```

Expected: `4314248` includes API security files; note unrelated dirty files and avoid reverting them.

---

### Task 2: Make Sensitive Uploads Private

**Files:**
- Modify `apps/api/src/main.ts`
- Modify `apps/api/src/modules/staff/staff.service.ts`
- Modify `apps/api/src/modules/staff/staff.controller.ts`
- Modify `apps/api/src/modules/reports/reports.controller.ts`
- Modify `apps/api/src/modules/reports/reports.service.ts` if finance attachment persistence expects URL paths
- Test `apps/api/src/modules/staff/staff.controller.spec.ts`
- Test `apps/api/src/modules/reports/reports.controller.spec.ts`

- [ ] **Step 1: Write failing tests for public static leak**

Add tests proving uploaded staff documents and finance attachments are not directly reachable by static URL and are reachable only through guarded controller routes.

Expected behaviors:

```ts
expect('/uploads/documents/user-1/file.pdf').not.toBeServedByStaticMiddleware()
expect('/uploads/finance/file.pdf').not.toBeServedByStaticMiddleware()
expect(downloadDocumentWithJwt()).toReturnFileBytes()
expect(downloadDocumentWithoutJwt()).toReturn401()
```

- [ ] **Step 2: Remove broad static mount**

In `apps/api/src/main.ts`, replace the broad static mount:

```ts
app.useStaticAssets(join(process.cwd(), 'uploads'), {
  prefix: '/uploads/',
})
```

with either no static upload mount, or a narrow public-only mount:

```ts
app.useStaticAssets(join(process.cwd(), 'uploads/public'), {
  prefix: '/uploads/public/',
})
```

Use the narrow mount only if existing non-sensitive images genuinely need public URLs.

- [ ] **Step 3: Store staff documents outside the public tree**

Change staff document upload destination from:

```ts
destination: (req) => `uploads/documents/${req.params['id'] ?? 'unknown'}`
```

to:

```ts
destination: (req) => `storage/private/documents/${req.params['id'] ?? 'unknown'}`
```

Change persisted `fileUrl` to an internal storage key, for example:

```ts
const storageKey = `documents/${userId}/${file.filename}`
```

Persist that key in the existing `fileUrl` field if no schema change is desired.

- [ ] **Step 4: Stream staff documents from disk through the guarded route**

Update `downloadDocument` so local files are read from private storage and sent through the existing `@Permissions('staff.read')` route. Do not return mock bytes.

Expected local path resolution:

```ts
const { absolutePath } = resolveUploadedFilePath(doc.fileUrl, {
  publicPrefix: 'documents/',
  rootDir: 'storage/private/documents',
})
```

If `resolveUploadedFilePath` remains tied to public URL prefixes, create a separate helper for private storage keys and test `../` traversal rejection.

- [ ] **Step 5: Move finance attachments behind auth**

Change finance upload destination from `./uploads/finance` to `storage/private/finance`, return an attachment key instead of `/uploads/finance/...`, and add a guarded download endpoint if the frontend needs to display/download receipts.

Expected returned value:

```ts
return { success: true, data: { attachmentUrl: `finance/${file.filename}` } }
```

- [ ] **Step 6: Run targeted tests**

Run:

```bash
pnpm --filter @petshop/api test -- --runInBand src/modules/staff/staff.controller.spec.ts src/modules/reports/reports.controller.spec.ts
```

Expected: tests pass and no test expects direct `/uploads/documents` or `/uploads/finance` access.

---

### Task 3: Make Bootstrap Admin Fail Closed

**Files:**
- Modify `apps/api/src/modules/auth/bootstrap.service.ts`
- Modify `.env.example`
- Modify `.env.production.example`
- Test `apps/api/src/modules/auth/bootstrap.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests:

```ts
it('throws in production when BOOTSTRAP_ADMIN_PASSWORD is missing')
it('allows local fallback only outside production')
it('does not log the generated password')
```

- [ ] **Step 2: Require explicit production password**

Replace:

```ts
const defaultPassword = process.env['BOOTSTRAP_ADMIN_PASSWORD'] ?? 'Admin@123'
```

with:

```ts
const configuredPassword = process.env['BOOTSTRAP_ADMIN_PASSWORD']?.trim()
if (process.env['NODE_ENV'] === 'production' && !configuredPassword) {
  throw new Error('Missing required environment variable: BOOTSTRAP_ADMIN_PASSWORD')
}
const defaultPassword = configuredPassword || 'Admin@123'
```

- [ ] **Step 3: Remove credential disclosure from comments and logs**

Remove the comment containing `Default login: superadmin / Admin@123`.

Replace:

```ts
this.logger.log('Đã tạo tài khoản mặc định: superadmin / Admin@123')
```

with:

```ts
this.logger.log('Đã tạo tài khoản SuperAdmin bootstrap')
```

- [ ] **Step 4: Document required env**

Add to production example:

```env
BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-long-random-password
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @petshop/api test -- --runInBand src/modules/auth/bootstrap.service.spec.ts
```

Expected: all bootstrap tests pass.

---

### Task 4: Fix Proxy-Aware Rate Limiting

**Files:**
- Modify `apps/api/src/main.ts`
- Create `apps/api/src/common/security/request-ip.util.ts`
- Create or modify `apps/api/src/common/security/proxy-throttler.guard.ts`
- Modify `apps/api/src/app.module.ts`
- Test `apps/api/src/common/security/request-ip.util.spec.ts`

- [ ] **Step 1: Write IP normalization tests**

Test cases:

```ts
expect(getClientIp({ ip: '10.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.10' } })).toBe('203.0.113.10')
expect(getClientIp({ ip: '10.0.0.1', headers: { 'x-forwarded-for': '203.0.113.11, 10.0.0.1' } })).toBe('203.0.113.11')
expect(getClientIp({ ip: '198.51.100.2', headers: {} })).toBe('198.51.100.2')
```

- [ ] **Step 2: Enable Express proxy trust**

In `main.ts`, after app creation:

```ts
app.set('trust proxy', process.env['TRUST_PROXY'] ?? 'loopback, linklocal, uniquelocal')
```

If production only runs behind Cloudflare, document the deployment requirement that only Cloudflare can reach the origin.

- [ ] **Step 3: Use normalized IP for throttling if needed**

If default `ThrottlerGuard` still tracks the proxy IP, replace it with `ProxyThrottlerGuard`:

```ts
{ provide: APP_GUARD, useClass: ProxyThrottlerGuard }
```

The custom guard should override tracker extraction using `cf-connecting-ip`, then `x-forwarded-for`, then `req.ip`.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
pnpm --filter @petshop/api test -- --runInBand src/common/security/request-ip.util.spec.ts
pnpm --filter @petshop/api test:e2e -- --runInBand
```

Expected: IP tests pass and auth e2e still passes.

---

### Task 5: Stop Returning Tokens In JSON Bodies

**Files:**
- Modify `apps/api/src/modules/auth/auth.controller.ts`
- Test `apps/api/test/auth.e2e-spec.ts`
- Check web client auth consumption under `apps/web/src`

- [ ] **Step 1: Find frontend token consumers**

Run:

```bash
rg -n "accessToken|refreshToken|refresh_token|access_token" apps/web/src
```

Expected: identify whether frontend needs response-body tokens or can rely on cookies.

- [ ] **Step 2: Update auth e2e expectations**

Change login/refresh tests to expect cookies and no raw token fields in body:

```ts
expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
  expect.stringContaining('access_token='),
  expect.stringContaining('refresh_token='),
]))
expect(response.body.accessToken).toBeUndefined()
expect(response.body.refreshToken).toBeUndefined()
expect(response.body.user).toBeDefined()
```

- [ ] **Step 3: Return safe auth payload**

In `login` and `refresh`, keep `this.setAuthCookies(res, auth)` and replace `return auth` with:

```ts
return {
  success: true,
  user: auth.user,
}
```

- [ ] **Step 4: Update frontend if it reads body tokens**

If frontend stores tokens from body, remove that storage and rely on `credentials: 'include'` requests plus `/auth/me`.

- [ ] **Step 5: Run tests**

Run:

```bash
$env:JWT_SECRET='test-access-secret'; $env:JWT_REFRESH_SECRET='test-refresh-secret'; pnpm --filter @petshop/api test:e2e -- --runInBand
pnpm --filter @petshop/web type-check
```

Expected: auth e2e and web type-check pass.

---

### Task 6: Commit Lockfile And Security Docs

**Files:**
- Modify `pnpm-lock.yaml`
- Modify `.env.example`
- Modify `.env.production.example`

- [ ] **Step 1: Ensure lockfile matches package.json**

Run:

```bash
pnpm install --lockfile-only
git diff -- package.json apps/api/package.json pnpm-lock.yaml
```

Expected: `helmet@8.1.0` is present in `pnpm-lock.yaml`.

- [ ] **Step 2: Add deployment notes to env examples**

Document:

```env
BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-long-random-password
TRUST_PROXY=loopback, linklocal, uniquelocal
PUBLIC_UPLOAD_DIR=uploads/public
PRIVATE_UPLOAD_DIR=storage/private
```

- [ ] **Step 3: Confirm no real secrets are tracked**

Run:

```bash
git ls-files -- .env "**/.env" "**/.env.*"
rg -n "petshop-dev-secret|JWT_SECRET=|JWT_REFRESH_SECRET=|DATABASE_URL=.*://" --glob "!.env.example" --glob "!.env.production.example"
```

Expected: no tracked real secret files.

---

### Task 7: Full Verification And GitNexus Scope Check

**Files:**
- No source edits unless verification fails.

- [ ] **Step 1: Run full API verification**

Run:

```bash
pnpm --filter @petshop/api type-check
$env:JWT_SECRET='test-access-secret'; $env:JWT_REFRESH_SECRET='test-refresh-secret'; pnpm --filter @petshop/api test -- --runInBand
$env:JWT_SECRET='test-access-secret'; $env:JWT_REFRESH_SECRET='test-refresh-secret'; pnpm --filter @petshop/api test:e2e -- --runInBand
```

Expected: all pass.

- [ ] **Step 2: Run web verification if auth client changed**

Run:

```bash
pnpm --filter @petshop/web type-check
```

Expected: pass.

- [ ] **Step 3: Run GitNexus change detection before commit**

Run:

```bash
gitnexus_detect_changes({scope: "all", repo: "Dev2"})
```

Expected: changed symbols match auth/bootstrap/uploads/throttling scope. Investigate unexpected flows before committing.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/api/src apps/api/test .env.example .env.production.example pnpm-lock.yaml docs/superpowers/plans/2026-04-25-api-security-hardening.md
git commit -m "security: harden private uploads and auth bootstrap"
```

Expected: commit succeeds. After commit, run `npx gitnexus analyze` if the workflow needs a fresh index.

---

## Self-Review

- Spec coverage: covers all review findings: public sensitive uploads, bootstrap default credential, proxy-aware throttling, token response body, lockfile/env docs, and verification.
- Placeholder scan: no task depends on an unspecified future decision except the explicit fork in Task 2 about whether public assets are genuinely needed; both choices are concrete.
- Type consistency: proposed helpers use storage keys and existing Nest/Jest stack; no schema change is required unless the team chooses to rename `fileUrl`.
