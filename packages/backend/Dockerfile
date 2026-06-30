# Multi-stage build for TradeWise Backend

# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Generate Prisma client
WORKDIR /app/packages/backend
RUN pnpm exec prisma generate

# Build application
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@8

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=nodejs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nodejs:nodejs packages/backend/package.json ./packages/backend/
COPY --chown=nodejs:nodejs packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --chown=nodejs:nodejs --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --chown=nodejs:nodejs --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --chown=nodejs:nodejs --from=builder /app/packages/backend/src/generated ./packages/backend/src/generated
COPY --chown=nodejs:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create logs directory
RUN mkdir -p /app/packages/backend/logs && \
    chown -R nodejs:nodejs /app/packages/backend/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set working directory to backend
WORKDIR /app/packages/backend

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
