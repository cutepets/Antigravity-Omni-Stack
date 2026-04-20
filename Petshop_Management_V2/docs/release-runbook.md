# Release Runbook

## Local Setup

1. Install Node.js 20+ and pnpm 10+.
2. Install dependencies with `pnpm install`.
3. Start infrastructure with `pnpm infra:up`.
4. Configure environment files for API and web from the project examples or deployment secrets.
5. Prepare database with `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed` when demo data is required.

## Staging Verification

Run checks in this order before promoting a build:

```bash
pnpm lint
pnpm type-check
pnpm --filter @petshop/api test
pnpm build
pnpm audit:generated-artifacts
pnpm utf8:check
```

If API end-to-end database credentials are available, also run:

```bash
pnpm --filter @petshop/api test:e2e
```

## Smoke Checklist

- Auth: login, refresh, logout, and `/auth/me` with cookie auth.
- Orders: create order, pay, complete, cancel, refund, export stock, and settle.
- Stock: create receipt, receive stock, supplier return, and supplier refund.
- Stock count: claim shift, submit count variance, complete shift, approve session.
- Reports: dashboard totals and cashbook transaction list against known fixture data.
- Uploads: image upload, document upload, delete file, and blocked path traversal.

## Production Release

1. Confirm migrations are backward compatible.
2. Run `pnpm db:status` against production.
3. Apply migrations with `pnpm db:migrate:prod`.
4. Build release artifacts with `pnpm build`.
5. Deploy API and web using the platform release process.
6. Run the staging verification smoke checklist against production URLs.

## Rollback

1. Roll back application deployment to the previous build.
2. Do not rollback database migrations unless a tested down-migration exists.
3. If data correction is required, create an explicit hotfix script and run it once with logs retained.
4. Re-run auth, orders, stock, stock-count, and reports smoke checks after rollback.

## Known Tooling Debt

- Web `type-check` is coupled to Next build behavior; use `pnpm --filter @petshop/web build` as the primary frontend gate when standalone web type-check is unstable.
- GitNexus currently reports dirty files from sibling folders when run at `C:\Dev2`; ignore `claw-code` and `glm-key-monitor` for this repository unless explicitly working on them.
