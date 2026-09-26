/**
 * ═══ ตัวกรองแถบซ้ายของกล่องงาน (แบบ iRecruit) — ตรรกะล้วน ═══
 *
 * เจ้าของสั่ง 26 ก.ย. 2569 (แผนเต็ม `docs/plan-board-irecruit-filter-2569-09-26.md`):
 * > *"ต้องการแค่หลักการทำงานและหน้าตา แต่ต้องแบ่งเป็นกล่อง ๆ การ์ด … แต่ข้อดี iRecruit
 * > คือมัน Filter ได้ครอบคลุมกว่า"*
 *
 * ไฟล์นี้ตัดสินทุกอย่างของแถบกรอง — จอแค่วาดตามที่คืนไป:
 * - ใบไหนผ่าน (`applyBoardFilters`) — **OR ในหัวข้อเดียวกัน · AND ข้ามหัวข้อ**
 * - เลขต่อท้ายแต่ละตัวเลือก (`buildBoardFacets`) — นับจากชุดที่ผ่าน **หัวข้ออื่น** แล้ว
 *   (แบบ iRecruit: เลือกจังหวัดแล้วเลขของจังหวัดอื่นไม่หายไปเป็น 0 ทั้งแถว)
 * - หัวข้อไหนต้องซ่อน — **ห้ามปุ่มหลอก** (กติกาในแผน): ข้อมูลจริงมีค่าเดียวหรือไม่มีเลย
 *   = ไม่โชว์หัวข้อนั้น · วัดจริง 26 ก.ย.: ใบขอ 316 ใบเป็น "ล่วงหน้า" ทั้งหมด ⇒ หัวข้อ
 *   ความเร่งด่วนหายไปเอง และจะกลับมาเองเมื่อมีใบด่วนจริง
 * - อ่าน/เขียน URL (`readBoardFilterState` / `writeBoardFilterState`) — ต่อยอดจาก params เดิม
 *   **ห้ามทำ `?view=` `?lane=` `?step=` หาย**
 *
 * 🔴 **ไม่แตะฐานข้อมูล** — ทุกอย่างคิดจากของที่หน้าโหลดมาแล้ว (ใบขอ + ยอดผู้สมัคร/Lead +
 * ทะเบียนปล่อย + ยอดส่ง AI) ผ่าน `BoardFacetFacts`
 */
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS } from '@/types';
import { publicJobPositionLabel } from './unitRequestDisplay';
import { extractJobSubtypeLabel } from './siamrajUnitFilters';
import { inferProvinceFromAddress } from './parseThaiJobAddress';
import { districtMatchesFilter } from './districtMatch';
import { getDistrictOptionsForProvince } from './thaiDistricts';
import { UNIT_SECTOR_LABEL } from './unitSector';
import { incomeDisplay } from './incomeLabel';
import { formatYmdDmyBe } from './dateTh';

/** คำกลางของ "ไม่มีข้อมูลช่องนี้" — ให้กดกรองได้ (กติกาในแผน: ฟิลด์ไม่มีค่า = มีค่า "ไม่ระบุ") */
export const UNSPECIFIED = '__none__';

export type BoardFacetKey =
  | 'applicants'
  | 'release'
  | 'urgency'
  | 'ai'
  | 'jobType'
  | 'position'
  | 'subtype'
  | 'unit'
  | 'province'
  | 'district'
  | 'sector'
  | 'gender'
  | 'age'
  | 'income'
  | 'recruiter'
  | 'contract';

/** ของที่หน้าโหลดไว้แล้ว — `null` = เส้นนั้นยังไม่พร้อม (หัวข้อที่พึ่งมันต้องไม่โผล่) */
export type BoardFacetFacts = {
  /**
   * ยอดผู้สมัคร/Lead โหลดมาแล้วหรือยัง — 🔴 ยังไม่มา = ทุกใบจะตอบ 0 แล้วหัวข้อ
   * "จำนวนผู้สมัคร" จะบอกว่า "ยังไม่มีคนสมัคร" ทั้งกอง ซึ่งดูเหมือนเลขจริง ⇒ ต้องไม่โผล่
   */
  countsReady: boolean;
  applicants: (job: JobRequest) => number;
  leads: (job: JobRequest) => number;
  /**
   * 🔴 ต้องเป็น `null` จนกว่าทะเบียนลิงก์/การปล่อยจะโหลดครบ — ก่อนหน้านั้นทุกใบจะตอบ false
   * แล้วหัวข้อนี้จะบอกว่า "ยังไม่ปล่อย" ทั้งกอง ซึ่งดูเหมือนเลขจริง (บทเรียนหัวกล่องงานขึ้น 0)
   */
  isReleased: ((job: JobRequest) => boolean) | null;
  /** จำนวนคนที่ส่งให้ AI โทรแล้ว — `null` = ยังไม่ได้โหลดยอดเลย */
  aiSent: ((job: JobRequest) => number) | null;
};

export type BoardDateField = 'required' | 'request';
export type BoardDateRange = { field: BoardDateField; from: string; to: string };

export type BoardFilterState = {
  /** ค่าที่ติ๊กไว้ต่อหัวข้อ — ไม่มีคีย์/อาร์เรย์ว่าง = ไม่กรองหัวข้อนั้น */
  selection: Partial<Record<BoardFacetKey, string[]>>;
  /** ช่วงวันที่ (แถบบน) — `null` = ไม่กรอง · ว่างข้างหนึ่งได้ (ตั้งแต่…/ถึง…) */
  dates: BoardDateRange | null;
};

export const EMPTY_BOARD_FILTER_STATE: BoardFilterState = { selection: {}, dates: null };

type FacetUi = 'chip' | 'check';

type FacetDef = {
  key: BoardFacetKey;
  label: string;
  ui: FacetUi;
  /** หัวข้อค่าเยอะ — มีช่องค้นหาในหัวข้อ */
  searchable?: boolean;
  /** ลำดับตายตัวของตัวเลือก (หัวข้อ enum) — ไม่มี = เรียงตามจำนวนใบ */
  order?: readonly string[];
  /** คำบนจอของค่า — ไม่มี = ใช้ค่านั้นเป็นคำ */
  labelOf?: (value: string) => string;
  /** หัวข้อนี้พร้อมโชว์ไหม (ขึ้นกับเส้นข้อมูล) */
  available?: (facts: BoardFacetFacts) => boolean;
  /** ใบนี้มีค่าอะไรบ้าง — คืนได้หลายค่า (เช่น "1–4 คน" + "มี Lead") */
  values: (job: JobRequest, facts: BoardFacetFacts, state: BoardFilterState) => string[];
};

const trimOr = (v: unknown): string => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t || UNSPECIFIED;
};

/** ป้ายของ "ไม่ระบุ" ต่อหัวข้อ — บางหัวข้อมีคำเฉพาะที่เจ้าของใช้อยู่แล้ว */
function unspecifiedLabel(key: BoardFacetKey): string {
  if (key === 'recruiter') return 'ไม่มีผู้รับผิดชอบ';
  if (key === 'sector') return 'ยังไม่ระบุ';
  if (key === 'income') return 'ไม่ทราบหน่วย (ดูในใบขอ)';
  return 'ไม่ระบุ';
}

const APPLICANT_LABEL: Record<string, string> = {
  none: 'ยังไม่มีคนสมัคร',
  few: '1–4 คน',
  many: '5 คนขึ้นไป',
  lead: 'มี Lead',
};

const AGE_BANDS: ReadonlyArray<{ id: string; label: string; min: number; max: number }> = [
  { id: '18-25', label: '18–25', min: 18, max: 25 },
  { id: '26-35', label: '26–35', min: 26, max: 35 },
  { id: '36-45', label: '36–45', min: 36, max: 45 },
  { id: '46+', label: '46 ขึ้นไป', min: 46, max: 200 },
];

const INCOME_BANDS: ReadonlyArray<{ id: string; label: string; min: number; max: number }> = [
  { id: 'lt12k', label: 'ต่ำกว่า 12,000', min: 0, max: 11999 },
  { id: '12-15k', label: '12,000–14,999', min: 12000, max: 14999 },
  { id: '15-20k', label: '15,000–19,999', min: 15000, max: 19999 },
  { id: '20k+', label: '20,000 ขึ้นไป', min: 20000, max: Number.MAX_SAFE_INTEGER },
];

/**
 * รายได้ต่อเดือนที่ **รู้หน่วยจริง** — ไม่รู้ = `null`
 *
 * 🔴 ห้ามจัดช่วงจาก `total_income` ดิบ — ERP ปนค่าแรง **ต่อวัน** (400) กับ **ต่อเดือน** (12,000)
 * ในช่องเดียวกัน (วัด 26 ก.ย.: ฟีดรายการไม่มี `monthly_income` เลยสักใบ) ⇒ จัดช่วงตรง ๆ
 * ใบรายวันจะไปตก "ต่ำกว่า 12,000" ทั้งที่ได้เดือนละหมื่นกว่า · ใช้ `incomeDisplay()`
 * ตัวเดียวกับการ์ด แล้วนับเฉพาะที่มันบอกว่าเป็น "ต่อเดือน"
 */
export function knownMonthlyIncome(job: JobRequest): number | null {
  if (job.income_display && job.income_display.period === 'monthly' && job.income_display.total > 0) {
    return job.income_display.total;
  }
  const d = incomeDisplay({ totalIncome: job.total_income, monthlyIncome: job.monthly_income });
  return d && d.period === 'monthly' ? d.amount : null;
}

/**
 * เพศจาก ERP — ใช้กติกาเดียวกับ `formatGenderRequirement` ฝั่ง API
 * ⚠️ รหัส `O` (วัด 26 ก.ย.: 177 จาก 316 ใบ) ไม่มีในตารางแปลงเดิม จึงโชว์ตามที่ ERP ส่งมา
 *    **ไม่เดาความหมายเอง** จนกว่าจะรู้ว่า O แปลว่าอะไร
 */
function genderValue(raw: string | undefined): string {
  const r = (raw ?? '').trim();
  if (!r) return UNSPECIFIED;
  const t = r.toUpperCase();
  if (t === 'M' || t === 'MALE' || r === 'ชาย') return 'ชาย';
  if (t === 'F' || t === 'FEMALE' || r === 'หญิง') return 'หญิง';
  if (t === 'B' || t === 'BOTH' || t === 'ANY' || r === 'ไม่ระบุ') return 'ไม่ระบุ';
  return r;
}

const ymd = (v: string | undefined | null): string => (v ?? '').slice(0, 10);

/**
 * หัวข้อตามลำดับในแผน — **ลำดับนี้คือลำดับบนจอ**
 * `contract` (ประเภทสัญญา) ไม่อยู่ในสเปกของแผนแต่เป็นตัวกรองที่มีอยู่แล้วบนแถบบน
 * ⇒ ย้ายมาอยู่ท้ายสุด (กติกา "เพิ่มได้ ห้ามลด" — ห้ามให้ของเดิมหายระหว่างย้าย)
 */
const FACETS: readonly FacetDef[] = [
  {
    key: 'applicants',
    label: 'จำนวนผู้สมัคร',
    ui: 'chip',
    order: ['none', 'few', 'many', 'lead'],
    labelOf: (v) => APPLICANT_LABEL[v] ?? v,
    available: (facts) => facts.countsReady,
    values: (job, facts) => {
      const n = facts.applicants(job);
      const out = [n <= 0 ? 'none' : n < 5 ? 'few' : 'many'];
      if (facts.leads(job) > 0) out.push('lead');
      return out;
    },
  },
  {
    key: 'release',
    label: 'สถานะประกาศ',
    ui: 'check',
    order: ['released', 'unreleased'],
    labelOf: (v) => (v === 'released' ? 'ปล่อยแล้ว' : 'ยังไม่ปล่อย'),
    available: (facts) => facts.isReleased !== null,
    values: (job, facts) => [facts.isReleased?.(job) ? 'released' : 'unreleased'],
  },
  {
    key: 'urgency',
    label: 'ความเร่งด่วน',
    ui: 'check',
    order: ['urgent', 'advance'],
    labelOf: (v) => (v === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'),
    values: (job) => [job.urgency === 'urgent' ? 'urgent' : 'advance'],
  },
  {
    key: 'ai',
    label: 'AI โทร',
    ui: 'check',
    order: ['sent', 'not_sent'],
    labelOf: (v) => (v === 'sent' ? 'ส่ง AI แล้ว' : 'ยังไม่ส่ง'),
    available: (facts) => facts.aiSent !== null,
    values: (job, facts) => [(facts.aiSent?.(job) ?? 0) > 0 ? 'sent' : 'not_sent'],
  },
  {
    key: 'jobType',
    label: 'ประเภทงาน',
    ui: 'check',
    labelOf: (v) => JOB_TYPE_LABELS[v as keyof typeof JOB_TYPE_LABELS] ?? v,
    values: (job) => [job.job_type ? job.job_type : UNSPECIFIED],
  },
  {
    key: 'position',
    label: 'ตำแหน่ง',
    ui: 'check',
    searchable: true,
    values: (job) => [trimOr(publicJobPositionLabel(job))],
  },
  {
    key: 'subtype',
    label: 'ลักษณะงานย่อย',
    ui: 'check',
    searchable: true,
    values: (job) => [trimOr(extractJobSubtypeLabel(job))],
  },
  {
    key: 'unit',
    label: 'หน่วยงาน',
    ui: 'check',
    searchable: true,
    values: (job) => [trimOr(job.unit_name)],
  },
  {
    key: 'province',
    label: 'จังหวัด',
    ui: 'check',
    searchable: true,
    values: (job) => [trimOr(inferProvinceFromAddress(job.location_address || ''))],
  },
  {
    /**
     * อำเภอ/เขต — **โผล่เมื่อเลือกจังหวัดแล้วเท่านั้น** (กติกาในแผน)
     * ค่าของใบ = อำเภอของจังหวัดที่เลือกซึ่งที่อยู่ใบขอตรง · ใช้ตัวเทียบเดียวกับตัวกรองเดิม
     */
    key: 'district',
    label: 'อำเภอ/เขต',
    ui: 'check',
    searchable: true,
    values: (job, _facts, state) => {
      const provinces = (state.selection.province ?? []).filter((p) => p !== UNSPECIFIED);
      if (provinces.length === 0) return [];
      const addr = job.location_address || '';
      const prov = inferProvinceFromAddress(addr);
      if (!prov || !provinces.includes(prov)) return [];
      const hit = getDistrictOptionsForProvince(prov).filter((d) => districtMatchesFilter(addr, d));
      return hit.length > 0 ? [...hit] : [UNSPECIFIED];
    },
  },
  {
    key: 'sector',
    label: 'ภาค',
    ui: 'check',
    labelOf: (v) => UNIT_SECTOR_LABEL[v as keyof typeof UNIT_SECTOR_LABEL] ?? v,
    values: (job) => [job.unit_sector ? job.unit_sector : UNSPECIFIED],
  },
  {
    key: 'gender',
    label: 'เพศที่ต้องการ',
    ui: 'check',
    values: (job) => [genderValue(job.gender_requirement)],
  },
  {
    /** ใบที่ช่วงอายุ **ทับ** กับช่วงที่เลือก (ใบ 22–40 ติดทั้ง 18–25 · 26–35 · 36–45) */
    key: 'age',
    label: 'ช่วงอายุ',
    ui: 'chip',
    order: AGE_BANDS.map((b) => b.id),
    labelOf: (v) => AGE_BANDS.find((b) => b.id === v)?.label ?? v,
    values: (job) => {
      const lo = typeof job.age_range_min === 'number' ? job.age_range_min : null;
      const hi = typeof job.age_range_max === 'number' ? job.age_range_max : null;
      if (lo === null && hi === null) return [UNSPECIFIED];
      const a = lo ?? 0;
      const b = hi ?? 200;
      return AGE_BANDS.filter((band) => band.min <= b && band.max >= a).map((band) => band.id);
    },
  },
  {
    key: 'income',
    label: 'รายได้ต่อเดือน',
    ui: 'chip',
    order: INCOME_BANDS.map((b) => b.id),
    labelOf: (v) => INCOME_BANDS.find((b) => b.id === v)?.label ?? v,
    values: (job) => {
      const m = knownMonthlyIncome(job);
      if (m === null) return [UNSPECIFIED];
      return [INCOME_BANDS.find((b) => m >= b.min && m <= b.max)?.id ?? UNSPECIFIED];
    },
  },
  {
    key: 'recruiter',
    label: 'เจ้าหน้าที่สรรหา',
    ui: 'check',
    searchable: true,
    values: (job) => [trimOr(job.recruiter_name)],
  },
  {
    key: 'contract',
    label: 'ประเภทสัญญา',
    ui: 'check',
    values: (job) => [trimOr(job.contract_type_name)],
  },
];

export const BOARD_FACET_KEYS: readonly BoardFacetKey[] = FACETS.map((f) => f.key);
const FACET_BY_KEY = new Map(FACETS.map((f) => [f.key, f]));

export function boardFacetLabel(key: BoardFacetKey): string {
  return FACET_BY_KEY.get(key)?.label ?? key;
}

/** คำบนจอของค่าหนึ่งในหัวข้อ — ใช้ทั้งแถบกรองและแถบ "กำลังดู" (ห้ามพิมพ์คำเองที่จอ) */
export function boardFacetValueLabel(key: BoardFacetKey, value: string): string {
  if (value === UNSPECIFIED) return unspecifiedLabel(key);
  const def = FACET_BY_KEY.get(key);
  return def?.labelOf ? def.labelOf(value) : value;
}

function passesDates(job: JobRequest, dates: BoardDateRange | null): boolean {
  if (!dates || (!dates.from && !dates.to)) return true;
  const d = ymd(dates.field === 'request' ? job.request_date : job.required_date);
  // ใบที่ไม่มีวันที่ในช่องนั้น ⇒ บอกไม่ได้ว่าอยู่ในช่วง = ไม่ผ่าน (ห้ามแอบปล่อยผ่าน)
  if (!d) return false;
  if (dates.from && d < dates.from) return false;
  if (dates.to && d > dates.to) return false;
  return true;
}

/** ค่าที่ติ๊กจริงของหัวข้อนั้น (กรองของว่างออก) */
function selectedOf(state: BoardFilterState, key: BoardFacetKey): string[] {
  return (state.selection[key] ?? []).filter((v) => typeof v === 'string' && v !== '');
}

/** หัวข้อที่ใช้กรองได้จริงตอนนี้ — หัวข้อที่เส้นข้อมูลยังไม่พร้อมต้องไม่กรอง (ห้ามตัดใบทิ้งเพราะยังไม่รู้) */
function activeFacets(facts: BoardFacetFacts): FacetDef[] {
  return FACETS.filter((f) => !f.available || f.available(facts));
}

type ValueTable = Map<BoardFacetKey, string[][]>;

function buildValueTable(
  rows: readonly JobRequest[],
  facets: readonly FacetDef[],
  facts: BoardFacetFacts,
  state: BoardFilterState,
): ValueTable {
  const table: ValueTable = new Map();
  for (const f of facets) table.set(f.key, rows.map((job) => f.values(job, facts, state)));
  return table;
}

function rowPasses(
  i: number,
  table: ValueTable,
  facets: readonly FacetDef[],
  state: BoardFilterState,
  skip: BoardFacetKey | null,
): boolean {
  for (const f of facets) {
    if (f.key === skip) continue;
    const want = selectedOf(state, f.key);
    if (want.length === 0) continue;
    const have = table.get(f.key)?.[i] ?? [];
    if (!have.some((v) => want.includes(v))) return false;
  }
  return true;
}

/** กรองใบขอตามแถบซ้าย + ช่วงวันที่ — OR ในหัวข้อ · AND ข้ามหัวข้อ */
export function applyBoardFilters(
  rows: readonly JobRequest[],
  state: BoardFilterState,
  facts: BoardFacetFacts,
): JobRequest[] {
  const dated = rows.filter((j) => passesDates(j, state.dates));
  const facets = activeFacets(facts);
  if (facets.every((f) => selectedOf(state, f.key).length === 0)) return dated;
  const table = buildValueTable(dated, facets, facts, state);
  return dated.filter((_, i) => rowPasses(i, table, facets, state, null));
}

export type BoardFacetOption = { value: string; label: string; count: number; selected: boolean };
export type BoardFacetView = {
  key: BoardFacetKey;
  label: string;
  ui: FacetUi;
  searchable: boolean;
  options: BoardFacetOption[];
  selectedCount: number;
};

/**
 * หัวข้อ + ตัวเลือก + เลขต่อท้าย สำหรับวาดแถบซ้าย
 *
 * - เลขของแต่ละค่า = ใบที่ผ่าน **ทุกหัวข้อยกเว้นหัวข้อตัวเอง** (+ ช่วงวันที่)
 * - ตัวเลือก = ค่าที่มีจริงในชุด (หลังช่วงวันที่) ∪ ค่าที่ติ๊กอยู่ (ติ๊กแล้วเลขเป็น 0 ก็ยังต้องเห็น)
 * - 🔴 **ห้ามปุ่มหลอก**: ค่าที่มีจริงไม่ถึง 2 ค่า และไม่ได้ติ๊กอะไรอยู่ = ไม่โชว์หัวข้อนั้น
 *   (กดไปก็ได้ชุดเดิม) · อำเภอไม่มีค่าเลยจนกว่าจะเลือกจังหวัด จึงหายไปเองตามแผน
 */
export function buildBoardFacets(
  rows: readonly JobRequest[],
  state: BoardFilterState,
  facts: BoardFacetFacts,
): BoardFacetView[] {
  const dated = rows.filter((j) => passesDates(j, state.dates));
  const facets = activeFacets(facts);
  const table = buildValueTable(dated, facets, facts, state);
  const out: BoardFacetView[] = [];

  for (const f of facets) {
    const selected = selectedOf(state, f.key);
    const universe = new Set<string>();
    for (const vals of table.get(f.key) ?? []) for (const v of vals) universe.add(v);
    if (universe.size < 2 && selected.length === 0) continue;
    for (const v of selected) universe.add(v);

    const counts = new Map<string, number>();
    dated.forEach((_, i) => {
      if (!rowPasses(i, table, facets, state, f.key)) return;
      for (const v of new Set(table.get(f.key)?.[i] ?? [])) counts.set(v, (counts.get(v) ?? 0) + 1);
    });

    const options: BoardFacetOption[] = [...universe].map((value) => ({
      value,
      label: boardFacetValueLabel(f.key, value),
      count: counts.get(value) ?? 0,
      selected: selected.includes(value),
    }));

    if (f.order) {
      const rank = (v: string) => {
        const idx = f.order!.indexOf(v);
        return idx === -1 ? f.order!.length + (v === UNSPECIFIED ? 1 : 0) : idx;
      };
      options.sort((a, b) => rank(a.value) - rank(b.value));
    } else {
      // ค่าเยอะ: จำนวนมากก่อน · "ไม่ระบุ" ไปท้ายเสมอ (ไม่ใช่ค่าที่คนตั้งใจหา)
      options.sort((a, b) => {
        if (a.value === UNSPECIFIED) return 1;
        if (b.value === UNSPECIFIED) return -1;
        return b.count - a.count || a.label.localeCompare(b.label, 'th');
      });
    }

    out.push({
      key: f.key,
      label: f.label,
      ui: f.ui,
      searchable: Boolean(f.searchable),
      options,
      selectedCount: selected.length,
    });
  }
  return out;
}

/**
 * ตัวเลือกที่จะโชว์ในหัวข้อค่าเยอะ (กติกาในแผน ข้อ 4)
 * ค่าที่ติ๊กแล้วลอยขึ้นบนสุด · ยังไม่พิมพ์ค้นหา = โชว์ 10 ค่าแรก · พิมพ์แล้ว = ทุกค่าที่ตรง
 */
export function visibleFacetOptions(
  options: readonly BoardFacetOption[],
  query: string,
  limit = 10,
): { shown: BoardFacetOption[]; hiddenCount: number } {
  const q = query.trim().toLowerCase();
  const selected = options.filter((o) => o.selected);
  const rest = options.filter((o) => !o.selected);
  if (q) {
    const hits = rest.filter((o) => o.label.toLowerCase().includes(q));
    return { shown: [...selected, ...hits], hiddenCount: 0 };
  }
  const head = rest.slice(0, Math.max(limit - selected.length, 0));
  return { shown: [...selected, ...head], hiddenCount: rest.length - head.length };
}

/** นับหัวข้อ/ค่าที่เลือกอยู่ (ปุ่ม "ตัวกรอง (N)" บนมือถือ) — ไม่นับช่วงวันที่ซึ่งอยู่แถบบน */
export function countSelectedFacetValues(state: BoardFilterState): number {
  return BOARD_FACET_KEYS.reduce((n, k) => n + selectedOf(state, k).length, 0);
}

export function hasAnyBoardFilter(state: BoardFilterState): boolean {
  return countSelectedFacetValues(state) > 0 || Boolean(state.dates && (state.dates.from || state.dates.to));
}

/** สลับค่าหนึ่งในหัวข้อ — เอาจังหวัดออกแล้วอำเภอของจังหวัดนั้นที่ติ๊กไว้ต้องหลุดตามด้วย */
export function toggleBoardFacetValue(
  state: BoardFilterState,
  key: BoardFacetKey,
  value: string,
): BoardFilterState {
  const cur = selectedOf(state, key);
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  const selection: BoardFilterState['selection'] = { ...state.selection, [key]: next };
  if (key === 'province') {
    const provinces = next.filter((p) => p !== UNSPECIFIED);
    const allowed = new Set(provinces.flatMap((p) => [...getDistrictOptionsForProvince(p)]));
    selection.district = (selection.district ?? []).filter((d) => d === UNSPECIFIED ? provinces.length > 0 : allowed.has(d));
  }
  return { ...state, selection };
}

/** ล้างเฉพาะแถบซ้าย (ปุ่ม "✕ ล้าง" บนหัวแถบ) — ช่วงวันที่บนแถบบนคงไว้ */
export function clearBoardFacets(state: BoardFilterState): BoardFilterState {
  return { ...state, selection: {} };
}

/** สรุปสั้นสำหรับแถบ "กำลังดู" — เช่น `จำนวนผู้สมัคร: ยังไม่มีคนสมัคร · จังหวัด: ชลบุรี, ระยอง` */
export function describeBoardFilters(state: BoardFilterState): string {
  const parts: string[] = [];
  for (const key of BOARD_FACET_KEYS) {
    const vals = selectedOf(state, key);
    if (vals.length === 0) continue;
    const labels = vals.map((v) => boardFacetValueLabel(key, v));
    const shown = labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ');
    parts.push(`${boardFacetLabel(key)}: ${shown}`);
  }
  if (state.dates && (state.dates.from || state.dates.to)) {
    const field = state.dates.field === 'request' ? 'วันที่ขอ' : 'วันที่ต้องการ';
    // รูปวันที่เดียวกับทั้งระบบ (1/10/2569) — ห้ามโชว์ 2026-10-01 ดิบ ๆ (เจอตอนตรวจบนจอ)
    const from = state.dates.from ? formatYmdDmyBe(state.dates.from) : '…';
    const to = state.dates.to ? formatYmdDmyBe(state.dates.to) : '…';
    parts.push(`${field}: ${from} – ${to}`);
  }
  return parts.join(' · ');
}

// ── URL ──────────────────────────────────────────────────────────────────────

/** params ของแถบกรองขึ้นต้นด้วยตัวนี้ทั้งหมด — ลบ/เขียนได้โดยไม่ไปโดน `view` `lane` `step` `job` */
export const BOARD_FILTER_PARAM_PREFIX = 'f.';
const DATE_FIELD_PARAM = 'df';
const DATE_FROM_PARAM = 'dfrom';
const DATE_TO_PARAM = 'dto';
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function readBoardFilterState(params: URLSearchParams): BoardFilterState {
  const selection: BoardFilterState['selection'] = {};
  for (const key of BOARD_FACET_KEYS) {
    const vals = params
      .getAll(`${BOARD_FILTER_PARAM_PREFIX}${key}`)
      .map((v) => v.trim())
      .filter(Boolean);
    if (vals.length > 0) selection[key] = [...new Set(vals)];
  }
  const from = params.get(DATE_FROM_PARAM) ?? '';
  const to = params.get(DATE_TO_PARAM) ?? '';
  const field: BoardDateField = params.get(DATE_FIELD_PARAM) === 'request' ? 'request' : 'required';
  const okFrom = YMD_RE.test(from) ? from : '';
  const okTo = YMD_RE.test(to) ? to : '';
  return {
    selection,
    dates: okFrom || okTo ? { field, from: okFrom, to: okTo } : null,
  };
}

/**
 * เขียนสถานะลง params **ชุดใหม่** — เก็บ params อื่นไว้ครบ (กติกาในแผน ข้อ 8)
 * ค่าว่างไม่เขียน (URL ไม่รก · ลิงก์เดิมที่ไม่มีตัวกรองยังเหมือนเดิมทุกตัวอักษร)
 */
export function writeBoardFilterState(
  params: URLSearchParams,
  state: BoardFilterState,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const k of [...next.keys()]) {
    if (k.startsWith(BOARD_FILTER_PARAM_PREFIX)) next.delete(k);
  }
  next.delete(DATE_FIELD_PARAM);
  next.delete(DATE_FROM_PARAM);
  next.delete(DATE_TO_PARAM);
  for (const key of BOARD_FACET_KEYS) {
    for (const v of selectedOf(state, key)) next.append(`${BOARD_FILTER_PARAM_PREFIX}${key}`, v);
  }
  if (state.dates && (state.dates.from || state.dates.to)) {
    if (state.dates.field === 'request') next.set(DATE_FIELD_PARAM, 'request');
    if (state.dates.from) next.set(DATE_FROM_PARAM, state.dates.from);
    if (state.dates.to) next.set(DATE_TO_PARAM, state.dates.to);
  }
  return next;
}

// ── เรียงการ์ด ────────────────────────────────────────────────────────────────

/**
 * ปุ่มเรียงการ์ด (แผน: "ด่วนก่อน (เดิม) / ผู้สมัครน้อย → มาก / ใบใหม่ → เก่า")
 * ⚠️ ค่าเดิมของบอร์ดจริง ๆ คือ **ค้างนานสุดก่อน** (เจ้าของสั่ง 18 ส.ค. 2569) ไม่ใช่ "ด่วนก่อน"
 *    ป้ายบนจอจึงเขียนตามที่มันทำจริง — ห้ามเรียกว่า "ด่วนก่อน" ทั้งที่ไม่ได้เรียงด้วยความด่วน
 */
export type BoardSort = 'age' | 'fewest_applicants' | 'newest';
export const BOARD_SORT_PARAM = 'sort';
export const BOARD_SORT_OPTIONS: ReadonlyArray<{ value: BoardSort; label: string }> = [
  { value: 'age', label: 'ค้างนานสุดก่อน' },
  { value: 'fewest_applicants', label: 'ผู้สมัครน้อย → มาก' },
  { value: 'newest', label: 'ใบใหม่ → เก่า' },
];

export function readBoardSort(params: URLSearchParams): BoardSort {
  const v = params.get(BOARD_SORT_PARAM);
  return v === 'fewest_applicants' || v === 'newest' ? v : 'age';
}

/**
 * เรียงแบบที่ไม่ใช่ค่าเดิม — ค่าเดิม (`age`) ให้จอใช้ตัวเรียงเดิมของบอร์ดต่อ ไม่ก๊อปมาที่นี่
 * (สองที่เรียงคนละแบบ = รอวันเพี้ยน)
 * @param ageCompare ตัวเรียงเดิมของบอร์ด — ใช้ตัดสินเมื่อค่าหลักเท่ากัน
 */
export function sortBoardJobs(
  rows: readonly JobRequest[],
  sort: Exclude<BoardSort, 'age'>,
  applicants: (job: JobRequest) => number,
  ageCompare: (a: JobRequest, b: JobRequest) => number,
): JobRequest[] {
  const copy = [...rows];
  if (sort === 'fewest_applicants') {
    return copy.sort((a, b) => applicants(a) - applicants(b) || ageCompare(a, b));
  }
  return copy.sort((a, b) => {
    const da = ymd(a.request_date);
    const db = ymd(b.request_date);
    if (da !== db) return da < db ? 1 : -1;
    return ageCompare(a, b);
  });
}
