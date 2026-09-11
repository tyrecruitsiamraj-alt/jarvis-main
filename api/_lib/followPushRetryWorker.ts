/**
 * ═══ ส่งซ้ำรายการติดตามที่ยังไปไม่ถึง Lumos (เจ้าของสั่ง 11 ก.ย. 2569) ═══
 *
 * > *"ฉันต้องการแค่เพิ่มแล้วต้องไปโผล่ที่ lumos ถ้าผิดที่เราก็แก้ดิ"*
 *
 * วัดจริงวันนั้น: 12 จาก 42 สายเป็น `push_failed` — ต่อไม่ถึง Lumos เป็นช่วงสั้น ๆ
 * (ช่วงเสียหลายสิบวินาที · retry ในคำขอเดียวครอบแค่ 1.2 วินาที จึงไม่ทัน)
 * และ **Lumos ไม่เคยมาดึงเอง** (`first_delivered_at` เป็น null ทุกแถว) ⇒ ปล่อยไว้เฉย ๆ
 * สายนั้นหายถาวร
 *
 * ตัวนี้เดินทุกนาที เก็บแถวที่ค้างแล้วยิงใหม่ ⇒ เน็ตหลุดกลายเป็น **สายช้าไปหน่อย**
 * ไม่ใช่ **สายหาย**
 *
 * 🔴 **ส่งซ้ำไม่ใช่สายใหม่** — `Idempotency-Key = follow-<id>` ตัวเดิม และ payload
 * มี `client_contact_id` เดิม ⇒ ถ้าครั้งแรกถึงจริง (แต่เราไม่รู้) Lumos จะตัดซ้ำให้เอง
 * ไม่เกิดสายที่สองไปหาคนจริง (หัวไฟล์ `lumosPushClient.ts` ยืนยันเรื่องนี้ไว้)
 *
 * 🔴 **เปิดเป็นค่าเริ่มต้น** ต่างจาก worker ตัวอื่นที่ปิดไว้ เพราะตัวนี้ไม่ได้ตัดสินใจ
 * อะไรแทนคน — มันแค่ทำสิ่งที่คนสั่งไว้แล้วให้สำเร็จ (คนกดเพิ่มรายการเอง ตั้งเวลาเอง
 * แถวในคิวมีอยู่แล้ว) · ปิดได้ด้วย `FOLLOW_PUSH_RETRY_ENABLED=false`
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError, logInfo, logWarn, errorSummaryText } from './logger.js';
import { getLumosPushConfig, pushReminders } from './lumosPushClient.js';
import { buildFollowPushRecord } from './lumosDispatch.js';
import type { LumosReminderPayload } from './lumosDispatch.js';
import {
  readFollowPushRetryConfig,
  shouldRetryFollowPush,
  type FollowPushRetryConfig,
} from '../../src/lib/followPushRetryPolicy.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

let running = false;
let stopped = false;

export type FollowPushRetryRun = {
  at: string;
  /** เจอแถวค้างกี่รายการ */
  found: number;
  /** ส่งซ้ำสำเร็จกี่รายการ */
  sent: number;
  /** ส่งซ้ำแล้วยังล้มกี่รายการ */
  failed: number;
  /** เลยเวลานัดจนเลิกส่งกี่รายการ */
  tooLate: number;
};

let lastRun: FollowPushRetryRun | null = null;

/** ผลรอบล่าสุด — `null` = ยังไม่เคยเดิน (อยู่ในหน่วยความจำ รีสตาร์ตแล้วหาย) */
export function getLastFollowPushRetryRun(): FollowPushRetryRun | null {
  return lastRun;
}

export function getFollowPushRetryConfig(): FollowPushRetryConfig {
  return readFollowPushRetryConfig(process.env);
}

type StuckRow = {
  id: string;
  scheduled_at: string | Date | null;
  payload: LumosReminderPayload | null;
};

/**
 * แถวที่ **ค้างอยู่จริง** — เงื่อนไขครบทุกข้อ ไม่ใช่แค่ธง `push_failed`
 *
 * ⚠️ `q.status = 'pending'` สำคัญที่สุด — ถ้าเป็น `delivered`/`completed` แปลว่า
 * Lumos ได้ไปแล้ว (หรือโทรจบแล้ว) การส่งซ้ำตอนนั้นคือความเสี่ยงเปล่า ๆ
 *
 * 🔴 **เอาเฉพาะแถวหัวขบวนของแผน** (`step_position = 0`) — หลายรอบของคนเดียวกัน
 * ถูกยิงเป็น **แผนเดียว** ที่ถือ payload ไว้ที่แถวนั้น · ส่งซ้ำแถวที่เหลือด้วยเมื่อไหร่
 * จะกลายเป็นหลายแผนที่เบอร์เดียวกัน = กลับไปทับกันเหมือนปัญหาเดิมที่เพิ่งแก้
 * (`null` = แถวเดี่ยวแบบเดิม ยังต้องส่งซ้ำตามปกติ)
 */
async function findStuck(limit: number): Promise<StuckRow[]> {
  const { rows } = await dbQuery<StuckRow>(
    `select f.id, f.scheduled_at, q.payload
       from ${followTable} f
       join ${queueTable} q
         on q.channel = 'reminder' and q.job_ref = 'follow'
        and q.person_ref = 'follow-' || f.id::text
      where f.dispatch_state = 'push_failed'
        and f.cancelled_at is null
        and f.completed_at is null
        and q.status = 'pending'
        and q.result is null
        -- ส่งซ้ำเฉพาะแถวหัวขบวนของแผน (step 0) หรือแถวเดี่ยวแบบเดิม (null)
        -- ส่งซ้ำแถวที่เหลือด้วย = กลายเป็นหลายแผนที่เบอร์เดียวกัน กลับไปทับกันเหมือนเดิม
        and coalesce(q.step_position, 0) = 0
      order by f.scheduled_at asc nulls last
      limit $1`,
    [limit],
  );
  return rows;
}

/**
 * ส่งแผนสำเร็จ ⇒ ล้างธงให้ **ทุกรอบในแผนเดียวกัน** ไม่ใช่แค่แถวหัวขบวน
 * (แถวที่เหลือไม่เคยถูก push เอง แต่มันอยู่ในแผนที่เพิ่งส่งไปแล้ว)
 */
async function markSent(id: string): Promise<void> {
  try {
    await dbQuery(
      `update ${followTable}
          set dispatch_state = 'queued', dispatch_error = null
        where dispatch_state = 'push_failed'
          and id in (
            select f2.id from ${followTable} f2
              join ${queueTable} q2
                on q2.channel = 'reminder' and q2.job_ref = 'follow'
               and q2.person_ref = 'follow-' || f2.id::text
             where q2.plan_ref = (
                     select q3.plan_ref from ${queueTable} q3
                      where q3.channel = 'reminder' and q3.job_ref = 'follow'
                        and q3.person_ref = 'follow-' || $1::text
                   )
               and q2.plan_ref is not null
          )`,
      [id],
    );
    // แถวเดี่ยว (ไม่มี plan_ref) — คำสั่งข้างบนไม่โดน ต้องล้างตรง ๆ อีกที
    await dbQuery(
      `update ${followTable}
          set dispatch_state = 'queued', dispatch_error = null
        where id = $1 and dispatch_state = 'push_failed'`,
      [id],
    );
  } catch (e) {
    // ฐานยังไม่ migrate 116 — อย่างน้อยต้องล้างธงให้ได้ ไม่งั้นจะส่งซ้ำวนไม่จบ
    try {
      await dbQuery(
        `update ${followTable} set dispatch_state = 'queued'
          where id = $1 and dispatch_state = 'push_failed'`,
        [id],
      );
    } catch (e2) {
      logError('follow.pushRetry: ล้างธงไม่สำเร็จ', e2, { followId: id });
    }
  }
}

async function markStillFailing(id: string, reason: string): Promise<void> {
  try {
    await dbQuery(
      `update ${followTable} set dispatch_error = $2
        where id = $1 and dispatch_state = 'push_failed'`,
      [id, reason],
    );
  } catch {
    /* จดเหตุไม่ได้ก็ไม่เป็นไร — ธง push_failed ยังอยู่ รอบหน้าลองใหม่ */
  }
}

/**
 * เดินหนึ่งรอบ — export ไว้ให้เทสต์และปุ่ม "ลองส่งใหม่ตอนนี้" (ถ้าทำ) เรียกได้
 */
export async function runFollowPushRetryOnce(
  cfg: FollowPushRetryConfig = getFollowPushRetryConfig(),
  now: Date = new Date(),
): Promise<FollowPushRetryRun> {
  const run: FollowPushRetryRun = {
    at: now.toISOString(),
    found: 0,
    sent: 0,
    failed: 0,
    tooLate: 0,
  };

  // ไม่ได้ตั้งค่า push = ระบบนี้ไม่ได้ใช้โหมด push — ไม่มีอะไรให้ส่งซ้ำ
  if (!getLumosPushConfig()) {
    lastRun = run;
    return run;
  }

  let rows: StuckRow[];
  try {
    rows = await findStuck(cfg.limit);
  } catch (e) {
    logError('follow.pushRetry: อ่านแถวค้างไม่สำเร็จ', e);
    lastRun = run;
    return run;
  }
  run.found = rows.length;

  for (const row of rows) {
    if (stopped) break;
    const scheduledAt =
      row.scheduled_at instanceof Date
        ? row.scheduled_at.toISOString()
        : row.scheduled_at
          ? String(row.scheduled_at)
          : null;

    if (!shouldRetryFollowPush({ id: row.id, scheduledAt }, cfg, now)) {
      run.tooLate += 1;
      continue;
    }
    if (!row.payload) {
      // ไม่มี payload ให้ส่ง — ส่งซ้ำไม่ได้ ปล่อยธงไว้ให้คนเห็น
      run.failed += 1;
      await markStillFailing(row.id, 'ไม่มี payload ในคิว — ส่งซ้ำอัตโนมัติไม่ได้');
      continue;
    }

    try {
      await pushReminders(buildFollowPushRecord(row.payload, now), `follow-${row.id}`);
      await markSent(row.id);
      run.sent += 1;
      logInfo('follow.pushRetry.ok', { followId: row.id });
    } catch (e) {
      run.failed += 1;
      await markStillFailing(row.id, errorSummaryText(e, 300));
      logWarn('follow.pushRetry.failed', {
        followId: row.id,
        reason: errorSummaryText(e, 200),
      });
    }
  }

  lastRun = run;
  if (run.found > 0) logInfo('follow.pushRetry.run', { ...run });
  return run;
}

function sleepInterruptible(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    // ปิด process ได้โดยไม่ต้องรอรอบถัดไป
    if (typeof t.unref === 'function') t.unref();
  });
}

/**
 * เริ่มตัวส่งซ้ำ — เรียกครั้งเดียวตอนบูต process API
 * คืน `false` เมื่อถูกปิดไว้ด้วย env
 */
export function startFollowPushRetryWorker(): boolean {
  const cfg = getFollowPushRetryConfig();
  if (!cfg.enabled) {
    logInfo('follow.pushRetry.worker.disabled', {
      hint: 'ลบ FOLLOW_PUSH_RETRY_ENABLED หรือตั้งเป็น true เพื่อเปิด',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('follow.pushRetry.worker.start', {
    intervalMs: cfg.intervalMs,
    limit: cfg.limit,
    maxLateMinutes: cfg.maxLateMinutes,
  });

  void (async () => {
    await sleepInterruptible(cfg.startupDelayMs);
    while (!stopped) {
      // อ่านค่าตั้งใหม่ทุกรอบ — ปิดสวิตช์แล้วมีผลรอบถัดไปโดยไม่ต้องรีสตาร์ต
      const nowCfg = getFollowPushRetryConfig();
      if (!nowCfg.enabled) {
        logWarn('follow.pushRetry.worker.turnedOff');
        break;
      }
      try {
        await runFollowPushRetryOnce(nowCfg);
      } catch (e) {
        logError('follow.pushRetry: รอบนี้ล้มทั้งรอบ', e);
      }
      await sleepInterruptible(nowCfg.intervalMs);
    }
    running = false;
  })();

  return true;
}

/** หยุดตัวส่งซ้ำ (ใช้ตอนปิด process / ในเทสต์) */
export function stopFollowPushRetryWorker(): void {
  stopped = true;
}
