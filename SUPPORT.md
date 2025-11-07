# Support

Thank you for using Biteful! We're here to help you get the most out of your meal planning experience.

## Getting Help

### 📚 Documentation

Before reaching out, please check our documentation:

- [README.md](README.md) - Installation and quick start guide
- [Docker Hub](https://hub.docker.com/r/pamsler/biteful) - Image details and tags
- [Production Deployment](PRODUCTION_DEPLOYMENT.md) - Advanced deployment guide

### 🐛 Bug Reports

If you've found a bug, please help us fix it:

1. Check [existing issues](https://github.com/pamsler/biteful/issues) to see if it's already reported
2. If not, [create a new bug report](https://github.com/pamsler/biteful/issues/new?template=bug_report.md)
3. Include as much detail as possible (see bug report template)

### 💡 Feature Requests

Have an idea for a new feature?

1. Check [existing issues](https://github.com/pamsler/biteful/issues) for similar requests
2. Open a new issue with the `enhancement` label
3. Describe your use case and why this feature would be valuable

### 🔒 Security Issues

**Do not report security vulnerabilities through public GitHub issues.**

Please see our [Security Policy](SECURITY.md) for responsible disclosure.

## Contact

For general questions, support, or issues:

- 🐛 GitHub Issues: [github.com/pamsler/biteful/issues](https://github.com/pamsler/biteful/issues)
- 🐳 Docker Hub: [hub.docker.com/r/pamsler/biteful](https://hub.docker.com/r/pamsler/biteful)

## Common Issues

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Check if database is ready
docker-compose -f docker-compose.production.yml logs db
```

### Database connection issues

Make sure your `DATABASE_URL` in `.env` matches your PostgreSQL configuration:

```env
DATABASE_URL=postgresql://mealuser:yourpassword@biteful-db:5432/mealplanner
```

### MFA Issues

If you're locked out of your account with MFA:
1. Check if you have backup codes
2. Create a GitHub issue with proof of account ownership

### Email notifications not working

Verify your SMTP settings in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Response Times

- **General Support**: We aim to respond within 2-3 business days
- **Bug Reports**: We'll acknowledge within 1-2 business days
- **Security Issues**: We'll respond within 48 hours (see [Security Policy](SECURITY.md))

## Community

We're building a community around Biteful. While we don't have a dedicated forum yet, feel free to:

- ⭐ Star the repository if you find it useful
- 👀 Watch the repository for updates
- 🔀 Fork and contribute improvements

## Self-Help Resources

### Health Check

```bash
curl http://localhost:8570/api/health
# Expected: {"status":"ok"}
```

### Rebuild Container

```bash
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

### Database Backup

```bash
docker exec biteful-db pg_dump -U mealuser mealplanner > backup_$(date +%Y%m%d).sql
```

### View Container Stats

```bash
docker stats biteful-app
```

---

**Need help?** Open an issue on [GitHub](https://github.com/pamsler/biteful/issues)

© 2025 AmslerTec - Made with ❤️ for better meal planning
