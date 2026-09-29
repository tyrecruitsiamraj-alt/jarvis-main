/**
 * ═══ หน้าหลักโฉม 3 ก้อน — ชนิดข้อมูล + ตัวคิด pure (29 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"ในหน้าหลักตอนนี้มันปน มันงงไปหมด"* → Choice **"จัดใหม่ 3 ก้อน"** + **"แยกตามคนเปิด"**
 * แผนเต็ม: `docs/plan-home-v3-2569-09-29.md`
 *
 * ไฟล์นี้ใช้ร่วมทั้งฝั่ง API (`/api/home-overview`) และหน้าเว็บ — **ไม่มีนิยามใหม่ของก้อน 1/2/4**
 * (ก้อน 1 = `activityLedger` ของ Dashboard · ก้อน 2 = `buildNextTasks` เดิม · ก้อน 4 = บอร์ดทีมเดิม)
 * นิยามใหม่มีที่เดียวคือ **ก้อน 3 "วันนี้ท่อเดินแค่ไหน"** (นับเป็นคน = เบอร์ไม่ซ้ำ) — อยู่ในไฟล์นี้ที่เดียว
 */
import type { UserRole } from '@/types';
import { CONNECTED_CALL_OUTCOMES } from '@/lib/callOutcomeBuckets';
import { classifyCallMicro, vocabForPersonRef } from '@/lib/callMicroOutcome';
import type { ActivityLedger } from '@/lib/trends/requestTrends';

/* ─────────────── ลำดับก้อนตามคนเปิด ─────────────── */

export type HomeBlockKey = 'result' | 'stuck' | 'today' | 'teams';

/**
 * เจ้าของเคาะ "แยกตามคนเปิด": หัวหน้า/ผู้บริหาร **ผลงานก่อน** · เจ้าหน้าที่ **งานของฉัน (ของค้าง) ก่อน** · ก้อนอื่นเหมือนกัน
 * opl = ผู้ชมอ่านอย่างเดียว (ทำงานในคิวไม่ได้) ⇒ ผลงานก่อน
 */
export function homeBlockOrder(role: UserRole | null | undefined): HomeBlockKey[] {
  return role === 'staff' ? ['stuck', 'result', 'today', 'teams'] : ['result', 'stuck', 'today', 'teams'];
}

/* ─────────────── ก้อน 1 — ผลงานเดือนนี้ (อัตรา) ─────────────── */

export type HomeMonthResult = {
  /** วันแรกของเดือน / วันนี้ (ปฏิทินไทย) */
  monthFrom: string;
  today: string;
  /** ยกมาต้นเดือน (ตามสมการ) */
  carried: number;
  /** ขอใหม่ (วันที่กรอก) */
  added: number;
  /** หาได้แล้ว (วันแจ้งเข้าจริง) */
  informed: number;
  /** ยกเลิก (วันปิด) */
  cancelled: number;
  /** ยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก */
  equationEnd: number;
  /** หาได้แล้วที่ไม่มีวันแจ้งเข้า — ยังไม่ได้หักในงวดไหน (ธงประมาณการ · snapshot_fallback) */
  undatedFilled: number;
  /** เหลือหาจริงตามแถวใบขอ ERP */
  erpOpenNow: number;
  /** เหลือหาตอนนี้ = หัวกล่องงาน (ERP + ใบขอล่วงหน้าฝั่งเรา) */
  boardOpen: number;
  /** ในนั้นเป็นใบขอล่วงหน้าฝั่งเรา */
  boardPre: number;
  /** ส่วนต่างที่สมการอธิบายไม่ได้ (ควรเป็น 0 · ไม่ใช่ 0 = บอกบนจอ ห้ามกลบ) */
  unexplained: number;
  /** อายุของสำเนา ERP */
  source: string;
  ageSeconds: number;
};

/**
 * ประกอบก้อน 1 จาก ledger ของเดือน (grain เดือน = งวดเดียว) + ยอดหัวกล่องงาน
 * กระทบยอด: ยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก − ไม่มีวันแจ้งเข้า = ERP ของหัวกล่องงาน · + ใบขอล่วงหน้า = หัวกล่องงาน
 */
export function buildMonthResult(
  ledger: Pick<ActivityLedger, 'points' | 'ledgerEnd' | 'undatedFilled' | 'openNow'>,
  board: { open: number; pre: number },
  meta: { monthFrom: string; today: string; source: string; ageSeconds: number },
): HomeMonthResult {
  const sum = (k: 'added' | 'informed' | 'cancelled') => ledger.points.reduce((a, p) => a + p[k], 0);
  const added = sum('added');
  const informed = sum('informed');
  const cancelled = sum('cancelled');
  const carried = ledger.ledgerEnd - added + informed + cancelled;
  const boardErp = board.open - board.pre;
  return {
    ...meta,
    carried,
    added,
    informed,
    cancelled,
    equationEnd: ledger.ledgerEnd,
    undatedFilled: ledger.undatedFilled,
    erpOpenNow: ledger.openNow,
    boardOpen: board.open,
    boardPre: board.pre,
    unexplained: ledger.ledgerEnd - ledger.undatedFilled - boardErp,
  };
}

/* ─────────────── ก้อน 3 — วันนี้ท่อเดินแค่ไหน (นับเป็นคน) ─────────────── */

export type HomeTodayStepKey = 'applied' | 'called' | 'connected' | 'interested' | 'appointed' | 'arrived';

/** ลำดับขั้นบนจอ — ป้าย/คำอธิบายอยู่ `metricDictionary` (`today.<key>`) */
export const HOME_TODAY_STEPS: readonly HomeTodayStepKey[] = [
  'applied',
  'called',
  'connected',
  'interested',
  'appointed',
  'arrived',
];

export type HomeTodayStep = { key: HomeTodayStepKey; today: number; yesterday: number };

export type HomeTodayFunnel = { day: string; yesterday: string; steps: HomeTodayStep[] };

/** เหตุการณ์หนึ่งรายการ — `who` = คีย์คน (เบอร์ E.164 · ไม่มีเบอร์ = รหัสแถว) */
export type HomeTodayEvent = { step: HomeTodayStepKey; day: string; who: string };

const CONNECTED = new Set<string>(CONNECTED_CALL_OUTCOMES);

/**
 * สายของ AI หนึ่งสาย (เลนสรรหา: หน้าสาธารณะ + Match — **ไม่รวมเลนติดตาม**) ไปอยู่ขั้นไหนบ้าง
 * - โทร = มีผลกลับ (ไม่นับยกเลิก) · ติด = ผลอยู่ในถัง "โทรติด" กลาง (`CONNECTED_CALL_OUTCOMES`)
 * - สนใจ = ถัง `said_yes` ของ `classifyCallMicro` (ตัวเดียวกับ Dashboard/บอร์ดทีม · รหัสผลก่อน แล้วค่อยอ่านคำพูด)
 */
export function aiCallSteps(row: {
  outcome: string | null;
  summary: string | null;
  reply: string | null;
  personRef: string;
}): HomeTodayStepKey[] {
  const code = (row.outcome ?? '').trim().toLowerCase();
  if (!code || code === 'cancelled') return [];
  const steps: HomeTodayStepKey[] = ['called'];
  if (CONNECTED.has(code)) steps.push('connected');
  const bucket = classifyCallMicro(
    { outcome: row.outcome, summary: row.summary, reply: row.reply },
    vocabForPersonRef(row.personRef),
  );
  if (bucket === 'said_yes') steps.push('interested');
  return steps;
}

/**
 * บันทึกติดต่อของเจ้าหน้าที่หนึ่งรายการ — ไม่มีช่อง "สนใจ" แยก ⇒ ติดต่อได้ + ได้นัด = สนใจ และ นัด
 * (นัด = นิยามเดิมของ "นัดสัมภาษณ์วันนี้": `ok` + มีวันนัด)
 */
export function staffContactSteps(row: { ok: boolean; hasAppointment: boolean }): HomeTodayStepKey[] {
  const steps: HomeTodayStepKey[] = ['called'];
  if (row.ok) steps.push('connected');
  if (row.ok && row.hasAppointment) steps.push('interested', 'appointed');
  return steps;
}

/** นับคนไม่ซ้ำต่อขั้น วันนี้ / เมื่อวาน — คนเดียวหลายเหตุการณ์ในขั้นเดียว = 1 */
export function countTodaySteps(events: readonly HomeTodayEvent[], today: string, yesterday: string): HomeTodayStep[] {
  const sets = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.day !== today && e.day !== yesterday) continue;
    const k = `${e.step}|${e.day}`;
    const s = sets.get(k) ?? new Set<string>();
    s.add(e.who);
    sets.set(k, s);
  }
  return HOME_TODAY_STEPS.map((key) => ({
    key,
    today: sets.get(`${key}|${today}`)?.size ?? 0,
    yesterday: sets.get(`${key}|${yesterday}`)?.size ?? 0,
  }));
}

/* ─────────────── คำตอบของเส้น ─────────────── */

export type HomeBuOption = {
  /** BU กลางชุดแผนก */
  bu: string;
  label: string;
  /** เหลือหาตอนนี้ของ BU นี้ (อัตรา · feed เดียวกับหัวกล่องงาน) */
  remaining: number;
  openJobs: number;
};

export type HomeOverview = {
  generated_at: string;
  /** ขอบเขตของผู้ใช้ — `code` = ถูกล็อกแผนก (BU ถูกบังคับ) */
  scope: 'all' | 'code' | 'none';
  forced_bu: string | null;
  /** BU ที่เส้นกรองให้จริง (null = ทั้งหมดตามสิทธิ์) */
  bu: string | null;
  bu_options: HomeBuOption[];
  /** ใบเปิดที่อ่าน BU ไม่ออก — อยู่ใน "ทั้งหมด" แต่ไม่อยู่ BU ไหน (บอกบนจอ ห้ามหายเงียบ) */
  unknown_bu_jobs: number;
  result: HomeMonthResult | null;
  today: HomeTodayFunnel | null;
  errors: { result?: string; today?: string };
};
