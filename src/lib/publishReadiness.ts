/**
 * ═══ ใบนี้ "พร้อมประกาศ" ไหม — ตัวตัดสินที่เดียวของการ์ดกล่องงาน · ป๊อปประกาศ · หัวข้อกรอง (2 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"กล่องงานอะ มันดูงงๆ ขอแนวทางที่ดีกว่านี้"* → Choice **"B ป๊อปหน้าเดียว ระบบร่างให้"**
 *
 * วัดจริงก่อนรื้อ (346 ใบเปิด · 2 ต.ค. 2569): "ติดขั้น 1" 193 · "ขั้น 2" 122 · "ขั้น 3" 4 · "ขั้น 4" 21 —
 * เลขขั้นบนการ์ดเป็นแค่ **ร่องรอย** (มีหมายเหตุ / แก้ช่อง / มีลิงก์) ไม่ได้บอกว่าใบไหนขึ้นประกาศได้
 * และไม่มีใครใส่อำเภอเองเลย 337/340 ใบ ⇒ เลิกบอก "ติดขั้น N" เปลี่ยนเป็นบอก **"ขาดอะไร"**
 *
 * 🔴 กติกา: ดูจาก **สิ่งที่คนนอกจะเห็นจริง** (ตัวคำนวณชุดเดียวกับหน้าสมัครสาธารณะ) ไม่ใช่จากร่องรอยว่าใครแตะอะไร
 * - สถานที่ = `publicSafeAddress` ให้ข้อความได้ไหม (ทีม Online ตั้งเอง หรือระบบอ่านจังหวัดจากที่อยู่ใบขอได้)
 * - รายได้  = คนนอกเห็นเลข **พร้อมหน่วย** ไหม (ตั้งเอง · ERP คิดต่อเดือนให้ได้ · เลขดิบไม่รู้หน่วย = ขาด — ห้ามเดา)
 * - เพศ     = `genderNeedsChoice` (ใบขอเขียน O/ว่าง และยังไม่มีใครเลือก) — ด่านเดียวที่ **กันกดประกาศ** (เจ้าของเคาะ 26 ก.ย. 2569)
 * - ใบที่ ERP พาไปคัดเลือก / รอเริ่มงาน / เริ่มงานแล้ว = "มีคนเริ่มงานแล้ว" (นิยามเดียวกับก้อนย่อยบนหัว `stillSourcing`)
 *
 * ⚠️ **ไม่แตะเลขบนหัวกล่องงาน** (`buildReleaseLedger`) — สามก้อนและก้อนย่อยยังคิดแบบเดิม · ป๊อป 4 หน้าเป็นค่าเริ่มอีกครั้งตั้งแต่ 4 ต.ค. 2569 (ป๊อปหน้าเดียว = `?popup=sheet`)
 */
import type { JobRequest } from '@/types';
import { genderNeedsChoice } from '@/lib/genderRequirement';
import { publicSafeAddress, publicWorkSchedule } from '@/lib/publicJobPrivacy';
import { incomeDisplay } from '@/lib/incomeLabel';
import { INCOME_PERIOD_LABEL } from '@/lib/incomeBreakdown';
import { JOB_BOX_LABEL, openJobBoxOf, type OpenBoxKey } from '@/lib/jobBoxGroups';

const NUM = new Intl.NumberFormat('th-TH');

/** ช่องที่ขาดได้ — ลำดับนี้คือลำดับบนจอ */
export const PUBLISH_GAP_KEYS = ['place', 'income', 'gender'] as const;
export type PublishGapKey = (typeof PUBLISH_GAP_KEYS)[number];

export const PUBLISH_GAP_LABEL: Record<PublishGapKey, string> = {
  place: 'สถานที่',
  income: 'รายได้',
  gender: 'เพศ',
};

export type PublicIncome = {
  /** ข้อความที่คนนอกเห็น เช่น "12,000 บาท/เดือน" */
  text: string;
  /** รู้หน่วยไหม — เลขดิบจาก ERP ที่ไม่รู้ว่าต่อวันหรือต่อเดือน = false */
  unit: boolean;
  /** ทีม Online ตั้งเองไหม (ไม่ใช่เลขที่ระบบคิดจากใบขอ) */
  manual: boolean;
  /** คำเตือนภายในสำหรับ tooltip (เจ้าหน้าที่เท่านั้น) — เลขดิบไม่รู้หน่วย / ERP คิดให้ · ตั้งเอง = ไม่มี */
  hint: string | null;
};

/**
 * รายได้ที่คนนอกจะเห็น — ลำดับเดียวกับหน้าสมัครสาธารณะ (`api/_handlers/public/jobs.ts` + การ์ดฝั่งคนนอก):
 * 1. รายได้แยกรายการที่ทีม Online ตั้ง (`income_display`)
 * 2. ยอดเดี่ยวแบบเก่าที่ทีม Online ตั้ง (`field_overrides.total_income` — หน้าสาธารณะนับเป็นต่อเดือน)
 * 3. ERP: ต่อเดือนที่ feed คิดให้ (`monthly_income` — feed กล่องงานแนบตัวเดียวกับหน้าสาธารณะตั้งแต่ 2 ต.ค. 2569) ·
 *    ไม่ได้ก็เลขดิบที่ **ไม่รู้หน่วย**
 * `null` = ไม่มีรายได้ให้เห็นเลย · ข้อความตรงกับการ์ดฝั่งคนนอกเป๊ะ (รูป "฿15,000 ต่อเดือน" / "12,000 บาท/เดือน")
 */
export function publicIncomeOf(
  job: Pick<JobRequest, 'income_display' | 'field_overrides' | 'total_income' | 'monthly_income'>,
): PublicIncome | null {
  if (job.income_display) {
    return {
      text: `฿${NUM.format(job.income_display.total)} ${INCOME_PERIOD_LABEL[job.income_display.period]}`,
      unit: true,
      manual: true,
      hint: null,
    };
  }
  const manual = job.field_overrides?.total_income;
  if (typeof manual === 'number' && manual > 0) {
    return { text: `${NUM.format(manual)} บาท/เดือน`, unit: true, manual: true, hint: null };
  }
  const d = incomeDisplay({ totalIncome: job.total_income, monthlyIncome: job.monthly_income });
  return d ? { text: d.text, unit: d.period !== 'unknown', manual: false, hint: d.hint } : null;
}

/**
 * ═══ ใบขอขาดข้อมูลอะไร — ตัวตัดสินที่เดียว (เจ้าของ 3 พ.ย. 2569 *"บอกเลยได้ไหมว่า ใบขอขาดอะไร เช่น ขาดอายุ ขาดเพศ ขาดคุณสมบัติ ขาดเงินเดือน"*) ═══
 * ดูจากค่าที่ใช้จริงหลังรวม ERP + ที่ทีมแก้ (รายละเอียดงาน/คุณสมบัติ ค่าตั้งต้น = ERP ตั้งแต่ 3 พ.ย. 2569)
 * 3 ช่องแรกคือชุดเดียวกับ "พร้อมประกาศ" ของกล่องงาน (`publishGapsOf`) — ห้ามเขียนเงื่อนไขซ้ำที่อื่น
 * "เงินเดือน" ใช้คำว่า **รายได้** ให้ตรงกับชิปกล่องงาน (นิยามเดียวกัน: คนนอกเห็นเลขพร้อมหน่วย)
 */
export const REQUEST_GAP_KEYS = ['place', 'income', 'gender', 'age', 'schedule', 'requirements', 'details'] as const;
export type RequestGapKey = (typeof REQUEST_GAP_KEYS)[number];

export const REQUEST_GAP_LABEL: Record<RequestGapKey, string> = {
  ...PUBLISH_GAP_LABEL,
  age: 'อายุ',
  schedule: 'วันเวลาทำงาน',
  requirements: 'คุณสมบัติ',
  details: 'รายละเอียดงาน',
};

const hasLines = (xs: readonly string[] | null | undefined) => (xs ?? []).some((x) => x.trim() !== '');

const REQUEST_GAP_TEST: Record<RequestGapKey, (job: JobRequest) => boolean> = {
  place: (job) => !publicSafeAddress(job),
  income: (job) => {
    const income = publicIncomeOf(job);
    return !income || !income.unit;
  },
  gender: (job) => genderNeedsChoice(job),
  age: (job) => job.age_range_min == null && job.age_range_max == null,
  schedule: (job) => !publicWorkSchedule(job.work_schedule),
  requirements: (job) => !hasLines(job.requirements),
  details: (job) => !hasLines(job.job_details),
};

/** ใบขอขาดข้อมูลอะไรบ้าง (ลำดับตามบนจอ) — ว่าง = ครบ */
export function requestGapsOf(job: JobRequest): RequestGapKey[] {
  return REQUEST_GAP_KEYS.filter((k) => REQUEST_GAP_TEST[k](job));
}

/**
 * ตัวกรอง "ข้อมูลใบขอ" หน้าใบขอ (เจ้าของ 3 พ.ย. 2569 "เพิ่ม filter ดูว่าใบขอไหนรายละเอียดไม่ครบ")
 * missing = ขาดอะไรก็ได้ · complete = ครบ · ชื่อช่อง = ขาดช่องนั้น · เลือกหลายค่า = ตรงค่าใดค่าหนึ่ง · ตัวตัดสิน `requestGapsOf` ตัวเดียวกับบรรทัด "ขาด:"
 */
export const REQUEST_GAP_FILTER_VALUES = ['missing', 'complete', ...REQUEST_GAP_KEYS] as const;
export type RequestGapFilterValue = (typeof REQUEST_GAP_FILTER_VALUES)[number];
export const REQUEST_GAP_FILTER_OPTIONS: { value: RequestGapFilterValue; label: string }[] = [
  { value: 'missing', label: 'ไม่ครบ' },
  { value: 'complete', label: 'ครบ' },
  ...REQUEST_GAP_KEYS.map((k) => ({ value: k, label: `ขาด${REQUEST_GAP_LABEL[k]}` })),
];
export function matchesRequestGapFilter(job: JobRequest, values: readonly RequestGapFilterValue[]): boolean {
  if (values.length === 0) return true;
  const gaps = requestGapsOf(job);
  return values.some((v) => (v === 'missing' ? gaps.length > 0 : v === 'complete' ? gaps.length === 0 : gaps.includes(v)));
}

/** ใบนี้ยังขาดอะไรก่อนขึ้นประกาศ — ว่าง = ครบ (ชุดย่อยของ `requestGapsOf`) */
export function publishGapsOf(job: JobRequest): PublishGapKey[] {
  return PUBLISH_GAP_KEYS.filter((k) => REQUEST_GAP_TEST[k](job));
}

export type PublishReadiness =
  | { kind: 'released' }
  | { kind: 'skipped' }
  | { kind: 'moved'; box: Exclude<OpenBoxKey, 'sourcing'> }
  | { kind: 'ready' }
  | { kind: 'gaps'; gaps: PublishGapKey[] };

export type PublishReadinessFacts = {
  /** อยู่ในทะเบียนประกาศแล้ว (`job_public_releases`) */
  isReleased: (job: JobRequest) => boolean;
  /** ทีม Online ตั้ง "ไม่ประกาศ + เหตุผล" ไว้ (migration 129) — ไม่ส่ง = ไม่รู้ ถือว่าไม่ได้ตั้ง */
  isSkipped?: (job: JobRequest) => boolean;
};

/**
 * ใบนี้อยู่สภาพไหน — **ตอบได้อย่างเดียวเสมอ** ลำดับ: ประกาศแล้ว → ตั้งไม่ประกาศ → มีคนเริ่มงานแล้ว → ขาด/พร้อม
 * ⚠️ เรียกกับ **ใบเปิด** เท่านั้น (ใบปิด/ยกเลิกไม่มีงานประกาศ)
 */
export function publishReadinessOf(job: JobRequest, facts: PublishReadinessFacts): PublishReadiness {
  if (facts.isReleased(job)) return { kind: 'released' };
  if (facts.isSkipped?.(job)) return { kind: 'skipped' };
  const box = openJobBoxOf(job);
  if (box !== 'sourcing') return { kind: 'moved', box };
  const gaps = publishGapsOf(job);
  return gaps.length > 0 ? { kind: 'gaps', gaps } : { kind: 'ready' };
}

/** คำบนชิป — 🔴 แหล่งเดียว ห้ามพิมพ์ซ้ำที่จอ */
export function readinessChipText(r: PublishReadiness): string {
  switch (r.kind) {
    case 'released':
      return 'ประกาศแล้ว';
    case 'skipped':
      return 'ไม่ประกาศ';
    case 'moved':
      return JOB_BOX_LABEL[r.box];
    case 'ready':
      return 'พร้อมประกาศ';
    case 'gaps':
      return `ขาด: ${r.gaps.map((g) => PUBLISH_GAP_LABEL[g]).join(' · ')}`;
  }
}

/** คำบนปุ่มท้ายการ์ด — ปุ่มเปิดป๊อปใบเดียวกันทุกสภาพ แค่บอกว่าเปิดไปทำอะไร */
export function readinessActionText(r: PublishReadiness | null): string {
  if (!r) return 'เปิดดู';
  if (r.kind === 'ready') return 'ตรวจแล้วประกาศ';
  if (r.kind === 'gaps') return `เติม ${NUM.format(r.gaps.length)} ช่อง`;
  return 'เปิดดู';
}

/* ═══ หัวข้อกรอง "พร้อมประกาศไหม" (แทนหัวข้อ "ติดขั้น" ที่ถอดไป) ═══ */

export const READINESS_FACET_ORDER = ['ready', 'gap_place', 'gap_income', 'gap_gender', 'moved', 'skipped'] as const;
export type ReadinessFacetValue = (typeof READINESS_FACET_ORDER)[number];

export const READINESS_FACET_LABEL: Record<ReadinessFacetValue, string> = {
  ready: 'พร้อมประกาศ',
  gap_place: 'ขาดสถานที่',
  gap_income: 'ขาดรายได้',
  gap_gender: 'ขาดเพศ',
  moved: 'มีคนเริ่มงานแล้ว',
  skipped: 'ตั้งไม่ประกาศไว้',
};

/**
 * ค่าในหัวข้อกรองของใบนี้ — ใบที่ขาดหลายช่องอยู่หลายค่า (ติ๊ก "ขาดสถานที่" แล้วใบที่ขาดทั้งสถานที่และเพศต้องยังอยู่)
 * ใบที่ประกาศแล้วไม่อยู่ในหัวข้อนี้ (ติ๊กอะไรก็หลุด — เหมือนหัวข้อติดขั้นเดิม)
 */
export function readinessFacetValues(r: PublishReadiness): ReadinessFacetValue[] {
  switch (r.kind) {
    case 'released':
      return [];
    case 'skipped':
      return ['skipped'];
    case 'moved':
      return ['moved'];
    case 'ready':
      return ['ready'];
    case 'gaps':
      return r.gaps.map((g) => `gap_${g}` as ReadinessFacetValue);
  }
}
