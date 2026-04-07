/** ข้อความเมื่อเรียก /api ไม่สำเร็จ (มักเป็น TypeError จากเครือข่าย / proxy) */
export function apiUnreachableHint(): string {
  if (import.meta.env.DEV) {
    return 'ต่อ API ไม่ได้ — รัน npm run dev (API พอร์ต 3000 + Vite พร้อมกัน) หรือแยกเทอร์มินัล: npm run api:local กับ npm run dev:vite';
  }
  return 'ต่อเซิร์ฟเวอร์ไม่ได้ — ลองรีเฟรชหน้า หรือตรวจว่า deploy ผ่านและ Environment ครบ (เช่น DATABASE_URL, PGSCHEMA, AUTH_JWT_SECRET)';
}
