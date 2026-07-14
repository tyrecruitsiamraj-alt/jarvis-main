# ═══════════════════════════════════════════════════════════
# Stage 1: Build — ติดตั้ง deps + สร้าง Vite frontend bundle
# ═══════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_ variables ต้องส่งตอน build เพราะ Vite อบลงใน bundle
ARG VITE_DEV_ROLE_ENTRY=false
ENV VITE_DEV_ROLE_ENTRY=$VITE_DEV_ROLE_ENTRY

RUN npm run build

# ═══════════════════════════════════════════════════════════
# Stage 2: Production — nginx (static) + Node API + supervisord
# ═══════════════════════════════════════════════════════════
FROM node:20-alpine AS production

RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Static frontend → nginx html root
COPY --from=builder /app/dist /usr/share/nginx/html

# API server source
COPY --from=builder /app/api        ./api
COPY --from=builder /app/shared     ./shared
COPY --from=builder /app/skills     ./skills
COPY --from=builder /app/server     ./server
COPY --from=builder /app/scripts/verify-api-registry.mjs ./scripts/verify-api-registry.mjs
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/package.json   ./

# node_modules ทั้งหมด (รวม tsx ที่อยู่ใน devDependencies)
COPY --from=builder /app/node_modules ./node_modules

# Config files
COPY docker/nginx.conf        /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf  /etc/supervisord.conf

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
