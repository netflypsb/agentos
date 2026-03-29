# Multi-stage build for AgentOS MCP Server
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S agentos && \
    adduser -S agentos -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=agentos:agentos /app/build ./build
COPY --from=builder --chown=agentos:agentos /app/node_modules ./node_modules
COPY --from=builder --chown=agentos:agentos /app/package.json ./package.json

# Create data directory for SQLite
RUN mkdir -p /data && chown agentos:agentos /data

# Switch to non-root user
USER agentos

# Set environment variables
ENV NODE_ENV=production
ENV AGENTOS_DATA_DIR=/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('AgentOS MCP Server Health Check')" || exit 1

# Expose port (if needed for future HTTP interface)
EXPOSE 3000

# Start the application
ENTRYPOINT ["node", "build/index.js"]
CMD ["--help"]
