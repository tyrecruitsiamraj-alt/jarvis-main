/**
 * ตรวจว่า API registry โหลดได้และมี route สำคัญครบ (ใช้หลัง deploy ใน Docker)
 *
 * รัน: npx tsx scripts/verify-api-registry.mjs
 *
 * ⚠️ ต้องรันด้วย **tsx** ไม่ใช่ `node` — registry เป็น TypeScript และ import ลูกด้วย
 * นามสกุล `.js` (ตามมาตรฐาน ESM ของ TS) ซึ่ง node ล้วนหาไฟล์ไม่เจอ
 * deploy.yml เรียกด้วย `npx tsx` อยู่แล้ว
 *
 * เพิ่ม route ใหม่แล้วควรเพิ่มในลิสต์นี้ด้วย ถ้าเป็นเส้นที่พังแล้วกระทบงานจริง
 */
import { apiRoutes } from '../api/_handlers/registry.ts';

const required = [
  // เส้นเดิมของ Matching
  '/api/matching/suggestions',
  '/api/matching/parse-branch-demand-job',
  '/api/recruit-registrations',
  // ผลคัดกรองผู้สมัคร (เกณฑ์เรียงผู้สมัครใช้)
  '/api/matching/candidate-screening',
  // "รับไปโทรเอง" — ล็อกสิทธิ์โทร กันเจ้าหน้าที่โทรชนกัน
  '/api/matching/call-holds',
  // โหมดส่งงานให้ Lumos (manual/assist/auto)
  '/api/lumos/dispatch-mode',
  // funnel การโทร + ถังต้องคนตาม (หน้า Follow)
  '/api/lumos/call-funnel',
  // ชุดส่งงาน + อนุมัติ + ช่วงถอนคำ
  '/api/lumos/call-batches',
  // เส้นที่ Lumos ยิงเข้ามา — พังแล้วงานโทรหยุดทั้งระบบ
  '/api/lumos/reminder/contacts',
  '/api/lumos/reminder/results',
  '/api/lumos/interview/candidates',
  '/api/lumos/interview/results',
  '/api/lumos/dispatch',
];

const missing = required.filter((path) => !apiRoutes[path]);

if (missing.length > 0) {
  for (const path of missing) console.error(`missing route: ${path}`);
  process.exit(1);
}

console.log(`api registry ok (${Object.keys(apiRoutes).length} routes, ${required.length} checked)`);
