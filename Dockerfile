# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build tools required for native addons (e.g. bcrypt)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Create storage directory for uploads and set permissions
RUN mkdir -p /app/public/images && chown -R node:node /app

USER node

EXPOSE 4000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
