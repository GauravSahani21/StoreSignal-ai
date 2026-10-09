# syntax=docker/dockerfile:1
# Production Multi-Stage Dockerfile for StoreSignal API (Node.js / Fastify)

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy API source and build configs
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Build the TypeScript API
RUN npm run build --workspace=@storesignal/api

# Prune dev dependencies for production runtime
RUN npm prune --production

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Run as non-root user for container security
USER node

# Copy dependencies and compiled distribution from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3001

# Healthcheck validating server responsiveness
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
