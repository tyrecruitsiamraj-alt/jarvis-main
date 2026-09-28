/**
 * ═══ ส่งซ้ำ "สายใบสมัครที่ส่งไม่ถึง Lumos" (เจ้าของเคาะ 28 ก.ย. 2569) ═══
 *
 * ไล่พบ 28 ก.ย.: ใบสมัคร OPL6909083 3 ใบค้าง 2–4 วัน — push ตอนกรอกล้มครั้งเดียว + **Lumos ไม่มาดึงคิวเองแล้ว**
 * ระบบยังนับว่า "อยู่ในคิว AI" จึงไม่มีเจ้าหน้าที่คนไหนโทร · งานติดตามเคยเจอแบบเดียวกัน 11 ก.ย. (`followPushRetryWorker`)
 *
 * Choice ที่เจ้าของเลือก: *"ตัวส่งซ้ำแบบงานติดตาม — จดว่าส่งไม่ถึง แล้วลองใหม่ทุกนาทีจนถึง (รหัสเดิม ไม่เกิดสายซ้อน) ·
 * ไม่ส่งช่วง 20:00–08:00 · เกิน 24 ชม. ยังไม่ถึง = เลิกส่ง AI แล้วขึ้นให้เจ้าหน้าที่โทรเอง"*
 *
 * ทุกนาที: หยิบแถวใบสมัครที่ `push_failed` (หรือ `push_pending` ค้าง = เครื่องรีสตาร์ตกลางทาง) แล้วตัดสินด้วย
 * `decideApplicationPushRetry` (มีเทสต์) — ยิง / รอ / เลิก
 * 🔴 ก่อนยิงเช็คซ้ำทุกครั้ง (ของเปลี่ยนได้ระหว่างรอ): มีคนรับไป/บันทึกผลติดต่อแล้ว/ย้ายเป็น Lead · เบอร์ถูกพัก ·
 *    เบอร์มีคนถืออยู่ ⇒ **ไม่ยิง** แล้วปิดฝั่ง AI (fail-safe ไปทางไม่โทร — โทรทับคนที่มีเจ้าของแล้วกู้คืนไม่ได้)
 * 🔴 เลิก = ปิดฝั่ง AI (`cancelled`) + `followup_state = 'needs_human'` ⇒ ขึ้นกล่อง "ต้องเร่งจัดการ" บนหน้าแรก และ
 *    ใบกลับไปอยู่ถัง "ยังไม่ถูกแตะ" ของแท็บผู้สมัคร (ไม่ถูกนับว่า AI ถืออยู่อีก)
 * ปิดได้ด้วย `APPLICATION_PUSH_RETRY_ENABLED=false` · ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { errorSummaryText, logError, logInfo, logWarn } from './logger.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { queuePending } from './lumosQueueDefs.js';
import { bangkokIso } from './bangkokIso.js';
import { getCallFollowupPolicy } from './callFollowupPolicyStore.js';
import { listSuppressedPhones } from './callFollowup.js';
import { listHeldPhones } from './candidateCallHolds.js';
import { pushApplicationRowsTracked } from './applicationPushTracking.js';
import { DEFAULT_CALL_FOLLOWUP_POLICY } from '../../src/lib/callFollowupPolicy.js';
import {
  decideApplicationPushRetry,
  readApplicationPushRetryConfig,
  type ApplicationPushRetryConfig,
} from '../../src/lib/applicationPushRetryPolicy.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const appsTable = tableInAppSchema('public_job_applications');
const contactsTable = tableInAppSchema('application_contact_logs');

let running = false;
let stopped = false;

export type ApplicationPushRetryRun = {
  at: string;
  found: number;
  sent: number;
  failed: number;
  waiting: number;
  /** ปิดฝั่ง AI เพราะมีเจ้าของ/ถูกพักแล้ว */
  skipped: number;
  /** เลยเพดาน โยนให้เจ้าหน้าที่ */
  gaveUp: number;
};

let lastRun: ApplicationPushRetryRun | null = null;

export function getLastApplicationPushRetryRun(): ApplicationPushRetryRun | null {
  return lastRun;
}

export function getApplicationPushRetryConfig(): ApplicationPushRetryConfig {
  return readApplicationPushRetryConfig(process.env);
}

type Candidate = {
  id: string;
  payload: unknown;
  created_at: string | Date;
  next_attempt_at: string | Date | null;
  app_exists: boolean;
  claimed: boolean;
  is_lead: boolean;
  contacted: boolean;
};

/**
 * แถวที่ยังต้องตาม — ใบสมัคร (`app-`) ช่อง interview · ยังไม่มีผล (นิยามกลาง `queuePending`) ·
 * จดว่าส่งไม่ถึง หรือกำลังส่งค้างนานเกิน (รีสตาร์ตกลางทาง) · แถวเก่าก่อน migration 123 (`push_state` null) ไม่แตะ
 */
export function buildCandidateSql(): string {
  return `select q.id::text as id, q.payload, q.created_at, q.next_attempt_at,
                 (a.id is not null) as app_exists,
                 (a.claimed_by is not null) as claimed,
                 coalesce(a.is_lead, false) as is_lead,
                 exists (select 1 from ${contactsTable} c where c.application_id = a.id) as contacted
            from ${queueTable} q
            left join ${appsTable} a on q.person_ref = 'app-' || a.id::text
           where q.channel = 'interview'
             and q.person_ref like 'app-%'
             and ${queuePending('q')}
             and q.result is null
             and (q.push_state = 'push_failed'
                  or (q.push_state = 'push_pending'
                      and q.push_started_at < now() - make_interval(mins => $2::int)))
           order by coalesce(q.next_attempt_at, q.created_at) asc
           limit $1`;
}

/** ปิดฝั่ง AI ของแถวที่ยังค้างจริงเท่านั้น (ผลโทรเพิ่งกลับมา = ไม่แตะ) */
async function closeAiSide(id: string, pushState: 'push_skipped' | 'push_gave_up', reason: string): Promise<void> {
  const needsHuman = pushState === 'push_gave_up';
  try {
    await dbQuery(
      `update ${queueTable}
          set status = 'cancelled', push_state = $2, push_error = $3, updated_at = now()
              ${needsHuman ? `, followup_state = 'needs_human'` : ''}
        where id = $1::bigint and ${queuePending('')} and result is null`,
      [id, pushState, reason],
    );
  } catch (e) {
    logError('application.pushRetry: ปิดฝั่ง AI ไม่สำเร็จ', e, { queueId: id, pushState });
  }
}

const phoneOf = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as Record<string, unknown>).phone;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

const toDate = (v: string | Date | null): Date | null => {
  if (v === null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** เดินหนึ่งรอบ — export ไว้ให้เทสต์ */
export async function runApplicationPushRetryOnce(
  cfg: ApplicationPushRetryConfig = getApplicationPushRetryConfig(),
  now: Date = new Date(),
): Promise<ApplicationPushRetryRun> {
  const run: ApplicationPushRetryRun = {
    at: now.toISOString(),
    found: 0,
    sent: 0,
    failed: 0,
    waiting: 0,
    skipped: 0,
    gaveUp: 0,
  };
  if (!getLumosPushConfig()) {
    lastRun = run;
    return run;
  }

  let rows: Candidate[];
  try {
    ({ rows } = await dbQuery<Candidate>(buildCandidateSql(), [cfg.limit, cfg.stalePendingMinutes]));
  } catch (e) {
    // ยังไม่ migrate 123 = ยังไม่มีอะไรให้ตาม (ไม่ต้องดังทุกนาที)
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === '42703') {
      lastRun = run;
      return run;
    }
    logError('application.pushRetry: อ่านแถวค้างไม่สำเร็จ', e);
    lastRun = run;
    return run;
  }
  run.found = rows.length;
  if (rows.length === 0) {
    lastRun = run;
    return run;
  }

  const policy = await getCallFollowupPolicy().catch(() => DEFAULT_CALL_FOLLOWUP_POLICY);
  // เบอร์ถูกพัก: อ่านไม่ได้ = รอบนี้ไม่ยิงใครเลย (เผลอโทรคนที่บอกเลิกหางานแล้วกู้คืนไม่ได้)
  let suppressed: Set<string> | null;
  try {
    suppressed = await listSuppressedPhones();
  } catch {
    suppressed = null;
  }
  // เบอร์มีคนถือ: อ่านไม่ได้ = ไม่กรอง (กติกาเดียวกับตอนเข้าคิว `insertQueueItems`)
  let held: Set<string>;
  try {
    held = await listHeldPhones();
  } catch {
    held = new Set();
  }

  for (const row of rows) {
    if (stopped) break;
    const dueAt = toDate(row.next_attempt_at) ?? toDate(row.created_at) ?? now;
    const decision = decideApplicationPushRetry(dueAt, cfg, policy, now);
    if (decision.action === 'give_up') {
      run.gaveUp += 1;
      await closeAiSide(row.id, 'push_gave_up', `ส่งไม่ถึง Lumos เกิน ${Math.round(cfg.giveUpAfterMinutes / 60)} ชม. — ให้เจ้าหน้าที่โทรเอง`);
      logWarn('application.pushRetry.gaveUp', { queueId: row.id });
      continue;
    }
    if (decision.action === 'wait') {
      run.waiting += 1;
      continue;
    }
    // ── เช็คซ้ำก่อนยิงทุกครั้ง ──
    const skipReason = !row.app_exists
      ? 'ไม่พบใบสมัครแล้ว'
      : row.claimed
        ? 'มีเจ้าหน้าที่รับไปโทรเองแล้ว'
        : row.contacted
          ? 'มีบันทึกผลติดต่อแล้ว'
          : row.is_lead
            ? 'ย้ายไปเป็น Lead แล้ว'
            : null;
    if (skipReason) {
      run.skipped += 1;
      await closeAiSide(row.id, 'push_skipped', skipReason);
      continue;
    }
    const phone = phoneOf(row.payload);
    if (suppressed === null) {
      run.waiting += 1;
      continue;
    }
    if (phone && suppressed.has(phone)) {
      run.skipped += 1;
      await closeAiSide(row.id, 'push_skipped', 'เบอร์ถูกพัก (ไม่หางานแล้ว/เบอร์เสีย)');
      continue;
    }
    if (phone && held.has(phone)) {
      run.skipped += 1;
      await closeAiSide(row.id, 'push_skipped', 'เบอร์นี้มีเจ้าหน้าที่ถืออยู่');
      continue;
    }
    // ── ยิงพร้อมเวลานัดที่พ้นช่วงห้ามโทรแล้ว ──
    const scheduledAt = bangkokIso(decision.scheduledAt);
    try {
      const r = await pushApplicationRowsTracked([{ id: row.id, payload: row.payload }], (p) => ({
        ...p,
        scheduled_at: scheduledAt,
      }));
      run.sent += r.pushed;
      run.failed += r.failed;
      if (r.pushed) logInfo('application.pushRetry.ok', { queueId: row.id, scheduledAt });
    } catch (e) {
      run.failed += 1;
      logWarn('application.pushRetry.failed', { queueId: row.id, reason: errorSummaryText(e, 200) });
    }
  }

  lastRun = run;
  // รอบที่แค่ "รอ" (ช่วงห้ามโทร/ยังไม่ถึงเวลานัด) ไม่ต้องจด — ไม่งั้นคืนละ ~700 บรรทัด
  if (run.sent || run.failed || run.skipped || run.gaveUp) logInfo('application.pushRetry.run', { ...run });
  return run;
}

function sleepInterruptible(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === 'function') t.unref();
  });
}

/** เริ่มตัวส่งซ้ำ — เรียกครั้งเดียวตอนบูต process API · คืน `false` เมื่อถูกปิดไว้ด้วย env */
export function startApplicationPushRetryWorker(): boolean {
  const cfg = getApplicationPushRetryConfig();
  if (!cfg.enabled) {
    logInfo('application.pushRetry.worker.disabled', {
      hint: 'ลบ APPLICATION_PUSH_RETRY_ENABLED หรือตั้งเป็น true เพื่อเปิด',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('application.pushRetry.worker.start', {
    intervalMs: cfg.intervalMs,
    limit: cfg.limit,
    giveUpAfterMinutes: cfg.giveUpAfterMinutes,
  });
  void (async () => {
    await sleepInterruptible(cfg.startupDelayMs);
    while (!stopped) {
      const nowCfg = getApplicationPushRetryConfig();
      if (!nowCfg.enabled) {
        logWarn('application.pushRetry.worker.turnedOff');
        break;
      }
      try {
        await runApplicationPushRetryOnce(nowCfg);
      } catch (e) {
        logError('application.pushRetry: รอบนี้ล้มทั้งรอบ', e);
      }
      await sleepInterruptible(nowCfg.intervalMs);
    }
    running = false;
  })();
  return true;
}

export function stopApplicationPushRetryWorker(): void {
  stopped = true;
}
