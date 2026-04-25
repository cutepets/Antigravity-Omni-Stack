---
name: vps-docker-deploy
description: >
  Deploy Petshop Management V2 lên VPS qua Docker Compose.
  Quy trình chuẩn: commit → push → SSH → deploy.sh (pull + build + recreate + migrate + health check).
category: infrastructure
version: 1.1.0
owner: devops-engineer
triggers:
  - deploy lên VPS
  - up bản mới lên VPS
  - đóng gói docker deploy
  - release production
---

# VPS Docker Deploy

> **Goal**: Deploy phiên bản mới nhất của Petshop Management V2 lên VPS production an toàn, lặp lại được, và có rollback.

## 1. System Introduction

**Petshop Management V2** — Hệ thống quản lý cửa hàng thú cưng

| Thông tin | Giá trị |
|-----------|---------|
| **Tên hệ thống** | Petshop Service Management System v2 |
| **Kiến trúc** | Turborepo Monorepo |
| **Backend** | NestJS (Node.js 20) |
| **Frontend** | Next.js 15 |
| **Database** | PostgreSQL 16 + Redis 7 |
| **Container** | Docker Compose multi-stage |
| **Domain** | `app.petshophanoi.com` |
| **Version file** | `package.json` → field `version` |
| **Changelog** | `CHANGELOG.md` |

**Modules chính:**
POS, Orders, Inventory, Products, Pets, Hotel, Grooming/Spa, Staff, Payroll, Reports, Settings, Storage (Google Drive + Local)

## 2. VPS Connection

| Field | Value |
|-------|-------|
| **SSH Alias** | `petshop-vps` |
| **IP** | `45.124.84.169` |
| **Port** | `26266` |
| **User** | `root` |
| **Key** | `~/.ssh/antigravity_vps` |
| **Project Dir** | `/root/petshop` |
| **App Dir** | `/root/petshop/Petshop_Management_V2` |
| **Branch** | `codex/baseline-upgrade` |

## 3. Architecture

```
VPS (/root/petshop/)
├── docker-compose.prod.yml   ← Build context: ./Petshop_Management_V2
├── .env                      ← Production environment vars
├── deploy.sh                 ← One-command deploy script
└── Petshop_Management_V2/    ← Git-tracked source code
    ├── Dockerfile            ← Multi-stage build (api-runner + web-runner)
    ├── CHANGELOG.md          ← Lịch sử phiên bản
    ├── package.json          ← Version chính (semver)
    ├── apps/api/             ← NestJS API → port 3003
    ├── apps/web/             ← Next.js Web → port 3002
    └── packages/             ← Shared packages
```

**Containers:**

| Container | Image Target | Internal Port | Exposed |
|-----------|-------------|---------------|---------|
| `petshop_api` | `api-runner` | 3001 | `127.0.0.1:3003` |
| `petshop_web` | `web-runner` | 3000 | `127.0.0.1:3002` |
| `petshop_postgres` | `postgres:16-alpine` | 5432 | internal only |
| `petshop_redis` | `redis:7-alpine` | 6379 | internal only |

## 4. Deploy Flow (8 Steps)

### Pre-flight (trước khi deploy)

```bash
# 1. Commit tất cả thay đổi local
git add -A && git commit -m "feat: <description>"

# 2. Push lên GitHub
git push origin codex/baseline-upgrade

# 3. Kiểm tra SSH
ssh petshop-vps "echo OK"
```

### Version & Changelog (BẮT BUỘC trước khi deploy)

Agent PHẢI thực hiện:

1. **Bump version** trong `package.json` theo semver:
   - `patch` (x.y.Z): bugfix, hotfix nhỏ
   - `minor` (x.Y.0): feature mới, cải thiện
   - `major` (X.0.0): breaking changes, rebuild lớn

2. **Cập nhật `CHANGELOG.md`** — thêm section mới lên đầu file:
   ```markdown
   ## [x.y.z] - YYYY-MM-DD

   ### Added / Changed / Fixed / Removed
   - Mô tả thay đổi
   ```

3. **Commit version bump** trước khi push:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "release: v{version} — {tóm tắt}"
   git push origin codex/baseline-upgrade
   ```

### Deploy (chạy trên VPS)

**Option A: One-command deploy (khuyến nghị)**

```bash
ssh petshop-vps "/root/petshop/deploy.sh"
```

**Option B: Step-by-step (khi cần debug)**

```bash
# Step 1: Pull code
ssh petshop-vps "cd /root/petshop/Petshop_Management_V2 && git pull origin codex/baseline-upgrade"

# Step 2: Build images
ssh petshop-vps "cd /root/petshop && docker compose -f docker-compose.prod.yml build api web"

# Step 3: Recreate containers
ssh petshop-vps "cd /root/petshop && docker compose -f docker-compose.prod.yml up -d --force-recreate api web"

# Step 4: Wait
sleep 10

# Step 5: Migrate
ssh petshop-vps "cd /root/petshop && docker compose -f docker-compose.prod.yml exec -T api /app/packages/database/node_modules/.bin/prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma"

# Step 6: Health check
ssh petshop-vps "curl -sf http://127.0.0.1:3003/api/health && curl -sI http://127.0.0.1:3002/ | head -3"
```

### Post-deploy (BÁO CÁO)

Agent PHẢI báo cáo cho user sau khi deploy thành công:

```
✅ Deploy v{version} thành công!
- Version: {version}
- Branch: {branch}
- Commit: {commit_hash}
- Changes: {tóm tắt CHANGELOG mục mới nhất}
- API: healthy
- Web: responding
```

## 5. Rollback

```bash
# Xem commit history
ssh petshop-vps "cd /root/petshop/Petshop_Management_V2 && git log --oneline -5"

# Rollback về commit cụ thể
ssh petshop-vps "cd /root/petshop/Petshop_Management_V2 && git checkout <commit_hash>"

# Rebuild
ssh petshop-vps "/root/petshop/deploy.sh"
```

## 6. Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `npx prisma` kéo v7.x | npx fetches latest | Dùng `pnpm exec prisma` hoặc `node_modules/.bin/prisma` |
| `Missing DATABASE_URL` | `prisma.config.ts` cần env var lúc generate | Dockerfile đã set dummy URL |
| Web không lên bản mới | Build context sai | Đã fix: `context: ./Petshop_Management_V2` |
| SSH timeout port 22 | VPS dùng port custom | Dùng alias `petshop-vps` (port 26266) |
| Container "Up X hours" | Docker reuse image nếu hash giống | Thêm `--force-recreate` |

## 7. Agent Checklist

Khi user yêu cầu deploy, agent PHẢI thực hiện ĐÚNG THỨ TỰ:

1. ✅ Commit local changes
2. ✅ **Bump version** trong `package.json` (semver)
3. ✅ **Cập nhật `CHANGELOG.md`** với mô tả thay đổi
4. ✅ Commit release: `release: v{version} — {summary}`
5. ✅ Push to GitHub
6. ✅ SSH vào VPS qua alias `petshop-vps`
7. ✅ Chạy `deploy.sh`
8. ✅ **Báo cáo** version + changes + health status

> **⚠️ KHÔNG BAO GIỜ** deploy mà không bump version và ghi changelog.
> **⚠️ KHÔNG BAO GIỜ** rsync/copy code thủ công. Luôn dùng `git pull` + Docker build.
