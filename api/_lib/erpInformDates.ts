/**
 * ═══ วันแจ้งเข้าล่าสุดจาก ERP ต่อเบอร์ (เจ้าของเคาะ 17 ต.ค. 2569 "วันแจ้งเข้าใน ERP") ═══
 *
 * ใช้เติมวันเริ่มงานที่ว่างให้ (ป๊อปย้ายไปดูแลหลังเริ่มงาน · หน้าดูแลหลังเริ่มงาน) — วัด 17 ต.ค.:
 * คนที่ปิดงานติดตามมีวันเริ่มงานแค่ 4 จาก 206 คน ต้องเลือกเองทีละคน
 *
 * แหล่ง: `hr_recruitment` (มีเบอร์) → `inform_no` → `st_inform_head` ที่ยังไม่ถูกยกเลิก (`activeInformWhereSql`)
 * ⚠️ ใช้ `inform_date` ตามที่เจ้าของเลือก · `st_inform_detail.begin_date` ส่วนใหญ่เป็นวันที่ 1 ของเดือน (วันเริ่มสัญญา) ไม่ใช่วันเข้างานจริง
 * ⚠️ เอาเฉพาะใบภายใน 120 วัน — ใบเก่ากว่านั้นเป็นงานก่อนหน้าของคนเดียวกัน
 * ⚠️ อ่านอย่างเดียว · จับคู่ด้วยเบอร์ 9 ตัวท้าย (คีย์เดียวกับทั้งระบบ) · ไม่ส่งเลขบัตร/ชื่อออกไป
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { activeInformWhereSql } from './siamrajStaffingOpen.js';
import { toBangkokYmd } from './businessDate.js';

export const ERP_INFORM_PHONE_LIMIT = 300;

/** เบอร์ 9 ตัวท้าย (ตัดขีด/ช่องว่าง/+66) — ไม่ถึง 9 หลัก = null */
export function phoneLast9(raw: string | null | undefined): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
}

/** เบอร์ (9 ตัวท้าย) → วันแจ้งเข้าล่าสุด YYYY-MM-DD · ไม่เจอ = ไม่มีคีย์ */
export async function erpInformDatesByPhones(phones: readonly string[]): Promise<Map<string, string>> {
  const keys = [...new Set(phones.map(phoneLast9).filter((x): x is string => Boolean(x)))].slice(0, ERP_INFORM_PHONE_LIMIT);
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const params: Record<string, string> = {};
  const marks = keys.map((k, i) => {
    params[`p${i}`] = k;
    return `@p${i}`;
  });
  const rows = await siamrajSqlQuery<{ last9: string; inform_day: Date | string | null }>(
    `
    SELECT RIGHT(REPLACE(REPLACE(RTRIM(r.mobile), '-', ''), ' ', ''), 9) AS last9,
           MAX(CONVERT(date, IH.inform_date)) AS inform_day
      FROM hr_recruitment r
      INNER JOIN st_inform_head IH ON IH.inform_no = r.inform_no
     WHERE r.inform_no IS NOT NULL
       AND ${activeInformWhereSql('IH')}
       -- ใบแจ้งเข้าเก่าเกิน 120 วัน = น่าจะเป็นงานก่อนหน้า ไม่ใช่งานที่กำลังตาม (เจอใบปี 2568 ตอนตรวจ 18 ต.ค. 2569)
       AND IH.inform_date >= DATEADD(day, -120, CONVERT(date, GETDATE()))
       AND RIGHT(REPLACE(REPLACE(RTRIM(r.mobile), '-', ''), ' ', ''), 9) IN (${marks.join(', ')})
     GROUP BY RIGHT(REPLACE(REPLACE(RTRIM(r.mobile), '-', ''), ' ', ''), 9)
  `,
    params,
  );
  for (const r of rows) {
    const day = r.inform_day ? toBangkokYmd(r.inform_day) : '';
    if (r.last9 && day) out.set(String(r.last9).trim(), day);
  }
  return out;
}
