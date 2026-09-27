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

/** ของที่ต้องรู้ตอนคิดค่า — แท็บ (หัวข้อนัดหมายโผล่เฉพาะแท็บนัด) + เวลาปัจจุบัน (ส่งเข้ามาให้เทสต์ได้) */
export type ApplicantFacetFacts = { tab: RmTab; now: Date };

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
    key: 'call',
    label: 'ผลโทรล่าสุด',
    ui: 'chip',
    order: ['interested', 'pending', 'not_interested', 'none'],
    labelOf: (v) => CALL_LABEL[v] ?? v,
    values: (r) => [applicantCallValue(r)],
  },
  {
    key: 'job',
    label: 'ใบขอที่สมัคร',
    ui: 'check',
    searchable: true,
    values: (r) => [trimOr(r.job_title || r.unit_name)],
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

export function buildApplicantFacets(
  rows: readonly PublicApplication[],
  state: ApplicantFilterState,
  facts: ApplicantFacetFacts,
): FacetView<ApplicantFacetKey>[] {
  return buildFacetViews(rows, FACETS, state, facts, applicantFacetValueLabel);
}

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
