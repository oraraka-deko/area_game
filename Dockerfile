# Multi-stage Dockerfile optimized for Google Cloud Run
# Stage 1: Build client SPA and prepare production artifacts
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build client production bundle into /dist
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server files, configs, and assets
COPY server ./server
COPY server.ts ./server.ts
COPY tsconfig.json ./tsconfig.json
COPY public ./public
COPY assets ./assets
COPY telegram_gifts.db ./telegram_gifts.db

# Cloud Run default port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
