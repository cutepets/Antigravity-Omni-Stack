# 🖥️ VPS Configuration

## Connection Info

| Field | Value |
|-------|-------|
| **IP** | 45.124.84.169 |
| **Port** | 26266 |
| **User** | root |
| **SSH Key** | `~/.ssh/antigravity_vps` |
| **Alias** | `petshop-vps` |

## SSH Commands

```bash
# Kết nối VPS
ssh petshop-vps

# Hoặc full command
ssh -p 26266 -i ~/.ssh/antigravity_vps root@45.124.84.169

# Upload file lên VPS
scp -P 26266 -i ~/.ssh/antigravity_vps <file_local> root@45.124.84.169:<path_vps>

# Download file từ VPS
scp -P 26266 -i ~/.ssh/antigravity_vps root@45.124.84.169:<path_vps> <file_local>
```

## Running Services

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| n8n | n8n | 5678 | Automation |
| n8n Redis | n8n_redis | 6379 | |
| n8n Postgres | n8n_postgres | 5432 | |
| Portainer | portainer | 8000, 9443 | Docker UI |
| Uptime Kuma | uptime_kuma | 3001 | Monitoring |
| Home Assistant | homeassistant | — | |

## Paths

| App | Path |
|-----|------|
| Petshop (VPS) | `/root/petshop` |

## Useful Commands on VPS

```bash
# Xem containers đang chạy
docker ps

# Kiểm tra RAM/Disk
free -h && df -h /
```

## Petshop Production Env Fixes

### Missing `APP_SECRET_ENCRYPTION_KEY`

Error in Settings:

```text
Loi khi luu: Missing required environment variable: APP_SECRET_ENCRYPTION_KEY
```

Root cause: API encrypts Google OAuth Client Secret, Google Drive refresh token, and service account JSON before saving them to DB. On VPS, `.env` must contain a stable encryption key.

Run on VPS:

```bash
ssh petshop-vps
cd /root/petshop

# Generate one stable key. Save this value and do not rotate it casually.
openssl rand -base64 48
```

Add the generated value to `/root/petshop/.env`:

```env
APP_SECRET_ENCRYPTION_KEY="PASTE_GENERATED_VALUE_HERE"
```

Restart the API container:

```bash
docker compose -f docker-compose.prod.yml up -d api
# or restart all app services after a deploy
docker compose -f docker-compose.prod.yml up -d --build
```

Verify the API container received the variable:

```bash
docker compose -f docker-compose.prod.yml exec api printenv APP_SECRET_ENCRYPTION_KEY
```

Important:

- Keep `APP_SECRET_ENCRYPTION_KEY` unchanged after secrets have been saved.
- If this key changes, previously saved encrypted secrets cannot be decrypted. Re-enter Google OAuth Client Secret and reconnect Google Drive.
- `docker-compose.prod.yml` uses `env_file: .env` for the API, so the variable must be in the project `.env` on VPS, not only in the local `.env`.

### Google OAuth redirect URI shows `localhost`

If Settings shows Google Login or Google Link callback as `http://localhost:3001/...`, add these public URL variables to `/root/petshop/.env`:

```env
PUBLIC_API_URL="https://app.petshophanoi.com"
PUBLIC_WEB_URL="https://app.petshophanoi.com"
NEXT_PUBLIC_API_URL="https://app.petshophanoi.com"
CORS_ORIGINS="https://app.petshophanoi.com"
```

Then restart API:

```bash
cd /root/petshop
docker compose -f docker-compose.prod.yml up -d api
```

Verify:

```bash
curl -s http://127.0.0.1:3003/api/auth/google/status
```

Expected callback URLs:

```text
https://app.petshophanoi.com/api/auth/google/callback
https://app.petshophanoi.com/api/auth/google/link/callback
https://app.petshophanoi.com/api/settings/google-drive/oauth/callback
```

## SSH Config (C:\Users\Admin\.ssh\config)

```
Host petshop-vps
    HostName 45.124.84.169
    User root
    Port 26266
    IdentityFile ~/.ssh/antigravity_vps
    StrictHostKeyChecking no
```
