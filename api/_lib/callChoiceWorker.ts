/**
 * worker "กันชื่อดอง" (Phase 5.7-5.10 · เจ้าของเคาะ 22 ส.ค. 2569)
 *
 * เดินสองงานต่อรอบ:
 *   ① ถอด claim ของใบที่ดองเกิน 1 วันไม่มี dial stamp → เตือนหัวหน้า (5.7-5.8)
 *   ② ใบที่อยู่กอง "เลือกวิธีโทร" ครบ 1 วันแล้วยังไม่มีใครเลือก → ส่งเข้าคิว AI เอง (5.10)
 *
 * 🔴 **ปิดโดยค่าเริ่มต้น เปิดที่ deploy เท่านั้น** (`CLAIM_GUARD_ENABLED=true`)
 * ฐาน dev = production — worker บนเครื่องนักพัฒนาจะถอด claim ของคนจริงและยิงสายจริง
 * (บทเรียนเดียวกับยามเฝ้าระบบ 19 ส.ค. 2569 ที่เด้ง "ERP ผิดปกติ" เข้าฐานจริง)
 *
 * 🔴 การส่งเข้าคิวใช้ `enqueueLumosInterviewForApplications()` → `insertQueueItems()`
 * ซึ่งเป็น **คอขวดเดียว** ที่มีด่านครบแล้ว (เบอร์ที่คนถือ · เบอร์ที่พักไว้ · เคยปฏิเสธใบนี้
 * · quiet hours 20:00-08:00 · กันซ้ำ channel+job+person) — ห้ามเขียน insert คิวเองที่นี่
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError, logInfo } from './logger.js';
import { notifyRoles } from './appNotifications.js';
import { OVERVIEW_BUCKETS } from './applicantOverviewSql.js';
import { enqueueLumosInterviewForApplications } from './lumosDispatch.js';
import { autoMoveIntEnv } from '../../src/lib/applicationAutoMoveReport.js';
import {
  CALL_CHOICE_HOURS,
  buildUnclaimNotice,
  idleDays,
  unclaimDedupeKey,
  type UnclaimedItem,
} from '../../src/lib/callChoiceGuard.js';

const APPS = tableInAppSchema('public_job_applications');

const DEFAULT_INTERVAL_MS = 900_000; // 15 นาที — จังหวะเดียวกับตัวย้ายใบสมัคร
const MIN_INTERVAL_MS = 60_000;
/** เพดานต่อรอบ — กันวันแรกที่เปิดใช้แล้วมีของค้างสะสมเป็นพันใบยิงรวดเดียว */
const DEFAULT_LIMIT = 100;

let running = false;
let stopped = false;

export type ClaimGuardRun = {
  at: string;
  /** ถอด claim ได้กี่ใบรอบนี้ */
  unclaimed: number;
  /** ส่งเข้าคิว AI ได้กี่ใบรอบนี้ */
  autoQueued: number;
  /** ใบที่ครบกำหนดแต่ส่งไม่ได้ (ไม่มีเบอร์/ถูกด่านกัน) — ต้องเห็น ไม่ใช่เงียบ */
  autoSkipped: number;
  error?: string;
};

let lastRun: ClaimGuardRun | null = null;

export function getLastClaimGuardRun(): ClaimGuardRun | null {
  return lastRun;
}

/** 🔴 ปิดเป็นค่าตั้งต้น — ดูเหตุผลในหัวไฟล์ */
export function isClaimGuardEnabled(): boolean {
  const raw = String(process.env.CLAIM_GUARD_ENABLED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

/** 42703 undefined_column — โค้ดขึ้นก่อน migration 104 */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/**
 * ① ถอด claim ของใบที่ดองเกินกำหนด — เงื่อนไขมาจาก `OVERVIEW_BUCKETS.claimed_idle`
 * (นิยามเดียวกับกล่องบน dashboard เป๊ะ — คนเห็นเลขเท่าไหร่ worker ลงมือเท่านั้น)
 *
 * ⚠️ `dbQuery` คืนแค่ `{ rows }` ไม่มี `rowCount` → ต้องใช้ `RETURNING` นับ
 * ⚠️ เก็บ `unclaimed_from_name` ไว้จากชื่อคนเก็บ **ก่อน** ล้าง claim ไม่งั้นชื่อหาย
 */
async function unclaimIdle(limit: number, now: Date): Promise<UnclaimedItem[]> {
  const { rows } = await dbQuery<{
    full_name: string;
    unclaimed_from_name: string | null;
    claimed_at: string | null;
  }>(
    `with due as (
       select a.id, a.claimed_at from ${APPS} a
        where ${OVERVIEW_BUCKETS.claimed_idle}
        order by a.claimed_at asc
        limit $1
     )
     update ${APPS} a
        set claimed_by = null,
            claimed_by_name = null,
            claimed_at = null,
            unclaimed_at = now(),
            unclaimed_from_name = a.claimed_by_name,
            call_choice = null,
            call_choice_at = null,
            call_choice_by_name = null,
            updated_at = now()
       from due
      where a.id = due.id
      returning a.full_name, a.unclaimed_from_name, due.claimed_at`,
    [limit],
  );
  return rows.map((r) => ({
    applicantName: r.full_name,
    heldByName: r.unclaimed_from_name,
    days: idleDays(r.claimed_at, now),
  }));
}

/**
 * ② ใบในกอง "เลือกวิธีโทร" ที่ครบกำหนดแล้ว — ส่งเข้าคิว AI เอง
 *
 * ⚠️ ต้อง **ปั๊ม `call_choice='auto_ai'` ก่อนส่ง** ไม่ใช่หลังส่ง: ถ้าส่งก่อนแล้วรอบนี้ล้ม
 * กลางทาง รอบถัดไปจะส่งซ้ำคนเดิม (ด่านกันซ้ำของคิวช่วยได้เฉพาะแถวที่ยัง active
 * — แถวที่ถูก cancelled จะถูก revive ใหม่ทุกรอบ) · ปั๊มก่อนแล้วส่งไม่ได้ = ใบหลุดวงจร
 * ซึ่งยอมรับได้กว่า เพราะยังเห็นใน `call_choice='auto_ai'` และไม่มีสายซ้ำไปหาคนจริง
 */
async function autoSendToAi(limit: number): Promise<{ queued: number; skipped: number }> {
  const { rows } = await dbQuery<{
    id: string;
    full_name: string;
    phone: string | null;
    job_id: string | null;
    job_title: string | null;
    unit_name: string | null;
    position_interest: string | null;
  }>(
    `with due as (
       select a.id from ${APPS} a
        where ${OVERVIEW_BUCKETS.awaiting_call_choice}
          and a.unclaimed_at < now() - interval '${CALL_CHOICE_HOURS} hours'
        order by a.unclaimed_at asc
        limit $1
     )
     update ${APPS} a
        set call_choice = 'auto_ai',
            call_choice_at = now(),
            call_choice_by_name = null,
            updated_at = now()
       from due
      where a.id = due.id
      returning a.id, a.full_name, a.phone, a.job_id, a.job_title, a.unit_name, a.position_interest`,
    [limit],
  );
  if (rows.length === 0) return { queued: 0, skipped: 0 };

  // ใบที่ไม่ผูกใบขอส่งไม่ได้ (คิวต้องมี job_ref) — นับเป็น skipped ให้เห็น ไม่เงียบ
  const byJob = new Map<string, typeof rows>();
  let skipped = 0;
  for (const r of rows) {
    if (!r.job_id) {
      skipped += 1;
      continue;
    }
    const list = byJob.get(r.job_id) ?? [];
    list.push(r);
    byJob.set(r.job_id, list);
  }

  let queued = 0;
  for (const [jobId, apps] of byJob) {
    try {
      const outcome = await enqueueLumosInterviewForApplications(jobId, apps, { autoPush: true });
      queued += outcome.queued;
      skipped += apps.length - outcome.queued;
    } catch (e) {
      skipped += apps.length;
      logError('claimGuard.autoSend.failed', e, { jobId, count: apps.length });
    }
  }
  return { queued, skipped };
}

/** เดินหนึ่งรอบ — export ไว้ให้เทสต์/หน้าสถานะเรียกได้ */
export async function runClaimGuardOnce(opts?: { limit?: number; now?: Date }): Promise<ClaimGuardRun> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? autoMoveIntEnv(process.env.CLAIM_GUARD_LIMIT, DEFAULT_LIMIT, 1);
  const run: ClaimGuardRun = { at: now.toISOString(), unclaimed: 0, autoQueued: 0, autoSkipped: 0 };
  try {
    const unclaimedItems = await unclaimIdle(limit, now);
    run.unclaimed = unclaimedItems.length;

    // เตือนหัวหน้า — แจ้งเตือนล้มห้ามทำให้ worker ตาย (notifyRoles กลืน error เองแล้ว)
    const notice = buildUnclaimNotice(unclaimedItems, now);
    if (notice) {
      await notifyRoles(['admin', 'supervisor'], {
        type: 'claim_idle_released',
        title: notice.title,
        body: notice.body,
        link: '/jobs/board?view=list&bucket=awaiting_call_choice',
        dedupeKey: unclaimDedupeKey(now),
      });
    }

    const sent = await autoSendToAi(limit);
    run.autoQueued = sent.queued;
    run.autoSkipped = sent.skipped;
    logInfo('claimGuard.run', {
      unclaimed: run.unclaimed,
      autoQueued: run.autoQueued,
      autoSkipped: run.autoSkipped,
    });
  } catch (e) {
    // ยังไม่รัน 104 → บอกตรง ๆ แล้วหยุดรอบนี้ (ของเดิมไม่พัง)
    run.error = isUndefinedColumn(e)
      ? 'ยังไม่ได้รัน migration 104 — สั่ง node scripts/migrate.mjs ก่อน'
      : e instanceof Error
        ? e.message
        : 'ไม่ทราบสาเหตุ';
    logError('claimGuard.run.failed', e);
  }
  lastRun = run;
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

async function sleepInterruptible(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped && Date.now() < end) {
    await sleep(Math.min(1_000, end - Date.now()));
  }
}

export function startClaimGuardWorker(): boolean {
  if (!isClaimGuardEnabled()) {
    logInfo('claimGuard.worker.disabled');
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;

  const intervalMs = autoMoveIntEnv(process.env.CLAIM_GUARD_INTERVAL_MS, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS);
  const startupDelayMs = autoMoveIntEnv(process.env.CLAIM_GUARD_STARTUP_DELAY_MS, 60_000, 0);
  logInfo('claimGuard.worker.start', { intervalMs, startupDelayMs });

  void (async () => {
    // หน่วงตอนบูตนานกว่าตัวอื่น — รอบแรกยิงสายจริงได้ ไม่ควรเดินทันทีที่ deploy
    await sleepInterruptible(startupDelayMs);
    while (!stopped) {
      // อ่าน flag ใหม่ทุกรอบ — ปิดสวิตช์แล้วมีผลรอบถัดไปโดยไม่ต้องรีสตาร์ต
      if (!isClaimGuardEnabled()) {
        logInfo('claimGuard.worker.turnedOff');
        break;
      }
      await runClaimGuardOnce();
      await sleepInterruptible(intervalMs);
    }
    running = false;
  })();

  return true;
}

export function stopClaimGuardWorker(): void {
  stopped = true;
}
