# ═══════════════════════════════════════════════════════════
# Stage 1: Build — ติดตั้ง deps + สร้าง Vite frontend bundle
# ═══════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# ⚠️ **ลองใหม่ได้ 3 ครั้ง + ยืดเวลา/เพิ่ม retry ของ npm เอง** — เจอ EIDLETIMEOUT จริง 16 ก.ย.
# 2569 (registry.npmjs.org ค้างกลางทาง ~355 วินาทีแล้วล้มทั้ง build) แพตเทิร์นเดียวกับที่
# apk ล้มไปแล้วด้านล่าง (เน็ตเครื่องจริงไปต่างประเทศไม่นิ่ง ไม่ใช่ปัญหาของโค้ด/dependency)
# ค่า default ของ npm (fetch-timeout 300000ms, fetch-retries 2) แคบไปสำหรับเน็ตนี้
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000
RUN ok=0; \
    for i in 1 2 3; do \
      if npm ci; then ok=1; break; fi; \
      echo "npm ci ล้มรอบที่ $i — รอ 15 วินาทีแล้วลองใหม่"; \
      sleep 15; \
    done; \
    [ "$ok" = "1" ]

COPY . .

# VITE_ variables ต้องส่งตอน build เพราะ Vite อบลงใน bundle
ARG VITE_DEV_ROLE_ENTRY=false
ENV VITE_DEV_ROLE_ENTRY=$VITE_DEV_ROLE_ENTRY

RUN npm run build

# ═══════════════════════════════════════════════════════════
# Stage 2: Production — nginx (static) + Node API + supervisord
# ═══════════════════════════════════════════════════════════
FROM node:20-alpine AS production

# ⚠️ **ลองใหม่ได้ 3 ครั้ง** — deploy ล้มจริง 15 ก.ย. 2569 เพราะโหลดแพ็กเกจจาก mirror
# ของ Alpine ขาดกลางคัน (`failed to extract python3 …: Connection aborted`) ใช้เวลาไป
# 389 วินาทีแล้วล้มทั้ง build · เน็ตของเครื่องจริงไปต่างประเทศไม่นิ่ง ไม่ใช่ปัญหาของโค้ด
# ⇒ กันไว้ที่นี่ ดีกว่าให้คนมานั่งกด re-run ทุกครั้งที่เน็ตสะดุด
RUN for i in 1 2 3; do \
      apk add --no-cache nginx supervisor && break; \
      echo "apk ล้มรอบที่ $i — รอ 10 วินาทีแล้วลองใหม่"; \
      sleep 10; \
    done; \
    apk info -e nginx >/dev/null && apk info -e supervisor >/dev/null

WORKDIR /app

# Static frontend → nginx html root
COPY --from=builder /app/dist /usr/share/nginx/html

# API server source
COPY --from=builder /app/api        ./api
COPY --from=builder /app/shared     ./shared
COPY --from=builder /app/skills     ./skills
COPY --from=builder /app/server     ./server
# บาง API handler แชร์ pure logic จาก src ผ่าน alias @/ (เช่น matching list filter/sort
# ที่ต้องตรงกับหน้าเว็บเป๊ะ) — tsx resolve @/ → src ตอนรัน จึงต้องมี src ใน production image
COPY --from=builder /app/src        ./src
# ⚠️ เอา scripts ทั้งโฟลเดอร์ — เดิมหยิบมาสองไฟล์ แล้วงานตามเก็บที่ต้องรัน
# บนเครื่องจริง (คีย์ Lumos อยู่ที่นั่นที่เดียว) หาไฟล์ไม่เจอในคอนเทนเนอร์
COPY --from=builder /app/scripts ./scripts
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
