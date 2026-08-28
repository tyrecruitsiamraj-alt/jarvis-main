/**
 * ═══ "งานถัดไปของคุณ" — คิวงานเรียงความด่วนของหน้าแรก (ดีไซน์ใหม่ 26 ส.ค. 2569) ═══
 *
 * 🔴 **ปัญหาที่แก้** (audit UX 25 ส.ค. 2569 วัดจริง): หน้าแรกมีปุ่ม 61 ปุ่ม แต่
 * **ไม่มีอะไรบอกว่าต้องทำอะไรก่อน** · KPI 9 ใบบอก "เกิดอะไรขึ้น" ไม่ได้บอก "ให้ทำอะไร"
 * ฉากห้องทำงานบอก "โต๊ะไหนมีของ" แต่ยังต้องเดาต่อว่าเรื่องไหนด่วนกว่ากัน
 *
 * ไฟล์นี้ยุบทุกถังให้เหลือ **ลิสต์เดียวเรียงแล้ว** — ใบบนสุดคือสิ่งที่ควรทำตอนนี้
 *
 * 🔴 **ไม่ยิง API ใหม่แม้แต่เส้นเดียว** — ประกอบจาก `flow-summary` + `office-floor`
 * ที่หน้าแรกโหลดอยู่แล้ว (เส้น flow-summary แตะ ERP · เพิ่มอีกเส้นเพื่อหาว่า
 * "ใบไหนด่วนสุด" = หน้าแรกช้าลงเพื่อข้อมูลที่ถังพวกนี้ตอบได้อยู่แล้ว)
 *
 * 🔴 **ถังที่ยังไม่รู้ค่า ต้องหายไปทั้งใบ ห้ามวาดเป็น 0** — เหตุผลเดียวกับทั้งระบบ:
 * "0 เพราะไม่มีงาน" กับ "0 เพราะโหลดไม่ได้" ต่างกัน และแบบหลังทำให้คนเลิกตาม
 */

/** ระดับความด่วน — เรียงจากมากไปน้อย และเป็นตัวกำหนดสีป้ายบนจอ */
import type { ConveyorBadgeKey } from '@/lib/soRecruitNav';

export type NextTaskTone = 'danger' | 'warn' | 'info';

export type NextTask = {
  key: string;
  /** หัวข้อสั้น ๆ ที่อ่านแล้วรู้เลยว่าต้องทำอะไร (ขึ้นต้นด้วยกริยาเสมอ) */
  title: string;
  /** ทำไมถึงต้องทำ — ประโยคเดียว บอกที่มาของตัวเลข */
  reason: string;
  /** คำสั้นบนป้ายข้างหัวข้อ — บอก "ด่วนเพราะอะไร" ในสามสี่คำ */
  badge: string;
  /** จำนวนของที่ค้างในถังนี้ */
  count: number;
  tone: NextTaskTone;
  /** กดแล้วไปไหน */
  path: string;
  /** ข้อความบนปุ่ม */
  action: string;
  /**
   * หน้าในลำดับงานที่ถังนี้อยู่ — ผูกกับ `CONVEYOR_STEPS` ด้วย **คีย์** ไม่ใช่เลข
   * 🔴 เดิมเป็น `step: number` · เจ้าของสั่งเลิกใช้เลขขั้น 28 ส.ค. 2569
   * ⚠️ ถังที่อยู่ในหน้าที่ถูกถอดออกจากลำดับ (ประกาศรับ/ผู้สมัคร) ใช้คีย์ของหน้าที่รับงานต่อ
   */
  stepKey: ConveyorBadgeKey;
};

/** สิ่งที่หน้าแรกรู้อยู่แล้ว — ทุกช่องเป็น `null` ได้ = ยังไม่รู้ (ต่างจาก 0) */
export type NextTaskInput = {
  /** Follow: เลยเวลานัดแล้วยังไม่มีผล */
  followPastDue?: number | null;
  /** ใบสมัครที่ยังไม่มีใครแตะเลย */
  applicantsUntouched?: number | null;
  /** เก็บไปโทรเองแล้วเงียบเกิน 1 วัน */
  claimedIdle?: number | null;
  /** ส่ง Lumos ไปแล้วเงียบเกิน 2 วัน */
  callsStale?: number | null;
  /** ผลโทรที่ต้องคนเร่งจัดการ */
  needsHuman?: number | null;
  /** ใบขอที่หลุด SLA แล้ว */
  slaBreached?: number | null;
  /** รายการติดตามที่ระบบไม่ได้ส่งให้ AI โทร */
  followNotDispatched?: number | null;
};

/**
 * ลำดับความด่วน — **เรียงตามความเสียหายถ้าปล่อยไว้ ไม่ใช่ตามจำนวน**
 *
 * เหตุผลที่ไม่เรียงตามจำนวน: "ใบขอหลุด SLA 202 ใบ" จะขึ้นบนสุดตลอดกาล
 * ทั้งที่เป็นยอดสะสมที่แก้วันนี้ไม่จบ · ส่วน "เลยนัดโทร 1 ราย" คือคนจริงที่กำลังรอสาย
 * อยู่ตอนนี้ และเสียไปแล้วเรียกคืนไม่ได้ ⇒ ของที่ **มีคนรออยู่ปลายทาง** มาก่อนเสมอ
 */
const ORDER: Array<{
  key: string;
  field: keyof NextTaskInput;
  title: (n: number) => string;
  reason: string;
  badge: string;
  tone: NextTaskTone;
  path: string;
  action: string;
  stepKey: ConveyorBadgeKey;
}> = [
  {
    key: 'follow-past-due',
    badge: 'เลยเวลานัดแล้ว',
    field: 'followPastDue',
    title: (n) => `โทรติดตามที่เลยเวลานัดแล้ว ${n} ราย`,
    reason: 'มีคนรอสายอยู่ตอนนี้ — เลยเวลาที่นัดไว้แล้วยังไม่มีผลกลับ',
    tone: 'danger',
    path: '/follow',
    action: 'เปิดหน้าติดตาม',
    stepKey: 'follow',
  },
  {
    key: 'follow-not-dispatched',
    badge: 'ไม่มีใครโทร',
    field: 'followNotDispatched',
    title: (n) => `รายการติดตาม ${n} รายการไม่ได้ถูกส่งให้ AI โทร`,
    reason: 'ระบบกันไว้ตอนสร้าง — ไม่มีใครโทรจนกว่าจะกดส่งใหม่หรือโทรเอง',
    tone: 'danger',
    path: '/follow',
    action: 'ดูว่าติดอะไร',
    stepKey: 'follow',
  },
  {
    key: 'needs-human',
    badge: 'AI ไปต่อไม่ได้',
    field: 'needsHuman',
    title: (n) => `ผลโทรที่ AI ไปต่อไม่ได้ ${n} ราย`,
    reason: 'โทรครบเพดานหรือติดเงื่อนไขแล้ว — ต้องมีคนตัดสินใจต่อ',
    tone: 'danger',
    path: '/matching/match',
    action: 'เปิดหน้าจับคู่',
    stepKey: 'matching',
  },
  {
    key: 'claimed-idle',
    badge: 'เก็บไว้แล้วเงียบ',
    field: 'claimedIdle',
    title: (n) => `เก็บไปโทรเองแล้วเงียบ ${n} ราย`,
    reason: 'มีคนกดเก็บไว้เกิน 1 วันแล้วยังไม่มีผล — AI ก็ไม่โทรทับให้',
    tone: 'warn',
    path: '/jobs/board?view=list',
    action: 'เปิดรายชื่อผู้สมัคร',
    stepKey: 'matching',
  },
  {
    key: 'applicants-untouched',
    badge: 'ยังไม่มีใครแตะ',
    field: 'applicantsUntouched',
    title: (n) => `ผู้สมัครที่ยังไม่มีใครแตะ ${n} คน`,
    reason: 'สมัครเข้ามาแล้วแต่ยังไม่มีใครคัดกรอง — ยิ่งช้ายิ่งติดต่อไม่ได้',
    tone: 'warn',
    path: '/jobs/board?view=list',
    action: 'เปิดรายชื่อผู้สมัคร',
    stepKey: 'matching',
  },
  {
    key: 'calls-stale',
    badge: 'รอผลเกิน 2 วัน',
    field: 'callsStale',
    title: (n) => `สายที่ส่ง AI ไปแล้วเงียบ ${n} ราย`,
    reason: 'Lumos รับไปเกิน 2 วันแล้วยังไม่ส่งผลกลับ — ควรเช็คกับทีม',
    tone: 'warn',
    path: '/matching/match',
    action: 'เปิดหน้าจับคู่',
    stepKey: 'matching',
  },
  {
    key: 'sla-breached',
    badge: 'ยอดสะสม',
    field: 'slaBreached',
    title: (n) => `ใบขอที่หลุดกำหนดแล้ว ${n} ใบ`,
    reason: 'ยอดสะสม — แก้วันนี้ไม่จบ แต่ต้องรู้ว่ากองอยู่เท่าไหร่',
    tone: 'info',
    path: '/jobs/list',
    action: 'เปิดรายการใบขอ',
    stepKey: 'requests',
  },
];

/**
 * คิวงานเรียงแล้ว — ถังที่ค่าเป็น 0 หรือยังไม่รู้ **ไม่อยู่ในลิสต์**
 * (0 = ไม่มีงานให้ทำ ⇒ ไม่ต้องมีบรรทัด · ยังไม่รู้ = ห้ามเดา)
 */
export function buildNextTasks(input: NextTaskInput): NextTask[] {
  const out: NextTask[] = [];
  for (const spec of ORDER) {
    const n = input[spec.field];
    if (typeof n !== 'number' || n <= 0) continue;
    out.push({
      key: spec.key,
      title: spec.title(n),
      reason: spec.reason,
      badge: spec.badge,
      count: n,
      tone: spec.tone,
      path: spec.path,
      action: spec.action,
      stepKey: spec.stepKey,
    });
  }
  return out;
}

/**
 * งานที่ควรทำตอนนี้ — `null` = ไม่มีอะไรค้างเลย **หรือยังโหลดไม่เสร็จ**
 * จอต้องแยกสองอย่างนี้เองจาก "โหลดเสร็จหรือยัง" ไม่ใช่จากค่าที่ฟังก์ชันนี้คืน
 */
export function pickNextTask(tasks: NextTask[]): NextTask | null {
  return tasks[0] ?? null;
}
