/** ข้อความเมื่อเรียก /api ไม่สำเร็จ (มักเป็น TypeError จากเครือข่าย / proxy) */
export function apiUnreachableHint(): string {
  if (import.meta.env.DEV) {
    return 'เชื่อมต่อ API ไม่ได้ — รัน npm run dev (API พอร์ต 3000 + Vite พร้อมกัน) หรือแยก: npm run api:local กับ npm run dev:vite';
  }
  return 'เชื่อมต่อ API ไม่ได้ — รีเฟรชหน้าแล้วลองใหม่ หรือตรวจ Vercel (Deploy สำเร็จ, DATABASE_URL, AUTH_JWT_SECRET) แล้ว Redeploy';
}
