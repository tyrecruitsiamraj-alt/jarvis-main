/**
 * API บนเครื่องแบบ **ปิดงานเบื้องหลังทุกตัว** — `npm run api:local:safe` (30 ก.ย. 2569)
 *
 * 🔴 ทำไมต้องมี: ฐานบนเครื่อง = production · `npm run api:local` เปิดงานเบื้องหลังตามค่าตั้งต้น
 * (ส่งซ้ำรายการติดตาม · ส่งซ้ำสาย Lumos · ยามเฝ้าระบบ) และ `.env.local` เปิดคิดคู่งานล่วงหน้าไว้ด้วย
 * ⇒ เปิด API บนเครื่องเมื่อไหร่ งานพวกนี้วิ่งซ้ำกับของบนเซิร์ฟเวอร์จริงทันที (แจ้งเตือนซ้ำ · เขียนผลซ้ำ)
 *
 * ⚠️ ค่าใน `.env*` ชนะค่าที่ส่งตอนสั่งรัน (`bootstrap-env.ts` เขียนทับ process.env) ⇒ ต้องโหลดไฟล์ env ก่อน
 * แล้วค่อยปิดสวิตช์ทีหลัง · ไฟล์นี้ให้ `tsx watch` ใช้ได้ (โค้ดเปลี่ยน = API โหลดใหม่เอง ไม่ค้างโค้ดเก่า)
 */
await import('./bootstrap-env.ts');

Object.assign(process.env, {
  MATCH_PRECOMPUTE_ENABLED: 'false',
  APPLICATION_AUTO_MOVE_ENABLED: 'false',
  CLAIM_GUARD_ENABLED: 'false',
  FOLLOW_PUSH_RETRY_ENABLED: 'false',
  LUMOS_PUSH_RETRY_ENABLED: 'false',
  // ดึงส่งคนแทนจาก iRecruit ทุกเช้า (2 ต.ค. 2569) — บนเครื่อง dev ห้ามวิ่งซ้ำกับเซิร์ฟเวอร์ (สร้างสาย + ส่ง AI ลงฐานจริง)
  IRECRUIT_REPLACE_SYNC_ENABLED: 'false',
  SYSTEM_HEALTH_WATCH_ENABLED: 'false',
});

await import('./local-api.ts');
