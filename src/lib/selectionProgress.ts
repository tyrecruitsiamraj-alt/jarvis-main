/**
 * ขั้นของคนที่คุยแล้วสนใจ + เช็คลิสต์เตรียมเข้างาน (migration 094)
 * เจ้าของสั่ง 16 ส.ค. 2569 ข้อ 5 และ 6 ของงานคัดสรร
 *
 * ⚠️ **คนละเรื่องกับ `status` เดิม** (new/contacted/converted/rejected) ซึ่งคือ
 * "ขั้นที่คนทำกับใบ" ที่ทั้งระบบใช้นับอยู่ · ตัวนี้คือ "ขั้นของคนในกระบวนการจ้าง"
 * ซึ่งเริ่มหลังจากเขาตอบว่าสนใจแล้ว — เอาไปทับกันเมื่อไหร่ ตัวเลขทุกหน้าเพี้ยนพร้อมกัน
 *
 * ⚠️ ไฟล์นี้ import ได้ทั้งฝั่งหน้าเว็บและ API (แพตเทิร์นเดียวกับ lumosDispatchMode.ts)
 * ค่าที่ระบบรู้จักอยู่ที่นี่ที่เดียว
 */

/** เรียงตามลำดับที่คนเดินจริง — ใช้เป็นลำดับใน dropdown ด้วย */
export const SELECTION_STATUSES = [
  'boss_review',
  'await_interview_date',
  'await_interview_result',
  'await_start',
  'probation',
  'await_inform',
] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export const SELECTION_STATUS_LABEL: Record<SelectionStatus, string> = {
  boss_review: 'รอนายพิจารณา',
  await_interview_date: 'รอนัดวันสัมภาษณ์',
  await_interview_result: 'รอผลสัมภาษณ์',
  await_start: 'รอเริ่มงาน',
  probation: 'ช่วงประเมิน',
  await_inform: 'รอแจ้งเข้า',
};

/** ⚠️ ทุกค่าต้องมีคู่ `dark:` ครบ (กติกาชิปของโปรเจกต์) */
export const SELECTION_STATUS_CLASS: Record<SelectionStatus, string> = {
  boss_review: 'bg-slate-500/15 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
  await_interview_date: 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  await_interview_result: 'bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  await_start: 'bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  probation: 'bg-orange-500/15 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300',
  await_inform: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
};

export function isSelectionStatus(v: unknown): v is SelectionStatus {
  return typeof v === 'string' && (SELECTION_STATUSES as readonly string[]).includes(v);
}

// ─── เช็คลิสต์เตรียมเข้างาน ───────────────────────────────────────────────

/**
 * รายการที่ติ๊กได้ — เก็บใน jsonb เพื่อเพิ่มรายการใหม่ได้โดยไม่ต้อง migrate
 * `inform_plan` (ลงแผนแจ้งเข้า) พิเศษกว่าเพื่อน: ติ๊กแล้วพาไปตั้งตารางโทรที่หน้า Follow
 * (ข้อ 7 ของเจ้าของ) — ดู `INFORM_PLAN_KEY`
 */
export const PREP_CHECKLIST_ITEMS = [
  'inform_plan',
  'case_result',
  'health_check',
  'uniform',
  'insurance',
] as const;
export type PrepChecklistKey = (typeof PREP_CHECKLIST_ITEMS)[number];

export const INFORM_PLAN_KEY: PrepChecklistKey = 'inform_plan';

export const PREP_CHECKLIST_LABEL: Record<PrepChecklistKey, string> = {
  inform_plan: 'ลงแผนแจ้งเข้า',
  case_result: 'ผลคดี',
  health_check: 'ผลตรวจสุขภาพ',
  uniform: 'เบิกเสื้อ',
  insurance: 'แจ้งประกัน',
};

export type PrepChecklist = Partial<Record<PrepChecklistKey, boolean>>;

export function isPrepChecklistKey(v: unknown): v is PrepChecklistKey {
  return typeof v === 'string' && (PREP_CHECKLIST_ITEMS as readonly string[]).includes(v);
}

/**
 * กันค่าเพี้ยนจาก DB/มือคน — เก็บเฉพาะคีย์ที่รู้จักและค่าที่เป็น `true`
 * ⚠️ **ไม่เก็บ `false`** — ค่าที่ไม่มี = ยังไม่ติ๊ก อยู่แล้ว เก็บ false ไว้เปลืองและ
 * ทำให้ "ไม่เคยแตะ" กับ "ติ๊กแล้วเอาออก" แยกไม่ออกโดยไม่ได้ตั้งใจ
 */
export function normalizePrepChecklist(raw: unknown): PrepChecklist {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: PrepChecklist = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isPrepChecklistKey(k) && v === true) out[k] = true;
  }
  return out;
}

/** ติ๊ก/เอาติ๊กออก — คืนก้อนใหม่เสมอ (pure) */
export function togglePrepChecklist(
  checklist: PrepChecklist,
  key: PrepChecklistKey,
): PrepChecklist {
  const next: PrepChecklist = { ...checklist };
  if (next[key]) delete next[key];
  else next[key] = true;
  return next;
}

/** ติ๊กไปกี่ข้อจากทั้งหมด — ใช้โชว์ "3/5" บนแถว */
export function prepChecklistProgress(checklist: PrepChecklist): { done: number; total: number } {
  const clean = normalizePrepChecklist(checklist);
  return { done: PREP_CHECKLIST_ITEMS.filter((k) => clean[k]).length, total: PREP_CHECKLIST_ITEMS.length };
}

/** ครบทุกข้อหรือยัง — พร้อมส่งคนเข้างานจริง */
export function isPrepChecklistComplete(checklist: PrepChecklist): boolean {
  const { done, total } = prepChecklistProgress(checklist);
  return done === total;
}
