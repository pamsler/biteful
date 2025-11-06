# 🍽️ Wochenplaner - Deployment

Smart meal planning and shopping list application.

[![Docker Image](https://img.shields.io/badge/docker-pamsler%2Fwochenplaner-blue)](https://hub.docker.com/r/pamsler/wochenplaner)

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Installation

1. **Download the deployment files:**

```bash
curl -o docker-compose.production.yml https://raw.githubusercontent.com/pamsler/wochenplaner/main/docker-compose.production.yml
curl -o .env https://raw.githubusercontent.com/pamsler/wochenplaner/main/.env.production.example
```

2. **Configure your environment:**

```bash
# Edit .env file with your values
nano .env
```

**Generate required secrets:**
```bash
# JWT Secret
openssl rand -base64 32

# Encryption Key
openssl rand -hex 32
```

**Minimum required configuration:**
```env
POSTGRES_PASSWORD=YourStrongDatabasePassword
JWT_SECRET=YourGeneratedJWTSecret
ENCRYPTION_KEY=YourGeneratedEncryptionKey
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongAdminPassword
ADMIN_EMAIL=admin@yourdomain.com
```

3. **Start the application:**

```bash
docker-compose -f docker-compose.production.yml up -d
```

4. **Access the application:**

Open your browser: `http://localhost:8570`

Default login:
- Username: `admin` (or the value you set in ADMIN_USERNAME)
- Password: Your ADMIN_PASSWORD

## 📦 Docker Image

Pre-built images are available on Docker Hub:

```bash
docker pull pamsler/wochenplaner:v0.1.0
docker pull pamsler/wochenplaner:latest
```

**Image Features:**
- Platform: linux/amd64
- SHA256 pinned base images
- Supply chain attestation (SBOM + Provenance)
- Security: Non-root user, health checks

## 🔄 Updates

To update to the latest version:

```bash
# Pull the latest image
docker-compose -f docker-compose.production.yml pull

# Restart with new image
docker-compose -f docker-compose.production.yml up -d

# Clean up old images
docker image prune -a
```

## 📊 Maintenance

### Backup

```bash
# Database backup
docker exec wochenplaner-db pg_dump -U mealuser mealplanner > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i wochenplaner-db psql -U mealuser -d mealplanner
```

### View Logs

```bash
# All logs
docker-compose -f docker-compose.production.yml logs -f

# Only app logs
docker-compose -f docker-compose.production.yml logs -f app
```

### Health Check

```bash
curl http://localhost:8570/api/health
```

Expected response: `{"status":"ok"}`

## 📞 Support

- 📧 Email: support@amslertec.ch
- 🐳 Docker Hub: https://hub.docker.com/r/pamsler/wochenplaner

---

© 2025 AmslerTec - Made with ❤️ for better meal planning
