/**
 * ═══ ย้อนสถานะปิดงาน = คืนสายที่ถูกหยุดตอนปิดด้วย (เจ้าของ 7 ต.ค. 2569 · ปัญหา Lumos ข้อ 4) ═══
 *
 * *"คนโทร เผลอกดสาย 1 จบงานไป แล้วขึ้นงานสำเร็จ สาย 2 ถูกยกเลิก แล้วพอกดล้างสถานะ สาย 2 สถานะไม่ย้อนมาด้วย
 * **ต้องการให้ย้อนสถานะทั้ง 2 สายเลย**"*
 *
 * ปิดงาน (`completeFollow`) หยุดสายที่เหลือของวันนั้น/ทั้งชุด แล้วจด id ไว้ใน audit `follow.complete` → `stoppedIds`
 * ย้อนสถานะ ⇒ อ่าน id ชุดนั้นจาก audit ครั้งล่าสุด แล้วคืนเฉพาะแถวที่ถูกยกเลิก **ในจังหวะเดียวกับการปิด** (ห่างไม่เกิน 2 นาที)
 * — แถวที่คนยกเลิกเองทีหลังไม่แตะ
 *   - คนโทร = เปิดแถวกลับเฉย ๆ
 *   - AI ยังไม่ถึงเวลา = คืนคิวเป็น pending + ส่งแผนให้ Lumos ใหม่ (`resyncFollowPlanWithLumos`)
 *   - AI เลยเวลาแล้ว = เปิดแถวกลับ **ไม่สลับเป็นคนโทรเอง** (ข้อ 3) · ไม่ส่ง Lumos (เวลาที่ผ่านแล้ว = โทรทันที)
 *   สายที่ปิดเองถ้ายังไม่ถึงเวลาและเป็น AI ก็คืนคิวด้วย (ตอนปิดถูกถอนคิวไปพร้อมกัน)
 * 🔴 ไม่มีคีย์ push (เครื่อง dev) = เปิดแถวกลับอย่างเดียว ไม่ยิง Lumos
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { resyncFollowPlanWithLumos } from './lumosDispatch.js';
import { staffNameOfPhone } from './followStaffName.js';
import { logError, logInfo } from './logger.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');
const auditTable = tableInAppSchema('audit_logs');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** id ที่ปิดงานครั้งล่าสุดหยุดไว้ + เวลาที่ปิด — ไม่มี audit = ไม่มีอะไรให้คืน */
export function stoppedIdsOf(newValue: unknown): string[] {
  const v = typeof newValue === 'string' ? safeJson(newValue) : newValue;
  const ids = (v as { stoppedIds?: unknown } | null)?.stoppedIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)) : [];
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export type ReopenRestore = { restored: number; resent: number; error?: string };

export async function restoreRoundsStoppedByClose(followId: string): Promise<ReopenRestore> {
  const out: ReopenRestore = { restored: 0, resent: 0 };
  const { rows: audits } = await dbQuery<{ new_value: unknown; created_at: string | Date }>(
    `select new_value, created_at from ${auditTable}
      where action = 'follow.complete' and entity_type = 'follow_entry' and entity_id = $1
      order by created_at desc limit 1`,
    [followId],
  );
  const audit = audits[0];
  const stopped = audit ? stoppedIdsOf(audit.new_value) : [];

  const restoredRows: Array<{ id: string; ai: boolean; future: boolean }> = [];
  if (audit && stopped.length > 0) {
    const { rows } = await dbQuery<{ id: string; ai: boolean; future: boolean }>(
      `update ${followTable}
          set cancelled_at = null, updated_at = now()
        where id = any($1::uuid[]) and cancelled_at is not null and completed_at is null
          and abs(extract(epoch from (cancelled_at - $2::timestamptz))) < 120
        returning id::text as id, coalesce(call_mode, 'ai') = 'ai' as ai,
                  scheduled_at > now() + interval '3 minutes' as future`,
      [stopped, audit.created_at],
    );
    restoredRows.push(...rows);
    out.restored = rows.length;
  }

  // สายที่ปิดเอง — AI ยังไม่ถึงเวลา = คืนคิวด้วย
  const { rows: selfRows } = await dbQuery<{ id: string; ai: boolean; future: boolean }>(
    `select id::text as id, coalesce(call_mode, 'ai') = 'ai' as ai,
            scheduled_at > now() + interval '3 minutes' as future
       from ${followTable} where id = $1 and cancelled_at is null and completed_at is null`,
    [followId],
  );
  const requeue = [...restoredRows, ...selfRows].filter((r) => r.ai && r.future).map((r) => r.id);
  if (requeue.length === 0) return out;

  // คืนคิวเฉพาะแถวที่ยังไม่เคยโทร (ไม่มีผล) · ล้างธง cancel_resent ของตัวส่งยกเลิกซ้ำ
  await dbQuery(
    `update ${queueTable} set status = 'pending', push_state = null, updated_at = now()
      where channel = 'reminder' and job_ref = 'follow' and status = 'cancelled'
        and first_result_at is null and person_ref = any($1::text[])`,
    [requeue.map((id) => `follow-${id}`)],
  );
  if (!getLumosPushConfig()) return out;
  // แถวที่คืนอาจอยู่คนละแผนที่ Lumos (ปิดงานส่งรอบที่เหลือเป็นแผนใหม่) ⇒ ส่งใหม่ทีละแผน
  const { rows: plans } = await dbQuery<{ id: string }>(
    `select distinct on (coalesce(plan_ref, person_ref)) substring(person_ref from 8) as id
       from ${queueTable}
      where channel = 'reminder' and job_ref = 'follow' and status = 'pending'
        and person_ref = any($1::text[])
      order by coalesce(plan_ref, person_ref), next_attempt_at`,
    [requeue.map((id) => `follow-${id}`)],
  );
  for (const p of plans) {
    try {
      const res = await resyncFollowPlanWithLumos(p.id, staffNameOfPhone);
      if (res.pushed) out.resent += res.rounds;
      else if (res.rounds > 0) out.error = res.reason ?? 'ส่งแผนให้ Lumos ไม่สำเร็จ';
    } catch (e) {
      out.error = 'ส่งแผนให้ Lumos ไม่สำเร็จ';
      logError('follow.reopen.restore: ส่งแผนใหม่ล้ม', e, { followId, planOf: p.id });
    }
  }
  logInfo('follow.reopen.restore', { followId, ...out });
  return out;
}
