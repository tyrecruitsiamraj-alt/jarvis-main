/**
 * ═══ ใบสมัครที่ส่ง AI ไม่สำเร็จตอนกรอก → ลองส่งใหม่เอง (เจ้าของสั่ง 15 ต.ค. 2569 "ทำข้อ 1 กันไม่ให้หลุดอีก") ═══
 *
 * ต้นเหตุ (ไล่จากข้อมูลจริง 15 ต.ค.): ตอนกรอกเสร็จ (`public/apply`) ตัวส่งอ่านรายได้ของใบขอ (`loadApplyScriptFacts`)
 * มีเพดาน 4 วิ · สำเนาใบขอหมดอายุแล้วโหลดใหม่ใช้ ~4.25 วิ ⇒ อ่านไม่ทัน = นับว่า "ไม่มีรายได้" ⇒ ไม่ส่ง
 * ไม่มีที่จดเหตุ ไม่มีใครลองใหม่ ⇒ ค้างเงียบ (7–14 ต.ค. หลุด 1–11 ใบ/วัน · ใบขอมีรายได้ครบ)
 *
 * ตัวนี้เดินทุก 5 นาที หยิบใบที่ "ควรถูกส่งตอนกรอก แต่ยังไม่มีสาย" แล้วส่งผ่านคอขวดเดิม
 * (`enqueueLumosInterviewForApplications` → `insertQueueItems` · ด่านอายุ/รายได้/เบอร์พัก/เคยปฏิเสธ/กันซ้ำครบ)
 * อุ่นสำเนาใบขอก่อนทุกรอบ ⇒ อ่านรายได้ทัน · ใบขอไม่มีรายได้จริง = ยังไม่ส่ง รอบหน้าลองใหม่ (ตั้งรายได้แล้วไปเอง)
 *
 * ใบที่หยิบ (ตรงกับเส้นกรอกเสร็จ):
 *   ผูกใบขอ · ไม่มีคนคีย์ (`created_by_name` ว่าง) หรือคีย์/นำเข้าตั้งแต่ `KEYED_AUTO_SINCE` (ไม่ใช่ใบดึงจาก iRecruit) · ไม่มีแถวในคิวโทร · ไม่ถูกยกเลิกข้อมูล · ไม่ติดป้ายซ้ำ iRecruit ·
 *   อายุไม่เกิน · ไม่มีคนเก็บไปโทรเอง/เก็บ Lead · ไม่อยู่กองรอเลือกวิธีโทร (`unclaimed_at` — ของ callChoiceWorker) ·
 *   วิธีโทรว่างหรือเลือก AI · กรอกมาแล้ว ≥ 3 นาที (ไม่ชนเส้นกรอกเสร็จ) และไม่เกิน 7 วัน
 * 🔴 กรอกตั้งแต่ `RETRY_SINCE` เท่านั้น — 17 ใบที่หลุดก่อนหน้านี้ เจ้าของยังไม่สั่งส่ง (ข้อ 2) ห้ามโทรเงียบ ๆ
 * 🔴 ไม่มีคีย์ push ของ Lumos หรือปิด `APPLICATION_AUTO_DISPATCH_ENABLED` = ไม่ทำอะไร
 *    (เครื่องนักพัฒนาไม่มีคีย์ ⇒ ไม่ยิงสายจริงจากเครื่อง ทั้งที่ฐานเป็นของจริง) · ปิดเฉพาะตัวนี้ด้วย APPLICATION_DISPATCH_RETRY_ENABLED=false
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { enqueueLumosInterviewForApplications } from './lumosDispatch.js';
import { listSiamrajUnitRequests } from './siamrajUnitRequests.js';
import { splitIrecruitDuplicates } from './irecruitDuplicates.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { isAutoDispatchEnabled } from './incomeReadyDispatch.js';
import { OVER_AGE_MIN } from '../../src/lib/applicantAge.js';
import { logError, logInfo } from './logger.js';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const CANCELLATIONS = tableInAppSchema('application_cancellations');
const IRECRUIT_DUPS = tableInAppSchema('application_irecruit_dups');

/** เริ่มนับจากตอนแก้ขึ้นเว็บ — ใบก่อนหน้านี้รอเจ้าของสั่ง (ข้อ 2) */
export const RETRY_SINCE = '2026-10-15T09:00:00+07:00';
/**
 * ใบที่เจ้าหน้าที่คีย์เอง/นำเข้า Excel แล้วผูกใบขอ ⇒ AI โทรเองเหมือนกรอกผ่านลิงก์ (เจ้าของ 20 ต.ค. 2569 Choice "AI โทรเองเฉพาะที่ผูกใบขอ")
 * ใช้บทเสนองานของใบคีย์เดิม (`created_by_name` ส่งต่อ) · ใบที่ระบบดึงจาก iRecruit ยังให้คนกดส่ง (กัน iRecruit โทรซ้ำ)
 * 🔴 นับเฉพาะใบที่คีย์ตั้งแต่เวลานี้ — ใบคีย์เก่าไม่ถูกโทรเงียบ ๆ
 */
export const KEYED_AUTO_SINCE = '2026-10-20T10:00:00+07:00';
const IRECRUIT_PULL_CREATED_BY = 'iRecruit';
const MIN_AGE_MINUTES = 3;
const MAX_AGE_DAYS = 7;
const LIMIT = 100;
const INTERVAL_MS = 5 * 60_000;
const STARTUP_DELAY_MS = 90_000;

export type RetryRow = {
  id: string;
  full_name: string;
  phone: string | null;
  job_id: string;
  job_title: string | null;
  unit_name: string | null;
  position_interest: string | null;
  age: number | null;
  created_at: Date | string | null;
  created_by_name: string | null;
};

/** ใบที่ควรถูกส่งตอนกรอกแต่ยังไม่มีสาย — แยกออกมาให้เทสต์/ตรวจแบบอ่านอย่างเดียวได้ · $1 = RETRY_SINCE · $2 = KEYED_AUTO_SINCE */
export function unsentApplicationsSql(): string {
  return `
    select a.id::text as id, a.full_name, a.phone, a.job_id, a.job_title, a.unit_name, a.position_interest, a.age, a.created_at,
           a.created_by_name
    from ${APPS} a
    where a.job_id is not null
      and (a.created_by_name is null
           or (a.created_by_name <> '${IRECRUIT_PULL_CREATED_BY}' and a.created_at >= $2::timestamptz))
      and a.phone is not null
      and a.created_at >= $1::timestamptz
      and a.created_at <= now() - interval '${MIN_AGE_MINUTES} minutes'
      and a.created_at >= now() - interval '${MAX_AGE_DAYS} days'
      and (a.age is null or a.age < ${OVER_AGE_MIN})
      and a.claimed_by is null
      and a.unclaimed_at is null
      and coalesce(a.is_lead, false) = false
      and (a.call_choice is null or a.call_choice in ('ai', 'auto_ai'))
      and not exists (select 1 from ${QUEUE} q where q.person_ref = 'app-' || a.id::text)
      and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)
      and not exists (select 1 from ${IRECRUIT_DUPS} d where d.application_id = a.id)
    order by a.created_at asc
    limit ${LIMIT}`;
}

export function isApplicationDispatchRetryEnabled(): boolean {
  if ((process.env.APPLICATION_DISPATCH_RETRY_ENABLED || '').trim().toLowerCase() === 'false') return false;
  return isAutoDispatchEnabled() && getLumosPushConfig() !== null;
}

export type DispatchRetryRun = { found: number; queued: number; skipped: number; reasons: Record<string, number> };

export async function runApplicationDispatchRetryOnce(): Promise<DispatchRetryRun> {
  const out: DispatchRetryRun = { found: 0, queued: 0, skipped: 0, reasons: {} };
  if (!isApplicationDispatchRetryEnabled()) return out;
  const { rows } = await dbQuery<RetryRow>(unsentApplicationsSql(), [RETRY_SINCE, KEYED_AUTO_SINCE]);
  if (rows.length === 0) return out;
  out.found = rows.length;
  // อุ่นสำเนาใบขอก่อน — ต้นเหตุเดิมคืออ่านรายได้ไม่ทันเพราะสำเนาเย็น
  try {
    await listSiamrajUnitRequests({ limit: 500, mode: 'all' });
  } catch {
    /* อุ่นไม่ได้ — ตัวส่งยังลองอ่านเอง */
  }
  const byJob = new Map<string, RetryRow[]>();
  for (const r of rows) byJob.set(r.job_id, [...(byJob.get(r.job_id) ?? []), r]);
  for (const [jobId, apps] of byJob) {
    try {
      // ซ้ำ iRecruit ภายใน 14 วัน = ไม่ส่งเอง ติดป้ายให้คนเลือก (กติกาเดียวกับตอนกรอก)
      const { send, dups } = await splitIrecruitDuplicates(apps);
      for (let i = 0; i < dups.length; i++) out.reasons['ซ้ำ iRecruit'] = (out.reasons['ซ้ำ iRecruit'] ?? 0) + 1;
      if (send.length === 0) continue;
      const res = await enqueueLumosInterviewForApplications(
        jobId,
        // กรอกผ่านลิงก์ = บทผู้สมัครผ่านลิงก์ · ใบคีย์/นำเข้า = บทเสนองาน (ส่งชื่อคนคีย์ต่อ)
        send.map((r) => ({ ...r, created_by_name: r.created_by_name ?? null })),
        { autoPush: true },
      );
      out.queued += res.queued;
      for (const s of res.skipped) out.reasons[s.reason] = (out.reasons[s.reason] ?? 0) + 1;
    } catch (e) {
      out.reasons['ส่งล้ม'] = (out.reasons['ส่งล้ม'] ?? 0) + apps.length;
      logError('applicationDispatchRetry.job_failed', e, { jobId, count: apps.length });
    }
  }
  out.skipped = out.found - out.queued;
  logInfo('applicationDispatchRetry.run', out);
  return out;
}

let running = false;
let stopped = false;

async function sleepInterruptible(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped && Date.now() < end) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, Math.min(1_000, end - Date.now()));
      t.unref?.();
    });
  }
}

export function startApplicationDispatchRetryWorker(): boolean {
  if (!isApplicationDispatchRetryEnabled()) {
    logInfo('applicationDispatchRetry.worker.disabled', {
      hint: 'ต้องมีคีย์ push ของ Lumos + APPLICATION_AUTO_DISPATCH_ENABLED=true (และไม่ได้ตั้ง APPLICATION_DISPATCH_RETRY_ENABLED=false)',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('applicationDispatchRetry.worker.start', { intervalMs: INTERVAL_MS, since: RETRY_SINCE });
  void (async () => {
    await sleepInterruptible(STARTUP_DELAY_MS);
    while (!stopped) {
      if (!isApplicationDispatchRetryEnabled()) break;
      try {
        await runApplicationDispatchRetryOnce();
      } catch (e) {
        logError('applicationDispatchRetry.run_failed', e);
      }
      await sleepInterruptible(INTERVAL_MS);
    }
    running = false;
  })();
  return true;
}

export function stopApplicationDispatchRetryWorker(): void {
  stopped = true;
}
