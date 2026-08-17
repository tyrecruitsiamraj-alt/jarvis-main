/**
 * ระบบ Lead — "ปัดใบสมัครออกจากรายชื่อทำงานไปคลังสำรอง"
 *
 * เจ้าของเคาะ 11 ส.ค. 2569: *"ตามระบบเดิมเป๊ะ — ปัดออกจากคิว"*
 * และเคาะเพิ่ม 12 ส.ค. 2569: **ปัดแล้วหายจากทุกแท็บ + มีตัวกรองเรียกคืนดู**
 *
 * ไฟล์นี้เก็บเฉพาะตรรกะล้วน (สรุปผลการปัดเป็นชุด + ป้าย) — การกรอง "ไม่ใช่ Lead"
 * อยู่ที่ **คิวรีฝั่ง server** (`buildApplicationsListQuery`) ไม่ใช่ที่หน้าเว็บ
 * เพราะแท็บของหน้า RM เป็นตัวกรองที่หั่นลิสต์ก้อนเดียวกัน — กรองทีหลังจะหลุดบางแท็บ
 */

/** ผลของการยิงทีละใบ — ชุดเดียวกับที่ `Promise.allSettled` คืนมา แต่ย่อให้เทสต์ง่าย */
export type LeadUpdateResult = { ok: true } | { ok: false; message: string };

export type LeadUpdateSummary = {
  ok: number;
  failed: number;
  /** ข้อความสรุปสำหรับโชว์ให้ผู้ใช้ — ล้มเหลวต้องบอกเหตุผลจริง ไม่ใช่ "ไม่สำเร็จ" ลอย ๆ */
  message: string;
};

/**
 * สรุปผลการปัด/เรียกคืนเป็นชุด
 *
 * ⚠️ **ล้มบางใบต้องไม่ถูกกลบ** — ปัด 20 ใบแล้วสำเร็จ 18 ถ้าโชว์แค่ "เก็บ Lead แล้ว"
 * เจ้าหน้าที่จะเชื่อว่าครบ แล้วอีก 2 ใบค้างอยู่ในลิสต์โดยไม่มีใครรู้ว่าทำไม
 * (เหตุผลที่พบจริงได้: ใบของแผนกอื่น → 403 · ยังไม่รัน migration → 503)
 */
export function summarizeLeadUpdate(
  results: LeadUpdateResult[],
  lead: boolean,
): LeadUpdateSummary {
  const ok = results.filter((r) => r.ok).length;
  const failures = results.filter((r): r is { ok: false; message: string } => !r.ok);
  const verb = lead ? 'เก็บเข้าคลังสำรอง (Lead)' : 'เอาออกจากคลังสำรอง';
  if (failures.length === 0) {
    return { ok, failed: 0, message: `${verb} ${ok} รายการ` };
  }
  // เหตุผลซ้ำ ๆ ยุบเหลืออันเดียว — ปัด 20 ใบพลาดด้วยเหตุเดียวกันไม่ควรได้ข้อความ 20 บรรทัด
  const reasons = [...new Set(failures.map((f) => f.message))].slice(0, 2).join(' · ');
  return {
    ok,
    failed: failures.length,
    message: `${verb} ${ok} รายการ · ไม่สำเร็จ ${failures.length} รายการ — ${reasons}`,
  };
}

/** ป้ายของปุ่มสลับมุมมอง — ข้อความเดียวของทั้งระบบ */
export const LEAD_VIEW_LABEL = {
  enter: 'ดูคลังสำรอง (Lead)',
  exit: 'กลับไปรายชื่อทำงาน',
} as const;

/** ป้ายอธิบายมุมมองคลังสำรอง — บอกให้รู้ว่าทำไมลิสต์ถึงต่างจากปกติ */
export const LEAD_VIEW_HINT =
  'คลังสำรอง (Lead) — ใบที่ถูกปัดออกจากรายชื่อทำงาน · กด “ลบ Lead” เพื่อเรียกกลับเข้าลิสต์ปกติ';
