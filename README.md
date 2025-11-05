# 🍽️ Meal Planner (Wochenplaner)

Smart meal planning and shopping list application with SSO support, built with Node.js, React, and PostgreSQL.

[![Docker Image](https://img.shields.io/badge/docker-pamsler%2Fwochenplaner-blue)](https://hub.docker.com/r/pamsler/wochenplaner)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-25.1-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org)

## ✨ Features

- 📅 **Weekly Meal Planning** - Plan your meals for the entire week
- 🛒 **Smart Shopping Lists** - Automatically generate shopping lists from meals
- 👥 **Multi-User Support** - Family-friendly with user management
- 🔐 **SSO Integration** - Optional Azure EntraID/Microsoft 365 authentication
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🌙 **Dark Mode** - Easy on the eyes
- 📊 **Activity Tracking** - See what your family is planning
- 🔄 **Real-time Sync** - Changes sync across all devices
- 🔍 **External Recipe APIs** - Integration with Spoonacular and Edamam

## 🏗️ Architecture

- **Frontend:** React 18 + TypeScript + Vite 6 + TailwindCSS
- **Backend:** Node.js 25 + Express
- **Database:** PostgreSQL 16
- **Authentication:** JWT + Optional SSO (Azure EntraID)
- **Container:** Multi-stage Docker build, SHA256 pinned, Multi-arch (amd64/arm64)
- **Security:** Supply chain attestation (SBOM + Provenance)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/pamsler/meal-planner.git
cd meal-planner

# Copy environment file
cp .env.example .env

# Edit .env and fill in your values
nano .env

# Generate secrets
openssl rand -base64 32  # JWT_SECRET
openssl rand -hex 32     # ENCRYPTION_KEY

# Start the application
docker-compose up -d
```

Access the application at: `http://localhost:8570`

### Option 2: Production Deployment

Pull the pre-built image from Docker Hub:

```bash
# Download production files
curl -o docker-compose.production.yml https://raw.githubusercontent.com/pamsler/meal-planner/main/docker-compose.production.yml
curl -o .env.example https://raw.githubusercontent.com/pamsler/meal-planner/main/.env.production.example

# Configure
cp .env.example .env
nano .env

# Start
docker-compose -f docker-compose.production.yml up -d
```

See [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) for detailed instructions.

## 📋 Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 512MB RAM minimum
- PostgreSQL 16 (included in docker-compose)

## 🔧 Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://mealuser:YOUR_PASSWORD@postgres:5432/mealplanner

# Security - CRITICAL!
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Admin Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
ADMIN_EMAIL=admin@example.com
```

### Optional Features

```env
# External Recipe APIs
SPOONACULAR_API_KEY=your_api_key_here
EDAMAM_APP_ID=your_app_id_here
EDAMAM_APP_KEY=your_app_key_here

# Azure EntraID SSO
SSO_ENABLED=true
SSO_TENANT_ID=your_tenant_id
SSO_CLIENT_ID=your_client_id
SSO_CLIENT_SECRET=your_client_secret
SSO_REDIRECT_URI=https://yourdomain.com/auth/callback
```

See [.env.production.example](.env.production.example) for all available options.

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Start backend (terminal 1)
cd backend
npm run dev

# Start frontend (terminal 2)
cd frontend
npm run dev
```

### Project Structure

```
meal-planner/
├── frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── api/          # API client functions
│   │   └── types/        # TypeScript types
│   └── package.json
├── backend/              # Node.js Express backend
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── server.js     # Main server file
│   └── package.json
├── Dockerfile            # Multi-stage Docker build
├── docker-compose.yml    # Development compose
└── docker-compose.production.yml  # Production compose
```

## 🐳 Docker Hub

Pre-built images are available on Docker Hub:

```bash
docker pull pamsler/wochenplaner:v0.1.0
# or
docker pull pamsler/wochenplaner:latest
```

**Image Features:**
- ✅ Multi-architecture (linux/amd64, linux/arm64)
- ✅ SHA256 pinned base images
- ✅ Supply chain attestation (SBOM + Provenance)
- ✅ Non-root user (UID 1001)
- ✅ Health checks included
- ✅ Alpine-based for minimal size

See [DOCKER_HUB_README.md](DOCKER_HUB_README.md) for more details.

## 🔒 Security

- **Non-root User**: Container runs as unprivileged user (UID 1001)
- **SHA256 Pinned**: Base images are pinned to specific SHA256 hashes
- **No Secrets in Image**: All sensitive data via environment variables
- **Supply Chain**: SBOM and Provenance attestation included
- **Health Checks**: Built-in container health monitoring
- **HTTPS Ready**: Reverse proxy configuration included

## 📖 Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [Docker Optimization Summary](DOCKER_OPTIMIZATION_SUMMARY.md)
- [Docker Hub README](DOCKER_HUB_README.md)
- [Environment Variables](.env.production.example)

## 🚢 Deployment Scripts

### Push to Docker Hub

```bash
./push-to-dockerhub.sh v0.1.0
```

**Note:** Fill in your Docker Hub credentials in the script first.

### Push to GitHub

```bash
./push-to-github.sh
```

The script will:
- Initialize Git repository
- Perform security checks (no credentials)
- Ask for your GitHub repository URL
- Show files to be committed
- Create commit and push

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Credits

Developed by [AmslerTec](mailto:pascal.amsler@amslertec.ch)

## 📞 Support

- 📧 Email: pascal.amsler@amslertec.ch
- 🐛 Issues: [GitHub Issues](https://github.com/pamsler/meal-planner/issues)

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Recipe scraping from URLs
- [ ] Meal plan templates
- [ ] Nutrition tracking
- [ ] Shopping list sharing
- [ ] Barcode scanning
- [ ] Calendar integration

---

Made with ❤️ for better meal planning
