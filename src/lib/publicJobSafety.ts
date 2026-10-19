/**
 * ═══ ของที่คนนอกไม่ควรเห็นบนหน้าสมัครงานสาธารณะ (QA 19 ต.ค. 2569 · เจ้าของ Choice) ═══
 * - ชื่อไซต์ที่เป็นรหัสย่อภายใน (HRSA · ADLC · krungsri) ⇒ ไม่ส่ง ให้หัวการ์ดใช้ชื่อบริษัทเต็มแทน
 *   ชื่อไซต์ที่เป็นภาษาไทย (เช่น "สมิติเวช ชลบุรี") ยังใช้เหมือนเดิม — บอกจุดทำงานจริงได้ดีกว่า (กติกา 3 ก.ย.)
 * - บรรทัดรายละเอียดที่บอกที่อยู่บ้าน/คอนโด/หมู่บ้านของนาย (งานขับรถ) ⇒ ตัดออก · เจ้าหน้าที่ยังเห็นครบ
 * ใช้ฝั่ง API `public/jobs` (ไม่ส่งออกไปเลย) — pure ไม่มี import ของหน้าเว็บ
 */

const THAI = /[฀-๿]/;

/** ชื่อไซต์ที่ใช้บนหน้าสาธารณะ · รหัสย่อ (ไม่มีอักษรไทย) = ไม่ใช้ */
export function publicWorkSiteName(name: string | null | undefined): string | undefined {
  const v = (name ?? '').trim();
  if (!v || !THAI.test(v)) return undefined;
  return v;
}

const BOSS = /นาย/;
const HOME = /บ้าน|หมู่บ้าน|คอนโด/;

/** ตัดบรรทัดที่บอกที่อยู่บ้านของนาย · ไม่เหลือเลย = undefined */
export function publicJobDetails(lines: readonly string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(lines)) return undefined;
  const kept = lines.filter((l) => !(BOSS.test(l) && HOME.test(l)));
  return kept.length > 0 ? kept : undefined;
}
