# Changelog

All notable changes to Biteful will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2025-01-06

### Added
- 🔐 **Multi-Factor Authentication (MFA/2FA)** - TOTP-based authentication for local users
  - Authenticator app support (Google Authenticator, Microsoft Authenticator, etc.)
  - QR code generation for easy setup
  - 10 backup codes for account recovery
  - MFA only available for local users (not SSO)
- 👤 **User Profile Page** - Dedicated profile page with two tabs
  - Account tab with user information
  - Security tab with MFA settings
- 🔒 **Enhanced Security Features**
  - Two-stage authentication (temporary JWT → full JWT after MFA)
  - Backup codes with one-time use
  - Password confirmation for MFA disable

### Changed
- Updated login flow to support MFA verification
- Profile accessible via user avatar in sidebar
- Theme toggle icons consistent across login and app (yellow sun in dark, gray moon in light)

### Fixed
- Login page flickering after SSO authentication
- MFA form cancel button now solid red for better visibility
- Sidebar button alignment for avatar and language toggle

## [0.1.2] - 2025-01-05

### Added
- 📧 **Configurable Email Notifications**
  - Daily menu emails
  - Weekly reminder emails
  - SMTP configuration in settings
- 👥 **Enhanced User Management**
  - Last login tracking for all users
  - Admin dashboard with user activity
- 🌍 **Multi-Language Support**
  - German (🇩🇪) and English (🇬🇧)
  - Language toggle in sidebar
  - Automatic browser language detection

### Changed
- Updated README with new features
- Improved settings page layout

## [0.1.1] - 2025-01-04

### Added
- 🔐 **SSO Integration** - Microsoft Entra ID (Azure AD) support
  - OAuth 2.0 authentication
  - Automatic user provisioning
  - Role mapping from SSO groups
- 📱 **Responsive Design Improvements**
  - Better mobile layout
  - Optimized sidebar for tablets

### Fixed
- Database migration issues
- Docker health check reliability

## [0.1.0] - 2025-01-03

### Added
- 🍽️ **Initial Release** - Complete meal planning application
- 📅 **Weekly Meal Planning** - Plan all meals for the week
- 🛒 **Smart Shopping Lists** - Auto-generated from meal plans
- 🤖 **AI Recipe Suggestions** - Claude AI and OpenAI integration
- 📸 **Product Recognition** - Upload receipt images
- 📊 **Recipe Management** - Create, edit, and organize recipes
- 🐳 **Docker Deployment**
  - Multi-stage optimized build
  - PostgreSQL database
  - Production-ready configuration
  - Health checks and monitoring
- 🔒 **Security Features**
  - JWT authentication
  - Encrypted credentials
  - Non-root Docker user
  - SHA256 pinned base images
  - SBOM and Provenance attestation

### Infrastructure
- Docker Hub: `pamsler/biteful`
- Platform: `linux/amd64`
- Base Image: `node:25-bookworm-slim`

---

## Release Types

- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features, backwards compatible
- **Patch** (0.0.x): Bug fixes, backwards compatible

[0.1.3]: https://github.com/pamsler/biteful/releases/tag/v0.1.3
[0.1.2]: https://github.com/pamsler/biteful/releases/tag/v0.1.2
[0.1.1]: https://github.com/pamsler/biteful/releases/tag/v0.1.1
[0.1.0]: https://github.com/pamsler/biteful/releases/tag/v0.1.0
