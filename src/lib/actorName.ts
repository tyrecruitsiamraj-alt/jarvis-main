/**
 * ชื่อของบัญชีที่ล็อกอินอยู่ — ระบบบันทึกงานในชื่อนี้ (เจ้าของ 20 พ.ย. 2569 "จะรู้ได้ไงว่าใครสั่ง" · Choice
 * "โชว์ชื่อบัญชีที่ล็อกอินบนสุด + บนปุ่มบันทึก") · กติกาเดียวกับชื่อคนสั่งในรายงาน (`STAFF_NAME_SQL`): ชื่อเล่น › ชื่อเต็ม › อีเมลหน้า @
 */
export function actorNameOf(u: { nickname?: string | null; full_name?: string | null; email?: string | null } | null | undefined): string {
  if (!u) return '';
  return u.nickname?.trim() || u.full_name?.trim() || (u.email ?? '').split('@')[0] || '';
}
