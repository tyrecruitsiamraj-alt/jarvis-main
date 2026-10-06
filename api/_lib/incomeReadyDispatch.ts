/**
 * ═══ ตั้งรายได้แล้ว → ส่งใบสมัครที่ค้างเข้า AI เอง (เจ้าของ 6 ต.ค. 2569 · Choice "ส่งเองเมื่อตั้งรายได้") ═══
 *
 * ด่าน "ไม่มีรายได้ ไม่ส่ง AI" (836c2b2 · 6 ต.ค. 2569 18:23) ทำให้ใบที่กรอกผ่านลิงก์ของใบขอที่ยังไม่ตั้งรายได้
 * ไม่เข้าคิวโทร · เดิมพอทีมตั้งรายได้ทีหลัง ต้องไล่กด "ส่ง AI" ทีละใบ
 * ⇒ บันทึก field_overrides ที่มีรายได้ (`income` มีรายการ หรือ `total_income`) แล้วหยิบใบที่ค้างของใบขอนั้นส่งเข้า AI
 *
 * ใบที่หยิบ = ใบที่ "ควรถูกส่งอัตโนมัติตอนกรอก แต่ยังไม่มีสาย":
 *   กรอกเองผ่านลิงก์ (`link_id` มี · `created_by_name` ว่าง — ใบคีย์/นำเข้า AI ไม่โทรเองตามเดิม) ·
 *   กรอกหลังด่านรายได้เริ่มใช้ (`INCOME_GATE_SINCE` — ใบเก่าที่ตกด้วยเหตุอื่นห้ามถูกโทรทีหลังเงียบ ๆ) ·
 *   ไม่มีแถวในคิวโทร · ไม่ถูกยกเลิกข้อมูล · อายุไม่เกิน
 * 🔴 สวิตช์เดียวกับการส่งตอนกรอก (`APPLICATION_AUTO_DISPATCH_ENABLED`) — ปิด = ไม่ส่ง (fail-safe ไปทางไม่โทร)
 * 🔴 ส่งผ่าน `enqueueLumosInterviewForApplications` → `insertQueueItems` (คอขวดเดียว: เบอร์ที่พัก/เคยปฏิเสธ/กันซ้ำ)
 *    ตัวส่งเช็กรายได้ซ้ำเองอีกชั้น (อ่านใบขอใหม่)
 * ⚠️ เรียกแบบไม่รอ (หลังตอบหน้าเว็บ) — ล้มห้ามทำให้การบันทึกล้ม
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { enqueueLumosInterviewForApplications } from './lumosDispatch.js';
import { listSiamrajUnitRequests } from './siamrajUnitRequests.js';
import { OVER_AGE_MIN } from '../../src/lib/applicantAge.js';
import { logError, logInfo } from './logger.js';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const CANCELLATIONS = tableInAppSchema('application_cancellations');

/** เวลาที่ด่านรายได้ขึ้นเว็บ (836c2b2) — ใบที่กรอกก่อนหน้านี้ไม่ได้ค้างเพราะรายได้ */
export const INCOME_GATE_SINCE = '2026-10-06T18:23:00+07:00';
/** เพดานต่อครั้ง — ใบขอเดียวไม่ควรมีค้างเกินนี้ */
const LIMIT = 100;

const PREQUEST_PREFIX = 'siamraj-pre:';

/** field_overrides มีรายได้ที่ทีมตั้งเองไหม — ตัวจุดชนวนเดียว */
export function hasManualIncome(fo: unknown): boolean {
  if (!fo || typeof fo !== 'object') return false;
  const o = fo as { income?: { lines?: unknown[] } | null; total_income?: unknown };
  if (Array.isArray(o.income?.lines) && o.income.lines.length > 0) return true;
  return typeof o.total_income === 'number' && o.total_income > 0;
}

/** คีย์บันทึกของใบขอ (`unitRequestNoteKey`) → `job_id` ของใบสมัคร · ใบขอล่วงหน้าใช้คีย์เดียวกัน */
export function jobIdOfNoteKey(key: string): string {
  const k = key.trim();
  return k.startsWith(PREQUEST_PREFIX) ? k : `siamraj-sql:${k}`;
}

export function isAutoDispatchEnabled(): boolean {
  return (process.env.APPLICATION_AUTO_DISPATCH_ENABLED || '').trim().toLowerCase() === 'true';
}

type WaitingRow = {
  id: string;
  full_name: string;
  phone: string | null;
  job_id: string;
  job_title: string | null;
  unit_name: string | null;
  position_interest: string | null;
  age: number | null;
};

/** ใบที่ค้างของใบขอนี้ — แยกออกมาให้เทสต์/ตรวจแบบอ่านอย่างเดียวได้ */
export function waitingApplicationsSql(): string {
  return `
    select a.id::text as id, a.full_name, a.phone, a.job_id, a.job_title, a.unit_name, a.position_interest, a.age
    from ${APPS} a
    where a.job_id = $1
      and a.link_id is not null
      and a.created_by_name is null
      and a.created_at >= $2::timestamptz
      and (a.age is null or a.age < ${OVER_AGE_MIN})
      and not exists (select 1 from ${QUEUE} q where q.person_ref = 'app-' || a.id::text)
      and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)
    order by a.created_at asc
    limit ${LIMIT}`;
}

export async function dispatchWaitingApplications(
  requestNo: string,
): Promise<{ found: number; queued: number; skipped: number }> {
  const jobId = jobIdOfNoteKey(requestNo);
  const { rows } = await dbQuery<WaitingRow>(waitingApplicationsSql(), [jobId, INCOME_GATE_SINCE]);
  if (rows.length === 0) return { found: 0, queued: 0, skipped: 0 };
  // สำเนาใบขอเพิ่งถูกล้างตอนบันทึก — อุ่นก่อน ไม่งั้นตัวอ่านรายได้ (เพดาน 4 วิ) หมดเวลาแล้วไม่ส่ง
  try {
    await listSiamrajUnitRequests({ limit: 500, mode: 'all' });
  } catch {
    /* อุ่นไม่ได้ — ตัวส่งยังลองอ่านเอง */
  }
  const outcome = await enqueueLumosInterviewForApplications(
    jobId,
    rows.map((r) => ({ ...r, created_by_name: null })),
    { autoPush: true },
  );
  const result = { found: rows.length, queued: outcome.queued, skipped: rows.length - outcome.queued };
  logInfo('incomeReady.dispatch', { jobId, ...result, reasons: outcome.skipped.map((s) => s.reason) });
  return result;
}

/** จุดเรียกจากเส้นบันทึก — ไม่รอ · ล้มแค่ log */
export function dispatchWaitingApplicationsInBackground(requestNo: string, fieldOverrides: unknown): void {
  if (!isAutoDispatchEnabled() || !hasManualIncome(fieldOverrides)) return;
  void dispatchWaitingApplications(requestNo).catch((e) => {
    logError('incomeReady.dispatch.failed (บันทึกใบขอสำเร็จแล้ว — ส่ง AI ทีละใบจากแท็บผู้สมัครได้)', e, { requestNo });
  });
}
