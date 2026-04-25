---
name: vps-docker-deploy
description: >
  Deploy Petshop Management V2 lên VPS qua Docker Compose.
  Quy trình chuẩn: commit → push → SSH → deploy.sh (pull + build + recreate + migrate + health check).
category: infrastructure
version: 1.0.0
owner: devops-engineer
triggers:
  - deploy lên VPS
  - up bản mới lên VPS
  - đóng gói docker deploy
  - release production
---

# VPS Docker Deploy

> **Goal**: Deploy phiên bản mới nhất của Petshop Management V2 lên VPS production an toàn, lặp lại được, và có rollback.

## 1. VPS Connection

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
| **Domain** | `app.petshophanoi.com` |

## 2. Architecture

```
VPS (/root/petshop/)
├── docker-compose.prod.yml   ← Build context: ./Petshop_Management_V2
├── .env                      ← Production environment vars
├── deploy.sh                 ← One-command deploy script
└── Petshop_Management_V2/    ← Git-tracked source code
    ├── Dockerfile            ← Multi-stage build (api-runner + web-runner)
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

**Nginx** (host-level) reverse proxies `app.petshophanoi.com` → containers.

## 3. Deploy Flow (6 Steps)

### Pre-flight (trước khi deploy)

```bash
# 1. Commit tất cả thay đổi local
git add -A && git commit -m "feat: <description>"

# 2. Push lên GitHub
git push origin codex/baseline-upgrade

# 3. Kiểm tra SSH
ssh petshop-vps "echo OK"
```

### Deploy (chạy trên VPS)

**Option A: One-command deploy (khuyến nghị)**

```bash
ssh petshop-vps "/root/petshop/deploy.sh"
# Hoặc deploy branch cụ thể:
ssh petshop-vps "/root/petshop/deploy.sh main"
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

## 4. Rollback

Khi deploy thất bại hoặc web lỗi:

```bash
# Xem image cũ
ssh petshop-vps "docker images petshop-api --format 'table {{.ID}}\t{{.CreatedAt}}'"

# Rollback git
ssh petshop-vps "cd /root/petshop/Petshop_Management_V2 && git log --oneline -5"
ssh petshop-vps "cd /root/petshop/Petshop_Management_V2 && git checkout <commit_hash>"

# Rebuild từ commit cũ
ssh petshop-vps "/root/petshop/deploy.sh"
```

## 5. Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `npx prisma` kéo v7.x | npx fetches latest | Dùng `pnpm exec prisma` hoặc `/app/.../node_modules/.bin/prisma` |
| `Missing DATABASE_URL` | `prisma.config.ts` cần env var lúc generate | Dockerfile đã set dummy URL |
| Web không lên bản mới | Build context sai | Đã fix: `context: ./Petshop_Management_V2` |
| SSH timeout port 22 | VPS dùng port custom | Dùng alias `petshop-vps` (port 26266) |
| Container "Up X hours" | Docker reuse image nếu hash giống | Thêm `--force-recreate` |

## 6. Agent Checklist

Khi user yêu cầu deploy, agent PHẢI thực hiện theo thứ tự:

1. ✅ Commit local changes
2. ✅ Push to GitHub
3. ✅ SSH vào VPS qua alias `petshop-vps`
4. ✅ Chạy `deploy.sh` hoặc step-by-step
5. ✅ Verify health: API `curl /api/health` + Web HTTP status
6. ✅ Báo cáo kết quả cho user

> **⚠️ KHÔNG BAO GIỜ** rsync/copy code thủ công. Luôn dùng `git pull` + Docker build.
