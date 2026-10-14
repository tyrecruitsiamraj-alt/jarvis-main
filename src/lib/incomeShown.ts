/**
 * ═══ รายได้รวม หรือ รายได้เฉลี่ย — เลือกทีละใบขอ (เจ้าของ Choice 14 ต.ค. 2569) ═══
 *
 * > *"สามารถเลือกได้ไหมว่าจะให้โชว์ รายได้รวมหรือเฉลี่ย"* · *"แต่ยังไงก็ต้องบอกฐานเงินเดือนนะ"*
 * Choice: "เลือกทีละใบขอ" (รวม / เฉลี่ย / ทั้งสอง · ค่าเริ่ม = ทั้งสอง เหมือนเดิม) · "AI ต้องตาม"
 *
 * - เก็บที่ `field_overrides.income_shown` ('total' | 'average' · ไม่มี = ทั้งสอง)
 * - 🔴 ฐานเงินเดือนไม่อยู่ในตัวเลือกนี้ — ขึ้นเสมอ (ติ๊กซ่อน "ฐานเงินเดือน / รายได้" ยังเป็นเรื่องของ `public_visibility`)
 * - ตัวที่เลือกไม่มีข้อมูล (เช่น เลือกเฉลี่ยแต่ไม่มี eSlip คนเก่า) = ใช้อีกตัว — บรรทัดเงินไม่หายเงียบ
 * - ใช้ทั้งการ์ด (`JobPublicFacts`) · หน้าสาธารณะ (`api/_handlers/public/jobs.ts`) · บท AI (`api/_lib/applyScriptFacts.ts`)
 */
export type IncomeShown = 'both' | 'total' | 'average';

export const INCOME_SHOWN_OPTIONS: ReadonlyArray<{ value: IncomeShown; label: string }> = [
  { value: 'both', label: 'ทั้งสอง' },
  { value: 'total', label: 'รายได้รวม' },
  { value: 'average', label: 'รายได้เฉลี่ย' },
];

export function incomeShownOf(fo: { income_shown?: string | null } | null | undefined): IncomeShown {
  const v = fo?.income_shown;
  return v === 'total' || v === 'average' ? v : 'both';
}

/** บรรทัดไหนขึ้นจริง — ตัวที่เลือกไม่มีข้อมูล = ใช้อีกตัว */
export function incomeLinesShown(
  shown: IncomeShown,
  has: { total: boolean; average: boolean },
): { total: boolean; average: boolean } {
  if (shown === 'total') return has.total ? { total: true, average: false } : { total: false, average: has.average };
  if (shown === 'average') return has.average ? { total: false, average: true } : { total: has.total, average: false };
  return { total: has.total, average: has.average };
}

/** เลขรายได้ต่อเดือนที่ AI พูด — เลือกเฉลี่ยและมีเฉลี่ย = เฉลี่ย · ที่เหลือ = รายได้รวมตามเดิม */
export function spokenMonthlyIncome(shown: IncomeShown, total: number | null, average: number | null): number | null {
  if (shown === 'average' && average !== null && average > 0) return average;
  return total;
}
