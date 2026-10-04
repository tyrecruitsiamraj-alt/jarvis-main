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
 * - หัวข้อไหนต้องซ่อน — **ห้ามปุ่มหลอก** (กติกาในแผน): ซ่อนเฉพาะหัวข้อที่ **ข้อมูลจริงว่างทั้งหมด**
 *   · 🔴 หัวข้อชิปแบบตายตัว (จำนวนผู้สมัคร · ความเร่งด่วน · เพศ · ช่วงอายุ · รายได้ ฯลฯ)
 *   **โชว์ครบทุกตัวเลือกเสมอ เลข 0 จาง** (แผนข้อ 5 · เจ้าของย้ำ 26 ก.ย. 2569) — เดิมผมซ่อน
 *   หัวข้อที่มีค่าเดียว แล้วหัวข้อความเร่งด่วนหายทั้งหัวข้อเพราะ 316 ใบเป็น "ล่วงหน้า" ทั้งหมด
 *   ซึ่งผิดแผน (คนไม่รู้ว่ามีตัวกรองนี้อยู่)
 * - อ่าน/เขียน URL (`readBoardFilterState` / `writeBoardFilterState`) — ต่อยอดจาก params เดิม
 *   **ห้ามทำ `?view=` `?lane=` `?step=` หาย**
 *
 * 🔴 **ไม่แตะฐานข้อมูล** — ทุกอย่างคิดจากของที่หน้าโหลดมาแล้ว (ใบขอ + ยอดผู้สมัคร/Lead +
 * ทะเบียนปล่อย + ยอดส่ง AI) ผ่าน `BoardFacetFacts`
 */
import type { JobRequest } from '@/types';
import { publicJobPositionLabel } from './unitRequestDisplay';
import { inferProvinceFromAddress } from './parseThaiJobAddress';
import { districtMatcherFor } from './districtMatch';
import { getDistrictOptionsForProvince } from './thaiDistricts';
import { UNIT_SECTOR_LABEL } from './unitSector';
import { buildIncomeDisplay } from './incomeBreakdown';
import { formatYmdDmyBe } from './dateTh';
import { genderLabel } from './genderRequirement';
import { isDrivingPositionLabel } from './jobBoardPositionPreset';
import {
  READINESS_FACET_LABEL,
  READINESS_FACET_ORDER,
  readinessFacetValues,
  type PublishReadiness,
  type ReadinessFacetValue,
} from './publishReadiness';
import {
  UNSPECIFIED,
  applyFacetDefs,
  buildFacetViews,
  countSelectedValues,
  describeSelection,
  readSelectionParams,
  toggleSelection,
  writeSelectionParams,
  type FacetDef as EngineFacetDef,
  type FacetOption,
  type FacetView,
} from './facetEngine';

/**
 * 🔴 อัลกอริทึมกรอง/นับ/URL อยู่ที่ `facetEngine.ts` (ใช้ร่วมกับแท็บผู้สมัคร — 27 ก.ย. 2569)
 * ไฟล์นี้เหลือ "หัวข้อของกล่องงาน" + ช่วงวันที่ + ปุ่มเรียง · export เดิมคงไว้ครบ
 */
export { UNSPECIFIED, visibleFacetOptions } from './facetEngine';

export type BoardFacetKey =
  | 'ready'
  | 'applicants'
  | 'release'
  | 'urgency'
  | 'ai'
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
  /**
   * ใบนี้พร้อมประกาศไหม/ขาดอะไร (2 ต.ค. 2569 — แทน "ติดขั้น") — ตัวเดียวกับชิปบนการ์ด (`publishReadinessOf`)
   * 🔴 `null` ทั้งตัว = ทะเบียนการประกาศยังโหลดไม่ครบ (ทุกใบจะดู "ยังไม่ประกาศ" ปลอม ๆ) ⇒ หัวข้อต้องไม่โผล่
   */
  readinessOf?: ((job: JobRequest) => PublishReadiness) | null;
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

type FacetDef = EngineFacetDef<JobRequest, BoardFacetKey, BoardFacetFacts, BoardFilterState>;

const trimOr = (v: unknown): string => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t || UNSPECIFIED;
};

/** ป้ายของ "ไม่ระบุ" ต่อหัวข้อ — บางหัวข้อมีคำเฉพาะที่เจ้าของใช้อยู่แล้ว */
function unspecifiedLabel(key: BoardFacetKey): string {
  if (key === 'recruiter') return 'ไม่มีผู้รับผิดชอบ';
  if (key === 'sector') return 'ยังไม่ระบุ';
  if (key === 'income') return 'ตั้งยอดรวมไว้ (ไม่ระบุหน่วย)';
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

/** ค่ารายได้ที่ไม่ใช่ช่วงเงิน — ลำดับบนจอ: ยังไม่ตั้ง → ช่วงเงินต่อเดือน → รายวัน */
const INCOME_SPECIAL_LABEL: Record<string, string> = {
  unset: 'ยังไม่ตั้งรายได้',
  daily: 'ตั้งเป็นรายวัน',
};

/**
 * รายได้ที่ **ทีม Online ตั้งไว้บนประกาศ** อยู่ช่วงไหน (ค่าของหัวข้อ "รายได้บนประกาศ")
 *
 * 🔴 **ยังไม่ตั้ง = `unset`** (เจ้าของเคาะ 26 ก.ย. 2569: *"แปลว่าเจ้าหน้าที่ Online ยังไม่มาทำ
 * อะไรกับกล่องงานใบนั้นเฉย ๆ"*) — **ห้ามเอาเลข ERP มาอุด** · ตัวกรองนี้มีไว้ไล่งานที่ยังไม่ทำ
 * ⚠️ ERP ปนค่าแรง **ต่อวัน** (400) กับ **ต่อเดือน** (12,000) ในช่องเดียวกัน — ของเดิมที่เดาจาก
 *    `total_income` จึงถูกถอดออก (ไม่งั้นเลขที่ไม่มีใครตั้งดูเหมือนตั้งแล้ว)
 * - ตั้งแบบแยกรายการ (`field_overrides.income`) ต่อเดือน = จัดช่วงตามยอดรวมที่ผู้สมัครเห็น
 * - ตั้งเป็นรายวัน = `daily` (ไม่แปลงเป็นต่อเดือนเอง — ห้ามเดาจำนวนวันทำงาน)
 * - ตั้งเลขเดี่ยวแบบเก่า (`field_overrides.total_income`) = ตั้งแล้วแต่ไม่รู้หน่วย
 */
export function onlineIncomeValue(job: JobRequest): string {
  const fo = job.field_overrides;
  const display = fo?.income ? buildIncomeDisplay(fo.income) : null;
  if (display) {
    if (display.period === 'daily') return 'daily';
    return INCOME_BANDS.find((b) => display.total >= b.min && display.total <= b.max)?.id ?? UNSPECIFIED;
  }
  if (typeof fo?.total_income === 'number' && fo.total_income > 0) return UNSPECIFIED;
  return 'unset';
}

/**
 * งานย่อยของงานขับรถ (เจ้าของเคาะ 26 ก.ย. 2569: *"ตำแหน่งงานที่สื่อว่า ขับรถนะ แต่งานย่อยของงาน
 * ขับรถมันมี ส่วนกลาง นาย ไรงี้"*) — ตำแหน่งอื่น **ไม่มีงานย่อย**
 *
 * วัดจาก ERP 26 ก.ย. (`hr_ms_job_description_2` ของใบขอขับรถที่เปิดอยู่): ส่วนกลาง 64 ·
 * รถผู้บริหาร 53 (+คนไทย 3 · ต่างชาติ 2) · Valet Parking 19 · ชนิดที่ 2 5 · ไม่ระบุ 4 · ทดสอบ 2
 * ⇒ "นาย" = ทุกชื่อที่มีคำว่า "ผู้บริหาร" · ค่าที่ไม่เข้ากลุ่มไหน = "อื่น ๆ" · ว่าง/ไม่ระบุ = ไม่ระบุ
 */
const DRIVING_SUBTYPES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'central', label: 'ส่วนกลาง' },
  { id: 'boss', label: 'นาย (รถผู้บริหาร)' },
  { id: 'valet', label: 'Valet' },
  { id: 'other', label: 'อื่น ๆ' },
];

export function drivingSubtypeOf(job: JobRequest): string {
  const raw = (job.job_description_code_2 ?? '').trim();
  if (!raw || raw === 'ไม่ระบุ') return UNSPECIFIED;
  if (/ส่วนกลาง/.test(raw)) return 'central';
  if (/ผู้บริหาร|นาย/.test(raw)) return 'boss';
  if (/valet|แวลเล่|แวลเลต/i.test(raw)) return 'valet';
  return 'other';
}

/** ตำแหน่งงานของใบ (คำเดียวกับบรรทัดสีบนการ์ด) */
const positionOf = (job: JobRequest): string => trimOr(publicJobPositionLabel(job));

/**
 * จังหวัดของใบ — 🔴 **อ่านค่าที่ทีม Online กรอกก่อน** (เจ้าของเคาะ 26 ก.ย. 2569: ที่อยู่กรอกเอง
 * ก่อนขึ้นหน้าสาธารณะ) แล้วค่อยเดาจากที่อยู่ใบขอ · ❌ **ไม่เติมจากจังหวัดของไซต์**
 * (ไซต์ = จังหวัดที่จดสัญญา วัดแล้วผิดที่ทำงานจริง 26% เช่น กรุงศรีสาขาบิ๊กซีลพบุรี แต่ไซต์จดกรุงเทพฯ)
 */
export function boardProvinceOf(job: JobRequest): string {
  return trimOr(job.override_province || inferProvinceFromAddress(job.location_address || ''));
}

const ymd = (v: string | undefined | null): string => (v ?? '').slice(0, 10);

/**
 * หัวข้อตามลำดับในแผน — **ลำดับนี้คือลำดับบนจอ**
 * `contract` (ประเภทสัญญา) ไม่อยู่ในสเปกของแผนแต่เป็นตัวกรองที่มีอยู่แล้วบนแถบบน
 * ⇒ ย้ายมาอยู่ท้ายสุด (กติกา "เพิ่มได้ ห้ามลด" — ห้ามให้ของเดิมหายระหว่างย้าย)
 */
const FACETS: readonly FacetDef[] = [
  {
    /**
     * ═══ พร้อมประกาศไหม — แทนหัวข้อ "ติดขั้น" (เจ้าของเลือก B 2 ต.ค. 2569) ═══
     * การ์ดบอก "พร้อมประกาศ / ขาด: …" เอง · หัวข้อนี้บอกจำนวนต่อสภาพ ติ๊กแล้วเหลือแต่ใบสภาพนั้น
     * นับจากตัวเดียวกับชิปบนการ์ด (`publishReadinessOf`) · ใบที่ประกาศแล้วไม่อยู่ในหัวข้อ (ติ๊กแล้วหลุด) ·
     * ใบที่ขาดหลายช่องอยู่หลายค่า (ติ๊ก "ขาดสถานที่" แล้วใบที่ขาดทั้งสถานที่และเพศยังอยู่)
     */
    key: 'ready',
    label: 'พร้อมประกาศไหม',
    ui: 'check',
    order: [...READINESS_FACET_ORDER],
    labelOf: (v) => READINESS_FACET_LABEL[v as ReadinessFacetValue] ?? v,
    available: (facts) => Boolean(facts.readinessOf),
    values: (job, facts) => {
      const r = facts.readinessOf?.(job);
      return r ? readinessFacetValues(r) : [];
    },
  },
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
    labelOf: (v) => (v === 'released' ? 'ประกาศ' : 'ยังไม่ประกาศ'),
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
    /**
     * ตำแหน่งงาน → งานย่อย แบบจังหวัด → อำเภอ (เจ้าของเคาะ 26 ก.ย. 2569)
     * 🔴 หัวข้อ "ประเภทงาน" ถูกถอดออก — ระบบเดาจากคำ (คนสวนก็ตกเป็น "ส่วนกลาง") ใช้งานย่อยแทน
     */
    key: 'position',
    label: 'ตำแหน่งงาน',
    ui: 'check',
    searchable: true,
    values: (job) => [positionOf(job)],
  },
  {
    /**
     * งานย่อย — **โผล่เมื่อเลือกตำแหน่งงานขับรถแล้วเท่านั้น** (ตำแหน่งอื่นไม่มีงานย่อย)
     * ⚠️ ตำแหน่ง "ทดแทนงาน" ใน ERP บางใบจริง ๆ เป็นงานขับรถ — ไม่เดาแทน (ข้อมูลฝั่ง ERP)
     */
    key: 'subtype',
    label: 'งานย่อย',
    ui: 'check',
    order: DRIVING_SUBTYPES.map((t) => t.id),
    labelOf: (v) => DRIVING_SUBTYPES.find((t) => t.id === v)?.label ?? v,
    values: (job, _facts, state) => {
      const picked = (state.selection.position ?? []).filter(isDrivingPositionLabel);
      if (picked.length === 0) return [];
      return picked.includes(positionOf(job)) ? [drivingSubtypeOf(job)] : [];
    },
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
    values: (job) => [boardProvinceOf(job)],
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
      const prov = boardProvinceOf(job);
      if (prov === UNSPECIFIED || !provinces.includes(prov)) return [];
      // ทีม Online กรอกอำเภอไว้ = ใช้ค่านั้น (ค่าเดียวกับที่ผู้สมัครเห็น) · ไม่กรอก = เดาจากที่อยู่ใบขอ
      const typed = (job.override_district ?? '').trim();
      if (typed) return [typed];
      const matches = districtMatcherFor(job.location_address || '');
      const hit = getDistrictOptionsForProvince(prov).filter(matches);
      return hit.length > 0 ? [...hit] : [UNSPECIFIED];
    },
  },
  {
    key: 'sector',
    label: 'ภาค',
    ui: 'check',
    order: Object.keys(UNIT_SECTOR_LABEL),
    labelOf: (v) => UNIT_SECTOR_LABEL[v as keyof typeof UNIT_SECTOR_LABEL] ?? v,
    values: (job) => [job.unit_sector ? job.unit_sector : UNSPECIFIED],
  },
  {
    /**
     * 🔴 รหัส O ของ ERP (`ms_sex`: O = ไม่ระบุ) ขึ้นเป็น **"ไม่ระบุ"** ไม่ใช่ตัว O ดิบ
     * (เจ้าของสั่ง 26 ก.ย. 2569) · ค่าที่ทีม Online เลือกในป๊อปขั้น 1 ทับมาให้แล้วที่ feed
     */
    key: 'gender',
    label: 'เพศที่รับ',
    ui: 'check',
    order: ['ชาย', 'หญิง', 'ไม่จำกัด'],
    values: (job) => {
      const g = genderLabel(job.gender_requirement);
      return [g === 'ไม่ระบุ' ? UNSPECIFIED : g];
    },
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
    /** รายได้ที่ทีม Online ตั้งบนประกาศ — "ยังไม่ตั้งรายได้" คือกองงานที่ยังไม่ได้ทำ (ห้ามอุดด้วยเลข ERP) */
    key: 'income',
    label: 'รายได้บนประกาศ',
    ui: 'chip',
    order: ['unset', ...INCOME_BANDS.map((b) => b.id), 'daily'],
    labelOf: (v) => INCOME_SPECIAL_LABEL[v] ?? INCOME_BANDS.find((b) => b.id === v)?.label ?? v,
    values: (job) => [onlineIncomeValue(job)],
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

/**
 * หัวข้อที่ได้ Dropdown ของตัวเองบนแถบตัวกรอง (เจ้าของเลือกแบบร่าง A 27 ก.ย. 2569)
 * ที่เหลือรวมอยู่ใน "ตัวกรองอื่น" · หัวข้อลูกอยู่ในกล่องเดียวกับหัวข้อแม่ (อำเภอในจังหวัด · งานย่อยในตำแหน่ง)
 */
/** "พร้อมประกาศไหม" ขึ้นก่อน (2 ต.ค. 2569 แทน "ติดขั้น" ซึ่ง 30 ก.ย. แทนแถวบนหัวที่ถอดไป) */
export const BOARD_PRIMARY_FACETS: readonly BoardFacetKey[] = ['ready', 'position', 'unit', 'province', 'income'];
export const BOARD_FACET_ATTACH: Partial<Record<BoardFacetKey, BoardFacetKey>> = {
  subtype: 'position',
  district: 'province',
};
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

/** กรองใบขอตามแถบซ้าย + ช่วงวันที่ — OR ในหัวข้อ · AND ข้ามหัวข้อ (ตัวกลาง `facetEngine`) */
export function applyBoardFilters(
  rows: readonly JobRequest[],
  state: BoardFilterState,
  facts: BoardFacetFacts,
): JobRequest[] {
  const dated = rows.filter((j) => passesDates(j, state.dates));
  return applyFacetDefs(dated, FACETS, state, facts);
}

export type BoardFacetOption = FacetOption;
export type BoardFacetView = FacetView<BoardFacetKey>;

/**
 * หัวข้อ + ตัวเลือก + เลขต่อท้าย สำหรับวาดแถบซ้าย (กติกาทั้งหมดอยู่ที่ `buildFacetViews`)
 * - เลขของแต่ละค่า = ใบที่ผ่าน **ทุกหัวข้อยกเว้นหัวข้อตัวเอง** (+ ช่วงวันที่)
 * - 🔴 ห้ามปุ่มหลอก: ซ่อนเฉพาะหัวข้อที่ข้อมูลจริงว่างทั้งหมด · หัวข้อตายตัวโชว์ครบ เลข 0 จาง
 *   ⚠️ เดิมซ่อนหัวข้อที่มีค่าเดียวด้วย ⇒ ความเร่งด่วนหายทั้งหัวข้อ (316 ใบเป็น "ล่วงหน้า") — แก้แล้ว
 */
export function buildBoardFacets(
  rows: readonly JobRequest[],
  state: BoardFilterState,
  facts: BoardFacetFacts,
): BoardFacetView[] {
  const dated = rows.filter((j) => passesDates(j, state.dates));
  return buildFacetViews(dated, FACETS, state, facts, boardFacetValueLabel);
}

/** นับหัวข้อ/ค่าที่เลือกอยู่ (ปุ่ม "ตัวกรอง (N)" บนมือถือ) — ไม่นับช่วงวันที่ซึ่งอยู่แถบบน */
export function countSelectedFacetValues(state: BoardFilterState): number {
  return countSelectedValues(state, BOARD_FACET_KEYS);
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
  const selection: BoardFilterState['selection'] = toggleSelection(state.selection, key, value);
  const next = selection[key] ?? [];
  if (key === 'province') {
    const provinces = next.filter((p) => p !== UNSPECIFIED);
    const allowed = new Set(provinces.flatMap((p) => [...getDistrictOptionsForProvince(p)]));
    selection.district = (selection.district ?? []).filter((d) => d === UNSPECIFIED ? provinces.length > 0 : allowed.has(d));
  }
  // งานย่อยมีเฉพาะงานขับรถ — ไม่เหลือตำแหน่งขับรถที่ติ๊กไว้ = งานย่อยที่ติ๊กไว้หลุดตาม
  if (key === 'position' && !next.some(isDrivingPositionLabel)) {
    selection.subtype = [];
  }
  return { ...state, selection };
}

/** ล้างเฉพาะแถบซ้าย (ปุ่ม "✕ ล้าง" บนหัวแถบ) — ช่วงวันที่บนแถบบนคงไว้ */
export function clearBoardFacets(state: BoardFilterState): BoardFilterState {
  return { ...state, selection: {} };
}

/** สรุปสั้นสำหรับแถบ "กำลังดู" — เช่น `จำนวนผู้สมัคร: ยังไม่มีคนสมัคร · จังหวัด: ชลบุรี, ระยอง` */
export function describeBoardFilters(state: BoardFilterState): string {
  const facetText = describeSelection(state, BOARD_FACET_KEYS, boardFacetLabel, boardFacetValueLabel);
  const parts: string[] = facetText ? [facetText] : [];
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
  const selection = readSelectionParams(params, BOARD_FILTER_PARAM_PREFIX, BOARD_FACET_KEYS);
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
  const next = writeSelectionParams(params, BOARD_FILTER_PARAM_PREFIX, BOARD_FACET_KEYS, state.selection);
  next.delete(DATE_FIELD_PARAM);
  next.delete(DATE_FROM_PARAM);
  next.delete(DATE_TO_PARAM);
  if (state.dates && (state.dates.from || state.dates.to)) {
    if (state.dates.field === 'request') next.set(DATE_FIELD_PARAM, 'request');
    if (state.dates.from) next.set(DATE_FROM_PARAM, state.dates.from);
    if (state.dates.to) next.set(DATE_TO_PARAM, state.dates.to);
  }
  return next;
}

/**
 * ช่องค้นหาของกล่องงานอยู่ใน URL (`?q=`) — เจ้าของเคาะ 26 ก.ย. 2569 (ตัวกรองทุกตัวต้องอยู่ในลิงก์
 * กดย้อนกลับ/ส่งลิงก์ต่อแล้วไม่หาย) · ค่าว่างไม่เขียน (ลิงก์เดิมที่ไม่มีคำค้นเหมือนเดิมทุกตัวอักษร)
 */
export const BOARD_SEARCH_PARAM = 'q';

export function readBoardSearch(params: URLSearchParams): string {
  return params.get(BOARD_SEARCH_PARAM) ?? '';
}

export function writeBoardSearch(params: URLSearchParams, q: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (q.trim()) next.set(BOARD_SEARCH_PARAM, q);
  else next.delete(BOARD_SEARCH_PARAM);
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
