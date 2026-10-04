/**
 * ═══ ฟอร์ม "ข้อมูลที่จะขึ้นประกาศ" (ป๊อปไล่งานขั้น 2/3) — ตรรกะล้วน ═══
 *
 * แยกออกมาจาก `EditPublicJobFieldsDialog` 27 ก.ย. 2569 เพื่อให้เทสต์คุมได้ — หลังเจอบั๊ก
 * auto-save เขียนทับข้อมูลจริงตอน "เปิดดูเฉย ๆ" (รายละเอียดที่ `formDiffersFromJob`)
 */
import type { JobRequest } from '@/types';
import { EXTRA_BENEFITS, benefitDisplayLabels } from '@/lib/extraBenefits';
import { BENEFIT_LABEL_MAX, cleanBenefitLines, type IncomePeriod } from '@/lib/incomeBreakdown';
import { parseThaiAddressParts } from '@/lib/parseThaiJobAddress';
import { getDistrictOptions, getProvinceOptions, getSubdistrictOptions } from '@/lib/thaiAddressCascade';
import {
  PUBLIC_TOGGLE_FIELDS,
  readPublicVisibility,
  type PublicToggleField,
} from '@/lib/publicFieldVisibility';
import { cleanPayCycles, payCyclesOf, type PayCycle } from '@/lib/payCycle';

/** state ที่ประกอบเป็น patch — แชร์ระหว่างปุ่มบันทึกกับ auto-save (22 ก.ย. 2569) */
export type OverridesFormState = {
  job: JobRequest;
  province: string;
  district: string;
  subdistrict: string;
  incomePeriod: IncomePeriod;
  incomeRows: { label: string; amount: string }[];
  incomeTotal: string;
  benefitText: string;
  /** รอบรับเงิน (4 ต.ค. 2569 — ย้ายออกจากสวัสดิการ) */
  payCycles: PayCycle[];
  visibility: Record<PublicToggleField, boolean>;
};

/**
 * ประกอบ patch ของ field_overrides จาก state ปัจจุบัน — **จุดเดียวที่สร้าง patch**
 * 🔴 spread ของเดิมก่อนเสมอ (API เขียนทับทั้งก้อน ไม่ merge)
 */
export function buildOverridesPatch(st: OverridesFormState): NonNullable<JobRequest['field_overrides']> {
  const parsedLines = st.incomeRows
    .map((r) => ({ label: r.label.trim(), amount: Math.trunc(Number(r.amount)) }))
    .filter((r) => r.label !== '' && Number.isFinite(r.amount) && r.amount > 0);
  const hasBreakdown = parsedLines.length > 0;
  const totalNum = st.incomeTotal.trim() === '' ? null : Math.trunc(Number(st.incomeTotal) || 0);
  const benefitLines = cleanBenefitLines(st.benefitText.split('\n'));
  const existing = (st.job.field_overrides ?? {}) as Record<string, unknown>;
  const visPatch: Partial<Record<PublicToggleField, boolean>> = {};
  for (const f of PUBLIC_TOGGLE_FIELDS) if (!st.visibility[f]) visPatch[f] = false;
  return {
    ...existing,
    province: st.province.trim() || null,
    district: st.district.trim() || null,
    subdistrict: st.subdistrict.trim() || null,
    total_income: hasBreakdown
      ? null
      : st.incomeTotal.trim() === ''
        ? null
        : Math.max(0, Math.trunc(Number(st.incomeTotal) || 0)),
    benefits: benefitLines.length > 0 ? benefitLines : null,
    pay_cycles: cleanPayCycles(st.payCycles).length > 0 ? cleanPayCycles(st.payCycles) : null,
    income: hasBreakdown ? { period: st.incomePeriod, lines: parsedLines, total: totalNum } : null,
    public_visibility: Object.keys(visPatch).length > 0 ? visPatch : null,
  } as NonNullable<JobRequest['field_overrides']>;
}

/**
 * ค่าในฟอร์มที่ได้จากใบขอ **ตามที่บันทึกไว้ตอนนี้** — ที่เดียว (ใช้ทั้งค่าตั้งต้นและตัวเทียบ)
 *
 * 🔴 **ยอดรวมเอาเฉพาะที่ทีม Online ตั้งไว้** (`field_overrides.total_income`) — ไม่เติมเลข ERP
 * (เจ้าของเคาะ 26 ก.ย. 2569: ใบที่ยังไม่ตั้งรายได้ = "Online ยังไม่ได้ทำใบนั้น" · ห้ามเอาเลข ERP ไปอุด)
 * เดิมเติม `job.total_income` (= เลข ERP ถ้ายังไม่ตั้ง) ลงช่องให้เอง ⇒ พอบันทึกอะไรในขั้นนี้
 * เลข ERP (บางใบเป็นค่าแรงต่อวัน 400) กลายเป็น "รายได้ที่ Online ตั้ง" ทันทีโดยไม่มีใครตั้งใจ
 * ว่าง = ช่องขึ้น "ใช้ค่าจาก ERP" และหน้าสาธารณะใช้เลขเดิมเหมือนเดิม
 */
export function formStateFromJob(job: JobRequest): Omit<OverridesFormState, 'job'> {
  const saved = job.field_overrides?.income;
  const lines = saved && saved.lines.length > 0 ? saved : null;
  const savedTotal = job.field_overrides?.total_income;
  return {
    province: job.override_province ?? '',
    district: job.override_district ?? '',
    subdistrict: job.override_subdistrict ?? '',
    incomePeriod: lines ? lines.period : 'monthly',
    incomeRows: lines ? lines.lines.map((l) => ({ label: l.label, amount: String(l.amount) })) : [],
    incomeTotal: lines
      ? lines.total != null
        ? String(lines.total)
        : ''
      : typeof savedTotal === 'number'
        ? String(savedTotal)
        : '',
    // ค่าเก่าที่ติ๊กเป็นคีย์ → แปลงเป็นคำอ่านให้แก้ต่อได้ (ห้ามหายเงียบ)
    // "จ่ายรายวัน" ยุคเก่าถูกตัดออกจากสวัสดิการ (benefitDisplayLabels) แล้วมาเป็นรอบรับเงินแทน — ทั้งสองฝั่งของตัวเทียบ
    // คิดแบบเดียวกัน ⇒ เปิดดูเฉย ๆ ไม่บันทึก · ย้ายจริงตอนมีคนแก้หน้า 3
    benefitText: benefitDisplayLabels(job.extra_benefits).join('\n'),
    payCycles: payCyclesOf(job),
    visibility: readPublicVisibility(job.field_overrides?.public_visibility),
  };
}

/**
 * ฟอร์มตอนนี้ **ต่างจากที่บันทึกไว้ในใบขอ** ไหม — 🔴 ด่านเดียวที่ตัดสินว่าจะยิงบันทึก
 *
 * บั๊กที่ทำให้ต้องมี (เจอตอนตรวจงาน 27 ก.ย. 2569 — ข้อมูลจริงโดนเขียนทับ):
 * ของเดิมกันด้วยธง "กำลังเติมค่า" ซึ่งแข่งเวลากับ React ⇒ แค่ **เปิดขั้น 2/3 ดูเฉย ๆ** ก็ยิงบันทึก
 * และหลังบันทึก ใบขอฝั่งแม่เปลี่ยน → ฟอร์มเติมค่าใหม่ → ยิงอีก **วนทุก 1.5 วินาที** (ใบเดียว 44 ครั้ง)
 * แถมเขียนค่าที่เติมไม่ทัน (การตั้ง "ซ่อนรายได้จากหน้าสาธารณะ" ถูกล้าง) ⇒ เปลี่ยนเป็นเทียบค่าจริง:
 * ฟอร์มเท่ากับใบขอ = ไม่ยิง ไม่ว่าจะ render กี่รอบ
 */
export function formDiffersFromJob(st: OverridesFormState): boolean {
  return (
    JSON.stringify(buildOverridesPatch(st)) !==
    JSON.stringify(buildOverridesPatch({ job: st.job, ...formStateFromJob(st.job) }))
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
 * ป๊อปไล่งานโฉมใหม่ (30 ก.ย. 2569) — ขั้น 2 เลือก "ใบขอเขียนว่า / ใส่รายละเอียดเอง" ·
 * ขั้น 3 รายได้เลือกได้ทางเดียว + สวัสดิการติ๊กจากรายการทั่วไป
 *
 * 🔴 ทุกตัวข้างล่างเป็นแค่ "ตัวแปลงหน้าฟอร์ม" — ของที่บันทึกยังผ่าน `buildOverridesPatch` ตัวเดิม
 *    และต้องแปลงไป-กลับได้ตรงเป๊ะ: เปิดดูเฉย ๆ ห้ามทำให้ `formDiffersFromJob` เป็นจริง
 *    (บทเรียน 27 ก.ย. — ป๊อปวนบันทึกเองทุก 1.5 วิ) · มีเทสต์ไป-กลับคุมที่ `publicFieldsForm.test.ts`
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ขั้น 2 — ใช้ที่อยู่ตามใบขอ (ระบบอ่านให้) หรือใส่จังหวัด/อำเภอ/ตำบลเอง */
export type PlaceMode = 'request' | 'manual';

/** มีช่องไหนถูกตั้งเองไว้ = "ใส่รายละเอียดเอง" · ว่างหมด = ใช้ตามใบขอ */
export function placeModeOf(p: Pick<OverridesFormState, 'province' | 'district' | 'subdistrict'>): PlaceMode {
  return p.province.trim() || p.district.trim() || p.subdistrict.trim() ? 'manual' : 'request';
}

const PLACE_PREFIX = /^(?:เขต|อำเภอ|อ\.|แขวง|ตำบล|ต\.)\s*/;

/**
 * หาค่าในรายการมาตรฐานที่ตรงกับข้อความที่ถอดได้ — ตัวถอดคืนมาแบบ "เขตบางรัก" หรือ
 * "ตำบลบางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ" (ติดคำนำหน้า/ข้อความท้าย) ส่วนรายการเป็นชื่อเปล่า ⇒
 * ตัดคำนำหน้าแล้วเอาชื่อที่ยาวที่สุดที่ข้อความขึ้นต้นด้วย (ต้องจบคำพอดี — "บางพลี" ไม่ชนะ "บางพลีใหญ่")
 * ไม่เจอ = `''` (ห้ามเดา)
 */
function pickPlaceOption(raw: string | null | undefined, options: readonly string[]): string {
  const t = (raw ?? '').trim().replace(PLACE_PREFIX, '');
  if (!t) return '';
  if (options.includes(t)) return t;
  let best = '';
  for (const o of options) {
    if (o.length > best.length && t.startsWith(o) && (t.length === o.length || /\s/.test(t[o.length]))) best = o;
  }
  return best;
}

/**
 * ค่าตั้งต้นตอนติ๊ก "ใส่รายละเอียดเอง" — เอาที่ระบบอ่านจากที่อยู่ในใบขอได้ มาเลือกไว้ให้ก่อน
 * (ลดการคีย์ · ถูกแล้วไม่ต้องแตะ) · เฉพาะค่าที่อยู่ในรายการมาตรฐานเท่านั้น
 */
export function placeGuessForForm(
  address: string | null | undefined,
): Pick<OverridesFormState, 'province' | 'district' | 'subdistrict'> {
  const parts = parseThaiAddressParts(address ?? '');
  const province = pickPlaceOption(parts.province, getProvinceOptions());
  const district = province ? pickPlaceOption(parts.district, getDistrictOptions(province)) : '';
  const subdistrict =
    province && district ? pickPlaceOption(parts.subdistrict, getSubdistrictOptions(province, district)) : '';
  return { province, district, subdistrict };
}

/**
 * ═══ ขั้น 3 รายได้ — เลือกได้ทางเดียว (เจ้าของเลือก Choice "ติ๊กเลือกได้อย่างเดียว" 30 ก.ย. 2569) ═══
 * - `request` ตามใบขอ: ติ๊กบรรทัดอัตราจากใบขอ ได้ยอดรวมให้ (ปรับยอดรวมเองได้แบบเดิม)
 * - `resigned` รายได้คนเก่า: ยอดสุทธิเฉลี่ยต่อเดือนหนึ่งบรรทัด
 * - `manual` ใส่เอง: ยอดเดียว + ต่อวัน/ต่อเดือน
 */
export type IncomeMode = 'request' | 'resigned' | 'manual';

/**
 * ป้ายบรรทัดรายได้ของสองทางหลัง — 🔴 **คำนี้ขึ้นหน้าสาธารณะ** ห้ามเขียนคำภายใน
 * (เช่น "คนเก่า"/"eSlip") ให้ผู้สมัครเห็น · ป้ายเป็นตัวบอกด้วยว่าเปิดฟอร์มใหม่ต้องกลับมาทางไหน
 */
export const RESIGNED_INCOME_LINE_LABEL = 'รายได้โดยประมาณ';
export const MANUAL_INCOME_LINE_LABEL = 'รายได้';

type IncomeRow = OverridesFormState['incomeRows'][number];
type IncomeFormPart = Pick<OverridesFormState, 'incomePeriod' | 'incomeRows' | 'incomeTotal'>;

/** ของในฟอร์มรายได้ทั้งสามทาง — สลับไปมาแล้วค่าที่ใส่ไว้ของแต่ละทางไม่หาย */
export type IncomeDraft = {
  mode: IncomeMode;
  period: OverridesFormState['incomePeriod'];
  requestRows: IncomeRow[];
  requestTotal: string;
  resignedRows: IncomeRow[];
  manualAmount: string;
  /**
   * ยอดที่ใส่เองแบบเดิม — เก็บเป็น `total_income` เฉย ๆ (ไม่มีหน่วย หน้าสาธารณะนับเป็นต่อเดือน)
   * ไม่แตะ = บันทึกแบบเดิม (เปิดดูห้ามเขียนทับ) · แก้ยอด/หน่วยเมื่อไหร่ค่อยเปลี่ยนเป็นแบบมีหน่วย
   */
  manualLegacy: boolean;
};

/** ของที่บันทึกไว้ → ฟอร์มสามทาง (ยังไม่ตั้งอะไร = ทาง "ตามใบขอ" ที่ยังไม่ติ๊กบรรทัดไหน) */
export function incomeDraftFromForm(f: IncomeFormPart): IncomeDraft {
  const base: IncomeDraft = {
    mode: 'request',
    period: f.incomePeriod,
    requestRows: [],
    requestTotal: '',
    resignedRows: [],
    manualAmount: '',
    manualLegacy: false,
  };
  if (f.incomeRows.length === 0) {
    return f.incomeTotal.trim() === '' ? base : { ...base, mode: 'manual', manualAmount: f.incomeTotal, manualLegacy: true };
  }
  if (f.incomeRows.length === 1 && f.incomeTotal.trim() === '') {
    const label = f.incomeRows[0].label.trim();
    if (label === RESIGNED_INCOME_LINE_LABEL) return { ...base, mode: 'resigned', resignedRows: f.incomeRows };
    if (label === MANUAL_INCOME_LINE_LABEL) return { ...base, mode: 'manual', manualAmount: f.incomeRows[0].amount };
  }
  return { ...base, requestRows: f.incomeRows, requestTotal: f.incomeTotal };
}

/** ฟอร์มสามทาง → ของที่จะบันทึก (เฉพาะทางที่ติ๊กอยู่) */
export function incomeFormFromDraft(d: IncomeDraft): IncomeFormPart {
  if (d.mode === 'resigned') return { incomePeriod: d.period, incomeRows: d.resignedRows, incomeTotal: '' };
  if (d.mode === 'manual') {
    if (d.manualLegacy) return { incomePeriod: d.period, incomeRows: [], incomeTotal: d.manualAmount };
    return {
      incomePeriod: d.period,
      incomeRows: d.manualAmount.trim() ? [{ label: MANUAL_INCOME_LINE_LABEL, amount: d.manualAmount }] : [],
      incomeTotal: '',
    };
  }
  return { incomePeriod: d.period, incomeRows: d.requestRows, incomeTotal: d.requestTotal };
}

/**
 * ═══ ขั้น 3 สวัสดิการ — ติ๊กจากรายการทั่วไป + ใส่รายละเอียดต่อท้าย (เจ้าของเลือก 30 ก.ย. 2569) ═══
 * > *"ฉันขอ Checkbox แล้วด้านขวาเป็นชื่อสวัสดิการ … ช่อง Freetext มาจากรายการที่ติ๊ก แล้วจะเพิ่มไรก็ตรงที่ติ๊ก
 * >  มีให้กดเพื่อใส่รายละเอียดเพิ่มเติม ลดการคีย์มือ"* → Choice "รายการทั่วไป (แนะนำ)" (`EXTRA_BENEFITS`)
 * บรรทัดที่บันทึก = ชื่อรายการ + เว้นวรรค + รายละเอียด (เช่น "รถรับส่ง จาก BTS หมอชิต") ·
 * บรรทัดที่ไม่ใช่รายการทั่วไป = รายการที่เพิ่มเอง · กติกาเดิมยังอยู่: 5 บรรทัด × 30 ตัวอักษร
 * 🔴 เรียงตามที่บันทึกไว้เสมอ (สลับลำดับ = บรรทัดต่างจากเดิม = เปิดดูแล้วเขียนทับ)
 */
export type BenefitEntry =
  | { kind: 'preset'; key: string; detail: string }
  | { kind: 'custom'; id: string; text: string };

const BENEFIT_PRESETS_LONGEST_FIRST = [...EXTRA_BENEFITS].sort((a, b) => b.label.length - a.label.length);

export function benefitPresetLabel(key: string): string {
  return EXTRA_BENEFITS.find((b) => b.key === key)?.label ?? '';
}

/** บรรทัดสวัสดิการที่บันทึกไว้ → รายการในฟอร์ม (รายการทั่วไปแต่ละอันใช้ได้ครั้งเดียว ซ้ำ = เพิ่มเอง) */
export function benefitEntriesFromText(text: string): BenefitEntry[] {
  const used = new Set<string>();
  return cleanBenefitLines(text.split('\n')).map((line, i): BenefitEntry => {
    const hit = BENEFIT_PRESETS_LONGEST_FIRST.find(
      (p) => !used.has(p.key) && (line === p.label || line.startsWith(`${p.label} `)),
    );
    if (!hit) return { kind: 'custom', id: `saved-${i}`, text: line };
    used.add(hit.key);
    return { kind: 'preset', key: hit.key, detail: line === hit.label ? '' : line.slice(hit.label.length + 1) };
  });
}

export function benefitLineOf(e: BenefitEntry): string {
  if (e.kind === 'custom') return e.text;
  const label = benefitPresetLabel(e.key);
  return e.detail.trim() ? `${label} ${e.detail}` : label;
}

/** รายการในฟอร์ม → ข้อความที่บันทึก (บรรทัดละรายการ · ตัวล้างเดิมตัดว่าง/ซ้ำ/เกินให้ตอนบันทึก) */
export function benefitTextFromEntries(entries: readonly BenefitEntry[]): string {
  return entries.map(benefitLineOf).join('\n');
}

/** รายละเอียดของรายการทั่วไปใส่ได้อีกกี่ตัวอักษร — ทั้งบรรทัดห้ามเกิน `BENEFIT_LABEL_MAX` */
export function benefitDetailMax(key: string): number {
  return Math.max(0, BENEFIT_LABEL_MAX - benefitPresetLabel(key).length - 1);
}

/** ฟอร์มนี้โชว์ส่วนไหน (= เป็นเจ้าของค่าส่วนไหน) — ขั้น 2 = สถานที่ · ขั้น 3 = รายได้ + สวัสดิการ */
export type FormSectionsOwned = {
  place: boolean;
  income: boolean;
  benefits: boolean;
  /** กล่อง "ให้ผู้สมัครเห็นอะไรบ้าง" — ไม่ส่ง = ติดมากับรายได้/สวัสดิการแบบเดิม (2 ต.ค. 2569: ป๊อปหน้าเดียวแยกเป็นแถวของตัวเอง) */
  visibility?: boolean;
};

/**
 * state ที่จะบันทึกของฟอร์มที่โชว์บางส่วน — **ส่วนที่ไม่ได้โชว์เอาจากใบขอล่าสุดเสมอ**
 *
 * 🔴 บั๊กที่กัน (เจอตอนรื้อป๊อป 30 ก.ย. 2569): ฟอร์มแต่ละขั้นถือค่าทุกช่องไว้ตั้งแต่เปิด · แก้สถานที่ขั้น 2
 * แล้วกด "ถัดไป" ก่อนบันทึกเสร็จ ⇒ ฟอร์มขั้น 3 เปิดมาพร้อมสถานที่เก่า · พอบันทึกขั้น 2 เสร็จ ใบขอเปลี่ยน
 * ⇒ ขั้น 3 เห็นว่า "ต่างจากใบขอ" แล้วบันทึกสถานที่เก่าทับกลับไป · ให้แต่ละขั้นเป็นเจ้าของเฉพาะช่องของตัวเอง
 */
export function formStateForSections(
  job: JobRequest,
  own: FormSectionsOwned,
  values: Omit<OverridesFormState, 'job'>,
): OverridesFormState {
  const saved = formStateFromJob(job);
  return {
    job,
    province: own.place ? values.province : saved.province,
    district: own.place ? values.district : saved.district,
    subdistrict: own.place ? values.subdistrict : saved.subdistrict,
    incomePeriod: own.income ? values.incomePeriod : saved.incomePeriod,
    incomeRows: own.income ? values.incomeRows : saved.incomeRows,
    incomeTotal: own.income ? values.incomeTotal : saved.incomeTotal,
    benefitText: own.benefits ? values.benefitText : saved.benefitText,
    payCycles: own.benefits ? values.payCycles : saved.payCycles,
    // ช่อง "ให้ผู้สมัครเห็นอะไรบ้าง" อยู่คู่ขั้น 3 — เว้นแต่ผู้เรียกบอกเองว่าถือ/ไม่ถือช่องนี้ (ป๊อปหน้าเดียว)
    visibility: (own.visibility ?? (own.income || own.benefits)) ? values.visibility : saved.visibility,
  };
}
