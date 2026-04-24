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
| Petshop (VPS) | `/root/Petshop_Service_Management` *(chưa deploy)* |

## Useful Commands on VPS

```bash
# Xem containers đang chạy
docker ps

# Kiểm tra RAM/Disk
free -h && df -h /
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
