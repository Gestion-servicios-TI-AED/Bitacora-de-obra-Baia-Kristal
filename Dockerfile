# ================================================================
# Stage 1: Build React frontend
# ================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build/client
# Force development so npm ci installs devDependencies (tsc, vite, etc.)
ENV NODE_ENV=development

COPY client/package*.json ./
RUN npm ci

COPY client/ .
RUN npm run build

# ================================================================
# Stage 2: Build Express backend + generate Prisma client
# ================================================================
FROM node:20-alpine AS backend-builder
WORKDIR /build/server
ENV NODE_ENV=development

COPY server/package*.json ./
RUN npm ci

COPY server/ .
RUN npx prisma generate
RUN npm run build

# ================================================================
# Stage 3: Production image
# ================================================================
FROM node:20-alpine AS production
WORKDIR /app

# Copy server node_modules (includes prisma CLI + generated client)
COPY --from=backend-builder /build/server/node_modules ./node_modules

# Copy compiled server TypeScript
COPY --from=backend-builder /build/server/dist ./dist

# Copy Prisma schema (needed to run db push at startup)
COPY server/prisma ./prisma

# Copy built React app — Express serves it as static files in production
COPY --from=frontend-builder /build/client/dist ./public

# Create persistent data directory (overridden by Coolify volume at /data)
RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/production.db
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

# Apply schema then start server
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node dist/index.js"]
