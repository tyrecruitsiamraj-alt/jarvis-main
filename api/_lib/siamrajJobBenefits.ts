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
 * 🔴 **กัน 2 ชั้น** (เจ้าของสั่ง 16 ส.ค. 2569: *"ไอพวกหักๆ ไม่ต้องเอามาโชว์"*):
 *   ชั้น 1 = ตัดฝั่งหักที่ต้นทาง SQL ด้วย `wg2_ms_fee.what_side <> '2'`
 *   ชั้น 2 = whitelist ชื่อ (ของเดิม)
 * `what_side='2'` คือฝั่งหักของ ERP — วัดจาก master 16 ส.ค.: 72 รายการ ครอบทั้ง
 * มาสาย · ค่าปรับขาดงาน · ภาษี · กองทุนสำรองเลี้ยงชีพ · ค่าเครื่องแบบ · ค่าความเสียหาย
 * ชั้นเดียวไม่พอ: whitelist กันชื่อที่ **รู้จัก** · `what_side` กันของ **ที่ยังไม่รู้จัก**
 * ที่ใครจะเพิ่มเข้า master วันหลัง
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

export type JobBenefitRate = {
  fee_name: string;
  fee_rate: number;
  /** หน่วยของอัตรา: `M` ต่อเดือน · `D` ต่อวัน · `H` ต่อชั่วโมง · `T` ต่อครั้ง (จาก `fee_unit_code_1`) */
  unit?: string | null;
  /** แถวค่าแรงหลักของใบขอ (`is_wage='Y'`) — มีได้แถวเดียวต่อใบ */
  is_wage?: boolean;
};

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
  // ⚠️ แถวค่าแรงหลักไม่นับเป็น "ของแถม" — พูดไปแล้วตอนบอกเงินเดือน (คิวรีดึงมาด้วย
  // ตั้งแต่ทำยอดรายเดือน จึงต้องกรองที่นี่ ไม่ใช่พึ่ง WHERE ของ SQL เหมือนเดิม)
  rates = rates.filter((r) => !r.is_wage);

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
 * เวอร์ชัน "ชิป" ของประโยคเดียวกัน — ใช้บน **หน้าสมัครสาธารณะ** (เจ้าของเคาะ 16 ส.ค. 2569:
 * *"หน้าสาธารณะโชว์ OT ได้ — เอาเหมือนที่ AI พูด"*)
 *
 * ⚠️ ต้องเดินตาม **กติกาเดียวกับ `speakableBenefitLine` เป๊ะ** (whitelist ตัวเดียวกัน ·
 * บอกเลขเฉพาะโอที 1.5 เท่า) — สองจอพูดคนละเลขคือเรื่องใหญ่กว่าจอไหนสวยกว่า
 * มีเทสต์ parity ล็อกว่า "มีชิป ⟺ มีประโยค" เสมอ
 */
export function speakableBenefitChips(rates: JobBenefitRate[]): string[] {
  const chips: string[] = [];
  rates = rates.filter((r) => !r.is_wage); // เหตุผลเดียวกับ speakableBenefitLine
  const ot = rates.find((r) => OT_15.test(r.fee_name) && Number(r.fee_rate) > 0);
  if (ot) chips.push(`โอที ~${Math.round(Number(ot.fee_rate))} บาท/ชม.`);
  for (const g of SPEAKABLE_GROUPS) {
    if (rates.some((r) => g.test.test(r.fee_name) && Number(r.fee_rate) > 0)) chips.push(g.label);
  }
  return chips;
}

// ─── รายได้ต่อเดือน (เจ้าของสั่ง 16 ส.ค. 2569: "เงินเดือน + รายได้มั่นคง เอาเป็นรายเดือน") ──

/** วันทำงานต่อเดือนที่ ERP ใช้เอง — ยืนยันจากฐาน: เงินเดือน 16,000 (M) ↔ 533.33 (D) = 16000/30 */
export const DAYS_PER_MONTH = 30;

/**
 * "รายได้มั่นคง" = ได้ทุกเดือนโดยไม่ขึ้นกับว่าทำอะไรเพิ่ม (เจ้าของนิยาม 16 ส.ค. 2569)
 *
 * ⚠️ **whitelist เท่านั้น** เหมือนฝั่งที่ AI พูด — ไม่รู้จัก = ไม่นับ (นับเกินแย่กว่าไม่นับ
 * เพราะเลขบนประกาศคือสิ่งที่ผู้สมัครเอาไปคาดหวัง แล้วมาเจอสลิปจริงน้อยกว่า)
 *
 * ที่ **จงใจไม่นับ** (วัดจาก 200 ใบจริง 16 ส.ค.):
 * - `เบี้ยขยัน` — มีเงื่อนไข (ขาด/สาย/ลา แล้วหลุด) ไม่ใช่ของที่ได้แน่
 * - `เบี้ยเลี้ยงค้างคืน/ไม่ค้างคืน` · `ค่าห้องพักค้างคืน` — ได้เฉพาะวันที่ออกต่างจังหวัดจริง
 * - `ค่ากะ` · `ค่าทำงานวันนักขัตฤกษ์` · `ค่าแทนงาน` — ขึ้นกับเวรที่ได้จริง
 * - โอทีทุกเรต — ขึ้นกับชั่วโมงที่ทำจริง (โชว์แยกเป็นชิปอยู่แล้ว)
 * - `เงินชดเชยลาป่วย/พักร้อน/ลากิจ (ปกส)` — เป็น**อัตราที่ใช้ตอนลา** ไม่ใช่รายได้เพิ่ม
 * - `เงินรางวัลพิเศษ` · `Incentive` · `คอมมิชชั่น` (หน่วย `T` ต่อครั้ง) — ไม่การันตี
 */
const STABLE_INCOME_GROUPS: Array<{ label: string; test: RegExp }> = [
  { label: 'ค่าครองชีพ', test: /ค่าครองชีพ/ },
  { label: 'ค่าโทรศัพท์', test: /โทรศัพท์/ },
  { label: 'ค่าเดินทาง', test: /ค่ารถ|ค่าเดินทาง|taxi|พาหนะ/i },
  { label: 'ค่าตำแหน่ง', test: /ค่าตำแหน่ง/ },
  { label: 'ค่าภาษา', test: /ค่าภาษา/ },
  { label: 'ค่าทักษะ', test: /ค่าทักษะ|ความสามารถพิเศษ/ },
  { label: 'ค่าอาหาร', test: /ค่าอาหาร|คูปองอาหาร/ },
  { label: 'ค่าเช่าบ้าน', test: /ค่าเช่าบ้าน/ },
];

export type MonthlyIncomeItem = { label: string; monthly: number };

export type MonthlyIncome = {
  /** ค่าแรงหลักต่อเดือน */
  base: number;
  /** รายได้มั่นคงที่บวกเพิ่ม (แปลงเป็นต่อเดือนแล้ว) */
  items: MonthlyIncomeItem[];
  /** base + items — 0 = คิดไม่ได้ (ไม่มีแถวค่าแรงหลัก) */
  total: number;
};

/** แปลงอัตราเป็น "ต่อเดือน" ตามหน่วยของ ERP · หน่วยที่แปลงไม่ได้ = null (ไม่เดา) */
export function toMonthlyAmount(rate: number, unit: string | null | undefined): number | null {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (unit || '').trim().toUpperCase();
  if (u === 'M') return n;
  if (u === 'D') return n * DAYS_PER_MONTH;
  // `H` ต่อชั่วโมง (โอที) และ `T` ต่อครั้ง = ไม่การันตี แปลงเป็นรายเดือนไม่ได้อย่างซื่อสัตย์
  return null;
}

/**
 * รายได้ต่อเดือน = ค่าแรงหลัก + รายได้มั่นคง (pure · มี unit test)
 *
 * ⚠️ **แถว `เงินเดือน` ที่หน่วยเป็นวันคือเงินก้อนเดียวกับค่าแรงหลัก** (16,000/30 = 533.33)
 * วัดจากฐาน: 180 ใบมีทั้งคู่ · บวกทั้งสองแถว = นับเงินเดือนสองรอบ
 * → ค่าแรงหลักเอาจาก `is_wage='Y'` แถวเดียว · แถวอื่นที่ชื่อเงินเดือน/ค่าแรง **ทิ้ง**
 *
 * ⚠️ ไม่มีแถวค่าแรงหลัก = คืน total 0 ให้ผู้เรียกไปแสดงค่าเดิมแทน (ห้ามเดา)
 */
export function monthlyGuaranteedIncome(rates: JobBenefitRate[]): MonthlyIncome {
  const wageRow = rates.find((r) => r.is_wage && Number(r.fee_rate) > 0);
  const base = wageRow ? toMonthlyAmount(wageRow.fee_rate, wageRow.unit) ?? 0 : 0;

  const items: MonthlyIncomeItem[] = [];
  for (const g of STABLE_INCOME_GROUPS) {
    // แถวที่เข้ากลุ่มเดียวกันหลายแถว (เช่น "ค่ารถ" กับ "ค่ารถ (อัตรา 1)") เอาก้อนที่มากสุด
    // ไม่ใช่บวกกัน — ของจริงคือเรตเดียวกันที่ตั้งไว้หลายแบบให้ไซต์เลือกใช้
    let best = 0;
    for (const r of rates) {
      if (r.is_wage || !g.test.test(r.fee_name)) continue;
      const monthly = toMonthlyAmount(r.fee_rate, r.unit);
      if (monthly !== null && monthly > best) best = monthly;
    }
    if (best > 0) items.push({ label: g.label, monthly: Math.round(best) });
  }

  const total = base > 0 ? Math.round(base) + items.reduce((sum, i) => sum + i.monthly, 0) : 0;
  return { base: Math.round(base), items, total };
}

/**
 * ดึงอัตราของหลายใบขอในคิวรีเดียว (อ่านอย่างเดียว) — คีย์ = เลขที่ใบขอ (request_no)
 * ล้ม = คืน map ว่าง (ผู้เรียกเสิร์ฟต่อแบบไม่มีข้อมูลเสริม — ERP ล่มห้ามทำให้คิวหยุด)
 */
export async function fetchJobBenefitRates(
  requestNos: string[],
): Promise<Map<string, JobBenefitRate[]>> {
  const byNo = new Map<string, JobBenefitRate[]>();
  const nos = [...new Set(requestNos.map((s) => (s || '').trim()).filter(Boolean))];
  if (nos.length === 0) return byNo;
  // mssql ไม่มี array param — ประกอบ IN ด้วย placeholder ต่อค่า (ห้ามต่อสตริงค่าดิบ)
  const placeholders = nos.map((_, i) => `@p${i}`).join(', ');
  const params = Object.fromEntries(nos.map((v, i) => [`p${i}`, v]));
  const rows = await siamrajSqlQuery<{
    request_no: string;
    fee_name: string;
    fee_rate: number;
    unit: string | null;
    is_wage: string | null;
  }>(
    `SELECT RTRIM(C.request_no) as request_no, RTRIM(F.fee_name) as fee_name, C.payment_rate as fee_rate,
            RTRIM(ISNULL(F.fee_unit_code_1, '')) as unit, RTRIM(C.is_wage) as is_wage
       FROM st_request_p3_rate C
       LEFT JOIN wg2_ms_fee F
         ON F.fee_codex = (C.withdraw_type_code + C.income1_code + C.income2_code + C.fee_code)
      WHERE C.request_no IN (${placeholders})
        AND RTRIM(ISNULL(F.what_side, '')) <> '2'`,
    params,
  );
  for (const r of rows) {
    if (!r.fee_name) continue;
    const list = byNo.get(r.request_no) ?? [];
    list.push({
      fee_name: r.fee_name,
      fee_rate: Number(r.fee_rate),
      unit: r.unit || null,
      is_wage: (r.is_wage || '').trim().toUpperCase() === 'Y',
    });
    byNo.set(r.request_no, list);
  }
  return byNo;
}

/** ประโยคสำหรับ AI พูด (คีย์ = เลขที่ใบขอ) — ใบที่ไม่มีอะไรพูด ไม่มีคีย์ */
export async function fetchJobBenefitLines(
  requestNos: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const [no, list] of await fetchJobBenefitRates(requestNos)) {
    const line = speakableBenefitLine(list);
    if (line) out.set(no, line);
  }
  return out;
}

/**
 * รายได้ต่อเดือนของหลายใบขอ (คีย์ = เลขที่ใบขอ) — **error-safe** เหมือนชิป
 * ใบที่คิดไม่ได้ (ไม่มีแถวค่าแรงหลัก) จะไม่มีคีย์ ผู้เรียกต้องถอยไปใช้เลขเดิม
 */
/**
 * @deprecated คีย์ด้วย**เลขที่ใบเปล่า** — ใช้กับใบขอล่วงหน้าไม่ได้ (เลขซ้ำกันจริง 23 ใบ)
 * ของใหม่คือ `fetchMonthlyIncomesById` ที่คีย์ด้วย id เต็ม
 */
export async function fetchMonthlyIncomes(
  requestNos: string[],
): Promise<Map<string, MonthlyIncome>> {
  const out = new Map<string, MonthlyIncome>();
  try {
    for (const [no, list] of await fetchJobBenefitRates(requestNos)) {
      const income = monthlyGuaranteedIncome(list);
      if (income.total > 0) out.set(no, income);
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * ชิปสำหรับ **หน้าสมัครสาธารณะ** — กติกาเดียวกับประโยคที่ AI พูด
 * ⚠️ **error-safe**: ERP ล่ม/ยังไม่ตั้งค่า → คืน map ว่าง ไม่ throw
 * (หน้าประกาศงานสาธารณะห้ามล่มเพราะข้อมูลเสริม — คนจริงกำลังจะสมัคร)
 */
/**
 * @deprecated คีย์ด้วย**เลขที่ใบเปล่า** — ใช้ `fetchJobBenefitChipsById` แทน
 */
export async function fetchJobBenefitChips(
  requestNos: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  try {
    for (const [no, list] of await fetchJobBenefitRates(requestNos)) {
      const chips = speakableBenefitChips(list);
      if (chips.length > 0) out.set(no, chips);
    }
  } catch {
    return out;
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

/**
 * แยก job id/job_ref เป็น "เลขที่ใบ + มาจากตารางไหน" (17 ส.ค. 2569)
 *
 * 🔴 ใบขอจริงกับใบขอล่วงหน้า **เก็บอัตราคนละตาราง** (`st_request_p3_rate` vs
 * `st_prequest_p3_rate`) และเลขที่ใบ**ซ้ำกันได้** — ถามผิดตารางคือได้เลขของอีกใบ
 * มาโชว์โดยไม่มีใครรู้ จึงต้องพก prefix ไปด้วยเสมอ ห้ามส่งแค่เลขที่ใบเปล่า ๆ
 */
export function parseJobRef(jobRef: string): { no: string; prequest: boolean } | null {
  const s = (jobRef || '').trim();
  for (const [prefix, prequest] of [
    ['siamraj-sql:', false],
    ['siamraj-pre:', true],
  ] as const) {
    if (s.startsWith(prefix)) {
      const no = s.slice(prefix.length).trim();
      return no ? { no, prequest } : null;
    }
  }
  return null;
}

/**
 * อัตราของ **ใบขอล่วงหน้า** — โครงเดียวกับ `fetchJobBenefitRates` ทุกอย่าง
 * (whitelist · หน่วย · ตัดฝั่งหัก `what_side='2'` · ใช้อัตราจ่ายเท่านั้น)
 * ⚠️ คอลัมน์อัตราของตารางนี้ชื่อ `fee_rate` ไม่ใช่ `payment_rate` (ตาราง prequest
 * ไม่มีคอลัมน์ `payment_rate` เลย) · `draw_rate` มีอยู่แต่ **ห้าม select** เหมือนกัน
 */
export async function fetchPrequestBenefitRates(
  prequestNos: string[],
): Promise<Map<string, JobBenefitRate[]>> {
  const byNo = new Map<string, JobBenefitRate[]>();
  const nos = [...new Set(prequestNos.map((s) => (s || '').trim()).filter(Boolean))];
  if (nos.length === 0) return byNo;
  const placeholders = nos.map((_, i) => `@q${i}`).join(', ');
  const params = Object.fromEntries(nos.map((v, i) => [`q${i}`, v]));
  const rows = await siamrajSqlQuery<{
    prequest_no: string;
    fee_name: string;
    fee_rate: number;
    unit: string | null;
    is_wage: string | null;
  }>(
    `SELECT RTRIM(C.prequest_no) as prequest_no, RTRIM(F.fee_name) as fee_name, C.fee_rate as fee_rate,
            RTRIM(ISNULL(F.fee_unit_code_1, '')) as unit, RTRIM(C.is_wage) as is_wage
       FROM st_prequest_p3_rate C
       LEFT JOIN wg2_ms_fee F
         ON F.fee_codex = (C.withdraw_type_code + C.income1_code + C.income2_code + C.fee_code)
      WHERE C.prequest_no IN (${placeholders})
        AND RTRIM(ISNULL(F.what_side, '')) <> '2'`,
    params,
  );
  for (const r of rows) {
    if (!r.fee_name) continue;
    const list = byNo.get(r.prequest_no) ?? [];
    list.push({
      fee_name: r.fee_name,
      fee_rate: Number(r.fee_rate),
      unit: r.unit || null,
      is_wage: (r.is_wage || '').trim().toUpperCase() === 'Y',
    });
    byNo.set(r.prequest_no, list);
  }
  return byNo;
}

/**
 * ดึงอัตราของทั้งใบจริงและใบล่วงหน้าในรอบเดียว — คีย์ผลลัพธ์เป็น **id เต็ม**
 * (`siamraj-sql:X` / `siamraj-pre:X`) ไม่ใช่เลขที่ใบเปล่า เพราะเลขซ้ำกันได้
 * ⚠️ error-safe: ฝั่งไหนล้มก็คืนเท่าที่ได้ (ข้อมูลเสริม ห้ามทำให้หน้าหลักพัง)
 */
export async function fetchBenefitRatesByJobId(
  jobIds: string[],
): Promise<Map<string, JobBenefitRate[]>> {
  const out = new Map<string, JobBenefitRate[]>();
  const real: string[] = [];
  const pre: string[] = [];
  const refs = new Map<string, { no: string; prequest: boolean }>();
  for (const id of jobIds) {
    const parsed = parseJobRef(id);
    if (!parsed) continue;
    refs.set(id, parsed);
    (parsed.prequest ? pre : real).push(parsed.no);
  }
  const [realRates, preRates] = await Promise.all([
    real.length > 0 ? fetchJobBenefitRates(real).catch(() => new Map()) : new Map(),
    pre.length > 0 ? fetchPrequestBenefitRates(pre).catch(() => new Map()) : new Map(),
  ]);
  for (const [id, { no, prequest }] of refs) {
    const hit = (prequest ? preRates : realRates).get(no);
    if (hit && hit.length > 0) out.set(id, hit);
  }
  return out;
}

/**
 * ชิปสวัสดิการ + รายได้ต่อเดือน แบบคีย์ด้วย **id เต็ม** (17 ส.ค. 2569)
 *
 * 🔴 ตัวเดิมคีย์ด้วย**เลขที่ใบเปล่า** ซึ่งใช้กับใบขอล่วงหน้าไม่ได้ — เลขที่ใบของสองระบบ
 * ซ้ำกันจริง 23 ใบ (เช่น `LBM6907002` เป็นทั้งใบล่วงหน้าของแคททาเลอร์ และใบขอปกติ
 * ของ รพ.เปาโล) ถามด้วยเลขเปล่าคือมีโอกาสได้อัตราของอีกบริษัทมาโชว์บนประกาศ
 *
 * ⚠️ error-safe เหมือนตัวเดิมทุกอย่าง — ERP ล่ม = คืน map ว่าง ประกาศยังขึ้นครบ
 */
export async function fetchJobBenefitChipsById(jobIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  try {
    for (const [id, list] of await fetchBenefitRatesByJobId(jobIds)) {
      const chips = speakableBenefitChips(list);
      if (chips.length > 0) out.set(id, chips);
    }
  } catch {
    return out;
  }
  return out;
}

export async function fetchMonthlyIncomesById(jobIds: string[]): Promise<Map<string, MonthlyIncome>> {
  const out = new Map<string, MonthlyIncome>();
  try {
    for (const [id, list] of await fetchBenefitRatesByJobId(jobIds)) {
      const income = monthlyGuaranteedIncome(list);
      if (income.total > 0) out.set(id, income);
    }
  } catch {
    return out;
  }
  return out;
}
