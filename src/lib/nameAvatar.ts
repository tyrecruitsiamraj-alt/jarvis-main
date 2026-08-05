/**
 * ตัวย่อ + สีประจำคนของ avatar (mockup rev.3 ข้อ 06/07)
 *
 * แยกจาก component เพราะต้องเรียกได้จากที่อื่นและเทสต์ได้
 * สีต้อง deterministic: คนเดิมได้สีเดิมทุกหน้า ทุกครั้งที่โหลด และไม่ผูกกับลำดับแถว
 * (เรียงใหม่/กรอง/แบ่งหน้าแล้วสีต้องไม่เปลี่ยน ไม่งั้นจำหน้าคนจากสีไม่ได้)
 */

/** จานสีของ avatar — คุมโทนเดียวกับ mockup · ตัวหนังสือขาวอ่านออกทั้งสองธีม */
export const AVATAR_COLORS = [
  '#4d7ef0',
  '#22a45f',
  '#b08d4f',
  '#e5b62a',
  '#7c5bd6',
  '#e2493c',
  '#0d9488',
] as const;

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** สีประจำชื่อ — ชื่อเดียวกันได้สีเดียวกันเสมอ */
export function avatarColor(name: string): string {
  return AVATAR_COLORS[hashCode(name || '') % AVATAR_COLORS.length];
}

/**
 * ตัวย่อ: ไทยเอา 2 อักขระแรกของชื่อต้น · อังกฤษเอาอักษรแรกของชื่อ + นามสกุล
 * ชื่อว่างได้ "—" (ไม่ใช่ช่องว่างเปล่าที่ดูเหมือนวงกลมเสีย)
 */
export function nameInitials(fullName: string): string {
  const name = (fullName || '').trim();
  if (!name) return '—';
  const parts = name.split(/\s+/);
  const isAscii = /^[\x20-\x7f]+$/.test(name);
  if (isAscii) {
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0].slice(0, 2);
}
