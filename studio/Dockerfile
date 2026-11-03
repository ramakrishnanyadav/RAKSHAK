# Multi-stage Dockerfile for ADAPTIVE-PATH Studio Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Pinned reproducible dependency installation
COPY package.json package-lock.json ./
RUN npm ci

# Copy source assets and build static bundle
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# Stage 2: Hardened Nginx production web server
FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
