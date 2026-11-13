/* eslint-disable */
// สร้างจาก scripts/ai-build-api-catalog.ts — ห้ามแก้มือ · รัน `npm run ai:catalog`
export type ApiCatalogEntry = { path: string; file: string; methods: string[]; doc: string; query: string[]; body: string[]; reachesPeople: boolean };
export const API_CATALOG: ApiCatalogEntry[] = [
 {
  "path": "/api/aftercare",
  "file": "api/_handlers/aftercare.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "`GET/POST/PATCH /api/aftercare` — \"ดูแลหลังเริ่มงาน\" (Phase 7.2-7.5 · migration 107)\n\nเจ้าของเคาะชื่อหน้าเอง: **\"ดูแลหลังเริ่มงาน\"** · คนเข้ามาสองทาง\n  1. ปุ่ม [ย้ายไปดูแลหลังเริ่มงาน] จากกล่อง \"โทรครบแล้ว\" บนหน้า Follow (7.2)\n  2. เพิ่มเองจากหน้าดูแลหลังเริ่มงาน (source `manual`)\n\n⚠️ คีย์คือ **เบอร์ E.164** — คนเดียวมีหลายรหัส/หลายใบสมัคร แต่เบอร์มีเบอร์เดียว\n(แพตเทิร์นเดียวกับล็อกโทร 068 และ `selection_progress` 105)\n⚠️ รอบโทร \"ถามความเป็นอยู่\" **ไม่ได้ทำระบบโทรใหม่** — ใช้โครง Follow เดิม (topic ใหม่)\nเส้นนี้จึงไม่มีอะไรเกี่ยวกับคิว/การยิงสายเลย",
  "query": [
   "history",
   "closed"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/ai-settings",
  "file": "api/_handlers/ai-settings.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "เลือก AI ที่ใช้คิดงาน (migration 150 · เจ้าของสั่ง 17 ต.ค. 2569) — admin เท่านั้น (rbac `ai-settings`)\n\nGET  /api/ai-settings → การเชื่อมต่อ (ไม่มีตัว key) + งานไหนใช้ตัวไหน + Ollama จากไฟล์ตั้งค่า\nPOST /api/ai-settings { action }\n  - save_connection   { connection }        เพิ่ม/แก้ (api_key ว่าง = คง key เดิม)\n  - delete_connection { id }                ลบ (งานที่ใช้อยู่ถอยไป Ollama ของระบบ — FK on delete set null)\n  - save_routes       { routes: [...] }      งานไหนใช้ตัวไหน\n  - test              { connection | connection_id, model? }  ยิงคำถามสั้น ๆ วัดเวลา (ไม่บันทึกอะไร)\n  - models            { connection | connection_id }          รายชื่อโมเดลของเจ้านั้น\n\n🔴 ไม่ส่ง API key กลับหน้าจอทุกกรณี · บันทึกการใช้งานจดแค่ว่า \"เปลี่ยน key\" ไม่จดตัว key",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/ai/chat",
  "file": "api/_handlers/ai-chat.ts",
  "methods": [
   "GET",
   "POST",
   "PUT",
   "PATCH",
   "DELETE"
  ],
  "doc": "═══ POST /api/ai/chat — ผู้ช่วย AI แชทมุมขวาล่าง (เจ้าของ 13 พ.ย. 2569 · แปลงจาก KNOWA) ═══\nรับประวัติแชท `{ messages }` → ตอบ `{ ok, added, pending? }`\n\nวงคุย: ส่งให้ OpenAI → ขอ \"อ่าน\" = ทำให้ทันที (เรียก handler ในตัวด้วยคุกกี้ของคนสั่ง) แล้ววนต่อ\n· ขอ \"เปลี่ยนข้อมูล\" = หยุดแล้วคืนการ์ด (`pending`) ให้หน้าจอขึ้นปุ่ม \"ทำเลย\" · เบราว์เซอร์ยิงเอง แล้วส่งผลกลับมาเป็นข้อความเครื่องมือ · ทีละการ์ด\nใช้ได้: admin + supervisor (เจ้าของ Choice) · กุญแจ/รุ่น = งาน \"ผู้ช่วยแชท\" ที่ ตั้งค่า › AI ที่ใช้คิดงาน (ต้องเป็นเจ้า OpenAI)\n⚠️ ประวัติแชทอยู่ฝั่งเบราว์เซอร์ (sessionStorage) ไม่ลงฐาน — แก้ประวัติเองก็ได้แค่ชวน AI เสนอคำสั่ง ซึ่งยังต้องกดยืนยัน + ผ่านด่านสิทธิ์ของคนนั้น\n⚠️ เวลา: nginx เส้นนี้รอ 95 วิ (Cloudflare ตัด ~100 วิ) ⇒ ทั้งวงต้องจบใน 85 วิ เกิน = 504 ข้อความไทย + ปุ่มลองใหม่บนจอ",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/app-nav-preferences",
  "file": "api/_handlers/app-nav-preferences.ts",
  "methods": [
   "GET",
   "PUT"
  ],
  "doc": "เมนูที่แอดมินจัดเอง (migration 093) — GET อ่านได้ทุกคน · PUT เฉพาะ admin\n\nอ่านได้ทุกคนเพราะทุกหน้าต้องใช้ตอน render เมนู · เขียนได้เฉพาะ admin เพราะ\nเป็นค่าระดับระบบ (ทุกคนเห็นเหมือนกัน ไม่ใช่ค่าส่วนตัวรายคน)",
  "query": [],
  "body": [
   "js",
   "preferences"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/app-user-names",
  "file": "api/_handlers/app-user-names.ts",
  "methods": [
   "GET"
  ],
  "doc": "`GET /api/app-user-names` — ชื่อผู้ใช้ที่ยังใช้งานอยู่ สำหรับช่อง \"ผู้รับผิดชอบ\" (11 ต.ค. 2569)\n\nเจ้าของแจ้งว่าป๊อปนำเข้า Excel ใช้ไม่ได้ — ต้นเหตุหนึ่งคือช่องผู้รับผิดชอบโหลดจาก `/api/app-users`\nซึ่งเปิดเฉพาะ admin ⇒ หัวหน้า/เจ้าหน้าที่ได้ลิสต์ว่าง เลือกไม่ได้ ปุ่มนำเข้ากดไม่ได้ตลอด\n\nส่งแค่ `{ id, name }` (ไม่มีอีเมล/สิทธิ์/เบอร์) · ทุก role ที่ล็อกอินอ่านได้ (rbac `app-user-names`)\nคนล็อก BU เห็นคนในแผนกเดียวกัน + คนที่ไม่ผูกแผนก (แอดมิน) · ล็อกแต่ไม่รู้แผนก = ลิสต์ว่าง\n`name` = `full_name` ค่าเดียวกับที่ป๊อปเดิมเก็บลง `responsible_name` (ห้ามเปลี่ยนเป็นชื่อเล่น — ตัวกรองเทียบชื่อนี้)\n`?lane=recruiter` (21 ต.ค. 2569 เจ้าของ \"เป็นชื่อเล่นของสรรหาดิ่\" — ฟอร์มเพิ่มผู้สมัคร) = เฉพาะสายงานนั้นที่ตั้งชื่อเล่นแล้ว\n  + `label` = ชื่อเล่น (โชว์บนจอ) · `name` ยังเป็นชื่อเต็ม (ค่าที่เก็บ)",
  "query": [
   "lane"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/app-users",
  "file": "api/_handlers/app-users.ts",
  "methods": [
   "GET",
   "PATCH",
   "DELETE"
  ],
  "doc": "ชื่อเล่นไทย (114) — ชื่อที่คนเรียกกันจริง · full_name เป็นชื่ออังกฤษจาก Microsoft",
  "query": [
   "id"
  ],
  "body": [
   "js",
   "id",
   "role",
   "is_active",
   "department_code",
   "extra_department_codes",
   "nickname",
   "job_lanes",
   "phone"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/application-attendance",
  "file": "api/_handlers/application-attendance.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "GET/POST /api/application-attendance — ผลติดตามนัด \"มาตามนัด/ไม่มา/เลื่อนนัด\"\n(เจ้าของสั่ง 15 ส.ค. 2569 · migration 089)\n\nPOST { applicationId, appointmentAt, result: 'showed'|'no_show'|'rescheduled', note? }\nPOST { …, result: 'passed'|'not_passed' } — ผ่าน/ไม่ผ่าน หลังมาตามนัด (migration 151 · 18 ต.ค. 2569) · ต้องมีผลนัดล่าสุดเป็น \"มาตามนัด\"\nGET  ?applicationId= → { items }\n\nกติกา (ตรวจฝั่ง server ห้ามเชื่อฟอร์ม):\n- บันทึกได้ตั้งแต่ **วันนัด (เวลาไทย) เป็นต้นไป** — ก่อนวันนัด 400 (กันกดล่วงหน้า)\n- append-only กดซ้ำเพื่อแก้ได้ ล่าสุดชนะ · **ไม่แตะ status ใบ**\n- ใครกดก็ได้ (คนอยู่หน้างานวันนัดมักไม่ใช่คนโทร) — ระบบ stamp ชื่อคนกดเสมอ\n- rbac + ด่าน BU เดียวกับใบสมัคร",
  "query": [
   "applicationId"
  ],
  "body": [
   "js",
   "applicationId",
   "result",
   "appointmentAt",
   "note"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/application-auto-move",
  "file": "api/_handlers/application-auto-move.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "ย้ายใบสมัครอัตโนมัติเมื่อใบขอถูกปิด (098 · เจ้าของสั่ง 17 ส.ค. 2569)\n\n`GET  /api/application-auto-move` → **ลองคิดให้ดู ไม่เขียนจริง** (dry run)\n`POST /api/application-auto-move` → ย้ายจริง\n\n⚠️ แยก GET/POST โดยตั้งใจ — ตัวนี้เดินเองแล้วแตะข้อมูลคนจริง\nต้องดูก่อนได้เสมอว่า \"รอบนี้จะย้ายใครไปไหน\" ก่อนสั่งย้าย",
  "query": [
   "limit"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/application-auto-move-status",
  "file": "api/_handlers/application-auto-move-status.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "สถานะตัวตั้งเวลาย้ายใบสมัครอัตโนมัติ (เจ้าของสั่ง 19 ส.ค. 2569:\n*\"แบบ 1 ก็ดี แต่ทำให้มันมีบอกหน่อยว่าย้ายใครไปไหน\"*)\n\n`GET`  → ค่าตั้งปัจจุบัน + ผลรอบล่าสุด (ไม่ยิง ERP ไม่แตะข้อมูล — อ่านจากหน่วยความจำล้วน)\n`POST` → สั่งเดินหนึ่งรอบเดี๋ยวนี้ **แบบลองดูเสมอ** ไม่ต้องรอรอบถัดไป\n\n🔴 เส้นนี้สั่งย้ายจริงไม่ได้โดยตั้งใจ — การย้ายจริงมีทางเดียวคือ\n`POST /api/application-auto-move` (คนกดเอง) หรือ worker ที่เปิด `APPLICATION_AUTO_MOVE_APPLY`\nไม่งั้นปุ่มบนหน้าตั้งค่าจะกลายเป็นปุ่มย้ายคนจริงโดยไม่ได้ตั้งใจ\n\n⚠️ ผลรอบล่าสุดอยู่ในหน่วยความจำของ process — บน Vercel (serverless) จะว่างเสมอ\nของจริงรันเป็น process เดียวบนเครื่อง on-prem จึงใช้ได้",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/application-call-choice",
  "file": "api/_handlers/application-call-choice.ts",
  "methods": [
   "POST"
  ],
  "doc": "POST /api/application-call-choice { ids: string[], choice: 'manual' | 'ai' | 'release', job_id?, job_title?, unit_name? }\n\n`job_id` (เฉพาะ `ai` · เจ้าของ 15 ต.ค. 2569) = ใบที่ยังไม่ผูกใบขอ (รายชื่อ iRecruit · นำเข้าไม่ผูกงาน) ผูกใบขอนี้ก่อนส่ง\n  คนเลือกใบขอเองในป๊อปยืนยัน · ใบที่ผูกอยู่แล้วไม่ย้าย · ใบขอต้องอยู่ใน BU ตัวเองและยังเปิดอยู่\n`greeting: true` (เฉพาะ `ai` · 15 ต.ค. 2569) = ใบที่ยังไม่ผูกใบขอ ส่ง **บททักทายทั่วไป** (ยังหางานไหม · งาน · จังหวัด · อายุ)\n  ใบที่ผูกใบขออยู่แล้วส่งบทของใบขอตามเดิม · ไม่ผูกใบขอให้ ไม่แก้ข้อมูลในใบ\n\nเส้นเดียวของ **\"ใครจะโทรหาคนนี้\"** — ใช้สองที่ที่เจ้าของเคาะให้เป็นเรื่องเดียวกัน:\n\n1. **ปุ่ม \"เก็บไปโทรเอง\"** (Phase 3 ข้อ ② · เจ้าของเคาะ 22 ส.ค. 2569)\n   เดิมเป็นสองปุ่มที่คนงงว่าต่างกันตรงไหน: \"เก็บไปติดต่อ\" (claim บนใบ) กับ\n   \"ดึงเข้าถังโทร\" (hold ที่เบอร์ กัน AI โทรทับ) → **รวมเป็นปุ่มเดียว**\n   กดทีเดียวได้ทั้งสองอย่าง = จองใบ + ล็อกเบอร์ (`choice: 'manual'`)\n\n2. **กอง \"เลือกวิธีโทร\"** (Phase 5.9) — ใบที่ worker ถอด claim เพราะดองเกิน 1 วัน\n   ต้องเลือก [โทรเอง] (`manual`) หรือ [ส่ง AI โทร] (`ai`) · ไม่เลือกใน 1 วัน\n   worker ส่ง AI เอง (`auto_ai` — เส้นนี้ไม่รับค่านั้น คนเลือกเองไม่ใช่ auto)\n\n🔴 กติกาที่ห้ามพลาด\n- claim กับ hold **คนละกุญแจ** (ใบ vs เบอร์ E.164) จึงต้องยิงทั้งคู่ · hold คือตัวที่\n  กัน AI โทรทับจริง (`listHeldPhones()` ใน insertQueueItems) — claim อย่างเดียวไม่กัน\n- ใบไม่มีเบอร์/ไม่ผูกใบขอ = เก็บใบอย่างเดียว ไม่รายงาน (AI โทรใบแบบนี้ไม่ได้อยู่แล้ว · เจ้าของ 8 ต.ค. 2569 \"เอาออกไม่ต้องบอก\")\n- ส่ง AI ผ่าน `enqueueLumosInterviewForApplications()` → `insertQueueItems()` เท่านั้น\n  (คอขวดเดียวที่มีด่าน held/suppressed/declined/quiet-hours ครบ)\n- เลือกแล้วต้องออกจากกองรอ (`call_choice` ไม่เป็น null) ไม่งั้น worker ส่ง AI ทับคนที่\n  เพิ่งกดเก็บไปโทรเอง\n\n3. **ปุ่ม \"ลบออก\" ในแท็บการติดตาม** (`choice: 'release'` · เจ้าของสั่ง 1 ต.ค. 2569)\n   ส่งใบกลับแท็บผู้สมัครเป็น **ใบว่าง ใครก็เก็บได้** (Choice ของเจ้าของ) = ปลดจอง + ถอด Lead\n   + คืนล็อกเบอร์ที่ตัวเองถือ — **ยิงเส้นเดียว server ทำครบ** (บทเรียนเดียวกับข้อ 1: หน้าเว็บ\n   ยิงหลายเส้นเองแล้วได้สภาพครึ่ง ๆ) · 🔴 **AI ไม่โทรเอง**: ไม่ล้าง `call_choice` และไม่ตั้ง\n   `unclaimed_at` ⇒ ใบไม่เข้ากอง \"เลือกวิธีโทร\" ที่ worker ส่ง AI เองเมื่อครบ 1 วัน (fail-safe)\n   · สถานะใบไม่ย้อนกลับเอง (กติกาเดียวกับคืนใบของ patchClaim — ไม่เดาแทนคน)",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/application-contacts",
  "file": "api/_handlers/application-contacts.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "GET/POST /api/application-contacts — บันทึก/อ่านผลการติดต่อผู้สมัคร (ลิสต์ข้อ 7 · 14 ส.ค. 2569)\n\nPOST { applicationId, ok, reasonId?, reasonLabel?, appointmentAt?, appointmentPlace?,\n       jobId?, jobLabel?, note? }\nGET  ?applicationId= → { items }\n\nกติกา (ตรวจฝั่ง server ห้ามเชื่อฟอร์ม):\n- ok=false ต้องมีเหตุผล (reasonLabel) — \"ไม่สำเร็จเฉย ๆ\" ไม่บอกอะไรใคร\n- ok=true + appointmentFailed=true = นัดหมายไม่สำเร็จ — ต้องมีเหตุผล · ห้ามมีวันนัด (4 ต.ค. 2569)\n- นัด (appointmentAt) มีได้เฉพาะ ok=true · ปี พ.ศ. โดนดักเหมือนวันนัดผลโทร\n- rbac เดียวกับใบสมัคร ('job-applications') — ใครเห็นใบ คนนั้นบันทึกผลติดต่อได้",
  "query": [
   "applicationId"
  ],
  "body": [
   "js",
   "applicationId",
   "ok",
   "reasonLabel",
   "appointmentFailed",
   "appointmentAt",
   "reasonId",
   "appointmentPlace",
   "jobId",
   "jobLabel",
   "note"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/application-dispatch",
  "file": "api/_handlers/application-dispatch.ts",
  "methods": [
   "POST"
  ],
  "doc": "POST /api/application-dispatch { jobId } — ปุ่ม \"🤖 ส่งให้ AI โทร\" ในกล่องงาน\n(S8 · เจ้าของเคาะ 15 ส.ค. 2569: ส่งอัตโนมัติตอนกรอก + ปุ่ม manual สำหรับใบตกค้าง\nเช่น ใบที่กรอกก่อนเปิดระบบ / ใบที่เพิ่งแก้เบอร์)\n\nserver เป็นคนคัด \"ใบที่เข้าเกณฑ์\" เองทั้งหมด (client ส่งได้แค่ jobId — กันยัดเบอร์):\n  ใบผูกใบขอนี้ · เบอร์ E.164 ได้ (087) · ยังไม่ถูกโทร (นิยามเดียวกับ dashboard —\n  applicantOverviewSql) · ไม่อยู่ในคิว · ไม่เป็น Lead · ไม่ถูก claim (มีคนถืองานอยู่)\nกันชั้นสุดท้าย (held/suppressed phone) อยู่ใน insertQueueItems ตามเดิม",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/application-trace",
  "file": "api/_handlers/application-trace.ts",
  "methods": [
   "GET"
  ],
  "doc": "`GET /api/application-trace?id=<ใบสมัคร>` — คนนี้ไปถึงไหนนอกระบบเรา (เจ้าของ 20 ต.ค. 2569 \"ผูกคนที่ผ่านกับ iRecruit และ ERP\")\nจับด้วยเบอร์ 9 ตัวท้าย ตั้งแต่วันกรอกใบ: เป็นผู้สมัครใน iRecruit วันไหน · แจ้งเข้า ERP วันไหน + ช่องทางของลิงก์ที่กรอกผ่าน\nอ่านอย่างเดียว · อ่านแหล่งไหนไม่ได้ = ช่องนั้น `unknown: true` (ห้ามบอกว่า \"ไม่เจอ\")",
  "query": [
   "id"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/audit-logs",
  "file": "api/_handlers/audit-logs.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "",
  "query": [
   "limit"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/azure-ad/callback",
  "file": "api/_handlers/auth/azure-ad-callback.ts",
  "methods": [
   "GET"
  ],
  "doc": "สร้าง account ใหม่อัตโนมัติสำหรับคนที่ login ผ่าน Microsoft แล้วยังไม่มีในระบบ\n(นโยบาย 3 ส.ค. 2569: ทั้งบริษัทจะย้ายไป login ด้วย Microsoft — อีเมลตรงใช้ account เดิม\nไม่มีก็เปิดให้เลย ไม่ต้องสมัครเอง)\n\nปลอดภัยเพราะ token แลกกับ tenant ของบริษัทเท่านั้น (AZURE_AD_TENANT_ID เจาะจง ไม่ใช่ common)\n— คนนอก tenant ผ่านขั้น exchangeAzureAuthCode ไม่ได้ · role เริ่มต้น staff เหมือนสมัครปกติ\npassword_hash ใส่ค่าสุ่มที่ไม่มีใครรู้ (ตาราง users บังคับ not null) — บัญชีนี้เข้าได้ทาง SSO เท่านั้น\nจนกว่าจะตั้งรหัสผ่านผ่าน forgot-password",
  "query": [
   "error",
   "state",
   "code"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/azure-ad/start",
  "file": "api/_handlers/auth/azure-ad-start.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "returnTo"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/callback/azure-ad",
  "file": "api/_handlers/auth/azure-ad-callback.ts",
  "methods": [
   "GET"
  ],
  "doc": "สร้าง account ใหม่อัตโนมัติสำหรับคนที่ login ผ่าน Microsoft แล้วยังไม่มีในระบบ\n(นโยบาย 3 ส.ค. 2569: ทั้งบริษัทจะย้ายไป login ด้วย Microsoft — อีเมลตรงใช้ account เดิม\nไม่มีก็เปิดให้เลย ไม่ต้องสมัครเอง)\n\nปลอดภัยเพราะ token แลกกับ tenant ของบริษัทเท่านั้น (AZURE_AD_TENANT_ID เจาะจง ไม่ใช่ common)\n— คนนอก tenant ผ่านขั้น exchangeAzureAuthCode ไม่ได้ · role เริ่มต้น staff เหมือนสมัครปกติ\npassword_hash ใส่ค่าสุ่มที่ไม่มีใครรู้ (ตาราง users บังคับ not null) — บัญชีนี้เข้าได้ทาง SSO เท่านั้น\nจนกว่าจะตั้งรหัสผ่านผ่าน forgot-password",
  "query": [
   "error",
   "state",
   "code"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/change-password",
  "file": "api/_handlers/auth/change-password.ts",
  "methods": [
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "current_password",
   "new_password"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/config",
  "file": "api/_handlers/auth/config.ts",
  "methods": [
   "GET"
  ],
  "doc": "โชว์ฟอร์มอีเมล+รหัสผ่านบนหน้า Login ไหม — ตั้งต้น \"ไม่โชว์\" ตามที่เจ้าของสั่ง\n(เส้น API ยังใช้ได้ตามปกติ · ดู isPasswordLoginUiEnabled)",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/dev-role",
  "file": "api/_handlers/auth/dev-role.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "Issue a session as the first active DB user matching role (no password).\nFail-closed: only when NOT production and JARVIS_DEV_ROLE_LOGIN=true.",
  "query": [],
  "body": [
   "js",
   "role"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/forgot-password",
  "file": "api/_handlers/auth/forgot-password.ts",
  "methods": [
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/login",
  "file": "api/_handlers/auth/login.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "email",
   "password"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/logout",
  "file": "api/_handlers/auth/logout.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/magic-link",
  "file": "api/_handlers/auth/magic-link.ts",
  "methods": [
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/magic-link-verify",
  "file": "api/_handlers/auth/magic-link-verify.ts",
  "methods": [
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/me",
  "file": "api/_handlers/auth/me.ts",
  "methods": [
   "GET",
   "PATCH"
  ],
  "doc": "BU ที่ดูเพิ่ม (164) — หน้าเว็บใช้ตัดสินว่าล็อก BU เดียวหรือให้เลือกในชุดนี้ (28 ต.ค. 2569)",
  "query": [],
  "body": [
   "js",
   "department_code"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/register",
  "file": "api/_handlers/auth/register.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "email",
   "password",
   "first_name",
   "last_name",
   "full_name",
   "department_code"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/auth/reset-password",
  "file": "api/_handlers/auth/reset-password.ts",
  "methods": [
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "token",
   "new_password",
   "password"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/branding",
  "file": "api/_handlers/branding.ts",
  "methods": [
   "GET",
   "PUT",
   "PATCH"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "logoDataUrl"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/bu-line-ids",
  "file": "api/_handlers/bu-line-ids.ts",
  "methods": [
   "GET",
   "PUT"
  ],
  "doc": "═══ GET/PUT /api/bu-line-ids — แอดไลน์ประจำ BU ในข้อความประกาศ (เจ้าของ 13 พ.ย. 2569) ═══\n- GET: ทุก BU ที่ตั้งไว้ `{ ids: { LBD: '@xxx' } }` (คนทำประกาศต้องอ่านได้ — ร่างข้อความใช้)\n- PUT (admin): `{ bu, lineId }` · lineId ว่าง = ลบ · จดบันทึกการใช้งานทุกครั้ง",
  "query": [],
  "body": [
   "js",
   "bu",
   "lineId"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/call-followup-policy",
  "file": "api/_handlers/call-followup-policy.ts",
  "methods": [
   "GET",
   "PUT"
  ],
  "doc": "═══ GET/PUT /api/call-followup-policy — โทรซ้ำคนที่ไม่รับสาย (เจ้าของ 26 ต.ค. 2569) ═══\n> *\"ไม่รับสายแล้วโทรวันถัดไป ขอเป็นโทรใหม่ตอนเที่ยง · ขอหน้าไว้ตั้งเวลาผ่าน UI\"* · Choice: ทุกงานที่ AI โทร · Admin แก้\n- GET: ค่าที่ใช้อยู่\n- PUT (admin): ช่องโทรซ้ำเป็นรอบ (27 ต.ค. 2569) `{ roundCalls, roundGapMinutes, roundsPerDay, roundsGapHours, retryDays,\n  dayMorning, dayAfternoon, retryDayMode }` — maxAttempts คิดให้เอง · ค่าอื่นของนโยบายคงเดิม · จดบันทึกการใช้งานทุกครั้ง\nความหมาย/ตัวกรองค่าอยู่ `src/lib/callFollowupPolicy.ts` ที่เดียว · เก็บใน app_call_followup_policy (073)",
  "query": [],
  "body": [
   "js",
   "retryDayMode"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/call-scripts",
  "file": "api/_handlers/call-scripts.ts",
  "methods": [
   "GET",
   "PUT",
   "DELETE"
  ],
  "doc": "GET/PUT/DELETE /api/call-scripts — บทพูดของ AI แก้ได้จากหน้าตั้งค่า\n(เจ้าของสั่ง 27 ส.ค. 2569: *\"ฉันแก้ Script การพูดจากฝั่งฉันแล้วให้มันส่งไป\nพร้อมกันให้ Lumos เลย\"*)\n\n- GET    → บททั้ง 3 ชุด: ฉบับที่ใช้จริงตอนนี้ + ฉบับมาตรฐาน + ใครแก้ล่าสุด\n           แถมรายชื่อตัวแปร {ที่ใช้ได้} ให้จอวาดเป็นตัวช่วย\n- PUT    → บันทึกฉบับแก้หนึ่งชุด (validate ก่อนเสมอ — ดู callScriptStore)\n- DELETE → ลบฉบับแก้ = กลับไปใช้บทมาตรฐานทันที (ทางถอยไม่ต้อง deploy)\n\n🔴 มีผลกับ **สายที่เข้าคิวหลังบันทึก** — สายที่ค้างคิวอยู่แล้วถือบทเดิมของมันไป\n(payload ประกอบตอน enqueue · เปลี่ยนย้อนหลัง = คนฟังกับคนตรวจเห็นคนละบท)\n\nสิทธิ์: supervisor ขึ้นไป — บทคือเสียงของบริษัทที่พูดกับคนจริง",
  "query": [
   "key"
  ],
  "body": [
   "js",
   "key",
   "lines"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/call-suppression",
  "file": "api/_handlers/call-suppression.ts",
  "methods": [
   "GET",
   "DELETE"
  ],
  "doc": "GET/DELETE /api/call-suppression — **บัญชีห้ามโทร** (เบอร์ที่ AI จะไม่โทรถึงชั่วคราว)\n\nเจ้าของถาม 1 ก.ย. 2569 ว่า *\"ไม่ได้ส่ง — เบอร์อยู่ในบัญชีห้ามโทร คือ\"* แล้วพบว่า\n**ไม่มีหน้าจอไหนดูหรือปลดบัญชีนี้ได้เลย** — เบอร์ถูกพักอัตโนมัติเมื่อผลโทรกลับมาว่า\n\"เบอร์ผิด\" (7 วัน) หรือ \"ไม่หางานแล้ว\" (30 วัน) แล้วคนใช้งานได้แต่รอให้หมดอายุ\n\n- GET    → รายการที่ **ยังพักอยู่** (หมดอายุแล้วไม่ต้องโชว์ ไม่ได้บล็อกอะไรแล้ว)\n- DELETE → ปลดเบอร์เดียว (`?phone=`) — ลบแถวทิ้ง ไม่ใช่ตั้งเวลาให้หมดอายุ\n           **แล้วพาสายที่เคยถูกปัดทิ้งกลับเข้าคิวให้ด้วย** (17 ก.ย. 2569)\n\nสิทธิ์: supervisor ขึ้นไป — ปลดแล้ว AI จะโทรหาเบอร์นั้นได้อีกครั้งจริง ๆ",
  "query": [
   "phone"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/candidate-interviews",
  "file": "api/_handlers/candidate-interviews.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "",
  "query": [
   "candidate_id",
   "id"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/candidate-work-history",
  "file": "api/_handlers/candidate-work-history.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "",
  "query": [
   "candidate_id"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/candidates",
  "file": "api/_handlers/candidates.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "",
  "query": [
   "limit",
   "offset",
   "id",
   "status"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/clients",
  "file": "api/_handlers/clients.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "",
  "query": [
   "active_only"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/dashboard-trends",
  "file": "api/_handlers/dashboard-trends.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/dashboard-trends?section=follow|applicants|releases|requests&from=YYYY-MM-DD&to=YYYY-MM-DD\n\n═══ ข้อมูลของแท็บ \"Dashboard\" ในหน้ากล่องงาน + หน้าติดตาม (อ่านอย่างเดียว · 28 ก.ย. 2569) ═══\n\nเจ้าของสั่ง: *\"สวมบทบาทเป็นผู้บริหาร … ดูว่าแต่ละวันทีมมีแนวโน้มเติบโตลดลงยังไง … รายวัน สัปดาห์ เดือน ปี\"*\n→ Choice: แท็บในสองหน้า (ชื่อ \"Dashboard\") · ทำครบ 4 ส่วน · ERP อ่านอย่างเดียว + สำเนาฝั่งเรา\n\n🔴 กติกาของเส้นนี้ (ชั้นคู่ขนาน — ไม่แตะเส้น/จอเดิม):\n1. **อ่านอย่างเดียว** ทุก section · ไม่มี POST/PATCH\n2. **คืนแถวย่อ ไม่คืนข้อมูลบุคคลของผู้สมัคร/ผู้รับสาย** (ไม่มีชื่อ เบอร์ ที่อยู่) — หน้าเว็บแบ่งงวด/มิติเอง\n3. สิทธิ์ต่อ section = สิทธิ์ของเส้นเดิมที่ข้อมูลชุดนั้นมาจาก (follow · job-applications · siamraj-unit-requests)\n4. **BU ชุดเดียว** = รหัสแผนก (`normalizeTrendBu`) · คนที่ถูกล็อก BU เห็นเฉพาะ BU ตัวเอง (ไม่รู้ BU = ไม่เห็น)\n   ⚠️ ติดตามไม่ล็อก BU — หน้าติดตามเดิมให้ทุกคนเห็นทุกแถว (ห้ามทำ Dashboard แคบกว่าหน้าที่มันสรุป)\n5. ใบขอ (ERP) อ่านผ่านสำเนาในฐาน (`trendSnapshots`) — คิวรีช่วงยาวใช้ ~24 วิ ถามสดทุกครั้งไม่ได้",
  "query": [
   "section",
   "from",
   "to"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/employees",
  "file": "api/_handlers/employees.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "",
  "query": [
   "limit",
   "offset",
   "id",
   "status"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/erp-inform-dates",
  "file": "api/_handlers/erp-inform-dates.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "POST /api/erp-inform-dates { phones: string[] } → { dates: { [เบอร์ 9 ตัวท้าย]: 'YYYY-MM-DD' } }\nวันแจ้งเข้าล่าสุดจาก ERP (อ่านอย่างเดียว) — เติมวันเริ่มงานที่ว่าง (เจ้าของเคาะ 17 ต.ค. 2569)\nใช้ POST เพราะส่งเบอร์ทีละหลายร้อย (ไม่ใส่เบอร์ใน URL) · ไม่เขียนอะไร",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/follow",
  "file": "api/_handlers/follow.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "Follow — รายชื่อคนที่ต้องติดตาม (คนกรอกเอง) → ส่งเข้าเส้น reminder ให้ Lumos โทร\n\nGET    /api/follow            → รายการ + สถานะการโทรจาก Lumos\nPOST   /api/follow            → เพิ่มรายชื่อ (enqueue ให้ Lumos ทันที)\nDELETE /api/follow?id=<uuid>  → ยกเลิก (soft cancel + ยกเลิกในคิวถ้ายังไม่ถูกดึง)\nDELETE /api/follow?id=<uuid>&purge=1 → **ลบทิ้งจริง** (admin เท่านั้น · ล้างข้อมูลทดสอบ)",
  "query": [
   "limit",
   "offset",
   "id",
   "scope",
   "purge"
  ],
  "body": [
   "js",
   "recipient_name",
   "recipient_phone",
   "topic",
   "note",
   "staff_phone",
   "scheduled_at",
   "group_id",
   "call_times",
   "call_mode",
   "unit_name",
   "site_code",
   "call_round",
   "follow_team",
   "time_tbd",
   "plan_day_start",
   "start_date",
   "insurance_type",
   "customer_name",
   "customer_contact",
   "customer_phone",
   "replace_position",
   "outcome_code",
   "outcome_note",
   "stop_scope",
   "apply_phone_to_set",
   "replace_ids",
   "rounds",
   "plan_day_nos",
   "replan",
   "outcome",
   "action"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/follow-insurance-types",
  "file": "api/_handlers/follow-insurance-types.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "\"ประเภทประกัน\" ขั้น 4 ฟอร์มเพิ่มคนติดตาม (migration 149 · เจ้าของสั่ง 16 ต.ค. 2569)\n\nGET  /api/follow-insurance-types → ตัวเลือกทั้งหมด (ทุก role ที่ล็อกอิน — dropdown หน้าติดตามใช้)\nPOST /api/follow-insurance-types → เพิ่มประเภทใหม่ (supervisor ขึ้นไป — บังคับที่ rbac)\n\n⚠️ ตั้งใจไม่มี DELETE/PATCH (เหมือน follow-topics) — จะเอาออกให้เจ้าของสั่งก่อน",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/follow-oldid-repush",
  "file": "api/_handlers/follow-oldid-repush.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "═══ GET/POST /api/follow-oldid-repush — แผนติดตามรหัสเดิมที่ยังค้าง (หน้า ตั้งค่า › เชื่อมระบบภายนอก · 22 ต.ค. 2569) ═══\n- GET: เหลือกี่แผน กี่สาย\n- POST: ส่งแผนพวกนี้กลับไปด้วยรหัสใหม่ เวลาเดิม — กดหลังทีม Lumos ยืนยันว่ายกเลิกแผนรหัสเดิมแล้วเท่านั้น\n- POST ?action=recancel: ยิงยกเลิกซ้ำที่ Lumos ให้แผนรหัสเดิมที่ยกเลิกในระบบเราแล้ว (ข้ามเบอร์ที่ยังมีสายรอโทร)\n- GET ?action=history: ประวัติยิงยกเลิกทุกครั้ง (จากบันทึกการใช้งาน) + สถานะที่ถามล่าสุด (25 ต.ค. 2569)\n- POST ?action=status&run=<id>: ถามสถานะคำสั่งยกเลิกของครั้งนั้นจาก Lumos อีกรอบ แล้วจดลงบันทึก\nแอดมินเท่านั้น · จดบันทึกทุกครั้ง · ที่มา/กติกาดู `api/_lib/followOldIdRepush.ts`",
  "query": [
   "action",
   "run"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/follow-staff-contacts",
  "file": "api/_handlers/follow-staff-contacts.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "รายชื่อ+เบอร์เจ้าหน้าที่ผู้ติดตาม (migration 099 · เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)\n\nGET  /api/follow-staff-contacts → รายชื่อทั้งหมด (ทุก role ที่ล็อกอิน — dropdown หน้า Follow ใช้)\nPOST /api/follow-staff-contacts → เพิ่มชื่อ+เบอร์ (supervisor ขึ้นไป — บังคับที่ rbac)\n\n⚠️ ตั้งใจไม่มี DELETE/PATCH — เบอร์ถูกอ่านให้ผู้สมัครฟังไปแล้วในสายที่โทรออก\nลบ/แก้ทีหลังไม่ช่วยอะไรกับสายที่ออกไปแล้ว · จะเอาออกจริงให้เจ้าของสั่งก่อน",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/follow-topics",
  "file": "api/_handlers/follow-topics.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "\"เรื่องที่จะให้โทรติดตาม\" (migration 100 · เจ้าของสั่ง 18 ส.ค. 2569)\n\nGET  /api/follow-topics → ตัวเลือกทั้งหมด (ทุก role ที่ล็อกอิน — dropdown หน้า Follow ใช้)\nPOST /api/follow-topics → เพิ่มเรื่องใหม่ (supervisor ขึ้นไป — บังคับที่ rbac)\n\n⚠️ ตั้งใจไม่มี DELETE/PATCH — เรื่องถูกอ้างจากรายการติดตามย้อนหลัง (เก็บเป็นข้อความ)\nลบตัวเลือกไม่ได้ทำให้รายการเก่าหาย แต่จะทำให้สถิติแยกกลุ่มไม่ตรง · จะเอาออกให้เจ้าของสั่งก่อน",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/geocode",
  "file": "api/_handlers/geocode.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/health",
  "file": "api/_handlers/health.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/home-ai-share",
  "file": "api/_handlers/home-ai-share.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/home-ai-share?from=YYYY-MM-DD&to=YYYY-MM-DD&bu= — หน้าหลัก \"ระบบไปกี่ %\" (30 ก.ย. 2569 · อ่านอย่างเดียว)\n\nตอบสี่ก้อน: หน้าติดตาม (สาย) · ดูแลหลังเริ่มงาน (สาย) · ผู้สมัครในกล่องงาน (ใบ) · จับคู่งาน (คน ต่อใบขอ)\nแต่ละก้อนเป็น 4 ก้อนที่ไม่ทับกัน AI โทร · คนโทร · ทั้งสองทาง · ยังไม่โทร\nนิยามอยู่ `src/lib/homeAiShare.ts` · SQL อยู่ `api/_lib/homeAiShareSql.ts`\nไม่ส่งวันที่ทั้งคู่ = ทั้งหมด (หน้าเว็บส่ง 30 วันล่าสุดเป็นค่าตั้งต้น)\n\n🔴 กติกา (ชุดเดียวกับ `team-online`): ตัวนับล้วน ไม่คืนข้อมูลบุคคล (`withAuth`) ·\nBU กลาง = `parseBuParam` · บัญชีถูกล็อกแผนก = BU ของตัวเองเสมอ · ก้อนล้มแยกกัน (null + เหตุ — ห้าม 0 ปลอม)\n⚠️ ฐานยังไม่รัน migration 130 = สองก้อนแรกยังตอบได้ แต่นับคนโทรไม่ได้ ⇒ `follow_staff_ready: false`\n\n`?list=<ก้อน>&segment=<total|ai|staff|both|notCalled>&page=<n>` (รอบ 17 · Popup รายชื่อตอนกดกล่อง) —\n**เส้นเดียวที่คืนชื่อคน** ⇒ สิทธิ์เท่าหน้าต้นทางของก้อนนั้น (`LIST_RESOURCE` + `checkApiAccess`) · ชื่อ + BU + วัน\n+ ก้อน เท่านั้น ไม่มีเบอร์ · CTE/เงื่อนไขก้อนตัวเดียวกับตัวนับ ⇒ จำนวนชื่อ = เลขในกล่อง\n\n`?results=<ก้อน>` (รอบ 18 · แผง \"ผลโทร\") — ผลล่าสุดของงานที่โทรแล้ว แยก AI/คน จัดถังด้วย `classifyCallMicro`\nตัวนับล้วน (ไม่มีชื่อ/เบอร์) ⇒ เปิดเท่ากับกล่องตัวเลข · นิยามอยู่ `src/lib/homeCallResults.ts`",
  "query": [],
  "body": [
   "errors",
   "previous",
   "follow",
   "follow_staff_ready",
   "aftercare",
   "applicants",
   "matching",
   "error",
   "rows",
   "ai",
   "staff",
   "total",
   "report",
   "journey",
   "apps",
   "entry"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/home-kpis",
  "file": "api/_handlers/home-kpis.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/home-kpis — เลข KPI แถวบนหน้าหลัก + ตัวเลือก BU (read-only · Phase 10)\n\nเจ้าของเคาะ 24 ส.ค. 2569: *\"ทำตัวเทียบจริงเลย\"* (วันนี้เทียบเมื่อวาน) และ\n*\"เห็นเหมือนกันอะแต่แยกตาม BU\"*\n\n🔴 กติกาของเส้นนี้:\n1. **นับได้เฉพาะเหตุการณ์ที่มีเวลา** — ใบสมัครกรอกเมื่อไหร่ · ผลโทรกลับเมื่อไหร่ ·\n   นัดเมื่อไหร่ ⇒ เทียบวันต่อวันได้จริง · ตัวที่เป็น \"สถานะปัจจุบัน\" (ใบขอเปิดกี่ใบ)\n   เทียบไม่ได้เพราะไม่มี snapshot รายวัน จึง **ไม่อยู่ในเส้นนี้เลย** (ห้ามแต่งตัวเลข)\n2. **BU มาจาก `site_code` ไม่ใช่ prefix เลขที่ใบขอ** — วัดจริง 24 ส.ค. 2569: prefix\n   เป็นชนิดใบขอ (OPL/LMO/LAO/DSO…) ไม่มี LBA/LBD เลย · ตัว BU อยู่ที่ site_code\n   ตำแหน่ง 3-5 (`65LBDL0143` → LBD) เก็บใน `job_site_map` ที่ feed เติมเอง\n3. **ไม่แตะ ERP (MSSQL)** — หน้าแรกต้องเบา เหมือน `/api/office-floor`\n4. **ไม่คืนข้อมูลบุคคล** — ตัวนับล้วน จึงครอบ `withAuth` เฉย ๆ ไม่ผูก rbac key\n5. **ตารางที่ยังไม่ migrate ต้องไม่ทำทั้งเส้นล้ม** — แต่ละก้อนกลืน error ของตัวเอง\n   แล้วคืน 0/undefined (fail-safe ไปทาง \"ไม่มีข้อมูล\" ไม่ใช่ 500)",
  "query": [
   "bu"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/home-money",
  "file": "api/_handlers/home-money.ts",
  "methods": [
   "GET"
  ],
  "doc": "═══ GET /api/home-money — เงินและนาฬิกาของใบขอ สำหรับหน้าหลักผู้บริหาร (เจ้าของ 24 ต.ค. 2569 · อ่านอย่างเดียว) ═══\n\n?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD — ช่วงที่รวมยอด (ไม่ส่ง = 30 วันล่าสุด) · บัญชีที่ล็อก BU เซิร์ฟเวอร์บังคับเอง\nคืน:\n  - totals: ยอดตามเงื่อนไขในใบขอ (เพดาน) ทั้งสองจุดเริ่มนับ `need` / `key` — ค่าปรับ · ลดมูลค่า · คน-วัน · จำนวนใบ\n  - daily: ยอดรายวันในช่วง (หน้าเว็บรวมเป็นสัปดาห์/เดือนเอง `groupDaily`)\n  - requests: รายใบที่มียอดในช่วง หรือยังเปิดอยู่ — ใบละกี่วัน วันละกี่คน อัตรา ยอด สองนาฬิกา\n  - customerFines: ลูกค้าหักเงินจริงรายเดือน (ใบรับเงิน · ทุกเรื่อง ไม่ใช่เฉพาะใบขอ)\n  - clocks: ความเร็วทีม (วันคีย์ → หาครบ) / ช้ากว่าที่ลูกค้าต้องการ — เฉพาะใบที่หาครบในช่วง\nตัวคิด `src/lib/requestPenaltyLedger.ts` · ข้อมูลดิบ `api/_lib/siamrajPenaltyLedgerSql.ts`",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/home-overview",
  "file": "api/_handlers/home-overview.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/home-overview?bu= — ก้อน 1 + ก้อน 3 ของหน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569 · อ่านอย่างเดียว)\n\nเจ้าของ: *\"ในหน้าหลักตอนนี้มันปน มันงงไปหมด\"* → Choice \"จัดใหม่ 3 ก้อน\" · แผน `docs/plan-home-v3-2569-09-29.md`\n\n- **ก้อน 1 ผลงานเดือนนี้ (อัตรา)** — `activityLedger` + สำเนา ERP **ก้อนเดียวกับแท็บ Dashboard**\n  (`loadRequestTrendPayload` · วันเริ่มเดียวกัน ⇒ ไม่ยิง ERP เพิ่ม) + ยอดหัวกล่องงานจาก feed เดียวกับกล่องงาน\n- **ก้อน 3 วันนี้ท่อเดินแค่ไหน** — นับเป็นคน (เบอร์ไม่ซ้ำ) · นิยามอยู่ `src/lib/homeOverview.ts` ที่เดียว\n- ก้อน 2 (ของค้าง) + ก้อน 4 (บอร์ดทีม) ไม่อยู่ในเส้นนี้ — ใช้เส้นเดิม + พารามิเตอร์ `bu` (นิยามเดิมทุกตัว)\n\n🔴 กติกา:\n1. BU กลาง = ชุดรหัสแผนก (`parseBuParam`) · ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ (ไม่สนพารามิเตอร์)\n2. ขอบเขต = `loadMatchingBuScope` (ชุดเดียวกับ office-team / flow-summary ที่หน้าหลักใช้อยู่)\n3. ตัวนับล้วน ไม่คืนข้อมูลบุคคล ⇒ `withAuth` (เหมือน office-floor / home-kpis)\n4. ก้อนล้มแยกกัน — ERP ล่ม = ก้อน 1 เป็น null + บอกเหตุ ก้อน 3 ยังขึ้น (ห้าม 0 ปลอม)",
  "query": [
   "bu"
  ],
  "body": [
   "errors"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/home-presence",
  "file": "api/_handlers/home-presence.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/home-presence — ใครอยู่ในระบบ (30 ก.ย. 2569 · อ่านอย่างเดียว)\n\n🔴 เดิมเป็นแผงท้ายหน้าหลัก — ตอนนี้ใช้ที่ **ตั้งค่า › ผู้ใช้งาน** (สถานะใต้ชื่อ · Online ขึ้นก่อน · ปุ่มกรอง)\n   ชื่อเส้นคงเดิม (ไม่มีใครต้องแก้ตาม) · หน้าตั้งค่าเปิดให้ admin อยู่แล้ว ⇒ ได้รายชื่อเสมอ\n\nOnline = เข้าระบบหรือบันทึกงานใน 30 นาทีล่าสุด · Offline = เคยเข้าแล้วแต่ช่วงนั้นเงียบ · ยังไม่เข้าระบบ = ไม่เคยเลย\n`by_bu` = ยอดแยก BU (รอบ 5) ส่งให้ทุกคน เพราะเป็นยอด ไม่ใช่ชื่อ\nนิยาม/ตัวจัดอยู่ `src/lib/homePresence.ts` · ร่องรอยชุดเดียวกับหน้าทีม Online (`userActivitySql.ts`)\n\n🔴 รายชื่อ (ชื่อคน) ส่งให้เฉพาะหัวหน้ากับผู้ดูแล (เจ้าของเคาะ · กติกาเดียวกับหน้าทีม Online) — คนอื่นได้แค่ยอด\n🔴 บัญชีผูกแผนก = เห็นเฉพาะคนใน BU ของตัวเอง · ไม่ผูกแผนก = บอกเหตุ (ห้าม 0 ปลอม)",
  "query": [],
  "body": [
   "error",
   "counts",
   "by_bu",
   "people"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/home-today",
  "file": "api/_handlers/home-today.ts",
  "methods": [
   "GET"
  ],
  "doc": "═══ `/api/home-today` — \"วันนี้ระบบทำอะไรไปแล้ว และเหลืออะไรต้องทำ\" ═══\n\nเจ้าของนิยามหน้าแรกไว้ 15 ก.ย. 2569: *\"หน้าแรกต้อง Display ดูสวย เปิดมาแล้วว้าว\nระบบบอกหมดทุกอย่าง … ตัวเลขต้องบอกระดับ micro ใครทำอะไร วันนี้ต้องทำอะไร\nทำอะไรเสร็จแล้ว เหลือทำอะไร เสร็จที่ว่าผลคืออะไร\"* และย้ำว่า\n*\"หน้าแรกไม่ใช่ Display สำหรับตำแหน่งใดตำแหน่งนึง มันสำหรับทั้งระบบ\"*\n\n⇒ เส้นนี้จึง **ไม่กรองตามสิทธิ์/ตามคน** — ตอบภาพของทั้งบริษัทวันนี้\n\nคืนสองก้อน:\n1. `headline` — ตัวเลขพาดหัว (โทรไปแล้วกี่สาย · ผลออกมาเป็นอะไร · เหลือกี่สาย)\n2. `rows` — **หนึ่งแถวหนึ่งสาย** พร้อมช่องที่ทุกจอก่อนหน้านี้ขาด: **แล้วไงต่อ**\n\n🔴 ผลของสายอ่านจากคำพูดจริงผ่านเครื่องยนต์กลาง `callMicroOutcome.ts`\n(รหัส `acknowledged` ของ Lumos ปนทั้งไปและไม่ไป — ใช้รหัสตรง ๆ ไม่ได้)",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/integration-keys",
  "file": "api/_handlers/integration-keys.ts",
  "methods": [
   "GET",
   "POST",
   "PUT",
   "DELETE"
  ],
  "doc": "═══ GET/POST/DELETE /api/integration-keys — key ของระบบภายนอก (หน้า ตั้งค่า › เชื่อมระบบภายนอก) ═══\nเจ้าของ 22 ต.ค. 2569 \"ทุกอย่างต้องทำผ่าน UI ได้นะ\" — เดิมออก key ได้ทางสคริปต์อย่างเดียว\n- GET: สถานะ key + ยอดคอมเมนต์ที่ So Scraping ส่งมา\n- POST {name}: ออก key ใหม่ (ตัวเก่าใช้ไม่ได้ทันที) — ตอบ key จริงครั้งเดียว เก็บแค่ sha256\n- DELETE ?name=: ยกเลิก key\nแอดมินเท่านั้น · จดบันทึกการใช้งานทุกครั้ง (ไม่จดตัว key)\n\nkey ขาออก (ที่ So Scraping ออกให้ Jarvis เรียก options API · 26 ต.ค. 2569):\n- GET คืน `outbound` (มี key ไหม · 4 ตัวท้าย · URL) — ไม่คืนตัว key\n- PUT {outbound:'so-scraping', key?, base_url, clear?}: บันทึกแบบเข้ารหัส\n- POST {outbound:'so-scraping', test:true, key?, base_url}: ลองเรียกจริง (ไม่ใส่ key = ใช้ตัวที่บันทึกไว้) ตอบจำนวนที่ได้\n- PUT {outbound:'line-bot-sowork', key?, base_url, clear?} (28 ต.ค. 2569): secret ร่วมกับ LINE Bot So Work (`lineBotSoWork.ts`)",
  "query": [
   "name"
  ],
  "body": [
   "js",
   "outbound",
   "base_url",
   "key",
   "clear",
   "test",
   "name"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/integrations/so-scraping/ai-call",
  "file": "api/_handlers/so-scraping-integration.ts",
  "methods": [
   "POST"
  ],
  "doc": "═══ So Scraping → Jarvis: คนที่คอมเมนต์ใต้โพสต์รับสมัครงาน (เจ้าของ 22 ต.ค. 2569) ═══\n\nPOST /api/integrations/so-scraping/leads    — รับคอมเมนต์ทีละอัน\nPOST /api/integrations/so-scraping/ai-call  — ส่งเข้า AI โทร (Lumos)\nยืนยันตัว: header `x-api-key` (`withIntegrationKey` · key ชื่อ `so-scraping`)\n\nChoice เจ้าของ:\n- มีเบอร์ = ใบสมัครหน้าผู้สมัคร Journey เดียวกับเจ้าหน้าที่เพิ่มเอง (`parseStaffApplication` minimal · กันซ้ำ 14 วัน `lockAndFindRepeat`)\n  ช่องทาง \"Facebook คอมเมนต์\" · ผู้รับผิดชอบ = ผู้สรรหาของใบขอ · \"ซ้ำก็คือซ้ำ\" (ไม่สร้างใบใหม่ ผูก lead กับใบเดิม)\n- ไม่มีเบอร์ = เก็บใน `so_scraping_comment_leads` เฉย ๆ\n- AI ยังไม่โทรจนกว่าเรียก ai-call (ตัวส่งอัตโนมัติข้ามใบ So Scraping ที่ยังไม่เลือกวิธีโทร) · ai-call ใช้ `chooseAi` ตัวเดียวกับปุ่ม \"ส่ง AI โทร\"\n- เบอร์ติด `candidate_call_suppression` หรือมีคนถือ (`candidate_call_holds`) = do_not_call\n- ส่งซ้ำ (comment_url เดิม) = ตอบแถวเดิม `duplicate: true`\n🔴 ไม่บันทึกความยินยอม PDPA แทนเจ้าหน้าที่ (ไม่มีคนยืนยัน) — ดู `docs` ในรายงานเจ้าของ",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/integrations/so-scraping/leads",
  "file": "api/_handlers/so-scraping-integration.ts",
  "methods": [
   "POST"
  ],
  "doc": "═══ So Scraping → Jarvis: คนที่คอมเมนต์ใต้โพสต์รับสมัครงาน (เจ้าของ 22 ต.ค. 2569) ═══\n\nPOST /api/integrations/so-scraping/leads    — รับคอมเมนต์ทีละอัน\nPOST /api/integrations/so-scraping/ai-call  — ส่งเข้า AI โทร (Lumos)\nยืนยันตัว: header `x-api-key` (`withIntegrationKey` · key ชื่อ `so-scraping`)\n\nChoice เจ้าของ:\n- มีเบอร์ = ใบสมัครหน้าผู้สมัคร Journey เดียวกับเจ้าหน้าที่เพิ่มเอง (`parseStaffApplication` minimal · กันซ้ำ 14 วัน `lockAndFindRepeat`)\n  ช่องทาง \"Facebook คอมเมนต์\" · ผู้รับผิดชอบ = ผู้สรรหาของใบขอ · \"ซ้ำก็คือซ้ำ\" (ไม่สร้างใบใหม่ ผูก lead กับใบเดิม)\n- ไม่มีเบอร์ = เก็บใน `so_scraping_comment_leads` เฉย ๆ\n- AI ยังไม่โทรจนกว่าเรียก ai-call (ตัวส่งอัตโนมัติข้ามใบ So Scraping ที่ยังไม่เลือกวิธีโทร) · ai-call ใช้ `chooseAi` ตัวเดียวกับปุ่ม \"ส่ง AI โทร\"\n- เบอร์ติด `candidate_call_suppression` หรือมีคนถือ (`candidate_call_holds`) = do_not_call\n- ส่งซ้ำ (comment_url เดิม) = ตอบแถวเดิม `duplicate: true`\n🔴 ไม่บันทึกความยินยอม PDPA แทนเจ้าหน้าที่ (ไม่มีคนยืนยัน) — ดู `docs` ในรายงานเจ้าของ",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/irecruit-replace-sync",
  "file": "api/_handlers/irecruit-replace-sync.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "═══ /api/irecruit-replace-sync — การดึงส่งคนแทนจาก iRecruit (2 ต.ค. 2569) ═══\n\nGET   → สภาพ: เปิดอยู่ไหม · เวลาโทร (3 สาย) · ผลรอบล่าสุด · เหตุผลที่ใช้ iRecruit ไม่ได้ (ถ้ามี)   (staff)\nPOST  → ดึงตอนนี้หนึ่งรอบ (ตัวเดียวกับที่ worker เดินทุก 5 นาที)                                  (supervisor+)\nPATCH → `{ aiPaused: boolean }` พัก/เปิด AI ของงานส่งคนแทน (เจ้าของสั่ง 6 ต.ค. 2569 ค่ำ \"อย่าพึ่งส่งให้ Ai โทร\")  (supervisor+)\n        พัก = เปลี่ยนสาย AI ที่ยังไม่ถึงเวลาเป็นคนโทร + ยกเลิกแผนที่ Lumos ทันที (worker บังคับซ้ำทุก 5 นาที)\nPATCH → `{ confirmTime, leadMinutes }` เวลาโทร (7 ต.ค. 2569)                                              (supervisor+)\nPATCH → `{ action: 'all_ai' | 'cancel_past' }` ปุ่มสลับเป็น AI (เว้น WL) · ยกเลิกสายที่เลยเวลา (19 ต.ค. 2569)          (supervisor+)\nPATCH → `{ aiPhones, aiPhonesWorkYmd }` รายชื่อให้ AI โทร (18 ต.ค. 2569 ช่องบนจอแทนการตั้งในฐานตรง ๆ)            (supervisor+)\n        บันทึกแล้วตั้งธง `aiPhonesApplyPending` → ตัวดึงทุก 5 นาทีสลับสายที่ยังไม่ถึงเวลาให้ครั้งเดียว\n\n🔴 เส้นนี้ไม่สร้างสายเอง — ทุกอย่างผ่าน `runIrecruitReplaceSync` ที่เดียว (กันซ้ำที่ฐาน · ส่ง AI ตามสวิตช์เดิม)",
  "query": [],
  "body": [
   "js",
   "action",
   "aiPaused",
   "confirmTime",
   "leadMinutes",
   "aiPhones",
   "aiPhonesWorkYmd"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/job-application-document",
  "file": "api/_handlers/job-application-document.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "POST { id, document: { base64, filename, mime } } — เจ้าหน้าที่แนบไฟล์ให้ใบที่มีอยู่ (เจ้าของ 12 พ.ย. 2569:\n\"นำเข้า excel เสร็จขึ้นมาข้างๆชื่อให้ Chose ไฟล์\") · ตรวจชนิด/ขนาดตัวเดียวกับหน้าสมัคร (PDF/JPG/PNG ≤ 3MB)\n· จำกัด BU เหมือน GET · ใบละไฟล์ แนบใหม่ = แทนไฟล์เดิม",
  "query": [
   "id"
  ],
  "body": [
   "js",
   "id",
   "document"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/job-applications",
  "file": "api/_handlers/job-applications.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "ผู้รับผิดชอบของลิงก์ที่สมัครเข้ามา (ทีม Online · `POSTING_OWNER_SQL`) · schema เก่า = undefined",
  "query": [
   "detail_of",
   "counts",
   "job_id",
   "lead",
   "bucket",
   "cancelled"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/job-applications-import",
  "file": "api/_handlers/job-applications-import.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "`GET/POST /api/job-applications-import` — นำเข้าผู้สมัครจาก Excel (เจ้าของสั่ง 1 ต.ค. 2569)\n\nGET  → ไฟล์ตัวอย่าง `{ filename, mime, dataBase64 }` (ชีตผู้สมัคร + ชีตค่าที่ใช้ได้)\nPOST `{ file_base64, dry_run, responsible_name?, channel_id?, channel_label?, job_id?, job_title?, unit_name?, send_ai? }`\n     dry_run = ตัวอย่างก่อนบันทึก (ไม่เขียนอะไร) · ไม่ใช่ dry_run = บันทึกแถวที่ผ่าน\n\n═══ นำเข้าตามกล่อง + ส่ง AI โทรเลย (เจ้าของสั่ง 15 ต.ค. 2569) ═══\n> *\"นำเข้าตามกล่องๆแล้วให้ Ai โทรเลย … พอเอาเข้าแล้วก็ส่งไปให้ Ai โทรเลย\"*\n`job_id` = ทุกแถวผูกใบขอนั้น (เช็ค BU เหมือนเพิ่มข้อมูลผู้สมัคร + ใบต้องยังเปิดอยู่)\n`send_ai` = บันทึกเสร็จส่งเข้าคิว AI ทันที (เส้นเดียวกับปุ่มส่ง AI · push เลย) — ซ้ำ iRecruit 14 วันไม่ส่ง (ให้คนเลือก)\ndry run ที่มี `job_id` บอกล่วงหน้าว่า AI โทรใบนี้ได้ไหม (`ai_block` — ใบยังไม่ตั้งรายได้ = AI ไม่โทร)\n\n🔴 กติกาต่อแถว = ปุ่ม \"เพิ่มข้อมูลผู้สมัคร\" ทุกตัวอักษร (`parseStaffApplication` + insert ชุดเดียวกัน)\n🔴 เบอร์ที่สมัครเข้ามาภายใน 14 วันข้าม (กติกาสมัครซ้ำ) — ตรวจก่อนเพื่อโชว์ในตัวอย่าง + **ตัดสินอีกชั้นตอนบันทึก**\n   ในธุรกรรมเดียว ล็อกเบอร์ทีละแถว (เรียงเบอร์ กัน deadlock) · ติดกติกา = ข้ามแถวนั้น · error อื่น = ไม่บันทึกทั้งไฟล์\n🔴 นำเข้าจากแท็บผู้สมัคร (ไม่มี `job_id`) **AI ยังไม่โทร** — ส่งเองจากแท็บผู้สมัคร (ปุ่มที่ยิงสายต้องมีป๊อปยืนยันรายชื่อ)\n   นำเข้าตามกล่อง: ตารางตัวอย่างคือรายชื่อที่จะโทร + ปุ่มบอกว่า \"นำเข้าแล้วส่ง AI โทร N คน\"\n⚠️ ใบที่นำเข้าไม่ผูกใบขอ ⇒ ผู้ใช้ที่ถูกล็อก BU ประทับแผนกตัวเองลงใบ (`staffEntryDepartment` · 11 ต.ค. 2569)\n   เดิมกัน 403 ทั้งเส้น = คนล็อก BU (59/61) เลือกไฟล์แล้วขึ้น error ทันที · ล็อกแต่ไม่รู้แผนก ยังกันเหมือนเดิม\n⚠️ SheetJS 0.18.5 (ตัวเดียวกับนำเข้า OPL) — เส้นนี้เปิดเฉพาะเจ้าหน้าที่ที่ล็อกอิน · จำกัดขนาด/จำนวนแถว",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/job-assignments",
  "file": "api/_handlers/job-assignments.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "",
  "query": [
   "job_id"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/job-post-actions",
  "file": "api/_handlers/job-post-actions.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "GET /api/job-post-actions            → ยอด \"ทำอะไรไปแล้ว\" ทุกใบ (การ์ดหน้าโพสต์ประกาศ · เจ้าของ 13 พ.ย. 2569)\nGET /api/job-post-actions?job=<id>   → รายละเอียดใบเดียว (ป๊อป: Autopost รายกลุ่ม · ลิงก์โพสต์เอง · คำสั่ง Scrap)\nGET /api/job-post-actions?days=1&from=&to=&bu= → โพสต์เองรายวัน (การ์ด 6 หน้าภาพรวม · BU แบบหน้าภาพรวม)\nPOST /api/job-post-actions { link_id, post_url? } → จดว่าโพสต์เองแล้ววันนี้ (กดคัดลอกข้อความ / วางลิงก์โพสต์ในหน้าโพสต์เอง · 13 พ.ย. 2569)\nอ่านอย่างเดียว · สิทธิ์เดียวกับหน้าโพสต์ประกาศ (`job-applications`) · จำกัด BU ตามเลขใบขอแบบเส้น board ของ So Scraping",
  "query": [
   "days",
   "from",
   "to",
   "bu",
   "job"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/job-public-release",
  "file": "api/_handlers/job-public-release.ts",
  "methods": [
   "GET",
   "POST",
   "DELETE"
  ],
  "doc": "`/api/job-public-release` — ปล่อย / ดึงลง ใบขอบนหน้าสาธารณะ\n\nเจ้าของเคาะ 22 ส.ค. 2569: **ทุกใบต้องกดปล่อย** (กลับด้านจากเดิมที่ขึ้นเองทุกใบ)\n  GET    → รายการที่ปล่อยแล้ว (บอร์ดใช้ติดชิป/นับตัวเลข)\n  POST   → ปล่อย (รับได้ทีละใบหรือหลายใบ — bulk release ของวันเปลี่ยนผ่าน)\n  DELETE → ดึงลง\n\n🔴 กติกา:\n1. **ต้องส่ง id เต็ม** (`siamraj-sql:OPL6908001`) ไม่ใช่เลขที่ใบขอเปล่า ๆ — ไม่งั้นเวลาเทียบ\n   กับ feed จะไม่ตรง (กับดัก pre:/sql: ของโปรเจกต์)\n2. เป็นการเปลี่ยน \"สิ่งที่คนนอกเห็น\" → บันทึกว่าใครกด (`released_by`) ไว้ตรวจย้อนได้\n3. rbac ผูกกับ key เดียวกับการแก้ประกาศ (`recruit-postings`) — คนที่แก้ประกาศได้\n   คือคนที่ตัดสินใจปล่อยได้ ไม่ต้องเพิ่มสิทธิ์ชุดใหม่ให้ทีมต้องมาขอ",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/job-release-skip",
  "file": "api/_handlers/job-release-skip.ts",
  "methods": [
   "GET",
   "POST",
   "DELETE"
  ],
  "doc": "`/api/job-release-skip` — ตั้ง / ยกเลิก \"ไม่ปล่อย + เหตุผล\" ของใบขอ (migration 129 · 29 ก.ย. 2569)\n\n  GET    → ทุกใบที่ตั้ง \"ไม่ปล่อย\" (กล่องงานติดชิป · หน้าทีม Online นับก้อน \"ไม่อนุมัติ\")\n  POST   → ตั้ง `{ jobId, reason, note }` (กดซ้ำ = เปลี่ยนเหตุผล)\n  DELETE → ยกเลิก (`?jobId=` — body ของ DELETE ไม่ถึง handler ในเซิร์ฟเวอร์ท้องถิ่น · บทเรียนทะเบียนปล่อย)\n\n🔴 กติกา:\n1. ต้องส่ง **id เต็ม** ของใบ (`siamraj-sql:` / `siamraj-pre:`) — แบบเดียวกับทะเบียนปล่อย\n2. ใบที่ **ปล่อยขึ้นหน้าสาธารณะอยู่** ตั้ง \"ไม่ปล่อย\" ไม่ได้ (409) — ต้องดึงลงก่อน (กันสถานะขัดกันเอง)\n3. เหตุผลตรวจด้วย `validateReleaseSkip` ตัวเดียวกับฟอร์ม · \"อื่น ๆ\" ต้องพิมพ์เหตุผล\n4. rbac key เดียวกับการปล่อย (`recruit-postings`) — คนที่ตัดสินใจปล่อยได้ คือคนที่ตัดสินใจไม่ปล่อยได้",
  "query": [],
  "body": [
   "reason",
   "note"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/job-staff",
  "file": "api/_handlers/job-staff.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "BU value written on new rows; null for the \"all\"/global scope.",
  "query": [
   "manage",
   "bu"
  ],
  "body": [
   "js",
   "op",
   "role",
   "name",
   "oldName",
   "newName",
   "fromBu",
   "toBu"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/jobs",
  "file": "api/_handlers/jobs.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "",
  "query": [
   "limit",
   "offset",
   "id",
   "status"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/lumos/call-batches",
  "file": "api/_handlers/lumos-call-batches.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "ชุดส่งงานโทร — สร้าง / อนุมัติ / ยกเลิก / ถอนคนออก\n\nGET    /api/lumos/call-batches                    → { batches: [...] }\nPOST   { jobId, boardCardIds?, irecruitIds?, note? } → สร้างชุด **อนุมัติแล้ว** (ดูด้านล่าง)\nPATCH  { batchId, action: 'approve'|'cancel', reason? }\nDELETE ?batchId=&itemId=                          → ถอนคนออกจากชุด\n\nอนุมัติแล้ว **ยังไม่เข้าคิวทันที** — ตั้ง release_at ไว้ข้างหน้า (ช่วงถอนคำ)\nระหว่างนั้นยกเลิก/ถอนคนได้ · พ้นเวลาแล้ว releaseDueCallBatches() ค่อยส่งเข้าคิวจริง\n\n⚠️ **POST ข้ามขั้นอนุมัติเสมอ (เจ้าของเคาะ 11 ส.ค. 2569)**\nแผงอนุมัติถูกเอาออกจากทุกหน้าไปแล้ว ชุดที่สร้างเป็น `pending_approval` จึงค้างถาวร\n(ตัวปล่อยแตะเฉพาะชุดที่ `approved`) — บนฐานจริงมีค้างแบบนั้น 1 ชุดตั้งแต่ 7 ส.ค.\nทางที่เลือก: ให้เส้นนี้เป็น `autoApprove` แล้ว **คงช่วงถอนคำ 10 นาทีไว้เหมือนเดิม**\nเป็นตัวกันพลาดแทนการอนุมัติ · หน้า Matching มีแถบนับถอยหลัง + ปุ่มยกเลิกอยู่\n\nไม่ใช่การผ่อนสิทธิ์: ปุ่ม \"ส่ง AI โทร\" บนหน้าเดียวกันยิงเข้าคิว**ทันที**ด้วย rbac ชุดนี้อยู่แล้ว\nเส้นนี้จึงยังเข้มกว่าเดิม (หน่วง 10 นาที + ยกเลิกได้) ไม่ใช่หลวมกว่า\n\nสิทธิ์: สร้างได้ทุกคนที่ใช้หน้า Matching ได้ · **`action:'approve'` เฉพาะ supervisor/admin**\n⚠️ ตั้งแต่ถอดโหมด assist ทิ้ง (11 ส.ค. 2569) **ไม่มีทางไหนสร้างชุด `pending_approval`\nได้อีกแล้ว** — `action:'approve'` จึงเหลือไว้เผื่อชุดเก่าที่ค้างบนฐานเท่านั้น\n(มีอยู่ 1 ชุด · เจ้าของสั่งปล่อยค้างไว้) ถ้าจะให้ staff อนุมัติเองแก้ที่ canApprove() ที่เดียว",
  "query": [
   "batchId",
   "itemId"
  ],
  "body": [
   "js",
   "jobId",
   "boardCardIds",
   "irecruitIds",
   "requestNo",
   "note",
   "batchId",
   "action",
   "reason"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/lumos/call-funnel",
  "file": "api/_handlers/lumos-call-funnel.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/lumos/call-funnel — funnel การโทรทั้งระบบ + ถัง \"ต้องคนตาม\" (read-only)\n\nตอบคำถามที่เจ้าของถาม: \"ส่งไปให้ Lumos กี่คน · โทรติดกี่คน · ไม่ติดกี่คน ·\nไม่รับสายกี่คน\" แล้วต่อด้วย \"ใครที่ AI เอาไม่อยู่แล้วต้องให้คนตาม\"\n\n⚠️ ตัวเลขที่นี่คือ \"การทำงานของการโทร\" ไม่ใช่ \"หาได้แล้ว/ปิดครบใบขอ\" ทางการจาก ERP\n(นิยาม Control Tower ห้ามปนกัน — ดู references/02-dashboard-metric-definitions.md)",
  "query": [
   "since",
   "source",
   "people",
   "series",
   "days"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/lumos/dispatch",
  "file": "api/_handlers/lumos-dispatch.ts",
  "methods": [
   "GET",
   "POST",
   "DELETE"
  ],
  "doc": "ส่งให้ Lumos โทร แบบ \"คนเลือกเอง\" + อ่านสถานะ/ผลการโทรต่อคน\n\nGET    /api/lumos/dispatch?jobId=<id>                     → สถานะ+ผลการโทรของทุกคนที่ส่งไปแล้วในใบขอนี้\nPOST   /api/lumos/dispatch  {jobId, boardCardIds[], irecruitIds[]} → เข้าคิวเฉพาะคนที่ติ๊กเลือก\nDELETE /api/lumos/dispatch?jobId=&channel=&ref=           → ยกเลิกที่ส่งผิด (เฉพาะที่ยังไม่มีผลกลับ)\n\n⚠️ ชื่อ/เบอร์ของ payload สร้างจากฝั่ง server เท่านั้น (ผลแมทที่เก็บไว้ / ฐาน iRecruit)\nclient ส่งมาได้แค่ \"id ของคนที่เลือก\" — กันการยัดเบอร์ปลายทางเข้าคิวโทร",
  "query": [
   "jobId",
   "job_id",
   "pool",
   "channel",
   "ref"
  ],
  "body": [
   "js",
   "jobId",
   "boardCardIds",
   "irecruitIds",
   "priority"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/lumos/dispatch-mode",
  "file": "api/_handlers/lumos-dispatch-mode.ts",
  "methods": [
   "GET",
   "PUT"
  ],
  "doc": "โหมดส่งงานให้ Lumos — GET อ่านได้ทุก role (หน้าตั้งค่าโชว์สถานะ) · PUT เฉพาะ admin\n\nทำไมต้องมี: เดิม auto-send ถูก hardcode 3 จุด เจ้าของสั่งปิดก่อนแต่จะเอากลับมาวันหน้า\nตารางนี้ทำให้เปลี่ยนไป Auto = แก้ค่าเดียว ไม่ต้องแก้โค้ด ไม่ต้อง deploy\nดู src/lib/lumosDispatchMode.ts (ความหมายของค่า) + migrations/069",
  "query": [],
  "body": [
   "js",
   "config"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/lumos/interview/candidates",
  "file": "api/_handlers/lumos-interview.ts",
  "methods": [
   "GET"
  ],
  "doc": "AI Interview — endpoints สำหรับ Lumos\n\nGET  /api/lumos/interview/candidates  →  ส่ง candidate list (สถานะ รอสัมภาษณ์) ให้ Lumos\nPOST /api/lumos/interview/results     →  รับผลลัพธ์การสัมภาษณ์จาก Lumos",
  "query": [
   "limit"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/lumos/interview/results",
  "file": "api/_handlers/lumos-interview.ts",
  "methods": [
   "GET"
  ],
  "doc": "AI Interview — endpoints สำหรับ Lumos\n\nGET  /api/lumos/interview/candidates  →  ส่ง candidate list (สถานะ รอสัมภาษณ์) ให้ Lumos\nPOST /api/lumos/interview/results     →  รับผลลัพธ์การสัมภาษณ์จาก Lumos",
  "query": [
   "limit"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/lumos/positions",
  "file": "api/_handlers/lumos-positions.ts",
  "methods": [
   "GET"
  ],
  "doc": "Lumos AI Recruit — Positions endpoint\n\nGET /api/lumos/positions\n\nตาม spec: [Lumos AI Recruit] Positions API Spec\nLogic เหมือน /api/public/jobs:\n  - ถ้า isSiamrajUnitRequestsEnabled() → ดึงจาก Siamraj (MSSQL / PG schema)\n  - ไม่เช่นนั้น → ดึงจาก jarvis_rm.jobs (PostgreSQL)\n\nResponse เป็น plain array เรียง created_at DESC (newest first)",
  "query": [
   "limit"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/lumos/reminder/contacts",
  "file": "api/_handlers/lumos-reminder.ts",
  "methods": [
   "GET"
  ],
  "doc": "AI Reminder — endpoints สำหรับ Lumos\n\nGET  /api/lumos/reminder/contacts  →  ส่ง contact list ให้ Lumos ไปแจ้งเตือน\nPOST /api/lumos/reminder/results   →  รับผลลัพธ์การแจ้งเตือนจาก Lumos",
  "query": [
   "limit"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/lumos/reminder/results",
  "file": "api/_handlers/lumos-reminder.ts",
  "methods": [
   "GET"
  ],
  "doc": "AI Reminder — endpoints สำหรับ Lumos\n\nGET  /api/lumos/reminder/contacts  →  ส่ง contact list ให้ Lumos ไปแจ้งเตือน\nPOST /api/lumos/reminder/results   →  รับผลลัพธ์การแจ้งเตือนจาก Lumos",
  "query": [
   "limit"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/match-priority-weights",
  "file": "api/_handlers/match-priority-weights.ts",
  "methods": [
   "GET",
   "PUT",
   "PATCH",
   "DELETE"
  ],
  "doc": "น้ำหนักเกณฑ์เรียงผู้สมัครหน้า Matching — ตั้งที่ Settings แล้วใช้ร่วมกันทั้งทีม\nอ่านได้ทุก role (หน้า Matching ต้องใช้) · แก้ได้เฉพาะ admin (rbac 'branding' = admin)\nค่าเริ่มต้นอยู่ในโค้ดฝั่งหน้าเว็บ (src/lib/candidatePriority.ts) — payload ว่าง = ใช้ค่าเริ่มต้น",
  "query": [
   "request_no"
  ],
  "body": [
   "js",
   "weights",
   "hard"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/board",
  "file": "api/_handlers/matching-board.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "═══ /api/matching/board — บอร์ดรายชื่อรอลงงาน (ERP อ่านอย่างเดียว + การกดบน Jarvis) ═══\nGET ?overview=1        → ช่อง · วัน (ตั้งแต่ปี 2568) · ขั้นตอน · ผล · แท็ก · ข้อตรวจ · รายชื่อผู้ดูแล\nGET ?item=<itemId>     → การ์ดของวันนั้น · หรือ ?from=YYYY-MM-DD&to=YYYY-MM-DD · ไม่ส่ง = วันล่าสุด\nGET ?card=<cardId>     → ป๊อปการ์ด (ความคิดเห็น · ข้อตรวจ · กิจกรรม · ประวัติขั้นตอน)\nPOST { cardId, action, ... } → กดปุ่มบนบอร์ด (เจ้าของ 3 พ.ย. 2569 Choice \"ทุกปุ่มบนบอร์ด\") · คืนป๊อปการ์ดชุดใหม่\n🔴 บัญชี ERP ของ Jarvis อ่านอย่างเดียว ⇒ การกดจดที่ erp_board_events ไม่เขียน ERP · ชนกัน = อันที่เปลี่ยนล่าสุดชนะ\nstaff เท่านั้น (ชื่อคนจริง)",
  "query": [
   "card",
   "overview",
   "item",
   "from",
   "to"
  ],
  "body": [
   "js",
   "cardId"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/board-candidates",
  "file": "api/_handlers/matching-board-candidates.ts",
  "methods": [
   "GET"
  ],
  "doc": "แมท \"คนของเรา\" (ผ่านสัมภาษณ์ รอลงงาน จาก board) กับใบขอ — read-only",
  "query": [
   "people",
   "picker",
   "q",
   "buckets",
   "pool",
   "jobId",
   "job_id",
   "refresh"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/call-holds",
  "file": "api/_handlers/matching-call-holds.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "\"รับไปโทรเอง\" — ล็อกสิทธิ์โทรผู้สมัคร (กันเจ้าหน้าที่โทรชนกัน + กัน AI โทรทับ)\n\nPOST   { action: 'lookup', phones: [...] } → { holds: [...] }  ล็อกที่ยังถืออยู่ของเบอร์ชุดนี้ (วาดการ์ด · เบอร์ไม่อยู่ใน URL)\nGET    ?phones=08x,09x        → แบบเดิม — เหลือไว้ให้ role อ่านอย่างเดียว (POST ไม่ได้)\nGET    ?mine=1                → { holds: [...] }  ที่ฉันถืออยู่ (แถบหัวหน้า + หน้า \"โทรของฉัน\")\nPOST   { phone, source, candidateRef, jobId, ... }        → จับล็อก (409 ถ้ามีคนถือ)\nPATCH  { holdId, outcome, scope?, note?, detail? }        → บันทึกผล + ปล่อยล็อก\nDELETE ?holdId=…                                          → คืนงานโดยไม่บันทึกผล\n\nสิทธิ์: rbac 'matching-proposals' (ชุดเดียวกับข้อมูลผู้สมัครรายคนอื่นในหน้า Matching)\nปล่อย/บันทึกผลได้เฉพาะล็อกของตัวเอง — ยกเว้น admin/supervisor ที่แกะของคนอื่นได้ (โอนงาน)",
  "query": [
   "view",
   "mine",
   "team",
   "phones",
   "dumpUserId",
   "reason",
   "holdId"
  ],
  "body": [
   "js",
   "action",
   "phones",
   "source",
   "phone",
   "candidateRef",
   "jobId",
   "candidateName",
   "requestNo",
   "holdId",
   "transferToUserId",
   "transferToName",
   "outcome",
   "scope",
   "appointmentAt",
   "note",
   "detail"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/candidate-job-matches",
  "file": "api/_handlers/matching-candidate-job-matches.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/matching/candidate-job-matches?cards=101,102 — \"คนนี้แมทอยู่กี่งาน งานไหนบ้าง\"\n\nใช้ที่หน้า Matching: ป้าย \"แมทอยู่ N งาน\" บนรายชื่อผู้สมัคร + popup เลือกงาน\nตอนส่งโทรคนที่แมทหลายงาน (เจ้าของสั่ง 12 ส.ค. 2569)\n\nตอบเป็น { items: { [cardId]: [{ jobId, requestNo, position, unit, tier }] } }\n— เฉพาะใบขอที่**เปิดอยู่และอยู่ใน BU scope ของผู้ใช้** (นิยามเดียวกับลิสต์หน้า Matching)",
  "query": [
   "cards"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/candidate-screening",
  "file": "api/_handlers/matching-candidate-screening.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "ผลคัดกรองผู้สมัคร (เหล้า/บุหรี่ + ประวัติคดี) — ให้เกณฑ์เรียงผู้สมัครหน้า Matching ใช้\n\nGET  /api/matching/candidate-screening?source=board&refs=1,2,3  → { items: [...] }\nPOST /api/matching/candidate-screening  { source, candidateRef, drinking?, smoking?,\n                                          criminalRecord?, criminalNote? }\n\nข้อมูลนี้อ่อนไหว (ประวัติคดี) — RBAC ใช้ resource 'matching-proposals' เดียวกับ\nข้อมูลผู้สมัครรายคนอื่น ๆ ของหน้า Matching และบันทึก audit log ทุกครั้งที่มีการเขียน",
  "query": [
   "source",
   "refs"
  ],
  "body": [
   "js",
   "source",
   "candidateRef",
   "candidateName",
   "drinking",
   "smoking",
   "criminalRecord",
   "criminalNote"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/candidate-spec",
  "file": "api/_handlers/matching-candidate-spec.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "ping",
   "jobId",
   "job_id",
   "refresh"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/contact-history",
  "file": "api/_handlers/matching-contact-history.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/matching/contact-history?phone=08xxxxxxxx → { items: [...] }\n\nประวัติการติดต่อผู้สมัคร \"รวมทุกทาง\" (คนโทรเอง + AI โทร) เรียงใหม่→เก่า\nตอบคำถามก่อนยกหู: คนนี้ถูกติดต่ออะไรไปแล้วบ้าง — เมื่อวาน AI เพิ่งโทรแล้ว\nเขาขอเลื่อนหรือเปล่า จะได้ไม่โทรทับจนผู้สมัครรำคาญ\n\nคีย์คือ \"เบอร์ E.164\" เหตุผลเดียวกับล็อกโทร: คนเดียวมีหลาย ref\n(card_id / iRecruit id / follow-*) แต่เบอร์ที่ดังมีเบอร์เดียว\n\n⚠️ ไม่ส่งเบอร์กลับไปในผลลัพธ์ — หน้าเว็บมีเบอร์อยู่แล้ว (มันเป็นคนส่งมาถาม)\nและแถวประวัติของใบขอแผนกอื่นต้องไม่พาเบอร์/ข้อความภายในรั่วออกไป",
  "query": [
   "phone"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/flow-summary",
  "file": "api/_handlers/matching-flow-summary.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/matching/flow-summary — สรุป \"การไหลของงาน\" สำหรับหน้าแรก (read-only)\n\nตอบ 3 คำถาม: งานเข้ามาเท่าไหร่ · ส่งไปไหนเท่าไหร่ · อะไรสำเร็จ/อะไรต้องติดตาม\nช่วงเวลา: ตัวเลขการเคลื่อนไหว = เดือนนี้ · ของค้าง (รอโทร/รอจอง/ใบด่วนไม่มีคน) = ทั้งหมด\n\n⚠️ ตัวเลขที่นี่เป็นสถานะ \"การทำงานของทีม Matching\" เท่านั้น — ไม่ใช่ \"หาได้แล้ว/ปิดครบใบขอ\"\nทางการจาก ERP (นิยาม Control Tower ห้ามปนกัน)",
  "query": [
   "bu"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/irecruit-candidates",
  "file": "api/_handlers/matching-irecruit-candidates.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "jobId",
   "job_id",
   "refresh",
   "owner",
   "send"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/job-postings",
  "file": "api/_handlers/matching-job-postings.ts",
  "methods": [
   "GET",
   "POST",
   "PUT",
   "PATCH"
  ],
  "doc": "โค้ดลิงก์ในแคปชั่นต้องเป็นลิงก์ของประกาศที่เปิดอยู่ของใบนี้จริง (ทุกโพสต์ต้องมีลิงก์สมัครที่เปิดได้ · 20 ต.ค. 2569)",
  "query": [
   "jobId",
   "job_id",
   "groups",
   "autopost",
   "options",
   "request_no",
   "run_message",
   "so_status",
   "type",
   "board",
   "status",
   "action",
   "id"
  ],
  "body": [
   "js",
   "job_id",
   "jobId",
   "job_snapshot",
   "jobSnapshot",
   "request_type",
   "requestType",
   "request_no",
   "requestNo",
   "reason",
   "status",
   "notes"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/list",
  "file": "api/_handlers/matching-list.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/matching/list — server-side pagination ของลิสต์ใบขอหน้า Matching\nparams: page, pageSize, q, unit, urgent=1, workflow=all|sla|green|yellow|none|reserved\nคืน { items, total, page, pageSize, unitOptions, summary, storedMatches }",
  "query": [
   "buFilter",
   "q",
   "urgent",
   "unit",
   "workflow",
   "bu",
   "sort",
   "page",
   "pageSize"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/parse-branch-demand",
  "file": "api/_handlers/matching-parse-branch-demand.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "text"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/parse-branch-demand-job",
  "file": "api/_handlers/matching-parse-branch-demand-job.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "jobId",
   "job_id",
   "text",
   "matches",
   "poolSize"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/proposals",
  "file": "api/_handlers/matching-proposals.ts",
  "methods": [
   "GET",
   "POST",
   "PUT",
   "PATCH"
  ],
  "doc": "เก็บเฉพาะ proposal ที่ request_no อยู่ในแผนกที่ผู้ใช้เห็นได้ (null = เห็นทุกแผนก)",
  "query": [
   "active",
   "jobIds",
   "jobId",
   "job_id",
   "id"
  ],
  "body": [
   "js",
   "job_id",
   "jobId",
   "candidate_ref",
   "candidateRef",
   "source",
   "status",
   "request_no",
   "requestNo",
   "candidate_name",
   "candidateName",
   "candidate_phone",
   "candidatePhone",
   "candidate_position",
   "candidatePosition",
   "branch_id",
   "branchId",
   "branch_name",
   "branchName",
   "tier",
   "reason",
   "proposed_by_name",
   "operator_name"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/recruit-lane",
  "file": "api/_handlers/matching-recruit-lane.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "เลนสรรหา — \"หาคนเพิ่ม + ส่ง AI โทร\" ข้าม 3 แหล่ง (R2b · เจ้าของเคาะ 16 ส.ค. 2569)\n\nGET /api/matching/recruit-lane?jobId=...&send=1\n  - ค้นคนที่ **ยังไม่สมัคร** จาก iRecruit + ฐานใหม่ So Recruit + ถัง Checklist\n  - `send=1` → ส่งเขียว+เหลืองเข้าคิว Lumos ทันที ไม่ต้องอนุมัติ (นิยามเลนสรรหา)\n  - ไม่ใส่ `send` = ค้นดูเฉย ๆ (ไม่แตะคิว)\n\n⚠️ แยก resource จาก `matching-irecruit-candidates` ตั้งใจ — เตรียมไว้ให้ A4\nแยกสิทธิ์ทีมสรรหา/คัดสรรได้โดยไม่ต้องรื้อ route",
  "query": [
   "send",
   "jobId",
   "job_id",
   "owner",
   "refresh"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/selection-recall",
  "file": "api/_handlers/matching-selection-recall.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "เลนคัดสรร — เส้น \"ชวนกลับ\" ที่วิ่งขนานกับใบสมัครใหม่ (เจ้าของสั่ง 16 ส.ค. 2569)\n\nGET /api/matching/selection-recall?jobId=...&send=1\n  - ค้นจาก **กองคนที่เคยตอบไม่สนใจงานอื่น** (สมัครกับเราแล้ว ไม่ต้องเก็บใบใหม่)\n  - `send=1` → ส่งเขียว+เหลืองเข้าคิว Lumos ทันที (\"อันที่ AI หามาก็โทรไปเลย\")\n\n⚠️ คนละเส้นกับ `/api/matching/recruit-lane` (เลนสรรหา = คนยังไม่สมัคร) โดยตั้งใจ —\nกองคนละกอง สิทธิ์แยกกันได้ และเลิกเส้นไหนก็ไม่กระทบอีกเส้น",
  "query": [
   "send",
   "jobId",
   "job_id",
   "refresh",
   "refs"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/matching/suggestions",
  "file": "api/_handlers/matching-suggestions.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "jobId",
   "job_id",
   "owner",
   "limit",
   "poolSize",
   "pool_size"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/matching/worker-status",
  "file": "api/_handlers/matching-worker-status.ts",
  "methods": [
   "GET"
  ],
  "doc": "สถานะ worker ที่คิดผลแมทล่วงหน้า — หน้า Matching ใช้โชว์ \"AI กำลังประมวลผล n ใบ\"\n\nครอบ withAuth เพราะเป็น endpoint เดียวของ /api/matching/* ที่เคยเปิดโล่ง\n(เจอตอน audit ก่อนขึ้น production — ตัวอื่นครอบ withRbac หมด)\nข้อมูลเป็นแค่ตัวนับ ไม่มีข้อมูลคน จึงไม่ต้องผูก rbac key เฉพาะ — ล็อกอินก็พอ",
  "query": [],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/notifications",
  "file": "api/_handlers/notifications.ts",
  "methods": [
   "GET",
   "PATCH"
  ],
  "doc": "GET   /api/notifications          → { items, unread } กล่องขาเข้าของฉัน\nPATCH /api/notifications { ids? } → ทำเครื่องหมายอ่านแล้ว (ไม่ส่ง ids = อ่านหมด)\n\nทุก role อ่านได้ — เห็นเฉพาะของตัวเอง (คีย์จาก token ไม่รับ userId จากภายนอก)",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/office-floor",
  "file": "api/_handlers/office-floor.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/office-floor — เลขดิบของฉาก \"ห้องทำงาน\" บนหน้าแรก (read-only)\n\nเจ้าของสั่ง 22 ส.ค. 2569: *\"อยากให้หน้าหลักมีตัวละครแทนแต่ละแผนก มีโต๊ะทำงาน\nบอกว่าแต่ละคนตอนนี้กำลังทำอะไร\"* — เส้นนี้ตอบว่า **แต่ละโต๊ะมีของอยู่ในมือเท่าไหร่**\nส่วนการแปลเป็นสถานะ/ประโยคอยู่ที่ `src/lib/officeFloor.ts` (pure · มีเทสต์)\n\n🔴 กติกาของเส้นนี้:\n1. **ไม่แตะ ERP (MSSQL)** — หน้าแรกต้องเบา · เลขฝั่งใบขอ (เปิดกี่ใบ · AI คิดแล้วกี่ใบ)\n   หน้าแรกได้จาก `/api/matching/flow-summary` อยู่แล้ว แล้วประกอบกันที่ฝั่งหน้าเว็บ\n2. **ใช้นิยามเดิมที่เดียว** — ถังของใบสมัครดึงจาก `OVERVIEW_BUCKETS`\n   (ไฟล์เดียวกับที่ศูนย์คุมงานสรรหาใช้) ห้ามเขียนเงื่อนไข \"โทรแล้ว/ยังไม่โทร\" ใหม่\n   ไม่งั้นหน้าแรกกับหน้าบอร์ดจะตอบไม่เท่ากันแบบเงียบ ๆ\n3. **ไม่มีข้อมูลบุคคล** — คืนแต่ตัวนับ จึงครอบ `withAuth` (ล็อกอินพอ) เหมือน\n   `/api/matching/worker-status` ไม่ต้องผูก rbac key เฉพาะ\n4. **cache สั้น** — หน้าแรกเปิดพร้อมกันหลายคน คิวรีถังใบสมัครมี EXISTS หลายชั้น",
  "query": [
   "bu"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/office-team",
  "file": "api/_handlers/office-team.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/office-team — เมตริกบอร์ด 4 ทีมบนหน้าแรก (read-only)\n\n🔴 **สเปกเมตริกมาจากเจ้าของโดยตรง** (พิมพ์เองทีมต่อทีม 26 ส.ค. 2569 และยืนยันว่า\n\"โอเคกะแบบนั้น\") — ดูตารางเมตริก→แหล่งข้อมูลใน\n`~/.claude/plans/home-team-board-redesign.md` H2 · ตัววาด `TeamBoardPanel.tsx`\n\nหลักที่เจ้าของสั่ง: **Error ไม่เงียบ** — ทีมไหนวัดไม่ได้ต้องไปโผล่ใน `teams.errors`\nให้จอวาด \"วัดไม่ได้ — เหตุผล\" ห้ามโชว์ 0 ปลอม ห้ามซ่อนทั้งคอลัมน์\n\nแหล่งข้อมูล (pg ทั้งหมด ยกเว้นลิสต์ใบเปิด):\n- ใบเปิด: `listSiamrajUnitRequests` **ท่อเดียวกับ flow-summary/หน้า Matching**\n  (นิยาม \"เปิดอยู่\" ห้ามมีที่สอง) · จำกัดตาม departmentScope เหมือนเส้นอื่น\n- ประกาศสาธารณะ: `job_public_releases`\n  (ตัวเลขคำขอโพส `job_posting_requests` ถูกถอด 27 ก.ย. 2569 — เจ้าของเลือก \"เอาแค่ปุ่ม\" ในจับคู่งาน)\n- ผู้สมัคร: `public_job_applications` + `application_contact_logs` +\n  `application_appointment_results` (089)\n- คิวโทร: `lumos_dispatch_queue` แยก 3 เลนตาม person_ref (นิยาม = `queueLane` ใน lib\n  🔴 แก้ SQL ต้องแก้ lib ให้ตรงกัน — มีเทสต์คุมฝั่ง lib)\n- ส่งให้ Lumos ทั้งระบบ (หัวคอลัมน์ Lumos · 28 ก.ย. 2569): คิวเดียวกัน นับรายวัน × BU × เส้นทาง × สถานะ\n\ncache 30 วิ ต่อ scope (แพตเทิร์นเดียวกับ office-floor)\n⚠️ id ที่ใช้ join ฝั่ง pg คือ `item.id` (รูป `siamraj-sql:XXX`) ไม่ใช่ request_no —\nวัดจริง: `public_job_applications.job_id` = 'siamraj-sql:LMM6704005'",
  "query": [
   "bu"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/pdpa-requests",
  "file": "api/_handlers/pdpa-requests.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "═══ /api/pdpa-requests — คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล ฝั่งเจ้าหน้าที่ (เจ้าของเลือกทำ 18 ต.ค. 2569) ═══\n\nGET              → รายการคำขอ + จำนวนข้อมูลที่เจอในระบบต่อเบอร์\nGET ?id=&data=1  → ข้อมูลทั้งหมดของเบอร์นี้ (คำขอต้องยืนยันตัวตนแล้วเท่านั้น)\nPOST             → เจ้าหน้าที่ลงคำขอแทน `{ kind, fullName, phone, detail }` (ขอลบ/คัดค้าน = หยุดโทรทันที)\nPATCH            → `{ id, action: 'verify' | 'close' | 'reject' | 'erase', note }`\n                   verify คำขอลบ/คัดค้านที่ยื่นเอง = หยุดโทรตอนนี้ (หน้าสาธารณะไม่หยุดทันที · 10 พ.ย. 2569)\nสิทธิ์: admin (หน้าตั้งค่า) — ลบข้อมูลย้อนไม่ได้",
  "query": [
   "id"
  ],
  "body": [
   "js",
   "id",
   "action",
   "note"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/public-click-stats",
  "file": "api/_handlers/public-click-stats.ts",
  "methods": [
   "GET"
  ],
  "doc": "`GET /api/public-click-stats?days=30` — ยอดคลิกบนหน้าสาธารณะรายใบขอ (เจ้าหน้าที่)\n\nตอบคำถาม *\"ประกาศไหนมีคนสนใจจริง\"* — คู่กับยอดคลิกลิงก์ช่องทางที่มีอยู่แล้ว\n🔴 ยอดรวมล้วน ไม่มีข้อมูลว่าใครกด (ดู `_lib/publicClicks.ts`)",
  "query": [
   "days"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/public/apply",
  "file": "api/_handlers/public/apply.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "คอลัมน์ที่ยังไม่ถูก migrate — pg ตอบ 42703",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/public/apply-link",
  "file": "api/_handlers/public/apply-link.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/public/apply-link?code=xxxx — เปิดลิงก์สมัครโดยไม่ต้องล็อกอิน\n\nคืนเฉพาะข้อมูลที่ผู้สมัครควรเห็น — ไม่ส่ง BU / ผู้สร้าง / ยอดใบสมัคร ออกไปหน้าสาธารณะ\n`job` = ใบงานรูปเดียวกับการ์ดหน้า /apply (`getLinkedPublicJob`) · null = ใช้การ์ดประกาศ",
  "query": [
   "code"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/public/channels",
  "file": "api/_handlers/public/channels.ts",
  "methods": [
   "GET"
  ],
  "doc": "═══ GET /api/public/channels — ช่องทางหลักให้หน้าสมัครเลือก (เจ้าของ 28 ต.ค. 2569) ═══\n> *\"มันต้องยึดตามช่องทางหลัก\"* → *\"https://jarvis.siamrajathanee.dev/recruit/channels ยึดตามนี้\"* ·\n> Choice \"ใช้รายการเดียวกัน\" (ช่อง \"เห็นประกาศจากช่องทางไหน\" เดิมล็อก 5 ค่า Facebook/TikTok/Instagram/ใบปลิว/อื่นๆ)\nไม่ต้องล็อกอิน · คืนเฉพาะ `{ id, name, children: [{ id, name }] }` ของช่องทางที่เปิดใช้ (ตัวเดียวกับ ChannelPicker / หน้าจัดช่องทาง)\nหลัก → รอง (เจ้าของ 28 ต.ค. 2569 จัดเหลือ 4 หลัก Facebook · Tiktok · Webjob · Offline)",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/public/click",
  "file": "api/_handlers/public/click.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "`POST /api/public/click` — นับคลิกบนหน้าสาธารณะ (ไม่ต้องล็อกอิน)\n\nเจ้าของถาม 3 ก.ย. 2569: *\"แท็กจำนวนคลิกได้ไหม ในหน้าสาธารณะ\"*\n\n🔴 **นับยอดรายวันเท่านั้น ไม่เก็บว่าใครกด** — ไม่มี IP / user-agent / คุกกี้\n🔴 **คืน 204 เสมอแม้เขียนไม่สำเร็จ** — การนับคลิกห้ามทำให้หน้าสมัครงานสะดุด\n   (หน้านี้คือหน้าที่คนจริงกำลังจะสมัครงาน · ตัวนับพังก็แค่เลขหาย ไม่ใช่คนสมัครไม่ได้)",
  "query": [],
  "body": [
   "js",
   "action",
   "job_ref",
   "posting_id",
   "link_code",
   "embedded"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/public/jobs",
  "file": "api/_handlers/public/jobs.ts",
  "methods": [
   "GET"
  ],
  "doc": "คุณสมบัติที่ทีมตั้งเอง (6 ต.ค. 2569) — แนบโดย `attachNotes`",
  "query": [
   "id",
   "limit",
   "bu"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/public/privacy-request",
  "file": "api/_handlers/public/privacy-request.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "POST /api/public/privacy-request — ผู้สมัครยื่นคำขอใช้สิทธิ์ข้อมูลส่วนบุคคลเอง (ไม่ต้องล็อกอิน · 18 ต.ค. 2569)\nลิงก์อยู่ในข้อตกลง PDPA บนหน้าสมัคร · ขอลบ/ขอให้หยุดติดต่อ = หยุดโทรทันที · เจ้าหน้าที่โทรกลับยืนยันตัวตนก่อนทำต่อ\n🔴 ตอบเหมือนกันทุกกรณีที่บันทึกได้ — ไม่บอกว่าเบอร์นี้มีข้อมูลในระบบหรือไม่ (กันคนนอกใช้ส่องว่าใครเคยสมัคร)",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/public/skill-quiz",
  "file": "api/_handlers/public/skill-quiz.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "/api/public/skill-quiz — พนักงานทำแบบทดสอบจากลิงก์ (ไม่ต้องล็อกอิน · เจ้าของ 12 พ.ย. 2569)\nGET ?token=   → ชื่อชุด/ชื่อพนักงาน/ข้อสอบที่ตัดเฉลยแล้ว · ส่งแล้ว = บอกว่าส่งแล้ว ไม่ส่งข้อสอบ\nPOST { token, answers } → ส่งได้ครั้งเดียว · ส่งแล้ว AI ร่างผลต่อเบื้องหลัง\n🔴 ไม่ส่งคะแนนกลับให้พนักงาน — ผลผ่านเจ้าหน้าที่ตรวจก่อนถึงลูกค้า",
  "query": [
   "token"
  ],
  "body": [
   "js",
   "token",
   "answers"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit-overview",
  "file": "api/_handlers/recruit-overview.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/recruit-overview?month=YYYY-MM | ?from=YYYY-MM-DD&to=YYYY-MM-DD (รายวัน/ช่วง · 5 ต.ค. 2569) — หน้า \"ภาพรวมงานสรรหา\" แบบ iRecruit (แท็บภาพรวมของกล่องงาน · 30 ก.ย. 2569)\n\nเจ้าของ: *\"ทำหน้าภาพรวมให้เหมือน iRecruit ต่อเลย\"* → Choice \"ทั้งหน้าเป็น iRecruit\" · \"เลือกเดือนแบบ iRecruit\" ·\nนับโทร/ติดต่อสำเร็จแบบ \"AI + คน\" แล้ว *\"บอกว่า มีกี่ใบที่ประกาศไป แล้วมีรายชื่อมาเท่าไหร่ Ai โทรไปให้ทั้งหมดเท่าไหร่\nเหลือสนใจแล้วคนมาโทรอีกเท่าไหร่ … ต้องบอกด้วยว่า กรอกมาวันนี้โดนโทรวันไหน จะนับเป็นวันต้องครบ 24 ชม\"*\n\n🔴 กติกาของเส้นนี้:\n1. **อ่านอย่างเดียว** · ไม่มีนิยามใหม่ — ทุกช่องต่อใบมาจาก `applicantOverviewSql.ts` (ตัวเดียวกับกล่องงาน/หน้าหลัก)\n2. ประชากร = ใบสมัครที่ไม่ใช่ Lead ตามวันกรอก + BU กลาง `appBuSql` (ชุดเดียวกับหน้าหลัก \"ระบบไปกี่ %\")\n   ผู้ใช้ผูกแผนก = BU ของตัวเองเสมอ (`loadMatchingBuScope`)\n3. **ไม่คืนชื่อ/เบอร์ผู้สมัคร** — ต่อใบมีแต่ข้อเท็จจริง · ชื่อเจ้าหน้าที่มีแค่ยอดรวมรายคน (อนุญาตบน Dashboard 15 ส.ค. 2569)\n4. ก้อนล้มแยกกัน — อ่านไม่ได้ = null + เหตุใน `errors` (ห้ามโชว์ 0 แทน)\n5. \"ใบที่ประกาศ\" ไม่ได้คิดที่เส้นนี้ — หน้าเว็บใช้เลขของหัวกล่องงานตรง ๆ (เจ้าของสั่ง 1 ต.ค. 2569:\n   *\"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน\"*) · เดิมนับใบที่ประกาศในเดือนจาก `job_public_releases` — ถอดแล้ว",
  "query": [
   "names",
   "month",
   "from",
   "to",
   "all",
   "bu"
  ],
  "body": [
   "linkClicks",
   "errors",
   "apps",
   "appJobs",
   "backlog",
   "backlogByJob",
   "staff",
   "staffByJob",
   "ai",
   "aiByJob",
   "channelPlacement",
   "requests",
   "requestsPrev",
   "requestDays",
   "requestList",
   "requestRows",
   "requestRowsPrev",
   "firstDay",
   "attendanceEverRecorded"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit-registrations",
  "file": "api/_handlers/recruit-registrations.ts",
  "methods": [
   "GET"
  ],
  "doc": "",
  "query": [
   "meta",
   "limit",
   "owner"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit-rm-overview",
  "file": "api/_handlers/recruit-rm-overview.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/recruit-rm-overview — ตัวเลข Dashboard \"ศูนย์คุมงานสรรหา\" (เจ้าของสั่ง 15 ส.ค. 2569)\n\nนับฝั่ง SQL ทั้งหมด (เลิกนับ client จาก limit 500) · scope เดียวกับลิสต์ใบสมัคร\n(job∈ใบขอที่เห็นได้ หรือ department_code ตรงแผนก — เลขต้องกดแล้วเจอแถวเท่ากัน)\n· นิยามทุกถังอยู่ที่ api/_lib/applicantOverviewSql.ts **ที่เดียว** (drill-down ใช้ร่วม)\n· อ่านไม่ได้ = null + ธง unavailable — **ไม่ใช่ 0** (0 ที่แปลว่าเช็คไม่ได้อันตรายกว่า)",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit-stuck",
  "file": "api/_handlers/recruit-stuck.ts",
  "methods": [
   "GET"
  ],
  "doc": "═══ GET /api/recruit-stuck — ใบขอที่เหลือหา ติดตรงไหน + เทียบเดือน (หน้าภาพรวมงานสรรหาโฉมใหม่ · เจ้าของ 4 พ.ย. 2569) ═══\n\n> *\"ใบขอมา มาแล้วไปประกาศแล้ว แต่ปิดไม่ได้เพราะไม่มีคนนะ หรือ มีคนแต่คนไม่โทรนะ หรือ ปิดไม่ได้เพราะไม่ได้โพสต์ด้วยซ้ำ\n> แล้วต้องบอกเลยว่า อ้อใบนี้ของใครรับผิดชอบบ้าง ช้าที่ใครเท่าไหร่\"*\n\nอ่านอย่างเดียว · ส่งข้อเท็จจริงต่อใบ (`StuckRequest`) ตัวตัดสินเหตุอยู่ที่เดียว `src/lib/recruitStuck.ts`\n- ใบขอ = ใบที่ยังเปิดชุดเดียวกับเมนูใบขอ (`readUnitRequestListThroughCache` · ขอบเขตแผนก + BU เดียวกับภาพรวม)\n- คน = `loadFactsForJobs` ทุกช่วงเวลาของใบ (นิยามเดียวกับภาพรวม/เส้น 12 ขั้น) · ประกาศ = `job_public_releases` · ลิงก์ = `recruit_posting_links`\n- โพสต์ = คำสั่ง Autopost ล่าสุดของใบ (`listLatestJobPostingsForBoard`)\n- เทียบเดือน = ต่อ (เดือน, ใบขอ) ย้อน 6 เดือน ให้หน้าเว็บรวมเฉพาะใบที่ผ่านตัวกรอง (รวมทุกใบ = ยอดเดิม)\nก้อนไหนอ่านไม่ได้ = null + เหตุ (ห้ามส่ง 0 แทน)",
  "query": [
   "bu",
   "from",
   "to",
   "part"
  ],
  "body": [
   "today",
   "requests",
   "errors",
   "monthly"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/recruit/channels",
  "file": "api/_handlers/recruit-channels.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "ช่องทางรับสมัคร (master 2 ระดับ: หลัก → รอง)\nGET   — ทุก role ที่ล็อกอิน (ฟอร์มสร้างลิงก์ต้องใช้)\nPOST/PATCH/DELETE — หัวหน้างานขึ้นไป (บังคับที่ rbac)",
  "query": [
   "all",
   "limit",
   "q",
   "offset",
   "view",
   "parent",
   "childQ",
   "roots",
   "id"
  ],
  "body": [
   "js",
   "parentId",
   "name",
   "sortOrder",
   "id",
   "isActive"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit/funnel",
  "file": "api/_handlers/recruit-funnel.ts",
  "methods": [
   "GET"
  ],
  "doc": "แผงสรุปงานสรรหา (RM) — **อ่านจากฐานเราเท่านั้น** (`public_job_applications`)\n\nเจ้าของสั่ง 12 ส.ค. 2569: \"ไม่ได้ให้เอา database จาก iRecruit มา ฉันจะเริ่มเก็บ\nรายชื่อใหม่เลย\" — เดิมแผงนี้อ่าน `recruit_register` ฝั่ง iRecruit (154,871 ราย)\nซึ่งทำให้ดูเหมือนฐานเรามีข้อมูลเป็นแสนทั้งที่ยังไม่เริ่มเก็บ\n(ตัวอ่าน iRecruit เดิมยังอยู่ที่ `api/_lib/recruitFunnelSql.ts` เผื่อใช้ตรวจตอน\nยกข้อมูลจริงในอนาคต — แค่ไม่มีเส้นไหนเรียกแล้ว)\n\nการแมปตัวเลข — ใช้เฉพาะของที่ฐานเรามีจริง ไม่เดาแทน:\n  เข้ามา (registered)   = ใบสมัครทั้งหมด\n  โทรแล้ว (called)      = ใบที่พ้นสถานะ new (มีเจ้าหน้าที่จัดการแล้ว)\n  ติดต่อสำเร็จ          = contacted + converted\n  ไม่สำเร็จ-อื่น ๆ       = rejected\n  ไม่รับสาย/ติดต่อไม่ได้/นัดหมาย/ติดตามนัด = **0 ไปก่อน** — ฝั่งเรายังไม่มีตาราง\n  บันทึกผลติดต่อ/นัดหมายรายครั้ง (งานถัดไปของ RM) พอมีแล้วค่อยต่อเข้าช่องพวกนี้\n  leads = 0 — ระบบ Lead ฝั่งเรายังไม่เกิด (migration 079)\n\n`?from=` / `?to=` เป็น ISO date (to = ขอบบนแบบไม่รวม) — พฤติกรรมเดิม",
  "query": [
   "from",
   "to"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit/job-titles",
  "file": "api/_handlers/recruit-job-titles.ts",
  "methods": [
   "GET"
  ],
  "doc": "master \"ตำแหน่งงาน\" ของงานสรรหา (RM) — `GET /api/recruit/job-titles`\n\n`?all=1` = เอาที่ปิดใช้งานแล้วมาด้วย (รายงานย้อนหลังต้องหาชื่อเจอ)\n`?department=LBD` = เฉพาะ BU นั้น + ตำแหน่งที่ไม่ระบุ BU\n\n⚠️ **อ่านอย่างเดียว** — ไม่มีหน้าจอจัดการ master นี้ (เจ้าของสั่งเอาปุ่ม \"ตำแหน่งงาน\"\nออก 11 ส.ค. 2569) · ยกข้อมูลด้วย `scripts/import-recruit-job-titles.mts`",
  "query": [
   "all",
   "department"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit/posting-kinds",
  "file": "api/_handlers/recruit-posting-kinds.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "ประเภทกล่องลอย (เจ้าของสั่ง 14 ต.ค. 2569 \"ทำหน้าจัดการประเภทกล่องในตั้งค่าบอร์ด\")\nGET ?all=1 รวมที่ปิดแล้ว · POST เพิ่ม {label} · PATCH {code, label?, isActive?} — สิทธิ์ชุดเดียวกับ \"เหตุผล\" (staff ขึ้นไป)\nไม่มี DELETE — ปิดใช้งานแทน (ประกาศเก่าอ้างรหัสอยู่)",
  "query": [
   "all"
  ],
  "body": [
   "js",
   "label",
   "code",
   "isActive"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit/postings",
  "file": "api/_handlers/recruit-postings.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "ประกาศรับสมัคร + ลิงก์ต่อช่องทาง\n\nBU scope มี 2 ทาง เพราะประกาศมี 2 ชนิด:\n - ผูกใบขอ  → เช็คสิทธิ์ที่ใบขอ (isSiamrajRequestInScope) เหมือนเส้นอื่นทั้งระบบ\n - ประกาศลอย → ไม่มีใบขอให้เช็ค จึงใช้ department_code ของตัวประกาศเอง\n   (ตอนสร้างบังคับให้เลือก BU ที่ validatePostingInput)",
  "query": [
   "group_stats",
   "id",
   "jobId",
   "standalone"
  ],
  "body": [
   "js",
   "postingId",
   "channelId",
   "channelLabel",
   "note",
   "fbGroupId",
   "jobId",
   "departmentCode",
   "standaloneKind",
   "title",
   "detail",
   "locationText",
   "salaryText",
   "contactName",
   "contactPhone",
   "positionName",
   "province",
   "responsibleName",
   "responsibleUserId",
   "specificType",
   "formType",
   "channels",
   "id",
   "status"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/recruit/reasons",
  "file": "api/_handlers/recruit-reasons.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "master \"เหตุผล\" ของงานสรรหา (RM) — ปุ่ม \"เหตุผล\"\nGET    — ทุก role ที่ล็อกอิน (ตอนบันทึกผลติดต่อต้องเลือกเหตุผล)\nPOST/PATCH/DELETE — หัวหน้างานขึ้นไป (บังคับที่ rbac)\n\n⚠️ DELETE = **ปิดการใช้งาน ไม่ลบทิ้ง** — เหตุผลถูกอ้างจากผลติดต่อย้อนหลัง",
  "query": [
   "all",
   "process",
   "outcome",
   "id"
  ],
  "body": [
   "js",
   "processCode",
   "outcomeCode",
   "name",
   "sortOrder",
   "id",
   "isActive"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/request-control/demand-forecast",
  "file": "api/_handlers/request-control-forecast.ts",
  "methods": [
   "GET"
  ],
  "doc": "ประเภทใบขอสำหรับพยากรณ์ demand — ชุดเดียวกับ lifecycleKind ของ throughput feed",
  "query": [],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/request-pipeline",
  "file": "api/_handlers/request-pipeline.ts",
  "methods": [
   "GET"
  ],
  "doc": "═══ GET /api/request-pipeline — ข้อมูลดิบของเส้นใบขอ 12 ขั้น (หน้าหลัก แท็บใบขอ · เจ้าของ 22 ต.ค. 2569) ═══\n\nเจ้าของ: *\"ทุกใบต้องบอกได้ว่า ใบขอ ก ผ่านมาแล้วกี่วัน มีคนสนใจใบนี้กี่คน ติดตรงไหนปิดไม่ได้ … เคยส่งคนแทนไหม\nถ้าเคยส่งมาแล้วกี่วัน เพื่อเอาวันที่ผ่านมาเนี่ยมาดูว่ามีค่าปรับเท่าไหร่\"* + ช่องทาง Facebook/TikTok/ออฟไลน์ กดลึกได้\n\nอ่านอย่างเดียว · ส่งข้อเท็จจริง หน้าเว็บนับเอง (`src/lib/requestPipeline.ts`) ให้ \"ผ่านมา\" เป็นตัวเดียวกับเมนูใบขอ\n- ใบขอ = รายการใบเปิดชุดเดียวกับเมนูใบขอ (`readUnitRequestListThroughCache` limit 500 · ขอบเขตแผนกของผู้ใช้)\n- ผู้สมัคร = `loadFactsForJobs` (นิยามเดียวกับภาพรวมงานสรรหา)\n- ส่งคนแทน = สายของหน้าติดตามส่งคนแทน · วันเข้างาน `replaceWorkYmd` · หนึ่งคนต่อวันต่อไซต์ · ไม่นับที่ยกเลิก\n- ติดตามคนเริ่มงาน / ดูแลหลังเริ่มงาน = ชุดติดตาม (group) ที่ผูกรหัสไซต์ · วันเริ่ม = สายแรกของชุด\nก้อนไหนล้ม = null + เหตุ (ก้อนอื่นยังขึ้น)",
  "query": [
   "bu"
  ],
  "body": [
   "facts",
   "releasedJobIds",
   "replacementBySite",
   "replacementSince",
   "followStartsBySite",
   "aftercareBySite",
   "channels"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/role-permissions",
  "file": "api/_handlers/role-permissions.ts",
  "methods": [
   "GET",
   "PATCH"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "role",
   "functionId",
   "enabled"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/selection-progress",
  "file": "api/_handlers/selection-progress.ts",
  "methods": [
   "GET",
   "PATCH"
  ],
  "doc": "`GET/PATCH /api/selection-progress` — ขั้นในกระบวนการจ้างของ **คนที่ยังไม่มีใบสมัคร**\n\n🔴 เจ้าของเคาะ 22 ส.ค. 2569: *\"สถานะผู้สมัคร รวมเป็นชุดเดียว — **คนจาก match ใช้ด้วย**\"*\nเส้น `PATCH /api/job-applications {id, selection_status}` ใช้ได้เฉพาะคนที่มีใบสมัคร\n(คีย์ด้วย id ใบ) · คนที่ AI จับคู่มาจากบอร์ด/iRecruit ไม่มีแถวนั้น → ต้องมีเส้นนี้\n\n⚠️ คีย์คือ **(jobId, phone)** — เบอร์เป็นคีย์คน (บทเรียนล็อกโทร 068: คนเดียวมีหลายรหัส\nแต่เบอร์มีเบอร์เดียว) · ตัวกลางเดียวที่เขียนคือ `selectionProgressStore.saveProgress`\nซึ่ง dual-write ตารางกลาง 105 + คอลัมน์เดิม 094 (ถ้ารู้ใบสมัคร)\n\n⚠️ **BU scope**: ต้องเห็นใบขอนั้นก่อนถึงจะตั้งขั้นให้ใครในใบขอนั้นได้\n(ด่านเดียวกับเส้นอื่นที่แตะใบขอ ERP — `loadScopedJobIdSet`)",
  "query": [
   "jobId",
   "phones"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/short-links",
  "file": "api/_handlers/short-links.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "Only allow shortening in-app public paths (prevents open-redirect abuse).",
  "query": [],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/short-links/resolve",
  "file": "api/_handlers/short-links-resolve.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/short-links/resolve?code=CODE → { targetPath } (public, used by /s/:code)",
  "query": [
   "code"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/siamraj/opl-import",
  "file": "api/_handlers/siamraj-opl-import.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "",
  "query": [],
  "body": [
   "js",
   "file_base64",
   "dry_run"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/siamraj/unit-assignments",
  "file": "api/_handlers/siamraj-unit-assignments.ts",
  "methods": [
   "GET",
   "POST",
   "PUT"
  ],
  "doc": "`?all=1` — ผู้รับผิดชอบทุกใบ (read-only) สำหรับ Dashboard กรองตามเจ้าหน้าที่\nไม่ผูก scope รายใบเพราะข้อมูลคือ \"ใบเลขนี้ใครดูแล\" เท่านั้น ไม่มีข้อมูลบุคคล\nและหน้า Dashboard ถูกล็อก BU ของผู้ใช้อยู่แล้วอีกชั้น",
  "query": [
   "all",
   "request_no"
  ],
  "body": [
   "js",
   "request_no",
   "recruiter_name",
   "screener_name",
   "opl_name",
   "online_name"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/siamraj/unit-history",
  "file": "api/_handlers/siamraj-unit-history.ts",
  "methods": [
   "GET"
  ],
  "doc": "ประวัติการแก้ไขของใบขอ — \"ใครแก้อะไรไป\" (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)\n\nGET /api/siamraj/unit-history?request_no=<เลขที่ใบ> → รายการแก้ไขล่าสุด (ใหม่→เก่า)\n\nอ่านจาก `audit_logs` ที่ handler ฝั่งเขียนบันทึกไว้อยู่แล้วทุกครั้ง (ผู้รับผิดชอบ /\nสถานะทำงาน / หมายเหตุ+ตัวเลือกใบขอ) — **ไม่เพิ่มการเขียนใหม่** แค่เปิดทางอ่านแบบ scoped\n\n⚠️ ทำไมไม่ใช้ `/api/audit-logs`: เส้นนั้นเป็น admin-only และเปิดดูได้ทุก entity\nส่วนเส้นนี้ staff ดูได้ แต่**จำกัดทีละใบ + ผ่านด่าน BU เดียวกับใบขอ** (คนละระดับสิทธิ์)",
  "query": [
   "request_no"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/siamraj/unit-notes",
  "file": "api/_handlers/siamraj-unit-notes.ts",
  "methods": [
   "GET",
   "POST",
   "PUT"
  ],
  "doc": "ตั้งรายได้แล้ว → ใบสมัครผ่านลิงก์ที่ค้างเพราะยังไม่มีรายได้ เข้าคิว AI เอง (เจ้าของ 6 ต.ค. 2569 Choice\n\"ส่งเองเมื่อตั้งรายได้\") · ไม่รอ · ล้มไม่กระทบการบันทึก — กติกาเต็มที่ `api/_lib/incomeReadyDispatch.ts`",
  "query": [
   "request_no"
  ],
  "body": [
   "js",
   "request_no",
   "note",
   "send_replacement",
   "replacement_spare",
   "parser_override_text",
   "field_overrides"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/siamraj/unit-requests",
  "file": "api/_handlers/siamraj-unit-requests.ts",
  "methods": [
   "GET"
  ],
  "doc": "คีย์ทุกรูปที่ของชิ้นเดียวกันอาจถูกบันทึกไว้ — ใช้ตอน**อ่านกลับ**เท่านั้น\n\n🔴 **ทำไมต้องหาหลายรูป** (แก้ 22 ก.ย. 2569 · เจ้าของแจ้งว่าบันทึกแล้วหาย)\nERP บางแถวเก็บ `request_no` เป็น**ตัวเลขล้วน** (`6907001`) แล้วเราเติม prefix\nให้ตอนแสดงผล (`SQ6907001`) ⇒ ใบเดียวกันมีสองชื่อ และของที่คนบันทึกไว้ก่อนวันนี้\nถูกเขียนด้วย `externalId` (เลขล้วน) ส่วนฝั่งอ่านหาด้วย `request_no` (มี prefix)\n⇒ ลงฐานครบแต่จอไม่เห็น\n\nหลักฐานในฐาน production: ใบเดียวกันมีทั้ง `6907001` และ `SQ6907001` อยู่จริง\nทั้งใน `siamraj_unit_notes` และ `siamraj_unit_assignments`\n\n⚠️ ตัวเขียนใช้คีย์เดียว (`request_no` ก่อน — ดู `unitRequestNoteKey`)\nตัวนี้มีไว้กู้ของเก่าที่เขียนไว้แล้วเท่านั้น ห้ามเอาไปใช้ตอนเขียน",
  "query": [
   "meta",
   "id",
   "units",
   "since",
   "throughput",
   "from",
   "to",
   "closed",
   "limit",
   "mode",
   "fresh"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/siamraj/unit-work-status",
  "file": "api/_handlers/siamraj-unit-work-status.ts",
  "methods": [
   "GET",
   "POST",
   "PUT"
  ],
  "doc": "",
  "query": [
   "request_no"
  ],
  "body": [
   "js",
   "request_no",
   "status",
   "persons",
   "person_first_name",
   "person_last_name",
   "status_date"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/skill-quiz",
  "file": "api/_handlers/skill-quiz.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "/api/skill-quiz — หน้าแบบทดสอบพนักงานของเจ้าหน้าที่ (เจ้าของ 12 พ.ย. 2569)\nGET              → รายการลิงก์/ผล (สรุปคะแนนจากตัวตัดสินเดียว `scoreQuiz`)\nGET ?view=sets   → ชุดข้อสอบ\nGET ?id=         → ผลของคนหนึ่งคน (มีเฉลย/คำตอบ/บทวิเคราะห์)\nPOST { action }  → create_set · update_set · archive_set · create_link · save_review · ai_draft · archive_attempt",
  "query": [
   "view",
   "id"
  ],
  "body": [
   "js",
   "action",
   "id",
   "content",
   "setId",
   "personName",
   "personRole",
   "textScores",
   "reviewed",
   "analysis"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/so-post-groups",
  "file": "api/_handlers/so-post-groups.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/so-post-groups?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD&page=1\nการ์ด \"5. โพสต์ลงกลุ่ม Facebook\" ในภาพรวมงานสรรหา (เจ้าของ 11 พ.ย. 2569) — ส่งต่อจาก So Scraping ด้วย key ฝั่ง server\nสิทธิ์เดียวกับภาพรวม (`job-applications`) · ทุกคนที่เห็นภาพรวมเห็นทุกใบ · from/to = วันที่ไทย รวมวันสุดท้าย · ไม่ส่ง bu = ทุก BU\n`status=not_tried` (12 พ.ย. 2569 \"กดแล้วดูเหตุได้ไหม\") = เฉพาะสถานะนั้น + เหตุจัดกลุ่มนับ (อ่านทุกแถวของช่วงแล้วกรองฝั่งเรา)",
  "query": [
   "from",
   "to",
   "bu",
   "page",
   "status"
  ],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/so-post-summary",
  "file": "api/_handlers/so-post-summary.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/so-post-summary — ยอดโพสต์ลงกลุ่มต่อเลขใบขอ (สั่ง · แต่ละสถานะ) สำหรับการ์ดบนหน้าโพสต์ประกาศ\n(เจ้าของ 12 พ.ย. 2569 \"งานไหน สั่งไปเท่าไหร่ โพสต์ได้เท่าไหร่ บอกตรงนี้เลย\") · ช่วง 1 ต.ค. 2569 – วันนี้ (เส้น post-groups ของ So Scraping เริ่มที่วันนั้น)\nสิทธิ์เดียวกับหน้าโพสต์ประกาศ (`job-applications`) · key อยู่ฝั่ง server",
  "query": [],
  "body": [],
  "reachesPeople": true
 },
 {
  "path": "/api/system-health",
  "file": "api/_handlers/system-health.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "สถานะระบบ — ไฟ 4 ดวง + สวิตช์ที่เปิดอยู่ + ของค้างที่ยังไม่มีใครรับ\n\n`GET`  → ผลรอบล่าสุดของยามเฝ้า (ไม่ยิง ERP · เบา เปิดรีเฟรชได้)\n`POST` → สั่งตรวจเดี๋ยวนี้ (ปุ่ม \"ตรวจเดี๋ยวนี้\")\n`GET ?view=resources` → แรม/โหลดของเครื่องจริง (ตัวจดทุก 1 นาที · 28 ต.ค. 2569)\n\n⚠️ ไฟ ERP อ้างผลรอบล่าสุดของตัวย้ายใบสมัคร ไม่ได้ยิง ERP เอง —\nไม่งั้นคนเปิดหน้านี้ค้างไว้จะกลายเป็นตัวถล่ม ERP",
  "query": [
   "view"
  ],
  "body": [],
  "reachesPeople": false
 },
 {
  "path": "/api/team-online",
  "file": "api/_handlers/team-online.ts",
  "methods": [
   "GET"
  ],
  "doc": "GET /api/team-online?from=&to=&grain=&compare=&bu= — หน้า \"ทีม Online\" (29 ก.ย. 2569 · อ่านอย่างเดียว)\n\nรอบ 1: เจ้าของส่งภาพต้นแบบ → \"ทำตามภาพด้วยข้อมูลจริง ดูหลังสวิตช์ก่อน\"\nรอบ 2: ช่วงเวลาเป็นปฏิทินแบบแท็บ Dashboard + เทียบ BU (คนใช้งาน % ของบัญชี · อัตราที่ขอเข้า · Lumos ทุกเลน)\n+ ติดตรงไหนต่อ BU · นิยาม/ตัวประกอบคำตอบอยู่ `src/lib/teamOnline.ts` ที่เดียว\n\n- **คนใช้งาน** = คนไม่ซ้ำที่ล็อกอินหรือบันทึกงาน (`ACTIVITY_SOURCES`) · BU = แผนกบนบัญชี · ฐาน % = บัญชีของ BU นั้น\n- **ใบขอเข้า (อัตรา)** = สำเนา ERP ก้อนเดียวกับ Dashboard · วันที่ขอเข้ามา = `requestAddedYmd`\n- **Lumos** = ทุกเลน (`queueLane`) · กลุ่มตามวันที่เข้าคิว · จัดสายด้วย `classifyQueueRow` (ตัวเดียวกับ Success Rate ของ Dashboard)\n- **Success ประกาศ** = ใบที่ Gen link ครั้งแรกในช่วง ที่มีผู้สมัคร ≥ 1 (ไม่นับ Lead = เลขบนการ์ดกล่องงาน)\n- **ติดตรงไหน** = ใบขอ ERP ที่เข้ามาในช่วง → Gen link → มีผู้สมัคร → AI โทร → สนใจ → นัด → มาตามนัด\n- **ใบเปิดตอนนี้** = feed เดียวกับกล่องงาน (มี Gen link = เทียบสองคีย์ `buildJobKeyIndex`)\n\n🔴 กติกา: BU กลาง = ชุดรหัสแผนก (`parseBuParam`) · ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ ·\nตัวนับล้วน ไม่คืนข้อมูลบุคคล (`withAuth`) · ก้อนล้มแยกกัน (null + เหตุ — ห้าม 0 ปลอม)",
  "query": [],
  "body": [
   "errors",
   "users",
   "requests",
   "lumos",
   "postings",
   "funnel",
   "applicants",
   "lanes",
   "decisions",
   "people",
   "byBu",
   "bu_options"
  ],
  "reachesPeople": true
 },
 {
  "path": "/api/training-records",
  "file": "api/_handlers/training-records.ts",
  "methods": [
   "GET",
   "POST"
  ],
  "doc": "",
  "query": [
   "employee_id"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/unit-sector",
  "file": "api/_handlers/unit-sector.ts",
  "methods": [
   "GET",
   "PATCH"
  ],
  "doc": "GET/PATCH /api/unit-sector — ประเภทหน่วยงาน ราชการ/เอกชน ที่ทีมระบุเอง\n(migration 108 · เจ้าของเคาะ 25 ส.ค. 2569: *\"2 ตัว เดี๋ยว User มาเลือกเอง\"*)\n\nGET   → { sectors: { [site_code]: 'government' | 'private' } } ทั้งหมด (ตารางเล็ก 138 แถว)\nPATCH { site_code, sector }  → บันทึก · `sector: null` = ล้างค่ากลับไป \"ยังไม่ระบุ\"\n\n🔴 กติกาของเส้นนี้:\n1. **ค่ามั่วต้อง 400 ห้ามเงียบ** — `normalizeUnitSector` แยก `undefined` (มั่ว) ออกจาก\n   `null` (ล้างค่า) ให้แล้ว · ถ้าปล่อยผ่าน ค่ามั่วจะกลายเป็นการลบของที่ทีมระบุไว้\n2. **ไม่มีแถว = ยังไม่ระบุ** ห้ามเติม default ให้ฝั่งไหน\n3. คีย์เป็น `site_code` (หน่วยงาน) ไม่ใช่เลขที่ใบขอ — 293 ใบมาจาก 138 หน่วยงาน\n4. ครอบ `withAuth` เฉย ๆ เหมือน `/api/siamraj-unit-notes` (ข้อมูลระดับหน่วยงาน ไม่ใช่ข้อมูลบุคคล)",
  "query": [],
  "body": [
   "site_code",
   "sector"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/work-calendar",
  "file": "api/_handlers/work-calendar.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH"
  ],
  "doc": "",
  "query": [
   "from",
   "to",
   "employee_id"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 },
 {
  "path": "/api/work-status-master",
  "file": "api/_handlers/work-status-master.ts",
  "methods": [
   "GET",
   "POST",
   "PATCH",
   "DELETE"
  ],
  "doc": "Master \"สถานะทำงาน\" ของใบขอ\nGET   — ทุก role ที่ login (dropdown ทั้งระบบต้องใช้) พร้อมจำนวนใบขอที่ใช้อยู่\nPOST/PATCH/DELETE — admin เท่านั้น (บังคับที่ rbac: resource นี้ write = admin)",
  "query": [
   "code"
  ],
  "body": [
   "js"
  ],
  "reachesPeople": false
 }
];
