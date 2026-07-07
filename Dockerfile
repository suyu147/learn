# =============================================================================
# SmartLearn — Multi-stage Docker Build
# Phase 6: Docker deployment
# =============================================================================
# Build:   docker compose build
# Run:     docker compose up -d
# Verify:  curl http://localhost:3000/api/v1/health
# =============================================================================

# -- Base image ---------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# -- Dependencies (cache-friendly) --------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy lock files first for cache efficiency
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci 2>/dev/null || npm install

# -- Builder ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needed at build time for type generation)
RUN npx prisma generate

# Build Next.js with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -- Runner (production image) ------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone server
COPY --from=builder /app/.next/standalone ./

# Copy static assets (Next.js requires these outside standalone)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files for runtime migrations (entrypoint runs prisma migrate deploy)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy entrypoint script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Create data directory for local disk storage (mounted as volume in compose)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
