/**
 * ═══ BU ที่ผู้ใช้ดูได้ — ตัวตัดสินฝั่งหน้าเว็บ (28 ต.ค. 2569) ═══
 * > เจ้าของ: *"sirirat.j เขาบอกทำไมไม่เห็นของ bu อื่น"* — ตั้ง "ดูเพิ่ม" 4 BU ไว้แล้ว (26–27 ต.ค.) แต่เมนูใบขอ/แดชบอร์ดหัวหน้า
 * ล็อกด้วย BU หลักอย่างเดียวบนหน้าเว็บ ทั้งที่เซิร์ฟเวอร์ส่งของทุก BU ในสิทธิ์มาแล้ว (`departmentScope.ts`)
 * admin = null (ทุก BU) · คนอื่น = BU หลัก + ดูเพิ่ม · ไม่มี BU หลัก = [] (ไม่เห็น)
 */
import type { User } from '@/types';

export function viewableBusOf(user: Pick<User, 'role' | 'department_code' | 'extra_department_codes'> | null | undefined): string[] | null {
  if (!user || user.role === 'admin') return null;
  const primary = user.department_code?.trim().toUpperCase();
  if (!primary) return [];
  const out = [primary];
  for (const c of user.extra_department_codes ?? []) {
    const v = c.trim().toUpperCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** BU เดียว = ล็อกช่อง BU ไว้ที่ตัวนั้น · หลาย BU / admin = เลือกได้ */
export function lockedBuOf(user: Parameters<typeof viewableBusOf>[0]): string | null {
  const bus = viewableBusOf(user);
  return bus && bus.length === 1 ? bus[0] : null;
}
