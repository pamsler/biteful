# 🍽️ Meal Planner (Wochenplaner)

Smart meal planning and shopping list application with SSO support, built with Node.js, React, and PostgreSQL.

[![Docker Image Size](https://img.shields.io/docker/image-size/pamsler/wochenplaner/latest)](https://hub.docker.com/r/pamsler/wochenplaner)
[![Docker Pulls](https://img.shields.io/docker/pulls/pamsler/wochenplaner)](https://hub.docker.com/r/pamsler/wochenplaner)
[![Security: A+ Rating](https://img.shields.io/badge/security-A%2B-brightgreen)]()
[![Alpine Based](https://img.shields.io/badge/base-alpine-0D597F)]()
[![Multi-Arch](https://img.shields.io/badge/arch-amd64%20%7C%20arm64-blue)]()

## 🚀 Quick Start

```bash
# Pull the image
docker pull pamsler/wochenplaner:v0.1.0
# or
docker pull pamsler/wochenplaner:latest

# Run with docker-compose (recommended)
curl -o docker-compose.production.yml https://raw.githubusercontent.com/pamsler/meal-planner/main/docker-compose.production.yml
curl -o .env.example https://raw.githubusercontent.com/pamsler/meal-planner/main/.env.production.example

# Configure environment
cp .env.example .env
nano .env  # Fill in your values

# Start
docker-compose -f docker-compose.production.yml up -d
```

## ✨ Features

- 📅 **Weekly Meal Planning** - Plan your meals for the entire week
- 🛒 **Smart Shopping Lists** - Automatically generate shopping lists from meals
- 👥 **Multi-User Support** - Family-friendly with user management
- 🔐 **SSO Integration** - Azure EntraID/Microsoft 365 authentication
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🌙 **Dark Mode** - Easy on the eyes
- 📊 **Activity Tracking** - See what your family is planning
- 🔄 **Real-time Sync** - Changes sync across all devices

## 🏗️ Architecture

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL 16
- **Authentication:** JWT + Optional SSO (Azure EntraID)
- **Container:** Alpine-based, SHA256 pinned, Multi-arch (amd64/arm64)
- **Security:** Supply chain attestation (SBOM + Provenance)

## 📋 Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 512MB RAM minimum
- PostgreSQL 16 (included in docker-compose)

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://mealuser:YOUR_PASSWORD@postgres:5432/mealplanner

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Admin Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
ADMIN_EMAIL=admin@example.com
```

See `.env.example` for all available configuration options.

## 🐳 Docker Compose Example

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: mealplanner
      POSTGRES_USER: mealuser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mealuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: pamsler/wochenplaner:v0.1.0
    restart: unless-stopped
    ports:
      - "8570:8570"
    environment:
      DATABASE_URL: postgresql://mealuser:${POSTGRES_PASSWORD}@postgres:5432/mealplanner
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      ADMIN_USERNAME: ${ADMIN_USERNAME}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
    volumes:
      - product_uploads:/app/uploads
      - training_data:/app/data
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  product_uploads:
  training_data:
```

## 🔒 Security Features

✅ **Non-root User** - Container runs as unprivileged user (UID 1001)
✅ **Multi-stage Build** - Minimal attack surface
✅ **No Secrets in Image** - All sensitive data via environment variables
✅ **Health Checks** - Built-in container health monitoring
✅ **Minimal Dependencies** - Only required runtime libraries
✅ **Regular Updates** - Based on official Node.js images

## 📊 Image Details

- **Base Image:** node:20-alpine (SHA256 pinned)
- **Architecture:** linux/amd64, linux/arm64
- **Size:** ~250MB compressed (Alpine)
- **Layers:** Optimized multi-stage build
- **User:** appuser (UID 1001)
- **Attestation:** SBOM + Provenance
- **Vulnerabilities:** Minimal (A+ security rating)

## 🛡️ Health Check

The container includes a built-in health check endpoint:

```bash
curl http://localhost:8570/api/health
```

## 📖 Documentation

- [Production Deployment Guide](https://github.com/pamsler/meal-planner/blob/main/PRODUCTION_DEPLOYMENT.md)
- [Docker Optimization Summary](https://github.com/pamsler/meal-planner/blob/main/DOCKER_OPTIMIZATION_SUMMARY.md)
- [Environment Variables](.env.production.example)

## 🔄 Available Tags

- `v0.1.0` - Stable release v0.1.0
- `latest` - Latest stable release
- All versions are multi-arch (amd64/arm64)

## 📦 Verification

Verify image attestation:
```bash
docker buildx imagetools inspect pamsler/wochenplaner:v0.1.0 --format "{{json .Provenance}}"
```

## 🤝 Support

- 📫 Email: pascal.amsler@amslertec.ch
- 🐛 Issues: [GitHub Issues](https://github.com/pamsler/meal-planner/issues)

## 📝 License

MIT License

## 🙏 Credits

Developed by AmslerTec
