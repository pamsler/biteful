# 🚀 Production Deployment Guide

## Schnellstart für Production Server

### 1. Voraussetzungen auf dem Server

```bash
# Docker & Docker Compose installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose V2
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### 2. Deployment Files auf Server kopieren

```bash
# Nur diese Dateien werden benötigt:
scp docker-compose.production.yml user@server:/opt/meal-planner/
scp .env.production.example user@server:/opt/meal-planner/
```

### 3. Environment Variables konfigurieren

```bash
# Auf dem Server
cd /opt/meal-planner
cp .env.production.example .env
nano .env
```

**Secrets generieren:**
```bash
# JWT Secret
openssl rand -base64 32

# Encryption Key
openssl rand -hex 32
```

**Minimal erforderliche Werte in .env:**
```env
POSTGRES_PASSWORD=IhrStarkesPasswort123!
JWT_SECRET=GenerierterJWTSecret
ENCRYPTION_KEY=GenerierterEncryptionKey
ADMIN_USERNAME=admin
ADMIN_PASSWORD=IhrAdminPasswort123!
ADMIN_EMAIL=admin@ihredomain.com
```

### 4. Application starten

```bash
cd /opt/meal-planner
docker-compose -f docker-compose.production.yml up -d
```

### 5. Logs überprüfen

```bash
# Alle Logs
docker-compose -f docker-compose.production.yml logs -f

# Nur App Logs
docker-compose -f docker-compose.production.yml logs -f app

# Nur DB Logs
docker-compose -f docker-compose.production.yml logs -f postgres
```

### 6. Health Check

```bash
curl http://localhost:8570/api/health
# Expected: {"status":"ok"}
```

## 🔄 Updates durchführen

```bash
# Neues Image pullen
docker-compose -f docker-compose.production.yml pull

# Neu starten mit neuem Image
docker-compose -f docker-compose.production.yml up -d

# Alte Images aufräumen
docker image prune -a
```

## 🔐 Reverse Proxy mit Nginx (Empfohlen)

### Nginx Konfiguration

```nginx
server {
    listen 80;
    server_name ihre-domain.com;

    # SSL mit Let's Encrypt (empfohlen)
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/ihre-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/ihre-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8570;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Optional: SSL erzwingen
    # if ($scheme != "https") {
    #     return 301 https://$server_name$request_uri;
    # }
}
```

### Let's Encrypt SSL Zertifikat

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx

# Zertifikat erstellen
sudo certbot --nginx -d ihre-domain.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

## 📊 Monitoring & Maintenance

### Container Status prüfen

```bash
docker ps
docker stats
```

### Backup erstellen

```bash
# Datenbank Backup
docker exec meal-planner-db pg_dump -U mealuser mealplanner > backup_$(date +%Y%m%d).sql

# Volumes Backup
docker run --rm -v meal-planner_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .
docker run --rm -v meal-planner_product_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads_backup.tar.gz -C /data .
```

### Restore von Backup

```bash
# Datenbank Restore
cat backup_20241105.sql | docker exec -i meal-planner-db psql -U mealuser -d mealplanner

# Volumes Restore
docker run --rm -v meal-planner_postgres_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/postgres_data_backup.tar.gz"
```

## 🔧 Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
docker-compose -f docker-compose.production.yml logs app

# Container Status
docker ps -a

# Container neu starten
docker-compose -f docker-compose.production.yml restart app
```

### Datenbank Connection Fehler

```bash
# DB Health Check
docker exec meal-planner-db pg_isready -U mealuser

# DB Logs
docker-compose -f docker-compose.production.yml logs postgres

# DB Shell
docker exec -it meal-planner-db psql -U mealuser -d mealplanner
```

### Port bereits belegt

```bash
# Port in .env ändern
echo "APP_PORT=8571" >> .env

# Neu starten
docker-compose -f docker-compose.production.yml up -d
```

## 🛡️ Security Best Practices

1. **Firewall konfigurieren**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Fail2Ban für SSH**
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

3. **Automatische Updates**
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

4. **Docker Socket Schutz**
```bash
# Nicht den Docker Socket exponieren
# Nur notwendige Ports öffnen
```

5. **Secrets Rotation**
```bash
# Regelmäßig JWT_SECRET und ENCRYPTION_KEY rotieren
# In .env ändern und Container neu starten
```

## 📈 Performance Tuning

### PostgreSQL Tuning

```bash
# In docker-compose.production.yml bei postgres service hinzufügen:
command:
  - "postgres"
  - "-c"
  - "shared_buffers=256MB"
  - "-c"
  - "max_connections=100"
  - "-c"
  - "work_mem=4MB"
```

### Resource Limits anpassen

```yaml
# In docker-compose.production.yml bei app service:
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 2G
```

## 🔄 Systemd Service (Optional)

Erstellen Sie `/etc/systemd/system/meal-planner.service`:

```ini
[Unit]
Description=Meal Planner Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/meal-planner
ExecStart=/usr/bin/docker-compose -f docker-compose.production.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.production.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Aktivieren:
```bash
sudo systemctl enable meal-planner
sudo systemctl start meal-planner
sudo systemctl status meal-planner
```

## 📞 Support

Bei Problemen:
1. Logs prüfen
2. GitHub Issues: https://github.com/pamsler/meal-planner/issues
3. Email: pascal.amsler@amslertec.ch
