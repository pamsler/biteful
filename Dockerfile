# =============================================================================
# Meal Planner - Optimized Multi-Stage Docker Build
# Security: Debian slim-based, SHA256 pinned, non-root user
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Frontend Builder
# -----------------------------------------------------------------------------
FROM node@sha256:d9dab42dc0e575d6e959b7b3d6962fd35cb4ef668e6ad4b4cda135488c504bbe AS frontend-builder

# Add metadata
LABEL stage=frontend-builder

WORKDIR /app/frontend

# Copy package files first (better layer caching)
COPY frontend/package*.json ./

# Install ALL dependencies (needed for build with Vite)
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Backend Dependencies Builder
# -----------------------------------------------------------------------------
FROM node@sha256:d9dab42dc0e575d6e959b7b3d6962fd35cb4ef668e6ad4b4cda135488c504bbe AS backend-builder

LABEL stage=backend-builder

WORKDIR /app

# Install build dependencies for native modules (Debian packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    pkg-config && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm install --production --legacy-peer-deps && \
    npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM node@sha256:d9dab42dc0e575d6e959b7b3d6962fd35cb4ef668e6ad4b4cda135488c504bbe AS production

# Metadata Labels (OCI Standard)
LABEL org.opencontainers.image.title="Meal Planner" \
      org.opencontainers.image.description="Smart meal planning and shopping list application with SSO support" \
      org.opencontainers.image.vendor="AmslerTec" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/pamsler/meal-planner" \
      org.opencontainers.image.base.name="docker.io/library/node:25.1-slim" \
      maintainer="pascal.amsler@amslertec.ch"

# Install only runtime dependencies (Debian packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    libpixman-1-0 && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create non-root user for security (Debian way)
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -s /bin/bash -m appuser

WORKDIR /app

# Copy node_modules from builder
COPY --from=backend-builder --chown=appuser:appuser /app/node_modules ./node_modules

# Copy backend code
COPY --chown=appuser:appuser backend/ ./

# Copy frontend build
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist ./public

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads/products /app/uploads/pdf-images /app/data && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app/uploads /app/data

# Expose port
EXPOSE 8570

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8570/api/health || exit 1

# Set environment
ENV NODE_ENV=production \
    PORT=8570

# Use entrypoint to fix permissions before starting
ENTRYPOINT ["docker-entrypoint.sh"]

# Start application
CMD ["node", "src/server.js"]