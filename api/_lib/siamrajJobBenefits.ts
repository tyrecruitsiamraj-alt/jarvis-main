/**
 * สวัสดิการ/รายได้เสริมของใบขอ → ประโยคที่ AI พูดได้ (เจ้าของสั่ง 15 ส.ค. 2569:
 * "ช่อง Interview เพิ่มข้อมูลของหน่วยงาน พวก OT ชั่วโมงละเท่าไหร่ สถานที่ปฏิบัติงาน
 * เบี้ยขยัน ค่าโทรศัพท์ ถ้าหน่วยงานไหนมีส่งไปด้วย")
 *
 * ที่มา: ERP `st_request_p3_rate` × `wg2_ms_fee` มีอัตราหลายแถวต่อใบ (feed หลัก
 * หยิบแค่ค่าแรงหลัก is_wage='Y' แถวเดียว) — วัดจากฐานจริง 15 ส.ค. เจอ
 * ค่าล่วงเวลา 1.5/2.0/3.0 เท่า · ค่าเบี้ยขยัน · ค่ารถ/ค่าเดินทาง · ค่ากะ · ค่าครองชีพ
 *
 * ⚠️ **ตารางเดียวกันมีแถวที่ห้ามพูดปน**: ค่าปรับขาดงาน · มาสาย · เงินชดเชยลากิจ/
 * ลาป่วย/พักร้อน (ปกส) · เงินเดือน (ซ้ำกับที่พูดไปแล้ว) — จึงใช้ **whitelist**
 * เท่านั้น: พูดเฉพาะที่รู้จัก ไม่รู้จัก = เงียบ (พูดผิดแย่กว่าไม่พูด)
 *
 * 🔴 **ใช้ `payment_rate` = อัตราจ่าย (จ่ายพนักงาน) เท่านั้น** (เจ้าของย้ำ 16 ส.ค. 2569:
 * *"โชว์อัตราจ่ายนะไม่ใช่อัตราเบิก"*) — ตารางเดียวกันมี `draw_rate` = **อัตราเบิก**
 * (เบิกจากลูกค้า) ซึ่งเป็นคนละเลขจริง ๆ วัดจากฐาน 16 ส.ค.: 309,977 แถวที่มีทั้งสองค่า
 * เบิกสูงกว่าจ่าย 154,362 · เท่ากัน 15,442 · **เบิกต่ำกว่าจ่าย 140,173**
 * → หยิบผิดคอลัมน์ = บอกตัวเลขผิดให้ผู้สมัคร และเผยราคาขายให้คนนอก
 * **ห้าม select `draw_rate` ในไฟล์นี้เด็ดขาด** (มีเทสต์คุม)
 *
 * ⚠️ **ตัวเลขบอกเฉพาะโอที 1.5 เท่า** (หน่วยชัด = ต่อชั่วโมง · ยืนยันกับฐาน:
 * 410/8×1.5 = 76.88 ตรงแถวจริง) — เบี้ยขยัน/ค่าเดินทาง/ค่าโทรศัพท์หน่วยไม่แน่
 * (ต่อวัน/ต่อเดือนแล้วแต่ไซต์) บอกแค่ "มี" พอ เจ้าหน้าที่ค่อยบอกเลขตอนคุยจริง
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';

export type JobBenefitRate = { fee_name: string; fee_rate: number };

/** กลุ่มที่พูดได้ — คีย์เวิร์ดจับชื่อ fee จริงในฐาน (ดูตัวอย่างจริงใน header) */
const SPEAKABLE_GROUPS: Array<{ label: string; test: RegExp }> = [
  { label: 'เบี้ยขยัน', test: /เบี้ยขยัน/ },
  { label: 'ค่าเดินทาง', test: /ค่ารถ|ค่าเดินทาง|taxi/i },
  { label: 'ค่าโทรศัพท์', test: /โทรศัพท์/ },
  { label: 'ค่ากะ', test: /ค่ากะ/ },
  { label: 'ค่าอาหาร', test: /ค่าอาหาร/ },
  { label: 'ค่าครองชีพ', test: /ค่าครองชีพ/ },
];

/** โอทีมาตรฐาน 1.5 เท่า — ตัวเดียวที่บอกตัวเลขได้ (หน่วยต่อชั่วโมงแน่นอน) */
const OT_15 = /ล่วงเวลา\s*1\.5/;

/**
 * ประกอบประโยคสวัสดิการที่ AI พูดได้ — pure (มี unit test)
 * คืน '' เมื่อไม่มีอะไรพูด (ใบที่ไม่มีข้อมูล = ไม่พูด ไม่ใช่พูดว่า "ไม่มี")
 */
export function speakableBenefitLine(rates: JobBenefitRate[]): string {
  const parts: string[] = [];

  const ot = rates.find((r) => OT_15.test(r.fee_name) && Number(r.fee_rate) > 0);
  if (ot) {
    // ปัดเป็นจำนวนเต็ม — "เจ็ดสิบหกจุดแปดแปดบาท" ฟังทางโทรศัพท์แล้วงง
    parts.push(`มีโอทีชั่วโมงละประมาณ ${Math.round(Number(ot.fee_rate))} บาท`);
  }

  const found: string[] = [];
  for (const g of SPEAKABLE_GROUPS) {
    if (rates.some((r) => g.test.test(r.fee_name) && Number(r.fee_rate) > 0)) found.push(g.label);
  }
  if (found.length > 0) parts.push(`มี${found.join(' ')}ให้ด้วย`);

  return parts.join(' และ');
}

/**
 * ดึงอัตราของหลายใบขอในคิวรีเดียว (อ่านอย่างเดียว) — คีย์ = เลขที่ใบขอ (request_no)
 * ล้ม = คืน map ว่าง (ผู้เรียกเสิร์ฟต่อแบบไม่มีข้อมูลเสริม — ERP ล่มห้ามทำให้คิวหยุด)
 */
export async function fetchJobBenefitLines(
  requestNos: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const nos = [...new Set(requestNos.map((s) => (s || '').trim()).filter(Boolean))];
  if (nos.length === 0) return out;
  // mssql ไม่มี array param — ประกอบ IN ด้วย placeholder ต่อค่า (ห้ามต่อสตริงค่าดิบ)
  const placeholders = nos.map((_, i) => `@p${i}`).join(', ');
  const params = Object.fromEntries(nos.map((v, i) => [`p${i}`, v]));
  const rows = await siamrajSqlQuery<{ request_no: string; fee_name: string; fee_rate: number }>(
    `SELECT RTRIM(C.request_no) as request_no, RTRIM(F.fee_name) as fee_name, C.payment_rate as fee_rate
       FROM st_request_p3_rate C
       LEFT JOIN wg2_ms_fee F
         ON F.fee_codex = (C.withdraw_type_code + C.income1_code + C.income2_code + C.fee_code)
      WHERE RTRIM(C.is_wage) <> 'Y' AND C.request_no IN (${placeholders})`,
    params,
  );
  const byNo = new Map<string, JobBenefitRate[]>();
  for (const r of rows) {
    if (!r.fee_name) continue;
    const list = byNo.get(r.request_no) ?? [];
    list.push({ fee_name: r.fee_name, fee_rate: Number(r.fee_rate) });
    byNo.set(r.request_no, list);
  }
  for (const [no, list] of byNo) {
    const line = speakableBenefitLine(list);
    if (line) out.set(no, line);
  }
  return out;
}

/** `job_ref` ของคิว ('siamraj-sql:OPL6908026') → เลขที่ใบขอ ('OPL6908026') · ไม่ใช่รูปนี้ = null */
export function requestNoFromJobRef(jobRef: string): string | null {
  const s = (jobRef || '').trim();
  if (!s.startsWith('siamraj-sql:')) return null;
  const no = s.slice('siamraj-sql:'.length).trim();
  return no || null;
}
