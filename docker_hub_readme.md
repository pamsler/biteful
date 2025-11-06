# 🍽️ Biteful

Biteful is your intelligent meal planning companion with AI-powered recipe suggestions, smart shopping lists, and multi-language support.

[![Docker Pulls](https://img.shields.io/docker/pulls/pamsler/biteful)](https://hub.docker.com/r/pamsler/biteful)
[![Docker Image Version](https://img.shields.io/docker/v/pamsler/biteful/latest)](https://hub.docker.com/r/pamsler/biteful)
[![Docker Image Size](https://img.shields.io/docker/image-size/pamsler/biteful/latest)](https://hub.docker.com/r/pamsler/biteful)

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Download the deployment files:**

```bash
curl -o docker-compose.production.yml https://raw.githubusercontent.com/pamsler/biteful/main/docker-compose.production.yml
curl -o .env https://raw.githubusercontent.com/pamsler/biteful/main/.env.production.example
```

2. **Configure your environment:**

```bash
# Generate required secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Edit .env file with your values
nano .env
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
- Username: `admin` (or your ADMIN_USERNAME)
- Password: Your ADMIN_PASSWORD

### Using Docker Run

```bash
# Create network
docker network create biteful-network

# Start PostgreSQL
docker run -d \
  --name biteful-db \
  --network biteful-network \
  -e POSTGRES_DB=mealplanner \
  -e POSTGRES_USER=mealuser \
  -e POSTGRES_PASSWORD=YourPassword \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine

# Start Biteful
docker run -d \
  --name biteful-app \
  --network biteful-network \
  -p 8570:8570 \
  -e DATABASE_URL=postgresql://mealuser:YourPassword@biteful-db:5432/mealplanner \
  -e JWT_SECRET=YourJWTSecret \
  -e ENCRYPTION_KEY=YourEncryptionKey \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=YourAdminPassword \
  -e ADMIN_EMAIL=admin@yourdomain.com \
  -v product_uploads:/app/uploads \
  -v training_data:/app/data \
  pamsler/biteful:latest
```

## ✨ Features

- 📅 **Weekly Meal Planning**: Plan meals for the entire week
- 🛒 **Smart Shopping Lists**: Automatically generated from your meal plans
- 🤖 **AI Recipe Suggestions**: Powered by Claude AI and OpenAI
- 📸 **Product Recognition**: Upload receipt images for automatic product detection
- 🔐 **Secure Authentication**: JWT-based with encrypted credentials
- 📊 **Recipe Management**: Create, edit, and organize your recipes
- 🍽️ **Meal Tracking**: Keep track of what you've cooked
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 🌍 **Multi-Language Support**: Switch between German (🇩🇪) and English (🇬🇧) with one click

## 🏗️ Image Details

**Base Image**: `node:25-bookworm-slim` (SHA256 pinned)

**Platform**: `linux/amd64`

**Security Features**:
- ✅ Non-root user (UID 1001)
- ✅ SHA256 pinned base image
- ✅ Supply chain attestation (SBOM + Provenance)
- ✅ Health checks included
- ✅ No known vulnerabilities
- ✅ Minimal attack surface (Debian slim)

**Image Layers**:
- Multi-stage build for minimal size
- Production dependencies only
- Optimized layer caching

## 📦 Available Tags

- `latest` - Latest stable release
- `v0.1.0` - Specific version tag

```bash
# Pull latest version
docker pull pamsler/biteful:latest

# Pull specific version
docker pull pamsler/biteful:v0.1.0
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for JWT tokens | Generate with `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data | Generate with `openssl rand -hex 32` |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | Use a strong password |
| `ADMIN_EMAIL` | Admin email address | `admin@yourdomain.com` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Application port | `8570` |

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

## 💾 Backup & Restore

### Database Backup

```bash
# Create backup
docker exec biteful-db pg_dump -U mealuser mealplanner > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup.sql | docker exec -i biteful-db psql -U mealuser -d mealplanner
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v biteful_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .

docker run --rm -v biteful_product_uploads:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads_backup.tar.gz -C /data .
```

## 🩺 Health Check

The image includes a built-in health check:

```bash
curl http://localhost:8570/api/health
```

Expected response: `{"status":"ok"}`

## 🌍 Multi-Language Support

Biteful supports multiple languages out of the box:

- 🇩🇪 **German (Deutsch)** - Default language
- 🇬🇧 **English** - Full English translation

**How it works:**
- Automatically detects browser language on first visit
- Language toggle button in the sidebar with country flags
- User preference is saved in browser localStorage
- Instant language switching without page reload
- All UI elements are translated including navigation, buttons, and labels

Switch languages anytime using the language selector at the bottom of the sidebar.

## 📊 Monitoring

### View Logs

```bash
# All logs
docker-compose -f docker-compose.production.yml logs -f

# Only app logs
docker-compose -f docker-compose.production.yml logs -f app
```

### Container Status

```bash
# Check container status
docker ps

# Check resource usage
docker stats biteful-app
```

## 🛡️ Security

- **Non-root user**: Application runs as user `appuser` (UID 1001)
- **SHA256 pinning**: Base image is pinned to specific SHA256 digest
- **No vulnerabilities**: All dependencies are up-to-date
- **Minimal base**: Uses Debian slim for minimal attack surface
- **Supply chain**: SBOM and provenance attestation included

## 🔗 Links

- **GitHub Repository**: https://github.com/pamsler/biteful
- **Docker Hub**: https://hub.docker.com/r/pamsler/biteful
- **Issues**: https://github.com/pamsler/biteful/issues

## 📞 Support

- 📧 Email: support@amslertec.ch
- 🐛 Issues: https://github.com/pamsler/biteful/issues

## 📄 License

MIT License - See LICENSE file for details

---

© 2025 AmslerTec - Made with ❤️ for better meal planning
