/**
 * ═══ แถบกรองแบบ iRecruit ของแท็บฝั่งผู้สมัคร — ตรรกะล้วน ═══
 *
 * เจ้าของเคาะ 26–27 ก.ย. 2569: หลักการ iRecruit ที่ทำบนกล่องงาน ให้มีที่ **แท็บอื่นในกล่องงาน**
 * ด้วย · ดูแบบร่างแล้วสั่ง *"เอาตามร่างเลย"* — ใช้กับ รายชื่อผู้สมัคร · การโทรของฉัน · ติดตามนัดหมาย
 * (แท็บคำขอโพสต์งานใหม่ เจ้าของบอกไม่ต้อง — ดูทีละกล่องแล้วเอาขึ้นเลย)
 *
 * ⚠️ 17 ส.ค. 2569 เจ้าของเคยสั่งถอดแผงกรองด้านข้างของหน้านี้ "ออกจากทุกหน้า" — รอบนี้เป็นคำสั่งใหม่
 *    (แจ้งเจ้าของแล้ว) · หน้าตาเป็นแบบ iRecruit (พับเก็บ เปิดทีละหัวข้อ) ไม่ใช่แถบซ้อนกันแบบเดิม
 *
 * 🔴 อัลกอริทึมกรอง/นับ/URL อยู่ที่ `facetEngine.ts` ตัวเดียวกับกล่องงาน — ไฟล์นี้มีแค่ "หัวข้อ"
 * 🔴 "สนใจ / ไม่สนใจ" ใช้กติกาเดียวกับแท็บย่อย (`applicantCallOutcome.ts`) — ห้ามนิยามใหม่
 * 🔴 ไม่แตะฐานข้อมูล — กรองจากรายชื่อที่หน้าโหลดมาแล้ว
 */
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { REFERRAL_SOURCE_LABEL } from '@/lib/publicApplicationsApi';
import type { RmTab } from '@/lib/recruitRm';
import { isInterestedApplicant, isNotInterestedApplicant } from '@/lib/applicantCallOutcome';
import { ATTENDANCE_LABEL } from '@/lib/appointmentAttendance';
import { toYmdBangkok } from '@/lib/dateTh';
import {
  UNSPECIFIED,
  applyFacetDefs,
  buildFacetViews,
  countSelectedValues,
  describeSelection,
  readSelectionParams,
  toggleSelection,
  writeSelectionParams,
  type FacetDef,
  type FacetState,
  type FacetView,
} from '@/lib/facetEngine';

export type ApplicantFacetKey =
  | 'apptWhen'
  | 'apptPlace'
  | 'attendance'
  | 'recruiter'
  | 'call'
  | 'job'
  | 'position'
  | 'province'
  | 'district'
  | 'age'
  | 'education'
  | 'days'
  | 'channel'
  | 'gender';

/**
 * ของที่ต้องรู้ตอนคิดค่า — แท็บ (หัวข้อนัดหมายโผล่เฉพาะแท็บนัด) + เวลาปัจจุบัน (ส่งเข้ามาให้เทสต์ได้) +
 * ตัวบอก "เจ้าหน้าที่สรรหาของใบขอที่คนนี้สมัคร" (หน้ารู้จากชุดใบขอที่โหลดไว้ · ไม่ส่ง = ไม่มีหัวข้อนี้)
 */
export type ApplicantFacetFacts = {
  tab: RmTab;
  now: Date;
  recruiterOf?: (r: PublicApplication) => string | null;
};

export type ApplicantFilterState = FacetState<ApplicantFacetKey>;
export const EMPTY_APPLICANT_FILTER_STATE: ApplicantFilterState = { selection: {} };

type Def = FacetDef<PublicApplication, ApplicantFacetKey, ApplicantFacetFacts, ApplicantFilterState>;

const trimOr = (v: unknown): string => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t || UNSPECIFIED;
};

const DAY_MS = 86_400_000;
/** จำนวนวันจากวันที่ a ถึง b (YYYY-MM-DD โซนไทย) */
function ymdDiffDays(a: string, b: string): number {
  const ta = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const tb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((tb - ta) / DAY_MS);
}

function ymdOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : toYmdBangkok(d);
}

const CALL_LABEL: Record<string, string> = {
  interested: 'สนใจ',
  pending: 'ยังติดต่อไม่ได้',
  not_interested: 'ไม่สนใจ',
  none: 'ยังไม่โทร',
};

/**
 * ผลโทรล่าสุดของใบ — 🔴 สนใจ/ไม่สนใจ ใช้ตัวตัดสินเดียวกับแท็บย่อย (เทียบเวลาผลโทร vs ผลติดต่อ)
 * ที่เหลือ: มีร่องรอยการติดต่อ (ผลโทร/ผลติดต่อ/กดโทร) = "ยังติดต่อไม่ได้" · ไม่มีเลย = "ยังไม่โทร"
 */
export function applicantCallValue(r: PublicApplication): string {
  if (isInterestedApplicant(r)) return 'interested';
  if (isNotInterestedApplicant(r)) return 'not_interested';
  if (r.last_call_outcome || typeof r.last_contact_ok === 'boolean' || (r.dial_count ?? 0) > 0) {
    return 'pending';
  }
  return 'none';
}

const AGE_BANDS: ReadonlyArray<{ id: string; label: string; min: number; max: number }> = [
  { id: '18-25', label: '18–25', min: 0, max: 25 },
  { id: '26-35', label: '26–35', min: 26, max: 35 },
  { id: '36-45', label: '36–45', min: 36, max: 45 },
  { id: '46+', label: '46 ขึ้นไป', min: 46, max: 200 },
];

const DAY_BANDS: ReadonlyArray<{ id: string; label: string; max: number }> = [
  { id: '0-3', label: '0–3 วัน', max: 3 },
  { id: '4-7', label: '4–7 วัน', max: 7 },
  { id: '8-30', label: '8–30 วัน', max: 30 },
  { id: '30+', label: 'เกิน 30 วัน', max: Number.MAX_SAFE_INTEGER },
];

const APPT_LABEL: Record<string, string> = {
  past: 'เลยวันนัดแล้ว',
  today: 'วันนี้',
  next7: '7 วันข้างหน้า',
  later: 'หลังจากนั้น',
};

const GENDER_LABEL: Record<string, string> = { male: 'ชาย', female: 'หญิง', other: 'อื่น ๆ' };

/** ป้ายของ "ไม่ระบุ" ต่อหัวข้อ */
function unspecifiedLabel(key: ApplicantFacetKey): string {
  if (key === 'apptWhen') return 'ยังไม่มีนัด';
  if (key === 'attendance') return 'ยังไม่บันทึก';
  if (key === 'job') return 'ไม่ระบุใบขอ';
  if (key === 'recruiter') return 'ไม่ระบุเจ้าหน้าที่';
  return 'ไม่ระบุ';
}

const onlyAppointments = (facts: ApplicantFacetFacts) => facts.tab === 'appointments';

/**
 * หัวข้อตามลำดับบนจอ (ตามแบบร่างที่เจ้าของเคาะ) — หัวข้อนัดหมายขึ้นก่อนในแท็บนัด
 * (แท็บอื่นไม่มีหัวข้อพวกนี้ — `available`)
 */
const FACETS: readonly Def[] = [
  {
    key: 'apptWhen',
    label: 'วันนัด',
    ui: 'chip',
    order: ['past', 'today', 'next7', 'later'],
    labelOf: (v) => APPT_LABEL[v] ?? v,
    available: onlyAppointments,
    values: (r, facts) => {
      const d = ymdOf(r.appointment_at);
      if (!d) return [UNSPECIFIED];
      const diff = ymdDiffDays(toYmdBangkok(facts.now), d);
      return [diff < 0 ? 'past' : diff === 0 ? 'today' : diff <= 7 ? 'next7' : 'later'];
    },
  },
  {
    key: 'apptPlace',
    label: 'สถานที่นัด',
    ui: 'check',
    searchable: true,
    available: onlyAppointments,
    values: (r) => [trimOr(r.appointment_place)],
  },
  {
    key: 'attendance',
    label: 'ผลมา/ไม่มา',
    ui: 'check',
    order: ['showed', 'no_show', 'rescheduled'],
    labelOf: (v) => ATTENDANCE_LABEL[v as keyof typeof ATTENDANCE_LABEL] ?? v,
    available: onlyAppointments,
    values: (r) => [r.attendance_result && r.attendance_result in ATTENDANCE_LABEL ? r.attendance_result : UNSPECIFIED],
  },
  {
    /**
     * ═══ เจ้าหน้าที่สรรหา — ดูเป็นคน (เจ้าของสั่ง 30 ก.ย. 2569) ═══
     * > *"Filter ต้องดูเป็นคนได้ เลือกชื่อเจ้าหน้าที่สรรหา แล้วขึ้นมาเฉพาะรายชื่อของเขา เช่น เลือก แบงค์
     * >  ก็ขึ้นชื่อคนที่สนใจของแบงค์มา"*
     * "ของแบงค์" = ใบขอที่คนนี้สมัคร **ตั้งแบงค์เป็นเจ้าหน้าที่สรรหาไว้** (ช่องผู้รับผิดชอบของใบขอ ·
     * `siamraj_unit_assignments.recruiter_name`) — วัดจริง 30 ก.ย.: แบงค์ถือ 190 ใบขอ มีผู้สมัคร 7 คน ·
     * ไม่ใช่คนที่กดเก็บ (เก็บแล้วไปอยู่แท็บการติดตามของคนเก็บเอง) และไม่ใช่ผู้รับผิดชอบลิงก์ (ทีม Online)
     * ใบขอยังโหลดไม่ขึ้น = ไม่มีหัวข้อนี้ (ห้ามตัดแถวทิ้ง — engine กันให้)
     */
    key: 'recruiter',
    label: 'เจ้าหน้าที่สรรหา',
    ui: 'check',
    searchable: true,
    available: (facts) => Boolean(facts.recruiterOf),
    values: (r, facts) => [trimOr(facts.recruiterOf?.(r))],
  },
  {
    key: 'call',
    label: 'ผลโทรล่าสุด',
    ui: 'chip',
    order: ['interested', 'pending', 'not_interested', 'none'],
    labelOf: (v) => CALL_LABEL[v] ?? v,
    values: (r) => [applicantCallValue(r)],
  },
  {
    /**
     * ใบขอที่สมัคร — 🔴 **คีย์ด้วย `job_id` ไม่ใช่ชื่องาน** (27 ก.ย. 2569)
     * ปุ่ม "ดูรายชื่อ" บนการ์ดกล่องงานพามาแท็บนี้พร้อมติ๊กใบนั้นให้ (เจ้าของสั่งห้ามเด้งไปหน้าใบขอ)
     * ชื่องานที่ผู้สมัครเห็นตอนสมัครเปลี่ยนตามประกาศได้ ⇒ เทียบด้วยชื่อแล้วหลุด ·
     * ใบสมัครที่ไม่มี `job_id` (ประกาศลอย) ใช้ชื่องานแทน · คำบนจอ = ชื่องาน (ดู `buildApplicantFacets`)
     */
    key: 'job',
    label: 'ใบขอที่สมัคร',
    ui: 'check',
    searchable: true,
    values: (r) => [applicantJobValue(r)],
  },
  {
    /** ⚠️ ผู้สมัครพิมพ์เอง — มีคำพิมพ์ผิดปน (เช่น "พยักงานขับรถ") โชว์ตามจริง ไม่เดาแก้ */
    key: 'position',
    label: 'ตำแหน่งที่สนใจ',
    ui: 'check',
    searchable: true,
    values: (r) => [trimOr(r.position_interest)],
  },
  {
    key: 'province',
    label: 'จังหวัดผู้สมัคร',
    ui: 'check',
    searchable: true,
    values: (r) => [trimOr(r.province)],
  },
  {
    /** อำเภอ — โผล่เมื่อเลือกจังหวัดแล้วเท่านั้น (แบบเดียวกับกล่องงาน) */
    key: 'district',
    label: 'อำเภอผู้สมัคร',
    ui: 'check',
    searchable: true,
    values: (r, _facts, state) => {
      const provinces = (state.selection.province ?? []).filter((p) => p !== UNSPECIFIED);
      if (provinces.length === 0) return [];
      const prov = trimOr(r.province);
      return provinces.includes(prov) ? [trimOr(r.district)] : [];
    },
  },
  {
    key: 'age',
    label: 'ช่วงอายุ',
    ui: 'chip',
    order: AGE_BANDS.map((b) => b.id),
    labelOf: (v) => AGE_BANDS.find((b) => b.id === v)?.label ?? v,
    values: (r) => {
      if (typeof r.age !== 'number' || !Number.isFinite(r.age)) return [UNSPECIFIED];
      return [AGE_BANDS.find((b) => r.age! >= b.min && r.age! <= b.max)?.id ?? UNSPECIFIED];
    },
  },
  {
    key: 'education',
    label: 'วุฒิการศึกษา',
    ui: 'check',
    values: (r) => [trimOr(r.education)],
  },
  {
    key: 'days',
    label: 'สมัครมาแล้ว',
    ui: 'chip',
    order: DAY_BANDS.map((b) => b.id),
    labelOf: (v) => DAY_BANDS.find((b) => b.id === v)?.label ?? v,
    values: (r, facts) => {
      const d = ymdOf(r.created_at);
      if (!d) return [UNSPECIFIED];
      const n = Math.max(0, ymdDiffDays(d, toYmdBangkok(facts.now)));
      return [DAY_BANDS.find((b) => n <= b.max)?.id ?? UNSPECIFIED];
    },
  },
  {
    /** ช่องทางจากตารางช่องทาง (แม่นกว่า) ก่อน · ไม่มีค่อยใช้ที่ผู้สมัครเลือกเอง */
    key: 'channel',
    label: 'ช่องทาง',
    ui: 'check',
    values: (r) => [
      trimOr(r.channel_label || (r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : '')),
    ],
  },
  {
    key: 'gender',
    label: 'เพศ',
    ui: 'check',
    order: ['male', 'female', 'other'],
    labelOf: (v) => GENDER_LABEL[v] ?? v,
    values: (r) => [r.gender && r.gender in GENDER_LABEL ? r.gender : UNSPECIFIED],
  },
];

export const APPLICANT_FACET_KEYS: readonly ApplicantFacetKey[] = FACETS.map((f) => f.key);
const FACET_BY_KEY = new Map(FACETS.map((f) => [f.key, f]));

export function applicantFacetLabel(key: ApplicantFacetKey): string {
  return FACET_BY_KEY.get(key)?.label ?? key;
}

export function applicantFacetValueLabel(key: ApplicantFacetKey, value: string): string {
  if (value === UNSPECIFIED) return unspecifiedLabel(key);
  const def = FACET_BY_KEY.get(key);
  return def?.labelOf ? def.labelOf(value) : value;
}

export function applyApplicantFilters(
  rows: readonly PublicApplication[],
  state: ApplicantFilterState,
  facts: ApplicantFacetFacts,
): PublicApplication[] {
  return applyFacetDefs(rows, FACETS, state, facts);
}

/** ค่าของหัวข้อ "ใบขอที่สมัคร" — `job_id` ก่อน · ไม่มีค่อยใช้ชื่องาน */
export function applicantJobValue(r: PublicApplication): string {
  const id = (r.job_id ?? '').trim();
  return id || trimOr(r.job_title || r.unit_name);
}

/**
 * คำบนจอของหัวข้อ "ใบขอที่สมัคร" — ค่าเป็น `job_id` จึงต้องแปลงเป็นชื่องานจากแถวจริง
 * ชื่อซ้ำกันคนละใบ = ต่อท้ายเลขที่ใบขอให้แยกออก · ไม่มีแถวของใบนั้นเลย = บอกเลขที่ใบขอ
 */
export function applicantJobLabels(rows: readonly PublicApplication[]): (value: string) => string {
  const titleById = new Map<string, string>();
  for (const r of rows) {
    const id = (r.job_id ?? '').trim();
    if (id && !titleById.has(id)) titleById.set(id, applicantFacetValueLabel('job', trimOr(r.job_title || r.unit_name)));
  }
  const idsPerTitle = new Map<string, number>();
  for (const t of titleById.values()) idsPerTitle.set(t, (idsPerTitle.get(t) ?? 0) + 1);
  const requestNo = (id: string) => id.slice(id.lastIndexOf(':') + 1);
  return (value) => {
    const title = titleById.get(value);
    if (title) return (idsPerTitle.get(title) ?? 0) > 1 ? `${title} · ${requestNo(value)}` : title;
    if (value.includes(':')) return `ใบขอ ${requestNo(value)}`;
    return applicantFacetValueLabel('job', value);
  };
}

export function buildApplicantFacets(
  rows: readonly PublicApplication[],
  state: ApplicantFilterState,
  facts: ApplicantFacetFacts,
): FacetView<ApplicantFacetKey>[] {
  const jobLabel = applicantJobLabels(rows);
  return buildFacetViews(rows, FACETS, state, facts, (key, value) =>
    key === 'job' ? jobLabel(value) : applicantFacetValueLabel(key, value),
  );
}

/**
 * หัวข้อที่ได้ Dropdown ของตัวเองบนแท็บผู้สมัคร (แบบเดียวกับกล่องงาน — เจ้าของเลือก 27 ก.ย. 2569)
 * หัวข้อนัดหมายมีเฉพาะแท็บติดตามนัดหมาย (engine ตัดให้เองในแท็บอื่น) · ที่เหลืออยู่ใน "ตัวกรองอื่น"
 */
export const APPLICANT_PRIMARY_FACETS: readonly ApplicantFacetKey[] = [
  'apptWhen',
  'apptPlace',
  'attendance',
  'recruiter',
  'call',
  'job',
  'province',
  'days',
];
export const APPLICANT_FACET_ATTACH: Partial<Record<ApplicantFacetKey, ApplicantFacetKey>> = {
  district: 'province',
};

export function countSelectedApplicantValues(state: ApplicantFilterState): number {
  return countSelectedValues(state, APPLICANT_FACET_KEYS);
}

/** สลับค่า — เอาจังหวัดออกแล้วอำเภอของจังหวัดนั้นที่ติ๊กไว้หลุดตาม */
export function toggleApplicantFacetValue(
  state: ApplicantFilterState,
  key: ApplicantFacetKey,
  value: string,
): ApplicantFilterState {
  const selection = toggleSelection(state.selection, key, value);
  if (key === 'province' && (selection.province ?? []).filter((p) => p !== UNSPECIFIED).length === 0) {
    selection.district = [];
  }
  return { ...state, selection };
}

export function describeApplicantFilters(state: ApplicantFilterState): string {
  return describeSelection(state, APPLICANT_FACET_KEYS, applicantFacetLabel, applicantFacetValueLabel);
}

/**
 * ตัวกรองอยู่ใน URL — prefix `a.` (คนละชุดกับ `f.` ของกล่องงาน · สลับแท็บแล้วไม่ชนกัน)
 * ต่อยอดจาก params เดิมเสมอ (`view` `tab` `list` `lead` `bucket` ต้องรอด)
 */
export const APPLICANT_FILTER_PARAM_PREFIX = 'a.';

export function readApplicantFilterState(params: URLSearchParams): ApplicantFilterState {
  return { selection: readSelectionParams(params, APPLICANT_FILTER_PARAM_PREFIX, APPLICANT_FACET_KEYS) };
}

export function writeApplicantFilterState(
  params: URLSearchParams,
  state: ApplicantFilterState,
): URLSearchParams {
  return writeSelectionParams(params, APPLICANT_FILTER_PARAM_PREFIX, APPLICANT_FACET_KEYS, state.selection);
}
