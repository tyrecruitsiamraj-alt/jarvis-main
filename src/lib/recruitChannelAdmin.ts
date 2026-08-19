/**
 * หน้าจัดช่องทางรับสมัคร — ตรรกะล้วน (ไม่แตะ DOM/เครือข่าย)
 *
 * ⚠️ ทำไมต้องแบ่งหน้าฝั่งเซิร์ฟเวอร์: ของจริงที่ยกมาจาก iRecruit มี **ช่องทางรอง 4,345 ตัว**
 * (พ่อชื่อ "Facebook Group" ตัวเดียวมีลูก 4,187) โหลดมาทั้งก้อนคือแช่หน้าเว็บ
 * หน้าเว็บจึงส่ง `limit`/`offset` ให้ API เสมอ แล้วคำนวณเลขหน้าจาก `total` ที่ API คืนมา
 */

/** แถวต่อหน้า — 25 พอดีกับความสูงจอโดยไม่ต้องเลื่อนยาว */
export const CHANNEL_ADMIN_PAGE_SIZE = 25;

/** ยาวสุดที่ฐานเก็บ (ตรงกับ MAX_TEXT ฝั่ง api/_lib/recruitPostings.ts) */
export const CHANNEL_NAME_MAX = 200;

/** สองมุมมองของหน้า — ช่องทางหลัก / ช่องทางรอง */
export type ChannelAdminView = 'roots' | 'children';

export const CHANNEL_ADMIN_VIEW_LABEL: Record<ChannelAdminView, string> = {
  roots: 'ช่องทางหลัก',
  children: 'ช่องทางรอง',
};

/** จำนวนหน้าทั้งหมด — ไม่มีของเลยก็ยังนับเป็น 1 หน้า (หน้าว่าง) ไม่ใช่ 0 */
export function channelPageCount(total: number, pageSize = CHANNEL_ADMIN_PAGE_SIZE): number {
  const size = Math.max(1, Math.trunc(pageSize) || 1);
  const n = Math.max(0, Math.trunc(Number(total)) || 0);
  return Math.max(1, Math.ceil(n / size));
}

/**
 * บีบเลขหน้าให้อยู่ในช่วงเสมอ — ลบจนหน้าท้ายว่างต้องเด้งกลับ ไม่ใช่ค้างหน้าเปล่า
 * (บทเรียนเดียวกับ `paginate` ใน rosterBuGroups)
 */
export function clampChannelPage(
  page: number,
  total: number,
  pageSize = CHANNEL_ADMIN_PAGE_SIZE,
): number {
  const last = channelPageCount(total, pageSize);
  const p = Math.trunc(Number(page)) || 1;
  return Math.min(Math.max(1, p), last);
}

/** offset ที่ส่งให้ API — คิดจากหน้าที่บีบแล้วเสมอ */
export function channelPageOffset(page: number, pageSize = CHANNEL_ADMIN_PAGE_SIZE): number {
  const size = Math.max(1, Math.trunc(pageSize) || 1);
  const p = Math.max(1, Math.trunc(Number(page)) || 1);
  return (p - 1) * size;
}

/** ป้ายบอกช่วงที่เห็นอยู่ เช่น "26–50 จาก 4,345" · ไม่มีของเลยคืน "ไม่มีรายการ" */
export function channelRangeLabel(
  page: number,
  total: number,
  shown: number,
  pageSize = CHANNEL_ADMIN_PAGE_SIZE,
): string {
  const n = Math.max(0, Math.trunc(Number(total)) || 0);
  if (n === 0 || shown <= 0) return 'ไม่มีรายการ';
  const from = channelPageOffset(clampChannelPage(page, n, pageSize), pageSize) + 1;
  const to = Math.min(from + shown - 1, n);
  return `${from.toLocaleString('th-TH')}–${to.toLocaleString('th-TH')} จาก ${n.toLocaleString('th-TH')}`;
}

/** ตรวจชื่อช่องทางก่อนยิง API — คืนข้อความผิดพลาด หรือ null ถ้าผ่าน */
export function channelNameError(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return 'ต้องระบุชื่อช่องทาง';
  if (s.length > CHANNEL_NAME_MAX) return `ชื่อยาวเกิน ${CHANNEL_NAME_MAX} ตัวอักษร`;
  return null;
}

/** แก้ชื่อแล้วเปลี่ยนจริงไหม — เทียบแบบตัดช่องว่างหัวท้าย (กันยิง PATCH เปล่า) */
export function channelNameChanged(before: string, after: string): boolean {
  return String(before ?? '').trim() !== String(after ?? '').trim();
}

/**
 * ข้อความยืนยันก่อนลบ
 * 🔴 FK เป็น `on delete cascade` — ลบช่องทางหลักคือลบช่องทางรองใต้มันหมดด้วย
 * ต้องบอกจำนวนลูกให้เห็นก่อน ไม่งั้นกดพลาดทีเดียวหาย 4,187 ช่อง
 */
export function channelDeleteWarning(channel: { name: string; childCount?: number }): string {
  const kids = Math.max(0, Math.trunc(Number(channel.childCount)) || 0);
  if (kids > 0) {
    return `ลบ "${channel.name}" — ช่องทางรองใต้ช่องทางนี้ ${kids.toLocaleString('th-TH')} ช่องจะถูกลบไปด้วย ยืนยันไหม?`;
  }
  return `ลบ "${channel.name}" ใช่ไหม? (ลิงก์ที่สร้างไว้แล้วยังใช้ได้)`;
}
