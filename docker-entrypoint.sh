#!/bin/sh
set -e

# Fix permissions for volumes that may be mounted as root
echo "🔧 Fixing permissions for /app/data and /app/uploads..."
chown -R appuser:appuser /app/data /app/uploads 2>/dev/null || true
chmod -R u+w /app/data /app/uploads 2>/dev/null || true

echo "✅ Permissions fixed"

# Switch to appuser and execute the main command
exec su-exec appuser "$@"
