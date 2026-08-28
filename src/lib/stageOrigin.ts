/**
 * ═══ "มาจากหน้าไหน" — สำหรับหน้าที่ถูกกดเข้ามาจากหน้าที่ไม่ได้อยู่บนสายพาน ═══
 *
 * เจ้าของทัก 27 ส.ค. 2569: *"หน้ากล่องงาน พอกดแล้วทำไมไปหน้าใบงาน มันงงนะ"*
 *
 * เหตุ: หน้ารายละเอียดใบขอ (`/jobs/siamraj/:id`) ถูกจับเป็น **ขั้นที่ 1/6 "ใบขอ"**
 * ตามกฎ prefix ของสายพาน · แต่คนกดมาจาก**กล่องงาน** ซึ่งไม่ใช่ขั้นไหนของสายพานเลย
 * ⇒ หัวจอขึ้น "ขั้นที่ 1/6 · ใบขอ · ต่อไป: ประกาศรับ →" อ่านเหมือนถูกดีดถอยไปอีกแผนก
 *
 * เจ้าของเคาะ: *"ไปหน้าเดิม แต่เลิกหลอกว่าอยู่ขั้น 1"*
 * ⇒ ถ้ารู้ว่ามาจากไหน **บอกทางกลับ** แทนการบอกเลขขั้น
 *
 * 🔴 **แหล่งเดียวของป้าย "มาจากหน้าไหน"** — ห้ามพิมพ์ชื่อหน้าเป็นสตริงตายที่อื่น
 * (กติกาเดิมของโปรเจกต์: ห้ามพิมพ์ชื่อขั้น/ชื่อหน้าเองในไฟล์หน้าจอ)
 */

/** หน้าต้นทางที่ไม่ได้อยู่บนสายพาน แต่พาคนไปหน้าอื่นได้ */
export type StageOriginKey = 'board' | 'applyPublic';

export const ORIGIN_LABELS: Record<
  StageOriginKey,
  { label: string; path: string; blurb: string }
> = {
  board: {
    label: 'กล่องงาน',
    path: '/jobs/board',
    blurb: 'ทำงานปล่อยประกาศอยู่ — กดกลับไปได้ ขั้นที่กรองไว้ยังอยู่',
  },
  applyPublic: {
    label: 'หน้าสมัครงาน',
    path: '/apply',
    blurb: 'มาจากหน้าสมัครงานสาธารณะ',
  },
};

/**
 * `returnTo` → หน้าต้นทาง · `null` = ไม่รู้จัก (ให้แถบสายพานทำงานตามปกติ)
 *
 * ⚠️ รับเฉพาะค่าที่ผ่าน `sanitizeUnitReturnTo` มาแล้ว (ผู้เรียกต้องกรองก่อน)
 * ⚠️ เทียบด้วย prefix เพราะ `returnTo` พก query มาด้วย (`/jobs/board?lane=toRelease`)
 */
export function originFromReturnTo(returnTo: string | null | undefined): StageOriginKey | null {
  const value = (returnTo ?? '').trim();
  if (!value) return null;
  if (value === '/jobs/board' || value.startsWith('/jobs/board?')) return 'board';
  if (value === '/apply' || value.startsWith('/apply?')) return 'applyPublic';
  return null;
}

/**
 * คำบนปุ่มย้อนกลับ — "กลับไปกล่องงาน" / "กลับไปหน้าสมัครงาน"
 * ไม่รู้ว่ามาจากไหน = `undefined` ⇒ ปุ่มเป็นลูกศรเปล่าเหมือนเดิม
 */
export function backLabelFor(returnTo: string | null | undefined): string | undefined {
  const origin = originFromReturnTo(returnTo);
  return origin ? `กลับไป${ORIGIN_LABELS[origin].label}` : undefined;
}
