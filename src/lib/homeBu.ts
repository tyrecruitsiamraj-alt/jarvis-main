/**
 * BU (สายธุรกิจ) ของงาน — ตัวแปลรหัสไซต์เป็น BU (เจ้าของสั่ง 24 ส.ค. 2569:
 * *"เห็นเหมือนกันอะแต่แยกตาม BU … พวก Lba Lbd ฯลฯ"*)
 *
 * 🔴 **BU ไม่ได้อยู่ในเลขที่ใบขอ** — วัดจริงบนฐาน 24 ส.ค. 2569:
 * prefix ของเลขที่ใบขอคือ **ชนิดใบขอ** (OPL 159 · LMO 77 · LAO 16 · DSO 11 · SQ 7 ·
 * LAM 6 · LMM 4 · LBM 4 · PEO 1) ซึ่ง **ไม่มี LBA/LBD เลย**
 * ตัว BU ที่เจ้าของเรียก อยู่ใน `site_code` ตำแหน่งที่ 3-5:
 * `65LBDL0143` → **LBD** · `66LML0011` → **LML** · `67LBAL0019` → **LBA** ·
 * `67DSL0044` → **DSL** · `69SNJ0002` → **SNJ**
 * ⇒ ทุกที่ที่แยก BU ต้องแปลจาก `site_code` เท่านั้น ห้ามใช้ prefix ใบขอ
 *
 * ที่มาของ site_code ต่อโต๊ะ: ใบสมัคร/คิว/ถังคนโทร join `job_site_map` ·
 * `selection_progress.unit_site_code` · `follow_entries.site_code` ·
 * `aftercare_people.site_code` (มีคอลัมน์ตรงทั้งสองตัว)
 */

/** BU = ตัวอักษร 3 ตัวหลังเลขปี 2 หลักของรหัสไซต์ */
const SITE_BU_RE = /^\d{2}([A-Za-z]{3})/;

/**
 * ดึง BU จากรหัสไซต์ — คืน `null` เมื่ออ่านไม่ออก
 * 🔴 อ่านไม่ออก = **ไม่รู้** ไม่ใช่ "BU อื่น" (ห้ามยัดลงถังใดถังหนึ่ง)
 */
export function buFromSiteCode(siteCode: string | null | undefined): string | null {
  const m = SITE_BU_RE.exec(String(siteCode ?? '').trim());
  return m ? m[1].toUpperCase() : null;
}

/**
 * ชื่อเรียก BU บนจอ — เอาจากคำที่บริษัทใช้เองใน skill ประเมิน TOR ของแต่ละสาย
 * (`.claude/skills/anthropic-skills/*-tor-evaluation`) ไม่ได้ตั้งเอง
 * 🔴 รหัสที่ยังไม่รู้ชื่อ ให้โชว์รหัสเปล่า ๆ ห้ามเดาคำไทยให้
 */
const BU_NAME: Record<string, string> = {
  LBD: 'พนักงานขับรถ / Valet',
  LBA: 'ธุรการ · ช่าง · IT',
  LML: 'ดูแลสวน / ภูมิทัศน์',
  DSL: 'Data Solution',
  SNJ: 'SO NEXT',
};

/** ป้ายเต็มของ BU — ไม่รู้ชื่อก็ยังได้รหัสไว้อ่าน */
export function buLabel(bu: string | null | undefined): string {
  const code = String(bu ?? '').trim().toUpperCase();
  if (!code) return 'ไม่ระบุ BU';
  const name = BU_NAME[code];
  return name ? `${code} · ${name}` : code;
}

/** ป้ายสั้นสำหรับปุ่มกรอง (จอแคบ) */
export function buShortLabel(bu: string | null | undefined): string {
  const code = String(bu ?? '').trim().toUpperCase();
  return code || 'ไม่ระบุ';
}

export type BuOption = { bu: string; label: string; count: number };

/**
 * เรียงตัวเลือก BU สำหรับปุ่มกรอง — ของมากอยู่ก่อน แล้วเรียงรหัสกันสลับตำแหน่ง
 * เมื่อยอดเท่ากัน (ปุ่มขยับที่ทุกครั้งที่โหลด = คนกดผิด)
 */
export function sortBuOptions(rows: readonly { bu: string; count: number }[]): BuOption[] {
  return [...rows]
    .filter((r) => Boolean(r.bu))
    .sort((a, b) => b.count - a.count || a.bu.localeCompare(b.bu))
    .map((r) => ({ bu: r.bu, label: buLabel(r.bu), count: r.count }));
}

/** ผู้ใช้เลือก BU มาถูกต้องไหม (กันค่ามั่วจาก URL) — คืนค่าที่ปลอดภัยเสมอ */
export function normalizeBu(raw: unknown, allowed: readonly string[]): string | null {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!code || code === 'ALL') return null;
  return allowed.includes(code) ? code : null;
}
