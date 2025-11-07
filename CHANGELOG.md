# Changelog

All notable changes to Biteful will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2025-01-08

### Added
- 🐳 **Custom Database Image** - Separate PostgreSQL 16 Alpine image
  - `pamsler/biteful-db` on Docker Hub
  - PostgreSQL contrib extensions included
  - UTF-8 locale support
  - Health checks configured
  - SBOM and Provenance attestation
- 🎨 **UI Color Improvements**
  - Cancel/Abbrechen buttons now red for better visibility
  - Backup code buttons (Download/Copy) now green
  - Local authentication badge now green (SSO stays blue)
  - Consistent color scheme across profile and MFA settings

### Changed
- Docker deployment now uses two separate images:
  - Application: `pamsler/biteful:v0.1.6`
  - Database: `pamsler/biteful-db:v0.1.6`
- Updated `push-to-dockerhub.sh` to build and push both images
- Updated all documentation for dual-image deployment

### Infrastructure
- New database image: `pamsler/biteful-db`
- Both images available on Docker Hub
- Platform: `linux/amd64`
- Database base: `postgres:16-alpine`

## [0.1.5] - 2025-01-07

### Added
- 🔧 **Database-Driven Passkey Configuration** - Passkey settings now stored in database
  - New **Settings → Security** tab for configuring WebAuthn settings
  - Configure RP ID, RP Name, and Origin via admin UI
  - No environment variables required anymore
  - Runtime configuration without container restart
  - Settings validation before saving
- 🗄️ **Database Updates**
  - Added `passkey_settings` table
  - Default values: localhost, Biteful, http://localhost:8570

### Changed
- Passkey configuration moved from environment variables to database
- `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` environment variables now optional (fallback only)
- Settings page now has dedicated Security tab
- All passkey routes now fetch configuration from database

### Improved
- Simpler production deployment - no need to set passkey ENV vars
- Better user experience with UI-based configuration
- More flexible configuration management

## [0.1.4] - 2025-01-07

### Added
- 🔑 **Passkey Support (WebAuthn)** - Passwordless biometric authentication
  - Fingerprint and face recognition login
  - Platform authenticator support (Windows Hello, Touch ID, Face ID)
  - Multiple passkey credentials per user
  - Passkey registration with optional credential naming
  - Mutually exclusive with MFA (only one security method active at a time)
  - Only available for local users (not SSO)
  - Browser support detection
- 🔐 **Enhanced Security Integration**
  - Automatic MFA disable when passkey is enabled
  - Automatic passkey disable when MFA is enabled
  - Warning messages in both MFA and Passkey settings
  - Passkey login option on login page
- 🗄️ **Database Updates**
  - Added `passkey_enabled` column
  - Added `passkey_credentials` JSONB array for multiple credentials
  - Added `passkey_challenge` for authentication flow
- 🌐 **WebAuthn Configuration**
  - `PASSKEY_RP_ID` environment variable for Relying Party ID
  - `PASSKEY_ORIGIN` environment variable for origin validation

### Changed
- Profile Security tab now shows both MFA and Passkey settings
- Login page shows "Sign in with Passkey" button when username is entered
- Updated all translations (German and English) with passkey strings

### Technical
- Backend: `@simplewebauthn/server` v10.0.1
- Frontend: `@simplewebauthn/browser` v10.0.0
- W3C WebAuthn Level 2 compliant

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

[0.1.6]: https://github.com/pamsler/biteful/releases/tag/v0.1.6
[0.1.5]: https://github.com/pamsler/biteful/releases/tag/v0.1.5
[0.1.4]: https://github.com/pamsler/biteful/releases/tag/v0.1.4
[0.1.3]: https://github.com/pamsler/biteful/releases/tag/v0.1.3
[0.1.2]: https://github.com/pamsler/biteful/releases/tag/v0.1.2
[0.1.1]: https://github.com/pamsler/biteful/releases/tag/v0.1.1
[0.1.0]: https://github.com/pamsler/biteful/releases/tag/v0.1.0
