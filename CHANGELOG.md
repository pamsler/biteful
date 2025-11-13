# Changelog

All notable changes to Biteful will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.10] - 2025-01-13

### Added
- 📱 **Push Notifications for Shopping List** - Real-time notifications for shopping list changes
  - Notifications when items are added to the shopping list
  - Notifications when items are removed from the shopping list
  - Browser-based push notifications using Web Push API
  - Service Worker integration for background notifications
  - VAPID keys stored securely in database
- 🔔 **User-Configurable Notifications** - Individual notification settings in user profile
  - New "Notifications" tab in Profile page
  - Enable/disable notifications with browser permission request
  - Master toggle for all notifications
  - Individual toggles for "Add" and "Remove" notifications
  - Test notification button
  - Available for all users (both SSO and local)
  - Settings removed from Admin area (now per-user)
- 🌍 **Language-Specific Notifications** - Notifications in user's preferred language
  - Each user receives notifications in their own language (German/English)
  - Language preference stored in database (`users.preferred_language`)
  - Automatic language detection and sync on login
  - Sidebar language selector updates user preference
- 🔄 **Live Shopping List Updates** - Auto-refresh without manual reload
  - Silent 5-second polling for shopping list changes
  - Updates happen in background without loading spinner
  - Pauses when browser tab is hidden (saves resources)
  - Uses Visibility API for smart polling
  - Custom `useShoppingListSync` React hook
- 🚩 **Fixed Login Page Flags** - Consistent flag rendering across all devices
  - Replaced emoji flags with SVG flags
  - German flag (🇩🇪 → SVG)
  - British flag (🇬🇧 → SVG)
  - Consistent rendering on all browsers and devices

### Changed
- Profile page now has 3 tabs: Account, Security, Notifications
- Settings page no longer includes push notification configuration
- Language changes in sidebar now update database preference
- Shopping list uses silent background refresh instead of manual reload
- Push notifications exclude the user who performed the action

### Technical Details
- New database column: `users.preferred_language` (varchar)
- Push notification preferences per user in `push_subscriptions` table
- Frontend: `/var/docker/container/meal-planner/frontend/src/hooks/useShoppingListSync.ts`
- Backend: `/var/docker/container/meal-planner/backend/src/services/pushService.js`
- Profile component: Added `NotificationSettings` component
- Shopping API: Push notifications on add/remove/toggle operations

### API Changes
- `POST /api/users/me/language` - Update user's preferred language
- `GET /api/users/me` - Returns user with `preferred_language`
- Push notification endpoints already existed, now used in Profile

## [0.1.9] - 2025-11-11

### Added
- 🇨🇭 **Swiss Product Catalog (SQLite)** - 153 pre-loaded products from major Swiss retailers
  - Products from Migros, Coop, Lidl, and Denner
  - Separate SQLite database (`/app/data/products.db`) for product catalog
  - Full-text search (FTS5) for fast product lookup
  - 10 product categories with icons and colors
  - Popularity-based ranking
- 🔍 **Hybrid Search System** - Intelligent product search combining multiple sources
  - Searches SQLite catalog first (predefined products)
  - Then searches PostgreSQL (custom user products)
  - Automatic deduplication of results
  - Cached results for better performance (30-minute TTL)
- 🕐 **Smart "Recently Used" Tracking** - Improved shopping list item tracking
  - Now shows only products that were searched, added, and checked off
  - Added `completed_at` timestamp to `shopping_list_items` table
  - Migration to backfill timestamps for existing checked items
  - Database migration: `002-add-completed-at.js`
- 🧹 **Automatic Weekly Cleanup** - Scheduled maintenance for shopping data
  - Cron job runs every Sunday at midnight (CET/CEST)
  - Automatically removes checked items older than 7 days
  - Keeps database clean and performant
- ➕ **Add Products From Search Results** - Enhanced UI for custom product creation
  - "Add Product" buttons now visible even when search results are found
  - Two options: Quick add (no icon) or Full add (with icon & category)
  - Added translation key `notInResults` for German and English

### Changed
- `/api/ingredients/frequent` endpoint now queries based on `completed_at` timestamp
- Removed user_id filter from frequent items (shopping lists are shared)
- Updated cron service to include cleanup job
- Search results now show combined catalog + custom products

### Database Changes
- Added `completed_at TIMESTAMP WITH TIME ZONE` column to `shopping_list_items`
- Migration automatically backfills timestamps for existing checked items
- New SQLite database for product catalog at `/app/data/products.db`

### Infrastructure
- New SQLite product catalog database alongside training database
- Optimized search performance with FTS5 indexes
- Improved caching strategy for search results

## [0.1.8] - 2025-11-08

### Added
- 📝 **Manual Recipe Modal** - Convert manual recipe creation from separate page to modal
  - Modal-based workflow matching PDF upload and preview modals
  - Full German and English translation support
  - Mobile-responsive design
  - Improved user experience with backdrop and focus management
- 🗑️ **Admin Activity Log Management** - Admin-only function to clear all activity logs
  - "Clear All" button visible only to administrators
  - Confirmation dialog before deletion
  - Toast notifications for success/error feedback
  - Complete German and English translations

### Fixed
- 🌍 **Activity Log Translations** - Product names within shopping activity logs now respect the current UI language, matching the shopping list view.
- 🔒 **Activity Log Privacy** - Removed profile picture upload/delete logs from activity tracking
  - Profile picture changes are now private
  - No activity logs created for profile picture uploads or deletions

### Changed
- 🖥️ **Desktop Layout Width** - Week Planner, Shopping List, Activity Logs, Settings, and Profile pages now use a full-width desktop layout while keeping the mobile experience unchanged.

## [0.1.7] - 2025-01-08

### Fixed
- 📸 **PDF Image Extraction** - Fixed broken image extraction from PDF recipes
  - Corrected pdfjs-dist import path for version 4.8.69
  - Changed from `pdfjs-dist/legacy/build/pdf.js` to `pdfjs-dist`
  - Images now properly extracted and saved with recipes
- 🌍 **Translation Completeness** - Added missing translations for PDF features
  - Complete English translations for PDF upload modal
  - Complete English translations for recipe preview modal
  - All form labels, buttons, and error messages now fully translated
  - Proper interpolation support for dynamic values (counts, filenames)

### Changed
- 🔄 **PDF Re-upload** - Removed duplicate PDF check
  - PDFs can now be re-uploaded if recipe wasn't saved
  - More flexible workflow for recipe creation
  - Simplified error handling

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

[0.1.7]: https://github.com/pamsler/biteful/releases/tag/v0.1.7
[0.1.6]: https://github.com/pamsler/biteful/releases/tag/v0.1.6
[0.1.5]: https://github.com/pamsler/biteful/releases/tag/v0.1.5
[0.1.4]: https://github.com/pamsler/biteful/releases/tag/v0.1.4
[0.1.3]: https://github.com/pamsler/biteful/releases/tag/v0.1.3
[0.1.2]: https://github.com/pamsler/biteful/releases/tag/v0.1.2
[0.1.1]: https://github.com/pamsler/biteful/releases/tag/v0.1.1
[0.1.0]: https://github.com/pamsler/biteful/releases/tag/v0.1.0
