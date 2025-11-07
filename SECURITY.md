# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of Biteful seriously. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

Please report security vulnerabilities through GitHub's private vulnerability reporting:

🔒 **[Report a vulnerability](https://github.com/pamsler/biteful/security/advisories/new)**

Or create a private issue in the repository with the label "security".

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass, etc.)
- Full paths of source file(s) related to the manifestation of the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will send you regular updates about our progress
- We will notify you when the vulnerability is fixed
- We may ask for additional information or guidance

### Security Features

Biteful includes the following security features:

- 🔐 **Multi-Factor Authentication (MFA)**: TOTP-based 2FA for local users
- 🔒 **JWT Authentication**: Secure token-based authentication
- 🔑 **Encryption**: Sensitive data encrypted at rest
- 🐳 **Docker Security**: Non-root user, SHA256 pinned images
- 📦 **Supply Chain**: SBOM and Provenance attestation
- 🛡️ **Input Validation**: Protection against common web vulnerabilities

### Responsible Disclosure

We kindly ask that you:

- Allow us reasonable time to fix the vulnerability before public disclosure
- Make a good faith effort to avoid privacy violations, data destruction, and service interruption
- Do not exploit the vulnerability beyond what is necessary to demonstrate it

Thank you for helping keep Biteful and our users safe!
