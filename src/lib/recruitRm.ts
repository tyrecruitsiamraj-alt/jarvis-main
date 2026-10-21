import { fullDaysSince } from '@/lib/fullDays';
import { isOverAge } from '@/lib/applicantAge';
import { aiQueueStatusOf } from '@/lib/applicantAiQueueStatus';
import { isInterestedApplicant, isNotInterestedApplicant } from '@/lib/applicantCallOutcome';
import type { UserRole } from '@/types';
/**
 * งานสรรหา (RM) — นิยามกลางของหน้า `/recruit/rm`
 *
 * โจทย์จากเจ้าของ (11 ส.ค. 2569): เอาโครง 3 แท็บของระบบเดิม (Bootstrap 4 + DataTables)
 * มา**ครอบข้อมูลที่มีอยู่แล้ว** — ไม่สร้างข้อมูลชุดใหม่ ไม่ทำของเดิมหาย และหัวใจคือ
 * **ต้องรู้ว่าใครสมัครมางานไหน**
 *
 * ═══ ออกแบบ: 3 แท็บ = 3 มุมของ "ใบสมัครจากบอร์ดรับสมัคร" ที่ระบบเก็บอยู่แล้ว ═══
 *
 * ตาราง `job_applications` (หน้า /apply) เก็บครบอยู่แล้ว: ใครสมัคร (ชื่อ/เบอร์/จังหวัด)
 * · สมัครงานไหน (`job_id` + `job_title` + `unit_name`) · เข้ามาทางไหน (`referral_source`)
 * · สถานะ (`new → contacted → converted / rejected`) — เดิมดูได้ทีละใบขอผ่าน dialog
 * บนบอร์ดเท่านั้น สิ่งที่ขาดคือ "มุมมองรวมทุกงาน" ซึ่งคือหน้านี้
 *
 * | แท็บ            | เห็นใคร                       | คือขั้นไหนของงานสรรหา |
 * |-----------------|-------------------------------|------------------------|
 * | ข้อมูลผู้สมัคร   | ทุกใบสมัคร ทุกสถานะ           | คลังรวม                |
 * | การติดต่อ       | `new` + `contacted`           | ยังต้องโทร/กำลังคุย     |
 * | ติดตามนัดหมาย   | `converted`                   | รับแล้ว ตามนัด/เริ่มงาน |
 *
 * ⚠️ ทั้งสามแท็บอ่านจากชุดเดียวกัน กรองด้วยสถานะ — เปลี่ยนสถานะใบสมัคร (ผ่าน dialog
 * เดิมบนบอร์ด หรือปุ่มในหน้านี้เมื่อต่อ API แล้ว) คนจะย้ายแท็บเอง ไม่มีข้อมูลสองชุด
 *
 * ⚠️ สถานะ/สี/ป้าย ใช้ของที่มีอยู่แล้วใน `publicApplicationsApi.ts`
 * (APPLICATION_STATUS_LABEL / _CLASS) — ไม่ประดิษฐ์ชุดใหม่มาชนกัน
 *
 * ไฟล์นี้ pure ทั้งไฟล์ — เทสต์ที่ `tests/api/recruitRm.test.ts`
 */
import type {
  ApplicationReferralSource,
  ApplicationStatus,
  PublicApplication,
} from '@/lib/publicApplicationsApi';

/** แท็บของหน้า — ตามลำดับใน HTML เดิม (panel0/1/2) */
export const RM_TABS = ['candidates', 'contact', 'appointments'] as const;
export type RmTab = (typeof RM_TABS)[number];

/**
 * ชื่อแท็บ — 🔴 ชุดเดียวกับแถบแท็บของกล่องงาน (`BOARD_VIEW_TABS` ใน JobBoardView · มีเทสต์คุมให้ตรงกัน)
 * เจ้าของเรียงเอง 30 ก.ย. 2569 ตามแบบ iRecruit: *"กล่องงาน > ผู้สมัคร > การติดตาม > ติดตามนัดหมาย > ภาพรวม"*
 */
export const RM_TAB_LABEL: Record<RmTab, string> = {
  candidates: 'ผู้สมัคร',
  contact: 'การติดต่อ',
  appointments: 'ติดตามนัดหมาย',
};

/** สถานะใบสมัครที่แต่ละแท็บมองเห็น — null = เห็นทุกสถานะ */
export const RM_TAB_STATUSES: Record<RmTab, ApplicationStatus[] | null> = {
  candidates: null,
  contact: ['new', 'contacted'],
  // 🔴 server ใช้นิยามเดียวกันกับมุมมอง "ทุกคน" (`status = 'converted'` ใน buildApplicationsListQuery) — แก้ที่นี่ต้องแก้ที่นั่น
  appointments: ['converted'],
};

/**
 * แท็บติดตามนัดหมาย: ของฉัน / ทุกคน (QA รอบ 2 ข้อ 4 · เจ้าของ Choice 10 ต.ค. 2569 "ปุ่ม ของฉัน / ทุกคน")
 * ของฉัน = ค่าเริ่ม (ของใครของมัน — กันสองคนโทรหาคนเดียวกัน) · ทุกคน = นัดของทุกคนใน BU ที่เห็นได้
 * ปุ่มโผล่เฉพาะ supervisor ขึ้นไป — server ตัดสินซ้ำเอง (`wantsEveryoneAppointments`)
 */
export const RM_APPOINTMENT_SCOPES = ['mine', 'all'] as const;
export type RmAppointmentScope = (typeof RM_APPOINTMENT_SCOPES)[number];

export const RM_APPOINTMENT_SCOPE_LABEL: Record<RmAppointmentScope, string> = {
  mine: 'ของฉัน',
  all: 'ทุกคน',
};

export function isRmAppointmentScope(v: unknown): v is RmAppointmentScope {
  return typeof v === 'string' && (RM_APPOINTMENT_SCOPES as readonly string[]).includes(v);
}

/**
 * เห็นปุ่ม "ทุกคน" ไหม — ทุกบัญชีที่ล็อกอิน (เจ้าของ 21 ต.ค. 2569 "ให้เห็นไปหมดเลย" · Choice "ทุกคนเห็นหมด ค่าเริ่ม = ทุกคน")
 * เดิม supervisor ขึ้นไป (10 ต.ค.) · กติกาเดียวกับ server (`wantsEveryoneAppointments`) · สิทธิ์ BU ยังอยู่
 */
export function canSeeEveryoneAppointments(role: UserRole | null | undefined): boolean {
  return !!role;
}

/**
 * ใบนี้อยู่ในแท็บนี้ไหม — นิยามแท็บที่เดียวของทั้งระบบ (ตัวนับบนแท็บ + ตัวกรองใช้ร่วมกัน)
 *
 * เจ้าของเปลี่ยนความหมายแท็บ "การติดต่อ" 13 ส.ค. 2569: จาก "สถานะ new+contacted"
 * เป็น **"ใบที่ฉันเก็บมาติดต่อ"** (เลือกจากกล่องงานแล้วมาโผล่ที่นี่ · ของใครของมัน —
 * server กรองใบที่คนอื่นเก็บออกจาก feed อยู่แล้ว ฝั่งนี้แค่แยก "ของฉัน" ออกจาก "ยังว่าง")
 * · ใบที่เก็บแล้วออกจากแท็บ "ข้อมูลผู้สมัคร" (ไปอยู่การติดต่อแทน — ไม่โผล่สองที่ให้งง)
 */
export function isInRmTab(r: PublicApplication, tab: RmTab): boolean {
  // ⚠️ **คนที่ตอบว่าไม่สนใจ กลับเข้าคลังกลาง** (เจ้าของสั่ง 13 ส.ค. 2569:
  // "กรณีคนไม่สนใจให้ไปอยู่ในนี้" ชี้ที่แท็บรายชื่อผู้สมัคร)
  // เหตุผล: งาน**ใบนั้น**จบแล้ว ไม่ต้องตามต่อ แต่ **คนยังอยู่ในระบบ** เอาไปเสนอ
  // งานอื่นได้ · ถ้าปล่อยค้างในถัง "การติดต่อ" ของคนเก็บ จะเป็นงานค้างที่ไม่มีวันจบ
  // และคนคนนั้นจะหายจากคลังกลางไปเฉย ๆ
  // "เก็บไว้ทำงานต่อ" = เก็บไปติดต่อ (claim) **หรือ** เก็บ Lead (เจ้าของสั่ง 14 ส.ค. 2569:
  // "เก็บ Lead → รายชื่อไปอยู่ที่การติดต่อแทน" · เดิม Lead หายเข้าคลังสำรอง)
  // 🔴 ของใครของมัน (Journey 4 ต.ค. 2569): Lead นับเฉพาะที่ผู้ดูเก็บ — server ซ่อน Lead ของคนอื่นแล้ว
  // `lead_by_me` ไม่มากับแถว (server เก่า) = ถือตาม is_lead เหมือนเดิม
  const kept = r.claimed_by_me === true || (r.is_lead === true && r.lead_by_me !== false);
  /**
   * 🔴 ตอบไม่สนใจแล้ว = กลับคลังกลาง — **ยกเว้นเก็บมาหลังผลนั้น** (QA 5 ต.ค. 2569 · เจ้าของเจอเอง:
   * "เก็บชื่อจากหน้าผู้สมัครแล้วไม่ไปหน้าการติดต่อ") — เดิมเช็คผลก่อนเสมอ ⇒ กดเก็บคนที่ไม่สนใจ ระบบล็อกเบอร์ให้
   * แต่ชื่อค้างหน้าผู้สมัคร หาไม่เจอ ถอยไม่ได้ · ผลไม่สนใจที่มา **หลัง** การเก็บ ยังพากลับคลังกลางตามเดิม (13 ส.ค.)
   */
  if (isClosedByCallOutcome(r) && !(kept && keptAfterLastCall(r))) return tab === 'candidates';
  if (tab === 'contact') return kept;
  if (tab === 'candidates') return !kept;
  const st = RM_TAB_STATUSES[tab];
  return !st || st.includes(r.status);
}

/**
 * ผลโทรที่แปลว่า "จบเรื่องกับใบนี้แล้ว" — ไม่ต้องตามต่อ แต่คนยังอยู่ในคลัง
 *
 * ⚠️ เอาเฉพาะผลที่ **จบจริง** · "ไม่รับสาย/ขอเลื่อน" ยังไม่จบ ต้องอยู่ในถังคนตามต่อ
 * ⚠️ ใบที่ **รับเข้าทำงานแล้ว** (converted) ไม่เข้าเงื่อนไขนี้ — ไปแท็บติดตามนัดหมาย
 * ตามเดิม แม้ผลโทรจะเป็นอะไรก็ตาม
 */
/** เก็บ (claim/Lead ของฉัน) หลังผลโทรล่าสุดไหม — ไม่รู้เวลาเก็บ (server เก่า) = ไม่ใช่ */
export function keptAfterLastCall(r: PublicApplication): boolean {
  const t = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
  const keptAt = Math.max(
    r.claimed_by_me ? t(r.claimed_at) || -Infinity : -Infinity,
    r.is_lead && r.lead_by_me !== false ? t(r.lead_at) || -Infinity : -Infinity,
  );
  if (!Number.isFinite(keptAt)) return false;
  const callAt = t(r.last_call_at);
  return Number.isNaN(callAt) || keptAt >= callAt;
}

export function isClosedByCallOutcome(r: PublicApplication): boolean {
  if (r.status === 'converted') return false;
  return r.last_call_outcome === 'declined';
}

/**
 * มุมมองย่อยของแท็บ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569: "แบ่ง 3 อัน")
 * ทั้งหมด / คนที่สนใจ / คนที่ไม่สนใจ — แบ่งด้วย **ผลโทร** ไม่ใช่สถานะใบสมัคร
 */
export const RM_LIST_VIEWS = [
  'all',
  'interested',
  'declined',
  'over_age',
  'irecruit_dup',
  'ai_at_risk',
  'no_pickup',
  'retry_wait',
  'irecruit_pull',
  'not_sent',
  'bad_data',
  'ai_cancelled',
  'collect',
] as const;
export type RmListView = (typeof RM_LIST_VIEWS)[number];

/**
 * ปุ่มมุมมองที่โชว์บนแท็บผู้สมัคร — 🔴 "รอเก็บใบสมัคร" ถอดออกจากจอ (เจ้าของสั่ง 5 ต.ค. 2569 "เอารอเก็บใบสมัคร 88 ไรนั่นออก")
 * นิยาม `collect` ยังอยู่ (ตัวนับ/เทสต์ใช้) · ลิงก์เก่า `?list=collect` ถอยไปรายชื่อทั้งหมด (ไม่ค้างมุมมองที่ไม่มีปุ่มกดกลับ)
 */
/** "อายุเกิน" (5 ต.ค. 2569) — อายุ 58 ปีขึ้นไป AI ไม่โทร ชื่อมารวมที่นี่ (`applicantAge.ts`)
 *  "ซ้ำ iRecruit" (12 ต.ค. 2569 · 143) — เบอร์สมัครใน iRecruit ภายใน 14 วัน AI ไม่โทรเอง ให้คนเลือกส่ง */
/** "AI ไม่ได้ผล" (14 ต.ค. 2569 · Choice "บอกครบ + แก้คนที่ตกหล่น") — AI โทรครบไม่ได้คำตอบ · ส่งแล้วเงียบ · Lumos ไม่รับ ·
 *  เลยนัดโทรซ้ำแล้วยังไม่มีผล (`applicantAiQueueStatus.ts`) */
/**
 * 14 ต.ค. 2569 เจ้าของ: *"397 แบ่งเป็น สนใจ … Aiไม่ได้ผล 22 หายไปไหน 146"* → *"เพิ่ม ไม่รับสาย รอติดต่อซ้ำ ยังไม่ได้ ข้อมูลผิด ยกเลิก
 * ไปกะพวก รายชื่อคนสนใจ ฯลฯ อยู่แถวเดียวกัน"* (Choice ยืนยันการนับ) ⇒ 5 ชิปท้ายแถว = คนที่ไม่อยู่ชิปก่อนหน้า
 * (`rmRestViewOf`) ทุกชิปไม่ทับกัน รวมกัน = รายชื่อทั้งหมด
 */
export const RM_LIST_VIEWS_SHOWN = [
  'all',
  'interested',
  'declined',
  'over_age',
  'irecruit_dup',
  'ai_at_risk',
  'no_pickup',
  'retry_wait',
  'irecruit_pull',
  'not_sent',
  'bad_data',
  'ai_cancelled',
] as const satisfies readonly RmListView[];
/** มุมมองตอนเปิดแท็บผู้สมัคร (ไม่มี ?list=) — เจ้าของสั่ง 14 ต.ค. 2569 */
export const RM_LIST_VIEW_DEFAULT = 'interested' as const satisfies RmListView;

export function isShownRmListView(v: string | null | undefined): v is (typeof RM_LIST_VIEWS_SHOWN)[number] {
  return !!v && (RM_LIST_VIEWS_SHOWN as readonly string[]).includes(v);
}

export const RM_LIST_VIEW_LABEL: Record<RmListView, string> = {
  all: 'รายชื่อทั้งหมด',
  interested: 'รายชื่อคนที่สนใจ',
  declined: 'รายชื่อคนที่ไม่สนใจ',
  over_age: 'อายุเกิน',
  irecruit_dup: 'ซ้ำ iRecruit',
  ai_at_risk: 'AI ไม่ได้ผล',
  no_pickup: 'ไม่รับสาย',
  retry_wait: 'รอติดต่อซ้ำ',
  // 20 ต.ค. 2569 เจ้าของ: "แก้คำ ยังไม่ได้ เป็น iRecruit" + Choice แยกกล่อง — ดึงจาก iRecruit (คนกดส่ง AI เอง) แยกจากที่ยังไม่ส่ง AI
  irecruit_pull: 'iRecruit',
  not_sent: 'ยังไม่ส่ง AI',
  bad_data: 'ข้อมูลผิด',
  ai_cancelled: 'ยกเลิก',
  // คิวงานสรรหา (16 ส.ค.): สนใจจริง แต่ยังไม่ขึ้นบอร์ด (= ยังไม่ได้มาสมัคร)
  // "ขึ้นบอร์ดแล้ว" = on_board (server จับคู่เบอร์กับคนบนบอร์ด ERP) → ออกจากคิวเอง
  collect: 'รอเก็บใบสมัคร',
};

/**
 * ⚠️ **"สนใจ" กับ "ไม่สนใจ" ต้องมาจากผลโทรเท่านั้น** — สถานะใบสมัครมีแค่
 * ใหม่/ติดต่อแล้ว/รับเข้าทำงาน/ปฏิเสธ ซึ่งเป็นคนละเรื่อง (สถานะการทำงานของเจ้าหน้าที่
 * ไม่ใช่คำตอบของผู้สมัคร) · คนที่ยังไม่ได้โทรจะไม่อยู่ในสองมุมมองหลัง — ตั้งใจ
 * เพราะยังไม่มีใครรู้ว่าเขาสนใจไหม การเดาแทนคือการโกหกตัวเลข
 */
export function isInRmListView(r: PublicApplication, view: RmListView): boolean {
  /**
   * 🔴 กติกา "สนใจ/ไม่สนใจ" อยู่ที่ `applicantCallOutcome.ts` **ที่เดียว**
   * (เดิมไฟล์นี้เทียบ `=== 'confirmed'` / `=== 'declined'` เองตรง ๆ → พอเจ้าของสั่งให้
   * ผลติดต่อ `ok=false` นับเป็นไม่สนใจด้วย (Phase 5.11) กล่องกับแท็บจะตอบไม่เหมือนกัน)
   */
  // 🔴 ชิปแถวบนห้ามทับกัน (เจ้าของ 20 ต.ค. 2569 "แยกกล่องอย่าให้ซ้ำกัน") — คนเดียวอยู่ชิปแรกที่เข้าเกณฑ์ตามลำดับ RM_PRIMARY_VIEWS
  if ((RM_PRIMARY_VIEWS as readonly string[]).includes(view)) return rmPrimaryViewOf(r) === view;
  // คิวสรรหา: ตอบสนใจตอนโทร แต่ยังไม่ขึ้นบอร์ด (ยังไม่มาสมัคร) — พอสรรหาเก็บใบสมัคร
  // (ชื่อขึ้นบอร์ด) on_board = true → หลุดจากคิวเอง
  if (view === 'collect') return isInterestedApplicant(r) && r.on_board !== true;
  if (isRmRestView(view)) return rmRestViewOf(r) === view;
  return true;
}

/** ชิปท้ายแถว (14 ต.ค. 2569) — คนที่ไม่อยู่ชิปก่อนหน้า แบ่งให้ครบทุกคน */
const RM_REST_VIEWS = ['no_pickup', 'retry_wait', 'irecruit_pull', 'not_sent', 'bad_data', 'ai_cancelled'] as const;
type RmRestView = (typeof RM_REST_VIEWS)[number];
const RM_PRIMARY_VIEWS = ['interested', 'declined', 'over_age', 'irecruit_dup', 'ai_at_risk'] as const;
type RmPrimaryView = (typeof RM_PRIMARY_VIEWS)[number];

/** ใบที่ระบบดึงจาก iRecruit เอง (`irecruitApplicantImport.ts` · created_by_name = 'iRecruit') */
export const IRECRUIT_PULL_CREATED_BY = 'iRecruit';

/**
 * ชิปแถวบนของใบนี้ — ชิปแรกที่เข้าเกณฑ์ตามลำดับ · null = ไปชิปท้ายแถว
 * เดิมแต่ละชิปเช็กแยกกัน ⇒ คนที่ซ้ำ iRecruit แล้วกดส่ง AI จนตอบสนใจ อยู่ทั้ง "สนใจ" และ "ซ้ำ iRecruit" (20 ต.ค. 2569 เจอ 1 คน)
 */
export function rmPrimaryViewOf(r: PublicApplication): RmPrimaryView | null {
  if (isInterestedApplicant(r)) return 'interested';
  if (isNotInterestedApplicant(r)) return 'declined';
  if (isOverAge(r.age)) return 'over_age';
  if (r.irecruit_dup_at) return 'irecruit_dup';
  if (aiQueueStatusOf(r)?.atRisk === true) return 'ai_at_risk';
  return null;
}

function isRmRestView(v: RmListView): v is RmRestView {
  return (RM_REST_VIEWS as readonly string[]).includes(v);
}

/**
 * ใบนี้อยู่ชิปท้ายแถวอันไหน — null = อยู่ชิปก่อนหน้าแล้ว (สนใจ · ไม่สนใจ · อายุเกิน · ซ้ำ · AI ไม่ได้ผล)
 * ไม่รับสาย = AI เคยโทรแล้วไม่ได้คำตอบ คิวปิดแล้ว · รอติดต่อซ้ำ = ตั้งโทรซ้ำไว้ · ยกเลิก = คิว AI ถูกยกเลิก ·
 * ข้อมูลผิด = เบอร์ใช้โทรไม่ได้ · iRecruit = ดึงจาก iRecruit ยังไม่มีใครส่ง AI · ยังไม่ส่ง AI = ยังไม่ได้ส่งให้ AI / รอรอบแรก
 */
export function rmRestViewOf(r: PublicApplication): RmRestView | null {
  if (rmPrimaryViewOf(r) !== null) return null;
  const q = aiQueueStatusOf(r);
  if (q?.kind === 'retry') return 'retry_wait';
  if (r.last_call_status === 'cancelled') return 'ai_cancelled';
  const aiCalled =
    Boolean(r.ai_answer) || r.last_call_status === 'completed' || r.last_call_status === 'failed' || Boolean(r.last_call_prev_outcome);
  if (aiCalled) return 'no_pickup';
  if (r.phone_callable === false) return 'bad_data';
  if (r.created_by_name === IRECRUIT_PULL_CREATED_BY) return 'irecruit_pull';
  return 'not_sent';
}

export function isRmListView(v: string | null | undefined): v is RmListView {
  return !!v && (RM_LIST_VIEWS as readonly string[]).includes(v);
}

/**
 * ═══ ชิปกรองแท็บการติดต่อ (แบบ C · เจ้าของเคาะ 5 ต.ค. 2569) ═══
 * เครื่องมือ Lead บนแถวเครื่องมือถูกถอดแล้ว (ผู้สมัครเหลือ 5 ปุ่ม) — ที่เคยเป็น `rmTabHasLeadTools`
 * "โทรแล้ว" = มีเวลากดโทรจริง (095) หรือมีผลโทร — ลำดับความจริงเดียวกับคอลัมน์ "โทรล่าสุด" ใน RmTable
 */
export type ContactChip = 'all' | 'uncalled' | 'called' | 'ok' | 'fail';

/**
 * ชิปแท็บการติดต่อ — สำเร็จ / ไม่สำเร็จ เติมต่อท้าย (เจ้าของ 8 ต.ค. 2569 Choice "เติมต่อท้าย")
 * = ผลติดต่อล่าสุดที่เจ้าหน้าที่กดในป๊อป (`last_contact_ok` · ขั้นการติดต่อแบบ iRecruit ใน `applicantProcess.ts`)
 */
export const CONTACT_CHIPS: readonly { id: ContactChip; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'uncalled', label: 'ยังไม่โทร' },
  { id: 'called', label: 'โทรแล้ว' },
  { id: 'ok', label: 'สำเร็จ' },
  { id: 'fail', label: 'ไม่สำเร็จ' },
];

export function isInContactChip(
  r: {
    dialed_last_at?: string | null;
    last_call_at?: string | null;
    last_contact_ok?: boolean | null;
    last_appointment_failed?: boolean | null;
    claimed_at?: string | null;
    lead_at?: string | null;
  },
  chip: ContactChip,
): boolean {
  if (chip === 'all') return true;
  // 🔴 14 ต.ค. 2569 เจ้าของ: "2 คนล่างนัดไม่สำเร็จแต่ขึ้นสำเร็จ" — นัดไม่สำเร็จเก็บเป็น ok=true + เหตุผล (`last_appointment_failed`)
  //    ⇒ สำเร็จ = ติดต่อได้และไม่ใช่นัดไม่สำเร็จ · ไม่สำเร็จ = ติดต่อไม่ได้ หรือ นัดไม่สำเร็จ (ตรงกับขั้นใน `applicantProcess.ts`)
  if (chip === 'ok') return r.last_contact_ok === true && r.last_appointment_failed !== true;
  if (chip === 'fail') return r.last_contact_ok === false || (r.last_contact_ok === true && r.last_appointment_failed === true);
  return chip === 'called' ? isContactCalledByStaff(r) : !isContactCalledByStaff(r);
}

/**
 * 🔴 "โทรแล้ว" ของแท็บการติดต่อ = **ลงผลติดต่อแล้ว** (สำเร็จ หรือ ไม่สำเร็จ) เท่านั้น
 * เจ้าของ 15 ต.ค. 2569: *"พอกดปุ่มโทร มันย้ายไปอยู่โทรแล้วเลย ไม่ได้อยากให้ย้าย ต้องการย้ายแค่ตอนลงผลว่า
 * ติดต่อสำเร็จ หรือ ไม่สำเร็จ กดปุ่มนั้นมันแค่ Stamp เวลา หรือ ย้ายไปปุ่มโทรออกบนมือถือเท่านั้น"*
 * - ปุ่มโทรบนแถว = บันทึกเวลากดโทร (`dialed_last_at`) + เปิดโทรออก — **ไม่ย้ายชิป**
 * - AI โทร ไม่นับ (14 ต.ค. 2569)
 * ⇒ โทรแล้ว = สำเร็จ + ไม่สำเร็จ · ทั้งหมด = ยังไม่โทร + โทรแล้ว
 * (14 ต.ค. เคยนับ "กดโทรหลังเก็บรายชื่อ" ด้วย — ถอดแล้ว)
 */
export function isContactCalledByStaff(r: { last_contact_ok?: boolean | null }): boolean {
  return typeof r.last_contact_ok === 'boolean';
}

/**
 * ตัวกรองของหน้ารายชื่อผู้สมัคร
 *
 * ⚠️ สามกลุ่มแรก (channels/provinces/statuses) **ไม่มี UI แล้ว** — เจ้าของสั่งถอด
 * แผงตัวกรองด้านข้างออกจากทุกหน้า 17 ส.ค. 2569 (commit 9dbe94b ลบ RmFilterSidebar.tsx)
 * ตรรกะยังอยู่เพราะ drill-down จาก Dashboard ใช้ผ่าน `?bucket=` และเทสต์คุมไว้
 * 🔴 **ห้ามเอา UI สามกลุ่มนั้นกลับมาโดยไม่ได้สั่งใหม่**
 *
 * `dateFrom`/`dateTo` (YYYY-MM-DD) = ตัวกรองวันที่สมัคร — เจ้าของสั่ง 22 ส.ค. 2569
 * *"หน้าผู้สมัครขอเป็นแบบ filter แบบ calendar ที่กดแล้วข้อมูลเปลี่ยนตามวันที่เลือก"*
 */
export type RmFilters = {
  channels: ApplicationReferralSource[];
  provinces: string[];
  statuses: ApplicationStatus[];
  /** วันที่สมัคร ตั้งแต่ (YYYY-MM-DD) — ว่าง/ไม่ส่ง = ไม่กรอง */
  dateFrom?: string | null;
  /** วันที่สมัคร ถึง (YYYY-MM-DD) — ว่าง/ไม่ส่ง = ไม่กรอง */
  dateTo?: string | null;
};

export const EMPTY_RM_FILTERS: RmFilters = {
  channels: [],
  provinces: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
};

/** วันที่สมัครในรูป YYYY-MM-DD (ตัดเวลาออก) — null = ไม่รู้วัน */
export function applicationAppliedYmd(row: PublicApplication): string | null {
  const raw = row.created_at;
  if (!raw || typeof raw !== 'string') return null;
  const ymd = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** ไม่ได้ติ๊กอะไรเลย = ไม่กรอง (ไม่ใช่ "กรองจนไม่เหลืออะไร") */
export function countActiveRmFilters(f: RmFilters): number {
  const dateActive = f.dateFrom || f.dateTo ? 1 : 0;
  return f.channels.length + f.provinces.length + f.statuses.length + dateActive;
}

/** ติ๊ก/เอาติ๊กออกในลิสต์เดียว — ใช้ร่วมทุกกลุ่มใน sidebar */
export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** จังหวัดที่เลือกได้ = จังหวัดที่มีคนสมัครจริง — ไม่ hardcode 77 จังหวัดให้เลื่อนหาเปล่า */
export function provincesFromApplications(rows: PublicApplication[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const p = (r.province || '').trim();
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'th'));
}

/** ชื่อ-นามสกุลแยกคอลัมน์ตามระบบเดิม — ใบสมัครเก่าบางใบมีแต่ full_name ต้องถอยไปตัดเอง */
export function splitApplicantName(r: PublicApplication): { firstName: string; lastName: string } {
  const first = (r.first_name || '').trim();
  const last = (r.last_name || '').trim();
  if (first || last) return { firstName: first, lastName: last };
  const parts = (r.full_name || '').trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** ป้าย "สมัครงานไหน" — หัวใจของหน้านี้ · ใบที่สมัครแบบไม่ระบุงานต้องบอกตรง ๆ ไม่ปล่อยว่าง */
/**
 * ตัดอิโมจิออกจากชื่องาน/หน่วยงานบนจอ — ชื่อประกาศที่ทีมพิมพ์เองมี 📍 ฯลฯ ติดมา (QA 17 ต.ค. 2569: คอลัมน์หน่วยงานปน 📍)
 * กติกาเดียวกับ `lumosDispatch` ที่ตัดก่อนส่งให้ AI พูด
 */
export function withoutEmoji(v: string | null | undefined): string {
  return (v || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function applicationJobLabel(r: PublicApplication): string {
  const job = withoutEmoji(r.job_title) || withoutEmoji(r.position_interest);
  const unit = withoutEmoji(r.unit_name);
  if (job && unit) return `${job} — ${unit}`;
  return job || unit || 'สมัครทั่วไป (ไม่ระบุงาน)';
}

/**
 * ป้าย "หน่วยงาน" ของแถวรายชื่อ (เจ้าของสั่ง 17 ส.ค. 2569 — คอลัมน์นี้เอาชื่อหน่วยงานล้วน)
 *
 * ⚠️ ของจริงมีใบที่ `job_title` กับ `unit_name` เป็นค่าเดียวกันเป๊ะ ทำให้คอลัมน์เดิม
 * โชว์ซ้ำสองรอบคั่นด้วยขีด ("บริษัท ก. — บริษัท ก.") — ตัวนี้เอาชื่อหน่วยงานอย่างเดียว
 * ไม่มีหน่วยงานค่อยถอยไปใช้ชื่องานที่สมัคร
 */
export function applicationUnitLabel(r: PublicApplication): string {
  const unit = withoutEmoji(r.unit_name);
  if (unit) return unit;
  return withoutEmoji(r.job_title) || withoutEmoji(r.position_interest) || '';
}

/**
 * "ผู้รับผิดชอบ" ของใบสมัคร = ทีม Online (เจ้าของ 16 ต.ค. 2569: *"ผู้รับผิดชอบ ก็ทีม online อะ ว่าน เจมส์"*)
 * ผู้รับผิดชอบที่เลือกตอนคีย์/นำเข้า → ผู้รับผิดชอบของลิงก์ที่สมัครเข้ามา (ไม่ได้ตั้ง = คนสร้างลิงก์) · ไม่มีทั้งคู่ = null
 * 🔴 คนละคนกับ "ข้อมูลผู้สรรหา" = เจ้าหน้าที่สรรหาของใบขอ (คิว แบงค์ · คอลัมน์ "เจ้าของงาน")
 */
export function applicantResponsibleName(r: Pick<PublicApplication, 'responsible_name' | 'posting_owner_name'>): string | null {
  return (r.responsible_name || '').trim() || (r.posting_owner_name || '').trim() || null;
}

/**
 * ที่อยู่ย่อของผู้สมัคร — ตำบล/อำเภอ/จังหวัด เท่าที่กรอกมา (เจ้าของสั่ง 17 ส.ค. 2569)
 * เดิมโชว์แค่จังหวัด ซึ่งกว้างเกินกว่าจะบอกได้ว่าคนนี้ไปไซต์ไหนไหว
 * ⚠️ กรอกไม่ครบ = ต่อเท่าที่มี ห้ามเติมคำว่า "ไม่ระบุ" คั่นกลางให้อ่านยาก
 */
export function applicationAddressLabel(r: PublicApplication): string {
  return [r.subdistrict, r.district, r.province]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * ใบนี้ยื่นมาแล้วกี่วัน (เจ้าของสั่ง 17 ส.ค. 2569 — "ผ่านมาแล้วกี่วัน")
 *
 * 🔴 **ครบ 24 ชม. ถึงนับเป็น 1 วัน** (เจ้าของเคาะ 30 ก.ย. 2569 — Choice "ครบ 24 ชม. เหมือนภาพรวม") ·
 * ใบที่กรอกเมื่อวานตอนสามทุ่ม เช้านี้ยังเป็น 0 วัน ("วันนี้") จนกว่าจะครบ 24 ชม.
 * (เดิมนับตามปฏิทินกรุงเทพ ข้ามเที่ยงคืน = 1 วัน — เลิกแล้ว) · ตัวนับอยู่ `fullDays.ts` ที่เดียว
 * คืน null เมื่อไม่มีวันที่/วันที่เสีย (คนละความหมายกับ 0 = วันนี้)
 */
export function daysSinceApplied(createdAt: string | null | undefined, now: Date): number | null {
  return fullDaysSince(createdAt, now);
}

/**
 * กรอง + ค้นหา — pure จึงเทสต์ได้โดยไม่ต้องมี DOM
 *
 * ⚠️ ช่องค้นหาตาม HTML เดิมเขียนว่า "ค้นหาข้อมูลจาก ชื่อ นามสกุล เบอร์" จึงค้นแค่นั้น
 * **บวกชื่องาน/หน่วยงาน** ที่เพิ่มให้เพราะเป็นหัวใจของหน้านี้ (หาว่า "ใครสมัครงาน X" ได้)
 */
export function filterApplications(
  rows: PublicApplication[],
  tab: RmTab,
  filters: RmFilters,
  keyword: string,
): PublicApplication[] {
  const kw = keyword.trim().toLowerCase();
  return rows.filter((r) => {
    if (!isInRmTab(r, tab)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false;
    if (filters.channels.length > 0) {
      if (!r.referral_source || !filters.channels.includes(r.referral_source)) return false;
    }
    if (filters.provinces.length > 0 && !filters.provinces.includes((r.province || '').trim())) {
      return false;
    }
    // ช่วงวันที่สมัคร — ใบที่ไม่รู้วันถือว่า "ไม่เข้าเงื่อนไข" เมื่อมีการกรองวัน
    // (ดีกว่าปล่อยผ่านแล้วคนอ่านคิดว่าใบนั้นสมัครในช่วงที่เลือก)
    if (filters.dateFrom || filters.dateTo) {
      const ymd = applicationAppliedYmd(r);
      if (!ymd) return false;
      if (filters.dateFrom && ymd < filters.dateFrom) return false;
      if (filters.dateTo && ymd > filters.dateTo) return false;
    }
    if (kw) {
      const hay = `${r.full_name} ${r.first_name ?? ''} ${r.last_name ?? ''} ${r.phone} ${applicationJobLabel(r)}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/**
 * แถบปุ่มด้านบน
 * ⚠️ **ไม่มีปุ่ม "ตำแหน่งงาน"** — เจ้าของสั่งเอาออก 11 ส.ค. 2569 (ตำแหน่งงานเลือกตอน
 * สร้างลิงก์/เพิ่มผู้สมัครอยู่แล้ว ไม่ต้องมีปุ่มจัดการแยก)
 * ⚠️ **ไม่มีปุ่ม "รายงาน"** — เจ้าของสั่งเอาออก 11 ส.ค. 2569 รอบสี่
 * ⚠️ อยู่ที่ lib ไม่ใช่ไฟล์ component — ไฟล์ component ที่ export ค่าอื่นนอกจาก
 * ตัว component จะโดน eslint เตือน react-refresh (กติกาเดิมของโปรเจกต์)
 */
export const RM_TOOLBAR_KEYS = ['channels', 'link', 'reasons'] as const;
export type RmToolbarKey = (typeof RM_TOOLBAR_KEYS)[number];

export const RM_TOOLBAR_LABEL: Record<RmToolbarKey, string> = {
  channels: 'ช่องทาง',
  link: 'Gen link', // เจ้าของยืนยัน 5 ต.ค. 2569 ใช้คำว่า Gen link ทั้งระบบ
  reasons: 'เหตุผล',
};

/** ปุ่ม action ต่อแถว — จุดเดียวที่ระบบเดิมให้แต่ละแท็บต่างกัน */
export type RmRowAction = 'bookmark' | 'call' | 'ai' | 'dial' | 'view' | 'rule' | 'remove' | 'release' | 'restore';

/**
 * ⚠️ `call` กับ `dial` เป็นคนละเรื่อง — สับสนเมื่อไหร่ตัวเลขเวลารอโทรเพี้ยนทันที
 *   call = **เก็บไปโทรเอง** (จองใบ + จับล็อกที่เบอร์ กัน AI/คนอื่นโทรทับ — สองอย่างในกดเดียว)
 *   dial = **จดว่าเพิ่งยกหูโทร** (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 5 ของงานสรรหา)
 * ปุ่ม dial โผล่เฉพาะแท็บ "การโทรของฉัน" เพราะเป็นขั้นหลังเก็บชื่อไปแล้ว
 */
export const RM_ROW_ACTIONS: Record<RmTab, RmRowAction[]> = {
  /** แบบ iRecruit (เก็บ Lead · โทร · ดูข้อมูล) + ส่ง AI โทร (เจ้าของ 4 ต.ค. 2569) — ส่ง AI ผ่านป๊อปยืนยันเสมอ */
  candidates: ['bookmark', 'call', 'ai', 'view'],
  /**
   * 🔴 แท็บการติดตามเหลือ 3 ปุ่ม (เจ้าของสั่ง 1 ต.ค. 2569):
   * *"ต้องมีแค่ ปุ่มโทรเพื่อ Stamp เวลา ปุ่มดูรายละเอียด และลบออกเพื่อส่งกลับไปหน้าผู้สมัคร"*
   * ใบในแท็บนี้เก็บมาแล้วทั้งนั้น ⇒ ปุ่มเก็บ Lead/เก็บไปโทรเองไม่มีความหมายที่นี่
   */
  contact: ['dial', 'view', 'release'],
  /** "เอาออกจากรายการ" (remove) ถอดแล้ว — ไม่เคยต่อกับระบบ กดแล้วแค่ขึ้น "ยังไม่ได้ต่อ" (QA 5 ต.ค. 2569) · ใส่กลับเมื่อเจ้าของบอกว่าให้ทำอะไร */
  /**
   * 🔴 ถอด "เก็บไปโทรเอง" (call) — เจ้าของ Choice 7 ต.ค. 2569 ก่อนทีมย้ายจาก iRecruit: ใบในแท็บนี้นัดแล้วทั้งนั้น ·
   * ใบคีย์เองที่ไม่ผูกใบขอขึ้นปุ่มที่กดไม่ได้ทุกแถว ("ใบคีย์เองที่ไม่ผูกใบขอ เก็บไปโทรเองไม่ได้") คนเห็นเป็นปุ่มเสีย
   */
  appointments: ['rule'],
};

export const RM_ROW_ACTION_LABEL: Record<RmRowAction, string> = {
  bookmark: 'เก็บเข้า Lead',
  /**
   * 🔴 เดิมมีสองปุ่มที่คนงงว่าต่างกันตรงไหน — "เก็บไปติดต่อ" (claim บนใบ) กับ
   * "ดึงเข้าถังโทร" (ล็อกเบอร์กัน AI ทับ) · เจ้าของเคาะ 22 ส.ค. 2569 ให้ **รวมเป็นปุ่มเดียว**
   * กดทีเดียวได้ทั้งคู่ (เส้น /api/application-call-choice choice=manual)
   */
  call: 'เก็บไปโทรเอง',
  ai: 'ส่ง AI โทร',
  /** กู้คืนใบที่ยกเลิกข้อมูล (135) — มุมมอง "ดูที่ยกเลิก" เท่านั้น */
  restore: 'กู้คืนเข้ารายชื่อหลัก',
  /** แท็บการติดต่อเรียกตาม iRecruit — ดู `rmRowActionLabel` (คำนี้คือคำกลางของการกระทำ) */
  dial: 'กดโทร (จดเวลา)',
  view: 'ดูรายละเอียด',
  rule: 'บันทึกผลนัดหมาย',
  remove: 'เอาออกจากรายการ',
  /** ส่งกลับเป็นใบว่าง ใครก็เก็บได้ — ปลดจอง + ถอด Lead + คืนล็อกเบอร์ · AI ไม่โทรเอง (Choice 1 ต.ค. 2569) */
  release: 'ลบออก — ส่งกลับแท็บผู้สมัคร',
};

/**
 * 🔴 ปุ่มบนแถวแท็บการติดต่อ = คำเดียวกับ iRecruit (เจ้าของสั่ง 4 ต.ค. 2569 "ทำให้เหมือน iRecruit"):
 * โทร (จดเวลา + เปิดหน้าโทร) · ดำเนินการ (ป๊อปติดต่อ/นัดหมาย) · ถอย Lead (ส่งกลับแท็บผู้สมัคร · เดิมชื่อ "ลบ Lead" เปลี่ยนตามคำเจ้าของ 5 ต.ค. 2569)
 */
export const RM_CONTACT_ACTION_LABEL: Partial<Record<RmRowAction, string>> = {
  dial: 'โทร',
  view: 'ดำเนินการ',
  release: 'ถอย Lead',
};

/**
 * ลิงก์เปิดหน้าโทรของเครื่อง (ปุ่ม "โทร" แบบ iRecruit) — เก็บแต่ตัวเลข/+ · ไม่มีเบอร์ = null (ไม่เปิดอะไร)
 */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 9 ? `tel:${digits}` : null;
}

export function rmRowActionLabel(tab: RmTab, action: RmRowAction): string {
  return (tab === 'contact' ? RM_CONTACT_ACTION_LABEL[action] : undefined) ?? RM_ROW_ACTION_LABEL[action];
}

/**
 * ── "ดึงไปโทร" จากแถวรายชื่อผู้สมัคร (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก) ──────────
 *
 * จับ call hold (ล็อกตัวเดียวกับหน้า Matching — ผูกเบอร์ ไม่ใช่ ref) ได้เฉพาะใบที่
 *   1. มีเบอร์ — server จะแปลง E.164 เอง แต่ใบไม่มีเบอร์เลยไม่มีอะไรให้ล็อก
 *   2. **ผูกใบขอ (`job_id`)** — POST บังคับ jobId เพื่อเช็ค BU scope
 *      ใบที่เจ้าหน้าที่คีย์เอง (job_id ว่าง) จับไม่ได้ **โดยตั้งใจ** — ผ่อนเมื่อไหร่
 *      ล็อกเบอร์ข้ามแผนกได้ (ขัด fail-safe) · ปุ่มต้อง disable พร้อมบอกเหตุผล
 */
export type RmHoldability =
  | { ok: true }
  | { ok: false; reason: string };

export function canHoldApplication(row: {
  phone?: string | null;
  job_id?: string | null;
}): RmHoldability {
  if (!row.phone?.trim()) return { ok: false, reason: 'ไม่มีเบอร์โทร' };
  if (!row.job_id?.trim()) {
    return { ok: false, reason: 'ใบคีย์เองที่ไม่ผูกใบขอ เก็บไปโทรเองไม่ได้' };
  }
  return { ok: true };
}
