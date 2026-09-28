/**
 * ═══ ส่งสายใบสมัครเข้า Lumos แบบ "จดผลทุกครั้ง" (เจ้าของเคาะ 28 ก.ย. 2569) ═══
 *
 * 🔴 ทำไมต้องจด: Lumos **ไม่มาดึงคิวเราแล้ว** (วัด 28 ก.ย.: `delivery_count` = 0 ทุกแถว) ⇒ ทางเดียวที่สายไปถึงคือ push
 * ของเดิม push ครั้งเดียวแบบไม่รอผล แล้วแค่ log เมื่อล้ม (คอมเมนต์เดิมบอก "Lumos โทรดึงได้เอง" ซึ่งไม่จริงแล้ว)
 * ⇒ ใบสมัคร OPL6909083 3 ใบค้าง 2–4 วัน · ระบบยังนับว่า "อยู่ในคิว AI" จึงไม่มีใครโทรเลย
 *
 * ตัวนี้จด `push_state` ที่แถวคิวทุกครั้ง (migration 123) ให้ `applicationPushRetryWorker` หยิบแถวที่ล้มไปส่งซ้ำ
 * - ยิง **ทีละแถว** ด้วย `Idempotency-Key = interview-<id คิว>` ตัวเดิมทุกครั้ง + `client_interview_id` เดิมใน payload
 *   ⇒ ครั้งก่อนถึงจริง (แต่เราไม่รู้) Lumos ตัดซ้ำเอง ไม่เกิดสายที่สอง (ยืนยันไว้ที่หัว `lumosPushClient.ts`)
 * - ยังไม่ migrate 123 = ยิงเหมือนเดิมแต่ไม่จด (คิวห้ามหยุดเดินเพราะคอลัมน์เสริม · กติกาข้อ 9)
 * ⚠️ ไม่แตะเวลานัดของ payload ตอนส่งครั้งแรก — พฤติกรรมเดิมเป๊ะ (ตัวส่งซ้ำเป็นคนเลื่อนเวลาเอง)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { errorSummaryText, logError, logInfo, logWarn } from './logger.js';
import { getLumosPushConfig, pushInterviews, type LumosPushInterviewRecord } from './lumosPushClient.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

export type ApplicationPushRow = { id: string; payload: unknown };

/** 42703 = คอลัมน์ยังไม่มี (ยังไม่ migrate 123) */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/** จดสถานะแบบกลืน error — จดไม่ได้ต้องไม่ทำให้การยิงล้ม */
async function mark(sql: string, params: unknown[], what: string): Promise<boolean> {
  try {
    await dbQuery(sql, params);
    return true;
  } catch (e) {
    if (isUndefinedColumn(e)) {
      logWarn('lumos.push.application.track.missing', {
        hint: 'ยังไม่ได้รัน migration 123 — ยิงได้แต่ไม่จดผล (ตัวส่งซ้ำยังไม่ทำงาน)',
      });
    } else {
      logError(`lumos.push.application.track: ${what}`, e);
    }
    return false;
  }
}

export const idempotencyKeyForRow = (id: string) => `interview-${id}`;

/**
 * ยิงทีละแถวและจดผล — คืนจำนวนที่ถึง/ไม่ถึง
 * `patchPayload` = ใช้กับรอบส่งซ้ำ (เลื่อนเวลานัด) · รอบแรกไม่ส่ง = payload เดิมเป๊ะ
 */
export async function pushApplicationRowsTracked(
  rows: readonly ApplicationPushRow[],
  patchPayload?: (payload: Record<string, unknown>) => Record<string, unknown>,
): Promise<{ pushed: number; failed: number }> {
  const out = { pushed: 0, failed: 0 };
  if (rows.length === 0 || !getLumosPushConfig()) return out;
  for (const row of rows) {
    if (!row.payload || typeof row.payload !== 'object') {
      out.failed += 1;
      await mark(
        `update ${queueTable} set push_state = 'push_failed', push_failed_at = coalesce(push_failed_at, now()),
                push_error = $2 where id = $1::bigint`,
        [row.id, 'ไม่มี payload ในคิว — ส่งไม่ได้'],
        'no payload',
      );
      continue;
    }
    const payload = patchPayload
      ? patchPayload({ ...(row.payload as Record<string, unknown>) })
      : (row.payload as Record<string, unknown>);
    await mark(
      `update ${queueTable}
          set push_state = 'push_pending', push_started_at = now(), push_attempts = push_attempts + 1
        where id = $1::bigint`,
      [row.id],
      'started',
    );
    try {
      const res = await pushInterviews([payload as unknown as LumosPushInterviewRecord], idempotencyKeyForRow(row.id));
      // 🔴 ตอบ 202 แต่ไม่รับรายการ (accepted 0 / status failed) = ไม่ถึงเหมือนกัน — ห้ามจดว่าถึง
      if (res && (res.status === 'failed' || (typeof res.accepted === 'number' && res.accepted < 1))) {
        throw new Error(`Lumos ไม่รับรายการ (status ${String(res.status)} · accepted ${String(res.accepted)})`);
      }
      out.pushed += 1;
      await mark(
        `update ${queueTable}
            set push_state = 'pushed', pushed_at = coalesce(pushed_at, now()), push_error = null
          where id = $1::bigint`,
        [row.id],
        'pushed',
      );
    } catch (e) {
      out.failed += 1;
      const reason = errorSummaryText(e, 300);
      await mark(
        `update ${queueTable}
            set push_state = 'push_failed', push_failed_at = coalesce(push_failed_at, now()), push_error = $2
          where id = $1::bigint`,
        [row.id, reason],
        'failed',
      );
      logWarn('lumos.push.application.failed', { queueId: row.id, reason: errorSummaryText(e, 200) });
    }
  }
  return out;
}

/**
 * รอบแรกตอนเข้าคิว — หาแถวคิวของใบที่เพิ่งเข้า (ช่อง interview · ใบขอเดียวกัน) แล้วยิงแบบจดผล
 * ⚠️ ผู้เรียกไม่ต้องรอ (fire-and-forget แบบเดิม) — ล้มทุกกรณีต้องกลืน
 */
export async function pushQueuedApplications(jobId: string, personRefs: readonly string[]): Promise<void> {
  if (personRefs.length === 0 || !getLumosPushConfig()) return;
  try {
    const { rows } = await dbQuery<{ id: string; payload: unknown }>(
      `select id::text as id, payload from ${queueTable}
        where channel = 'interview' and job_ref = $1 and person_ref = any($2::text[])
        order by id`,
      [jobId, [...personRefs]],
    );
    const r = await pushApplicationRowsTracked(rows);
    logInfo('lumos.push.application', { jobId, rows: rows.length, ...r });
  } catch (e) {
    logError('lumos.push.application: ยิงรอบแรกไม่สำเร็จ (ตัวส่งซ้ำจะตามต่อถ้าจดสถานะไว้แล้ว)', e, { jobId });
  }
}
