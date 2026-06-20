# SZ Inventory — Deployment Guide

Mini PC running Ubuntu Server as the host. Accessible online via Cloudflare Tunnel and on the local network (LAN) when internet is down.

---

## Architecture

```
ONLINE (internet available)
Any device anywhere  →  https://inventory.yourdomain.com  →  Cloudflare  →  Mini PC

OFFLINE (internet down)
Any device on LAN    →  http://192.168.100.X:3000  →  Mini PC
```

The app runs entirely on the mini PC. The Cloudflare tunnel going down does not stop the local server — LAN access always works as long as the mini PC is on.

---

## Mini PC Requirements

- Ubuntu Server 22.04 LTS or later
- Node.js 18+
- Docker + Docker Compose (for PostgreSQL and PostgREST)
- `cloudflared` (Cloudflare tunnel daemon)

---

## 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

---

## 2. Clone and Configure the App

```bash
git clone <your-repo-url> /opt/szinventory
cd /opt/szinventory

# Install dependencies
npm install

# Copy and edit environment file
cp .env.example .env.local
nano .env.local
```

### Key .env.local values to update

```env
NODE_ENV=production

# Set this to your Cloudflare domain (used in email links)
NEXT_PUBLIC_API_URL=https://inventory.yourdomain.com

# PostgREST and DB — keep as localhost (they run locally on the mini PC)
POSTGREST_URL=http://localhost:8036
DATABASE_URL=postgresql://szinventoryv2single:YOUR_PASSWORD@localhost:5436/szinventoryv2single

# Change this to a strong random secret
JWT_SECRET=replace-with-a-strong-random-secret-at-least-32-chars

# Your SMTP settings for email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your-app-password
```

---

## 3. Start the Database (Docker)

```bash
cd /opt/szinventory
docker-compose up -d

# Verify containers are running
docker ps

# Run schema on first setup
docker exec -i <postgres-container-name> psql -U szinventoryv2single -d szinventoryv2single < 01_schema.sql
```

---

## 4. Build and Start the App

```bash
cd /opt/szinventory
npm run build
npm start
```

### Run as a system service (auto-start on boot)

Create `/etc/systemd/system/szinventory.service`:

```ini
[Unit]
Description=SZ Inventory App
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/szinventory
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable szinventory
sudo systemctl start szinventory

# Check status
sudo systemctl status szinventory
```

---

## 5. Firewall

```bash
sudo ufw allow 3000/tcp    # Next.js app (LAN access)
sudo ufw allow 22/tcp      # SSH
sudo ufw enable
```

> Port 8036 (PostgREST) and 5436 (PostgreSQL) should NOT be opened — they are internal only.

---

## 6. Static Local IP (Important)

Assign a reserved/static IP to the mini PC so the LAN fallback URL never changes.

**Option A — Router DHCP reservation (recommended):**
1. Log in to your router admin page (usually `192.168.100.1`)
2. Find the mini PC by its MAC address (`ip link show`)
3. Reserve a fixed IP, e.g., `192.168.100.50`

**Option B — Set static IP on Ubuntu:**

Edit `/etc/netplan/00-installer-config.yaml`:

```yaml
network:
  ethernets:
    eth0:
      dhcp4: no
      addresses: [192.168.100.50/24]
      gateway4: 192.168.100.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
  version: 2
```

```bash
sudo netplan apply
```

---

## 7. Online Access — Cloudflare Tunnel

### Install cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### Authenticate and create tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create szinventory
```

### Configure tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/ubuntu/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: inventory.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Point your domain to the tunnel

```bash
cloudflared tunnel route dns szinventory inventory.yourdomain.com
```

### Run tunnel as a service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## 8. Access URLs

| Mode | URL |
|------|-----|
| **Online** | `https://inventory.yourdomain.com` |
| **Offline / LAN fallback** | `http://192.168.100.50:3000` |

Bookmark both. When internet is down, use the LAN URL — the app and data are fully local.

---

## 9. Optional — Local Hostname

If your router supports local DNS (most do under "LAN" or "DHCP" settings), you can set:

```
inventory.local  →  192.168.100.50
```

Then the offline URL becomes `http://inventory.local:3000` — easier to remember than an IP.

---

## Maintenance

### Update the app

```bash
cd /opt/szinventory
git pull
npm install
npm run build
sudo systemctl restart szinventory
```

### View app logs

```bash
sudo journalctl -u szinventory -f
```

### View tunnel logs

```bash
sudo journalctl -u cloudflared -f
```

### Restart everything

```bash
sudo systemctl restart szinventory
sudo systemctl restart cloudflared
docker-compose -f /opt/szinventory/docker-compose.yml restart
```

### Backup the database

```bash
docker exec <postgres-container-name> pg_dump -U szinventoryv2single szinventoryv2single > backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| App not loading on LAN | `sudo ufw status` — is port 3000 open? |
| App not loading online | `sudo systemctl status cloudflared` |
| Database errors | `docker ps` — are containers running? |
| App crashes on start | `sudo journalctl -u szinventory -n 50` |
| Tunnel not routing | `cloudflared tunnel info szinventory` |
