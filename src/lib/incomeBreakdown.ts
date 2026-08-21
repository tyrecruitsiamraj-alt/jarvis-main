/**
 * รายได้แบบแยกส่วนบนประกาศ — **ตรรกะล้วน** (เจ้าของสั่ง 20 ส.ค. 2569)
 *
 * โจทย์: *"เลือกได้ว่าเอาอะไรโชว์บ้าง เลือกได้ว่าคิดเป็นรายวันหรือรายเดือน พอรวมเสร็จ
 * ปรับยอดรวมได้ … เลือกฐานเงินเดือน เบี้ยขยัน ค่าโทรศัพท์ รวมได้ 18,000 แต่อยากใส่
 * 20,000 ก็ใส่ไป แล้วผู้สมัครเห็นว่าฐานเท่าไหร่ เบี้ยขยันเท่าไหร่ รวมเท่าไหร่"*
 *
 * 🔴 กติกาที่เจ้าของเคาะ (ถามเป็น Choice แล้ว):
 *   1. ยอดรวมที่ใส่เอง **มากกว่า**ผลบวก → เติมบรรทัด **"อื่น ๆ (เช่น OT)"** = ส่วนต่าง
 *      ให้เลข balance เสมอ — ผู้สมัครบวกเลขเองได้ ถ้าไม่ตรงจะรู้สึกโดนหลอกทั้งประกาศ
 *   2. ยอดรวมที่ใส่เอง **น้อยกว่า**ผลบวก → ไม่ยอมรับ ใช้ผลบวกแทน (เลขห้ามโกหกลงด้วย)
 *   3. หน่วยเลือกได้ทั้งประกาศ: รายวัน หรือ รายเดือน — ห้ามปนกันในรายการเดียว
 *
 * ⚠️ ตัวเลขชุดนี้**ทับเฉพาะที่โชว์บนประกาศ** — ไม่แตะอัตราจ่าย ERP และไม่ใช่ตัวที่
 * AI ใช้คิดค่าแรง (ขอบเขตเดียวกับ `total_income` override เดิม)
 */

export const INCOME_PERIODS = ['daily', 'monthly'] as const;
export type IncomePeriod = (typeof INCOME_PERIODS)[number];

export const INCOME_PERIOD_LABEL: Record<IncomePeriod, string> = {
  daily: 'ต่อวัน',
  monthly: 'ต่อเดือน',
};

/** รายการรายได้ 1 บรรทัด — label พิมพ์เองได้ (มีชุดแนะนำให้กดเลือก) */
export type IncomeLine = { label: string; amount: number };

export type IncomeBreakdown = {
  period: IncomePeriod;
  lines: IncomeLine[];
  /** ยอดรวมที่ใส่เอง · null = ใช้ผลบวกของรายการ */
  total: number | null;
};

/** ชื่อรายการที่ใช้บ่อย — กดเลือกได้เร็ว ๆ (พิมพ์เองก็ได้ ไม่บังคับ) */
export const SUGGESTED_INCOME_LABELS: readonly string[] = [
  'ฐานเงินเดือน',
  'ค่าแรงรายวัน',
  'เบี้ยขยัน',
  'ค่าโทรศัพท์',
  'ค่าครองชีพ',
  'ค่าตำแหน่ง',
  'ค่าเดินทาง/ค่ารถ',
  'ค่าอาหาร',
  'ค่ากะ',
  'ค่าภาษา',
];

/** เพดานกันข้อมูลบวม — sanitizer ฝั่ง API ใช้ชุดเดียวกัน */
export const INCOME_LINE_MAX = 10;
export const INCOME_LABEL_MAX = 30;
/** ป้ายบรรทัดส่วนต่างที่ระบบเติมเอง */
export const INCOME_OTHER_LABEL = 'อื่น ๆ (เช่น OT)';

/** สวัสดิการแบบพิมพ์เอง — เจ้าของเคาะ "Freetext ล้วน จำกัดจำนวน" (20 ส.ค. 2569) */
export const BENEFIT_LINE_MAX = 5;
export const BENEFIT_LABEL_MAX = 30;

export function isIncomePeriod(v: unknown): v is IncomePeriod {
  return v === 'daily' || v === 'monthly';
}

/**
 * ล้างรายการรายได้จากฟอร์ม/ฐาน — ตัดบรรทัดว่าง · ตัดความยาว · เลขติดลบ/เพี้ยนทิ้ง
 * คืน [] เมื่อไม่มีอะไรเหลือ (ผู้เรียกตีความว่า "ไม่ได้ตั้ง breakdown")
 */
export function normalizeIncomeLines(raw: unknown): IncomeLine[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomeLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim().slice(0, INCOME_LABEL_MAX) : '';
    const amount = Number(r.amount);
    if (!label || !Number.isFinite(amount) || amount <= 0) continue;
    out.push({ label, amount: Math.trunc(amount) });
    if (out.length >= INCOME_LINE_MAX) break;
  }
  return out;
}

export function sumIncomeLines(lines: readonly IncomeLine[]): number {
  return lines.reduce((s, l) => s + l.amount, 0);
}

export type IncomeDisplay = {
  period: IncomePeriod;
  /** รายการที่ผู้สมัครเห็น — รวมบรรทัด "อื่น ๆ" ที่ระบบเติมแล้ว (ถ้ามี) */
  lines: IncomeLine[];
  /** ยอดรวมที่ผู้สมัครเห็น — เท่ากับผลบวกของ `lines` เสมอ (กติกาข้อ 1-2) */
  total: number;
};

/**
 * แปลง breakdown ที่เจ้าหน้าที่ตั้ง → สิ่งที่ผู้สมัครเห็น
 * 🔴 ผลลัพธ์ **balance เสมอ**: total = ผลบวกของ lines ทุกกรณี
 * คืน null เมื่อไม่มีรายการเลย (ผู้เรียกถอยไปใช้การแสดงรายได้แบบเดิม)
 */
export function buildIncomeDisplay(b: IncomeBreakdown | null | undefined): IncomeDisplay | null {
  if (!b) return null;
  const lines = normalizeIncomeLines(b.lines);
  if (lines.length === 0) return null;
  const sum = sumIncomeLines(lines);
  const period: IncomePeriod = isIncomePeriod(b.period) ? b.period : 'monthly';

  const override = b.total;
  if (typeof override === 'number' && Number.isFinite(override) && Math.trunc(override) > sum) {
    const diff = Math.trunc(override) - sum;
    return {
      period,
      lines: [...lines, { label: INCOME_OTHER_LABEL, amount: diff }],
      total: Math.trunc(override),
    };
  }
  // override ว่าง / เท่ากับ / น้อยกว่าผลบวก → ใช้ผลบวก (เลขห้ามโกหกลง)
  return { period, lines, total: sum };
}

/** ล้าง breakdown ทั้งก้อน (ใช้ทั้งฟอร์มก่อนบันทึกและ sanitizer ฝั่ง API) · null = ไม่ได้ตั้ง */
export function cleanIncomeBreakdown(v: unknown): IncomeBreakdown | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const lines = normalizeIncomeLines(o.lines);
  if (lines.length === 0) return null;
  const totalRaw = Number(o.total);
  const total = Number.isFinite(totalRaw) && totalRaw > 0 ? Math.trunc(totalRaw) : null;
  return {
    period: isIncomePeriod(o.period) ? o.period : 'monthly',
    lines,
    total,
  };
}

/**
 * ล้างสวัสดิการแบบพิมพ์เอง — ตัดว่าง/ซ้ำ · จำกัด 5 รายการ × 30 ตัวอักษร
 * (เจ้าของ: *"เปลี่ยนเป็น Freetext ที่จำกัดการใส่ ไม่งั้นเยอะเกิน"*)
 */
export function cleanBenefitLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim().slice(0, BENEFIT_LABEL_MAX);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= BENEFIT_LINE_MAX) break;
  }
  return out;
}
