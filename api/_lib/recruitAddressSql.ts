/**
 * ที่อยู่ผู้สมัคร iRecruit (`hr_recruitment_address` alias `ra`) → ชื่อจังหวัด/อำเภอ/ตำบล — ที่เดียวทั้งระบบ
 *
 * 🔴 25 พ.ย. 2569 (เจ้าของ "ที่อยู่คนฉันว่าบน erp มีนะ" — ถูก): รหัสในตารางที่อยู่มี **2 ชุด**
 * - ชุดปัจจุบัน `ms_province` / `ms_province_amphur` (กรุงเทพ = '10' · ราชเทวี = '1037') — 99,816 แถว
 * - ชุดเก่า `hr_ms_province` / `hr_ms_amphur` (กรุงเทพ = '2' · ราชเทวี = '0048') — 1,118 แถว
 *   เดิม join แต่ชุดปัจจุบัน: 504 แถวได้ "ไม่มีที่อยู่" · **614 แถวได้จังหวัดผิด** (อยู่สมุทรปราการ ขึ้นแม่ฮ่องสอน ·
 *   อยู่ระยอง ขึ้นนครพนม) เพราะรหัสเก่าบังเอิญตรงรหัสจังหวัดอื่นของชุดปัจจุบัน
 * ตัดสินชุดด้วย **คู่ (จังหวัด, อำเภอ)**: อยู่ใน `ms_province_amphur` = ชุดปัจจุบัน · ไม่อยู่แต่อยู่ใน `hr_ms_amphur` = ชุดเก่า
 * (วัดจริงอ่านอย่างเดียว · ไม่ตรงทั้งสองชุด 221 แถว = ใช้ชุดปัจจุบันตามเดิม)
 */
export const RECRUIT_ADDRESS_JOINS_SQL = `
LEFT JOIN dbo.ms_province             AS pv  ON pv.province_code = ra.province_code
LEFT JOIN dbo.ms_province_amphur      AS am  ON am.province_code = ra.province_code AND am.amphur_code = ra.amphur_code
LEFT JOIN dbo.ms_province_tambon      AS tb  ON tb.province_code = ra.province_code AND tb.amphur_code = ra.amphur_code AND tb.tambon_code = ra.tambon_code
LEFT JOIN dbo.hr_ms_province          AS hpv ON hpv.province_code = ra.province_code
LEFT JOIN dbo.hr_ms_amphur            AS ham ON ham.province_code = ra.province_code AND ham.amphur_code = ra.amphur_code`;

/** แถวนี้ใช้รหัสชุดเก่า (`hr_ms_*`) */
const OLD_CODE_SET_SQL = `(am.amphur_code IS NULL AND ham.amphur_code IS NOT NULL)`;

export const RECRUIT_PROVINCE_NAME_SQL = `CASE WHEN ${OLD_CODE_SET_SQL} THEN NULLIF(LTRIM(RTRIM(hpv.province_name)), N'') ELSE pv.province_name END`;
export const RECRUIT_AMPHUR_NAME_SQL = `CASE WHEN ${OLD_CODE_SET_SQL} THEN NULLIF(LTRIM(RTRIM(ham.amphur_name)), N'') ELSE am.amphur_name END`;
/** ตำบลชุดเก่าไม่มีตารางคู่ที่ตรวจแล้ว — ไม่เดา (ข้อความ `address1` มีตำบลอยู่แล้ว) */
export const RECRUIT_TAMBON_NAME_SQL = `CASE WHEN ${OLD_CODE_SET_SQL} THEN NULL ELSE tb.tambon_name END`;
