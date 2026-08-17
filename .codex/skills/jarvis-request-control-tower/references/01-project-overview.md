# ภาพรวมโปรเจกต์

Jarvis คือเว็บแอปบริหารกำลังคนสำหรับงาน staffing — เป็น SPA แบบ React/Vite TypeScript
ใช้คอมโพเนนต์ shadcn/Radix UI จัดสไตล์ด้วย Tailwind มี API handler สไตล์ Vercel
พร้อมตัวจำลอง API ในเครื่อง migration ของ PostgreSQL และการเชื่อมต่อ
MSSQL/Siamraj/Lumos บางส่วน

## Runtime และคำสั่ง

- ฝั่งแอป: React 18, Vite 5, TypeScript, TanStack Query, React Router,
  shadcn/Radix UI, lucide-react, Recharts
- ฝั่ง API: ฟังก์ชัน Vercel แบบ catch-all ตัวเดียวใน `api/[[...path]].ts` ·
  handler รายเส้นทางอยู่ใต้ `api/_handlers/` · ยูทิลิตี้ที่ใช้ร่วมอยู่ใต้ `api/_lib/`
- รันครบทั้งชุดในเครื่อง: `npm run dev` (สตาร์ต `npm run api:local` กับ Vite พร้อมกัน)
  Vite เปิดที่ `http://localhost:8080` และ proxy `/api` ไป `http://127.0.0.1:3000`
- หน้าเว็บอย่างเดียว: `npm run dev:vite`
- API ในเครื่องอย่างเดียว: `npm run api:local` (ผ่าน `tsx watch server/local-api.ts`)
- Build: `npm run build`
- เทสต์: `npm test` หรือเจาะไฟล์เดียว `npx vitest run <ไฟล์เทสต์>`
- เทสต์ความพร้อม: `npm run test:readiness`
- ฐานข้อมูล: `npm run db:migrate` · `npm run db:migrate:status` · `npm run db:seed`
  · `npm run db:ping` · `npm run db:ping:mssql`

## หน้าจอของแอป

route หลักประกาศใน `src/App.tsx`:

- สาธารณะ: `/apply`, `/s/:code`, `/careers`, `/mapwork`, `/auth/magic-link`,
  `/reset-password`
- role hub (ต้องล็อกอิน): `/`, `/opl`, `/staff`, `/supervisor`, `/admin`
- กำลังคน/แรงงาน: `/wl`, `/wl/monthly-planner`, `/wl/daily-assignment`,
  `/wl/global-calendar`, `/wl/employees`
- Matching: `/matching`, `/matching/candidates`, `/matching/match`,
  `/matching/pre-check`, `/matching/job-postings`, `/matching/reservations`
- ใบขอ: `/jobs/list`, `/jobs/board`, `/jobs/overview`, `/jobs/siamraj/:id`, `/jobs/:id`
- แดชบอร์ด: `/dashboard`
- ตั้งค่า/บัญชี: `/settings`, `/account/change-password`

## รูปร่างของ API

`api/_handlers/registry.ts` คือตาราง route ที่ใช้ร่วมกันทั้ง runtime ในเครื่องและ
Vercel — ครอบคลุม auth, ใบขอ, ผู้สมัคร, พนักงาน, ปฏิทินงาน, ใบขอหน่วยงาน Siamraj,
matching, Lumos, รับสมัคร/ประกาศงานสาธารณะ, ลิงก์สั้น, branding, follow,
พยากรณ์ความต้องการของ request-control, RBAC, audit และ diagnostics

แพตเทิร์นสำคัญ:

- handler ของ API ใช้ `ApiReq`/`ApiRes` จาก `api/_lib/http.ts`
- runtime ของ Vercel ต้องการ import แบบ relative ที่ลงท้าย `.js`
- โค้ดฝั่ง `src/` import ด้วย `@/` ได้ตามที่เทสต์/build ตั้งไว้
- API ของแดชบอร์ดต้องเป็นอ่านอย่างเดียว เว้นแต่มีการขอ flow เขียนและอนุมัติชัดเจน

## แหล่งข้อมูล

- migration ของ PostgreSQL อยู่ใน `migrations/`
- adapter และ probe ของ Siamraj/MSSQL อยู่ใต้ `api/_lib/siamraj*`,
  `api/_lib/irecruit*` และ `scripts/probe-*.mjs`
- ใบสมัครสาธารณะใช้ `migrations/048_public_job_applications.sql`,
  `migrations/049_public_job_applications_structured.sql`,
  `api/_lib/publicApplications.ts`, `api/_handlers/public/apply.ts` และ
  `src/components/jobs/PublicApplyDialog.tsx`
- ข้อมูล matching ใช้ API ผู้สมัคร/ใบขอ, ที่เก็บผลแมทของบอร์ด, การเสนอ (proposals),
  การติดตามประเภทคำขอ และการกรองลิสต์ฝั่ง server

## แหล่งความจริงของเอกสาร

- กติกาโดเมนศูนย์ควบคุมใบขอ: `.claude/skills/request-control-tower-advisor/`
- คู่มือโปรเจกต์สำหรับคน: `docs/request-control-tower/HANDBOOK.md`
- กติกาฝั่ง Cursor (mirror): `.cursor/rules/request-control-tower.mdc`
- skill ฝั่ง `.codex` นี้เป็นแค่ตัวเชื่อมของโปรเจกต์ — ถ้ากติกาขัดกัน ให้หยุดแล้ว
  กลับไปเทียบกับ `.claude/skills/request-control-tower-advisor/` ก่อน
