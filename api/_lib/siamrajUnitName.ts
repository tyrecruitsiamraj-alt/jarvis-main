/**
 * ชื่อหน่วยงาน — แยก "จุดทำงาน" ออกจาก "ลูกค้าคู่สัญญา"
 *
 * 🔴 **เจอของจริง 3 ก.ย. 2569** ใบขอไซต์ `69LBDL0044` ขึ้นจอว่า
 * *"บริษัท สมิติเวช ศรีราชา จำกัด (สำนักงานใหญ่)"* แต่คนต้องไปทำงานที่
 * **สมิติเวช ชลบุรี** — โรงพยาบาลชลบุรีจดทะเบียนใต้บริษัทศรีราชา
 * ⇒ ชื่อนิติบุคคลตอบว่า *ใครจ่ายเงิน* ไม่ได้ตอบว่า *ไปทำงานที่ไหน*
 *
 * ใน ERP มีสองช่องแยกกันอยู่แล้ว:
 * - `ms_site.site_name` = จุดทำงาน + ตำแหน่ง/จำนวน เช่น
 *   `"สมิติเวช ชลบุรี - พขร. (Valet Parking) 4 คน"`
 * - `st_site_contract_p1.customer_name` = นิติบุคคลคู่สัญญา
 *
 * 🔴 **ห้ามสลับค่า `unit_name` เฉย ๆ** — วัดจริงจาก ERP (414 สัญญาที่มีใบขอปี 69):
 * ชื่อจุดทำงาน **240 จาก 414 เป็นชื่อย่ออังกฤษ** (`krungsri` `SCB` `TDEM` `MEGA`)
 * ถ้าเอาขึ้นเดี่ยว ๆ คนนอก/ผู้สมัครอ่านไม่รู้เรื่อง ⇒ ต้องโชว์คู่กันเสมอ
 *
 * 🔴 **และ `unit_name` เป็นกุญแจจับคู่** — `jobPenalty.countPenaltyDays()` เอา
 * `unit_name` ไปแมตช์กับ `client_name` ของ WL (ค่าที่บันทึกไว้ในอดีตแล้ว)
 * เปลี่ยนค่าเมื่อไหร่ = วันขาดคนย้อนหลังเพี้ยนเงียบ ๆ
 * ⇒ ที่นี่จึง**เพิ่มช่องใหม่** `work_site_name` ไม่แตะ `unit_name`
 */

/** ตัดหางรายละเอียดตำแหน่ง/จำนวนคนออกจากชื่อไซต์ ERP */
export function sitePlaceName(siteName?: string | null): string {
  const raw = (siteName ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  // ERP เขียน "จุดทำงาน - ตำแหน่ง จำนวน คน" · ตัวคั่นคือ " - " (มีเว้นวรรคสองข้าง)
  // ชื่อที่มีขีดติดกันอย่าง "Asian-HD" จึงไม่ถูกหั่น (วัดจริง: 413/414 แถวมีตัวคั่นนี้)
  const head = raw.split(/\s+-\s+/)[0]?.trim() ?? '';
  return head || raw;
}

/** เทียบชื่อแบบไม่สนช่องว่าง/ตัวพิมพ์ — ERP มีเว้นวรรคซ้อนเยอะ */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(a) === norm(b);
}

/**
 * คืนชื่อจุดทำงานที่ควรโชว์ — คืน `null` เมื่อไม่มีข้อมูลเพิ่มจาก `unit_name`
 * (ชื่อซ้ำกัน หรือ ERP ไม่มีชื่อไซต์ เช่น ใบขอล่วงหน้า) ⇒ จอไม่ต้องขึ้นบรรทัดซ้ำ
 */
export function workSiteNameOf(
  siteName?: string | null,
  unitName?: string | null,
): string | null {
  const place = sitePlaceName(siteName);
  if (!place) return null;
  if (unitName && sameName(place, unitName)) return null;
  return place;
}
