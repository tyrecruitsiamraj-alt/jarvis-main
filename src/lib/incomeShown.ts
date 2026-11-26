/**
 * ═══ รายได้รวม หรือ รายได้เฉลี่ย — เลือกทีละใบขอ (เจ้าของ Choice 14 ต.ค. 2569) ═══
 *
 * > *"สามารถเลือกได้ไหมว่าจะให้โชว์ รายได้รวมหรือเฉลี่ย"* · *"แต่ยังไงก็ต้องบอกฐานเงินเดือนนะ"*
 * Choice: "เลือกทีละใบขอ" (รวม / เฉลี่ย / ทั้งสอง · ค่าเริ่ม = ทั้งสอง เหมือนเดิม) · "AI ต้องตาม"
 *
 * - เก็บที่ `field_overrides.income_shown` ('total' | 'average' · ไม่มี = รายได้รวม)
 * 🔴 15 ต.ค. 2569 เจ้าของ: "เอาตัวเลขมาโชว์เลย แล้วมีให้เลือกว่า รายได้รวมเท่าไหร่ รายได้เฉลี่ยเท่าไหร่ เลือกอันไหนก็โชว์แค่นั้น"
 *    ⇒ ถอดตัวเลือก "ทั้งสอง" · ปุ่มบอกตัวเลข · ใบที่ไม่เคยเลือก = รายได้รวม (Choice) — ใบเดิมที่เคยขึ้นสองบรรทัดเหลือบรรทัดเดียว
 * - 🔴 ฐานเงินเดือนไม่อยู่ในตัวเลือกนี้ — ขึ้นเสมอ (ติ๊กซ่อน "ฐานเงินเดือน / รายได้" ยังเป็นเรื่องของ `public_visibility`)
 * - ตัวที่เลือกไม่มีข้อมูล (เช่น เลือกเฉลี่ยแต่ไม่มี eSlip คนเก่า) = ใช้อีกตัว — บรรทัดเงินไม่หายเงียบ
 * - ใช้ทั้งการ์ด (`JobPublicFacts`) · หน้าสาธารณะ (`api/_handlers/public/jobs.ts`) · บท AI (`api/_lib/applyScriptFacts.ts`)
 */
export type IncomeShown = 'total' | 'average';

export const INCOME_SHOWN_OPTIONS: ReadonlyArray<{ value: IncomeShown; label: string }> = [
  { value: 'total', label: 'รายได้รวม' },
  { value: 'average', label: 'รายได้เฉลี่ย' },
];

export function incomeShownOf(fo: { income_shown?: string | null } | null | undefined): IncomeShown {
  return fo?.income_shown === 'average' ? 'average' : 'total';
}

/**
 * ═══ รายได้เฉลี่ยต่ำกว่าฐานเงินเดือน (เจ้าของ Choice 27 พ.ย. 2569 "รายได้เฉลี่ยต่ำกว่าฐาน = ไม่พูด") ═══
 * เฉลี่ยมาจากสลิปคนเก่า (สุทธิ · เดือนที่ทำไม่เต็มก็ดึงลง) — LAO6911017 เฉลี่ย 9,180 ฐาน 14,000
 * AI พูด "รายได้ประมาณ 9,180 ฐานเงินเดือน 14,000" ผู้สมัครงง ⇒ เลือกเฉลี่ยไว้แต่ต่ำกว่าฐาน = บอกแค่ฐาน (AI + การ์ด)
 * ไม่รู้ฐาน = ตัดสินไม่ได้ ใช้เฉลี่ยตามเดิม
 */
export function averageBelowBase(average: number | null | undefined, base: number | null | undefined): boolean {
  const a = Number(average);
  const b = Number(base);
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && a < b;
}

/** บรรทัดไหนขึ้นจริง — ตัวที่เลือกไม่มีข้อมูล = ใช้อีกตัว · เลือกเฉลี่ยแต่ต่ำกว่าฐาน = ไม่ขึ้นทั้งคู่ (เหลือฐาน) */
export function incomeLinesShown(
  shown: IncomeShown,
  has: { total: boolean; average: boolean; averageBelowBase?: boolean },
): { total: boolean; average: boolean } {
  if (shown === 'average' && has.average && has.averageBelowBase) return { total: false, average: false };
  if (shown === 'total') return has.total ? { total: true, average: false } : { total: false, average: has.average };
  return has.average ? { total: false, average: true } : { total: has.total, average: false };
}

/**
 * เลขรายได้ต่อเดือนที่ AI พูด — เลือกเฉลี่ยและมีเฉลี่ย = เฉลี่ย · ที่เหลือ = รายได้รวมตามเดิม
 * เลือกเฉลี่ยแต่ต่ำกว่าฐาน (`averageBelowBase`) = null — ผู้เรียกพูดแค่ฐาน
 */
export function spokenMonthlyIncome(
  shown: IncomeShown,
  total: number | null,
  average: number | null,
  base?: number | null,
): number | null {
  if (shown === 'average' && average !== null && average > 0) return averageBelowBase(average, base) ? null : average;
  return total;
}
