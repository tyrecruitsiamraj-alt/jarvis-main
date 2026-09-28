/**
 * ═══ ส่งซ้ำ "สายที่ส่งไม่ถึง Lumos" — ใบสมัคร + เลน Match (เจ้าของเคาะ 28 ก.ย. 2569) ═══
 *
 * ไล่พบ 28 ก.ย.: ใบสมัคร OPL6909083 3 ใบค้าง 2–4 วัน — push ตอนกรอกล้มครั้งเดียว + **Lumos ไม่มาดึงคิวเองแล้ว**
 * ระบบยังนับว่า "อยู่ในคิว AI" จึงไม่มีเจ้าหน้าที่คนไหนโทร · งานติดตามเคยเจอแบบเดียวกัน 11 ก.ย. (`followPushRetryWorker`)
 *
 * Choice ที่เจ้าของเลือก: *"ตัวส่งซ้ำแบบงานติดตาม — จดว่าส่งไม่ถึง แล้วลองใหม่ทุกนาทีจนถึง (รหัสเดิม ไม่เกิดสายซ้อน) ·
 * เกิน 24 ชม. ยังไม่ถึง = เลิกส่ง AI แล้วขึ้นให้เจ้าหน้าที่โทรเอง"* · เลน Match: *"ถ้าอันไหนให้ส่งก็ส่งไปเลยแล้วก็เข้าคิวโทร"* ·
 * ช่วงห้ามโทร: ยกเลิกทั้งระบบ (migration 125) — ตัวนี้อ่านนโยบายกลางทุกรอบ ตั้งกลับเมื่อไหร่ก็เคารพทันที
 *
 * ครอบ: ช่อง interview ของใบสมัคร (`app-`) + iRecruit (`ir-`) · ช่อง reminder ของคนของเรา (`card-`)
 * 🔴 **ไม่แตะงานติดตาม** (`job_ref = 'follow'`) — แผนหลายรอบ มีตัวส่งซ้ำของตัวเองอยู่แล้ว
 *
 * ทุกนาที: หยิบแถวที่ `push_failed` (หรือ `push_pending` ค้าง = เครื่องรีสตาร์ตกลางทาง) แล้วตัดสินด้วย
 * `decideLumosPushRetry` (มีเทสต์) — ยิง / รอ / เลิก
 * 🔴 ก่อนยิงเช็คซ้ำทุกครั้ง (ของเปลี่ยนได้ระหว่างรอ): เบอร์ถูกพัก · เบอร์มีคนถืออยู่ · และเฉพาะใบสมัคร: มีคนรับไป/
 *    บันทึกผลติดต่อแล้ว/ย้ายเป็น Lead ⇒ **ไม่ยิง** แล้วปิดฝั่ง AI (fail-safe ไปทางไม่โทร — โทรทับคนที่มีเจ้าของแล้วกู้คืนไม่ได้)
 * 🔴 เลิก = ปิดฝั่ง AI (`cancelled`) + `followup_state = 'needs_human'` ⇒ ขึ้นกล่อง "ต้องเร่งจัดการ" บนหน้าแรก และ
 *    ใบสมัครกลับไปอยู่ถัง "ยังไม่ถูกแตะ" ของแท็บผู้สมัคร (ไม่ถูกนับว่า AI ถืออยู่อีก)
 * ปิดได้ด้วย `LUMOS_PUSH_RETRY_ENABLED=false` · ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร
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
import { pushQueueRowsTracked, type LumosPushChannel } from './lumosPushTracking.js';
import { DEFAULT_CALL_FOLLOWUP_POLICY } from '../../src/lib/callFollowupPolicy.js';
import {
  decideLumosPushRetry,
  readLumosPushRetryConfig,
  type LumosPushRetryConfig,
} from '../../src/lib/lumosPushRetryPolicy.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const appsTable = tableInAppSchema('public_job_applications');
const contactsTable = tableInAppSchema('application_contact_logs');

let running = false;
let stopped = false;

export type LumosPushRetryRun = {
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

let lastRun: LumosPushRetryRun | null = null;

export function getLastLumosPushRetryRun(): LumosPushRetryRun | null {
  return lastRun;
}

export function getLumosPushRetryConfig(): LumosPushRetryConfig {
  return readLumosPushRetryConfig(process.env);
}

type Candidate = {
  id: string;
  channel: LumosPushChannel;
  person_ref: string;
  payload: unknown;
  created_at: string | Date;
  next_attempt_at: string | Date | null;
  app_exists: boolean;
  claimed: boolean;
  is_lead: boolean;
  contacted: boolean;
};

/**
 * แถวที่ยังต้องตาม — ใบสมัคร/iRecruit (interview) · คนของเรา (reminder) · ยังไม่มีผล (นิยามกลาง `queuePending`) ·
 * จดว่าส่งไม่ถึง หรือกำลังส่งค้างนานเกิน · แถวเก่าก่อน migration 123 (`push_state` null) และงานติดตามไม่แตะ
 */
export function buildCandidateSql(): string {
  return `select q.id::text as id, q.channel, q.person_ref, q.payload, q.created_at, q.next_attempt_at,
                 (a.id is not null) as app_exists,
                 (a.claimed_by is not null) as claimed,
                 coalesce(a.is_lead, false) as is_lead,
                 exists (select 1 from ${contactsTable} c where c.application_id = a.id) as contacted
            from ${queueTable} q
            left join ${appsTable} a on q.person_ref = 'app-' || a.id::text
           where q.job_ref <> 'follow'
             and ((q.channel = 'interview' and (q.person_ref like 'app-%' or q.person_ref like 'ir-%'))
                  or (q.channel = 'reminder' and q.person_ref like 'card-%'))
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
    logError('lumos.pushRetry: ปิดฝั่ง AI ไม่สำเร็จ', e, { queueId: id, pushState });
  }
}

/** เบอร์ใน payload — interview ใช้ `phone` · reminder ใช้ `recipient_phone` (ตัวเดียวกับ PAYLOAD_PHONE_KEYS) */
const phoneOf = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  for (const key of ['recipient_phone', 'phone']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

/** เลื่อนเวลานัดของ payload — interview มีช่องเดียว · reminder ของเลน Match เป็นแผนรอบเดียวใน `steps` */
export function withScheduledAt(payload: Record<string, unknown>, iso: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if ('scheduled_at' in out || !Array.isArray(out.steps)) out.scheduled_at = iso;
  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((s) =>
      typeof s === 'object' && s !== null ? { ...(s as Record<string, unknown>), scheduled_at: iso } : s,
    );
  }
  return out;
}

const toDate = (v: string | Date | null): Date | null => {
  if (v === null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** เดินหนึ่งรอบ — export ไว้ให้เทสต์ */
export async function runLumosPushRetryOnce(
  cfg: LumosPushRetryConfig = getLumosPushRetryConfig(),
  now: Date = new Date(),
): Promise<LumosPushRetryRun> {
  const run: LumosPushRetryRun = {
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
    logError('lumos.pushRetry: อ่านแถวค้างไม่สำเร็จ', e);
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
    const decision = decideLumosPushRetry(dueAt, cfg, policy, now);
    if (decision.action === 'give_up') {
      run.gaveUp += 1;
      await closeAiSide(
        row.id,
        'push_gave_up',
        `ส่งไม่ถึง Lumos เกิน ${Math.round(cfg.giveUpAfterMinutes / 60)} ชม. — ให้เจ้าหน้าที่โทรเอง`,
      );
      logWarn('lumos.pushRetry.gaveUp', { queueId: row.id, channel: row.channel });
      continue;
    }
    if (decision.action === 'wait') {
      run.waiting += 1;
      continue;
    }
    // ── เช็คซ้ำก่อนยิงทุกครั้ง ──
    const isApplication = row.person_ref.startsWith('app-');
    const skipReason = !isApplication
      ? null
      : !row.app_exists
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
    if (suppressed === null) {
      run.waiting += 1;
      continue;
    }
    const phone = phoneOf(row.payload);
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
    // ── ยิงพร้อมเวลานัดใหม่ (พ้นช่วงห้ามโทรถ้านโยบายมีช่วงห้าม) ──
    const scheduledAt = bangkokIso(decision.scheduledAt);
    try {
      const r = await pushQueueRowsTracked(row.channel, [{ id: row.id, payload: row.payload }], (p) =>
        withScheduledAt(p, scheduledAt),
      );
      run.sent += r.pushed;
      run.failed += r.failed;
      if (r.pushed) logInfo('lumos.pushRetry.ok', { queueId: row.id, channel: row.channel, scheduledAt });
    } catch (e) {
      run.failed += 1;
      logWarn('lumos.pushRetry.failed', { queueId: row.id, reason: errorSummaryText(e, 200) });
    }
  }

  lastRun = run;
  // รอบที่แค่ "รอ" (ยังไม่ถึงเวลานัด/ช่วงห้ามโทร) ไม่ต้องจด — ไม่งั้นคืนละหลายร้อยบรรทัด
  if (run.sent || run.failed || run.skipped || run.gaveUp) logInfo('lumos.pushRetry.run', { ...run });
  return run;
}

function sleepInterruptible(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === 'function') t.unref();
  });
}

/** เริ่มตัวส่งซ้ำ — เรียกครั้งเดียวตอนบูต process API · คืน `false` เมื่อถูกปิดไว้ด้วย env */
export function startLumosPushRetryWorker(): boolean {
  const cfg = getLumosPushRetryConfig();
  if (!cfg.enabled) {
    logInfo('lumos.pushRetry.worker.disabled', {
      hint: 'ลบ LUMOS_PUSH_RETRY_ENABLED หรือตั้งเป็น true เพื่อเปิด',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('lumos.pushRetry.worker.start', {
    intervalMs: cfg.intervalMs,
    limit: cfg.limit,
    giveUpAfterMinutes: cfg.giveUpAfterMinutes,
  });
  void (async () => {
    await sleepInterruptible(cfg.startupDelayMs);
    while (!stopped) {
      const nowCfg = getLumosPushRetryConfig();
      if (!nowCfg.enabled) {
        logWarn('lumos.pushRetry.worker.turnedOff');
        break;
      }
      try {
        await runLumosPushRetryOnce(nowCfg);
      } catch (e) {
        logError('lumos.pushRetry: รอบนี้ล้มทั้งรอบ', e);
      }
      await sleepInterruptible(nowCfg.intervalMs);
    }
    running = false;
  })();
  return true;
}

export function stopLumosPushRetryWorker(): void {
  stopped = true;
}
