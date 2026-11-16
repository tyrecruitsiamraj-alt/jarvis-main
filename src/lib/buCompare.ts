/**
 * ═══ เทียบ BU (เจ้าของ 16 พ.ย. 2569) ═══
 * > *"จะรู้ได้ไง BU ไหนเข้ามาเยอะ เข้ามาแล้วติดตรงไหน เทียบทุก Bu ได้ ดูแยก Bu ได้ · ตอนนี้ฉันรู้แค่ชื่อเข้าพันกว่า
 * > ต้องกดแยกดู แล้วบวกลบเอง แต่ระบบควรบอกทั้งหมด"*
 * แถวละ BU + แถวรวม · ขั้นเดียวกับ Journey งานสรรหา (`buildRecruitJourney` — นิยามเดียวกับการ์ดอื่นในภาพรวม)
 * % = เทียบกับขั้นก่อนหน้า (ดูได้ว่าติดขั้นไหน) · ทุกแถวรวมกัน = แถวรวม (ใบที่ไม่รู้ BU มีแถวของตัวเอง ไม่หาย)
 */
import { APP_DEPARTMENT_CODES } from './departmentCodes';
import { buildRecruitJourney } from './recruitJourney';
import type { RecruitAppFact } from './recruitOverviewTypes';

export type BuCompareKey = 'names' | 'aiCalled' | 'aiYes' | 'staffCalled' | 'staffOk' | 'booked' | 'showed';

/** `of` = ขั้นที่ใช้เป็นฐานของ % (ขั้นก่อนหน้า) */
export const BU_COMPARE_COLUMNS: ReadonlyArray<{ key: BuCompareKey; label: string; of: BuCompareKey | null }> = [
  { key: 'names', label: 'รายชื่อเข้า', of: null },
  { key: 'aiCalled', label: 'AI โทรแล้ว', of: 'names' },
  { key: 'aiYes', label: 'สนใจ', of: 'aiCalled' },
  { key: 'staffCalled', label: 'คนโทรแล้ว', of: 'aiYes' },
  { key: 'staffOk', label: 'ติดต่อได้', of: 'staffCalled' },
  { key: 'booked', label: 'นัดได้', of: 'staffOk' },
  { key: 'showed', label: 'มา', of: 'booked' },
];

export type BuCompareCell = { value: number; ids: string[] };
export type BuCompareRow = { key: string; label: string; cells: Record<BuCompareKey, BuCompareCell> };

export const BU_UNKNOWN_LABEL = 'ไม่รู้ BU';
const UNKNOWN = '__none__';

function rowOf(key: string, label: string, list: readonly RecruitAppFact[]): BuCompareRow {
  const steps = buildRecruitJourney(list);
  const partOf = (step: string, ...keys: string[]): BuCompareCell => {
    const parts = steps.find((s) => s.key === step)?.parts.filter((p) => keys.includes(p.key)) ?? [];
    return { value: parts.reduce((n, p) => n + p.value, 0), ids: parts.flatMap((p) => p.ids) };
  };
  return {
    key,
    label,
    cells: {
      names: { value: list.length, ids: list.map((f) => f.id).filter((v): v is string => Boolean(v)) },
      aiCalled: partOf('names', 'aiCalled'),
      aiYes: partOf('ai', 'yes'),
      staffCalled: partOf('staff', 'ok', 'fail'),
      staffOk: partOf('staff', 'ok'),
      booked: partOf('appointment', 'booked'),
      showed: partOf('attendance', 'showed'),
    },
  };
}

/**
 * แถวต่อ BU ตามลำดับ SN · DS · LM · LBA · LBD (BU ที่ไม่มีรายชื่อยังขึ้น 0 — ว่างแล้วห้ามหาย) · BU อื่นที่ไม่อยู่ในรายการต่อท้าย
 * `only` = BU ที่จะโชว์ (ผู้ใช้ BU เดียว/เลือก BU อยู่) · null = ทุก BU
 */
export function buildBuCompare(cohort: readonly RecruitAppFact[], only: readonly string[] | null = null): { rows: BuCompareRow[]; total: BuCompareRow } {
  const by = new Map<string, RecruitAppFact[]>();
  for (const f of cohort) {
    const k = (f.bu ?? '').trim().toUpperCase() || UNKNOWN;
    const list = by.get(k) ?? [];
    list.push(f);
    by.set(k, list);
  }
  const base = (only ?? APP_DEPARTMENT_CODES).map((c) => c.toUpperCase());
  const extra = [...by.keys()].filter((k) => k !== UNKNOWN && !base.includes(k)).sort();
  const keys = [...base, ...extra, ...(by.has(UNKNOWN) ? [UNKNOWN] : [])];
  return {
    rows: keys.map((k) => rowOf(k, k === UNKNOWN ? BU_UNKNOWN_LABEL : k, by.get(k) ?? [])),
    total: rowOf('total', 'รวม', cohort),
  };
}

/** % ของขั้นก่อนหน้า · ฐาน 0 = null (ไม่มีให้เทียบ) */
export function buComparePct(row: BuCompareRow, key: BuCompareKey): number | null {
  const of = BU_COMPARE_COLUMNS.find((c) => c.key === key)?.of;
  if (!of) return null;
  const base = row.cells[of].value;
  return base > 0 ? Math.round((row.cells[key].value / base) * 100) : null;
}
