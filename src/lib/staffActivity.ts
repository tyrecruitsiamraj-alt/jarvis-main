/**
 * ═══ งานรายคน (เจ้าของ 18 พ.ย. 2569 "อยากรู้ว่าวันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป โพสต์มือเอง Autopost scrap"
 * · Choice "ภาพรวม แต่เพิ่ม Filter ให้ดูรายคนได้") ═══
 * นับจากงานที่บันทึกในระบบ (ใครทำ · วันไหน ตามปฏิทินกรุงเทพ) — ตัวดึงอยู่ `api/_handlers/staff-activity.ts`
 */
export const STAFF_ACTIVITY_KINDS = ['autopost', 'scrap', 'links', 'manualPosted', 'contacts', 'appts'] as const;
export type StaffActivityKind = (typeof STAFF_ACTIVITY_KINDS)[number];

/** หัวคอลัมน์ — คำที่คนในทีมใช้ */
export const STAFF_ACTIVITY_LABEL: Record<StaffActivityKind, string> = {
  autopost: 'Autopost (ใบ)',
  scrap: 'Scrap (ใบ)',
  links: 'สร้างลิงก์โพสต์เอง',
  manualPosted: 'ติ๊กโพสต์เองแล้ว',
  contacts: 'ลงผลติดต่อ',
  appts: 'นัดได้',
};

export type StaffActivityRow = { userId: string; name: string; bu: string | null; day: string } & Record<StaffActivityKind, number>;

export type StaffActivityItem = { day: string; title: string; sub: string | null; applicationId: string | null; requestNo: string | null };

/** รวมทุกวันต่อคน (ตัวกรอง "ทุกคน") · เรียงงานมากไปน้อย */
export function staffActivityTotals(rows: readonly StaffActivityRow[]): StaffActivityRow[] {
  const m = new Map<string, StaffActivityRow>();
  for (const r of rows) {
    const cur = m.get(r.userId) ?? { userId: r.userId, name: r.name, bu: r.bu, day: '', autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 };
    for (const k of STAFF_ACTIVITY_KINDS) cur[k] += r[k];
    m.set(r.userId, cur);
  }
  const sum = (r: StaffActivityRow) => STAFF_ACTIVITY_KINDS.reduce((n, k) => n + r[k], 0);
  return [...m.values()].sort((a, b) => sum(b) - sum(a) || a.name.localeCompare(b.name, 'th'));
}
