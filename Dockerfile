# Build stage
FROM node:18.20.4-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY plugins/ ./plugins/

# Compile TypeScript
RUN npm run build

# Production stage
FROM node:18.20.4-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install runtime dependencies only
RUN apk add --no-cache tini

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose default port (3000)
EXPOSE 3000

# Health check for the container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1

# Set startup command
CMD ["npm", "start"]
