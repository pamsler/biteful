# 🍽️ Biteful - Smart Meal Planning

Biteful - Your intelligent meal planning companion with AI-powered recipe suggestions and multi-language support.

[![Docker Image](https://img.shields.io/badge/docker-pamsler%2Fbiteful-blue)](https://hub.docker.com/r/pamsler/biteful)

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Installation

1. **Download the deployment files:**

```bash
curl -o docker-compose.production.yml https://raw.githubusercontent.com/pamsler/biteful/main/docker-compose.production.yml
curl -o .env https://raw.githubusercontent.com/pamsler/biteful/main/.env.production.example
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

## 📦 Docker Images

Pre-built images are available on Docker Hub:

**Application Image:**
```bash
docker pull pamsler/biteful:v0.1.15
docker pull pamsler/biteful:latest
```

**Database Image:**
```bash
docker pull pamsler/biteful-db:v0.1.15
docker pull pamsler/biteful-db:latest
```

**Image Features:**
- Platform: linux/amd64
- SHA256 pinned base images
- Supply chain attestation (SBOM + Provenance)
- Security: Non-root user, health checks
- Custom PostgreSQL 16 Alpine database image

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
docker exec biteful-db pg_dump -U mealuser mealplanner > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i biteful-db psql -U mealuser -d mealplanner
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

## ✨ Key Features

- 📅 **Weekly Meal Planning** - Plan all meals for the week
- 🛒 **Smart Shopping Lists** - Auto-generated from meal plans with intelligent product suggestions
- 🇨🇭 **Swiss Product Catalog** - 153 pre-loaded products from Migros, Coop, Lidl, Denner
- 🔍 **Hybrid Search** - Lightning-fast product search combining SQLite catalog with custom products
- 🕐 **Smart Recently Used** - Track completed shopping items with automatic 7-day cleanup
- 📱 **Push Notifications** - Real-time browser notifications for shopping list changes (add/remove items)
- 🔔 **User-Configurable Notifications** - Per-user notification settings in profile (enable/disable, test notifications)
- 🌍 **Language-Specific Notifications** - Each user receives notifications in their preferred language (German/English)
- 🔄 **Live Shopping List Updates** - Silent auto-refresh every 5 seconds, no manual reload needed
- 👥 **User Management** - Last login tracking & admin controls
- 🔐 **Multi-Factor Authentication (MFA)** - TOTP-based 2FA for local users with backup codes
- 🔑 **Passkey Support (WebAuthn/FIDO2)** - Passwordless biometric authentication
  - Works with Bitwarden, 1Password, and platform authenticators
  - Database-driven configuration (no environment variables needed)
  - Configure via Settings → Security tab
  - Supports multiple passkeys per user
- 👤 **User Profiles** - Dedicated profile page with account, security, and notification settings
- 🖼️ **Profile Pictures** - Upload custom profile pictures (local users) or auto-sync from Microsoft Entra ID (SSO users)
- 📧 **Email Notifications** - Configurable daily/weekly reminders
- 🤖 **AI-Powered** - Claude AI and OpenAI integration
- 🔒 **Secure** - JWT authentication with encryption
- 🌍 **Multi-Language** - German 🇩🇪 and English 🇬🇧

## 🌍 Multi-Language Support

Biteful supports multiple languages out of the box:
- 🇩🇪 **Deutsch** (German) - Default
- 🇬🇧 **English**

**Features:**
- Automatic language detection based on browser settings
- Language toggle in the sidebar with SVG flag icons (consistent rendering on all devices)
- User preference saved in database and synced across devices
- Instant language switching without page reload
- Language-specific push notifications - each user receives notifications in their preferred language
- Easy to extend with additional languages

Users can switch languages at any time using the language toggle button at the bottom of the sidebar.

- 🐳 Docker Hub: https://hub.docker.com/r/pamsler/biteful

---

© 2025 AmslerTec - Made with ❤️ for better meal planning
