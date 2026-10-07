/**
 * ═══ ยกเลิก 3 แบบ: สายนี้ · วันนี้ · เลิกตามคนนี้ (เจ้าของ 7 ต.ค. 2569 Journey ข้อ 2) ═══
 *
 * *"กรณียกเลิกก็ต้องบอกว่า ยกเลิกแค่สายนี้สายเดียว ยกเลิกวันนั้น หรือ ยกเลิกการติดตามคนนี้เลย"*
 * สายเดียว = `cancelFollow` เดิม · ไฟล์นี้ทำ `day` กับ `person`
 *
 * "คนนี้" = เบอร์เดียวกัน (9 หลักท้าย) + ทีมเดียวกัน (รายชื่อติดตาม / ส่งคนแทน) — ไม่ใช่ `group_id`
 * เพราะสายที่ลงคนละรอบไม่มีชุดเดียวกัน (ตรวจ Journey 7 ต.ค.: ยกเลิกทั้งชุดแล้วหลุด)
 * ยกเลิกเฉพาะสายที่ยังไม่มีผล (ยังไม่ปิด · AI ยังไม่ได้ผล · คนยังไม่ลงผล) — สายที่โทรแล้วเป็นประวัติ
 * ฝั่ง Lumos: ทีละแผน — แผนที่ไม่เหลือสายรอโทร = ยกเลิกแผน · ยังเหลือ = ส่งแผนใหม่จากสายที่เหลือ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { cancelPushedReminderIgnoringMissing, resyncFollowPlanWithLumos } from './lumosDispatch.js';
import { staffNameOfPhone } from './followStaffName.js';
import { logError } from './logger.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

export type FollowCancelScope = 'day' | 'person';

export function parseCancelScope(raw: unknown): FollowCancelScope | null {
  return raw === 'day' || raw === 'person' ? raw : null;
}

/** แถวที่จะยกเลิก — `$1` id แถวที่กด · `$2` = 'day' | 'person' */
export function cancelScopeTargetsSql(): string {
  return `
    with a as (select * from ${followTable} where id = $1::uuid)
    select f.id::text as id
      from ${followTable} f, a
     where f.cancelled_at is null and f.completed_at is null
       and right(regexp_replace(coalesce(f.recipient_phone, ''), '\\D', '', 'g'), 9)
         = right(regexp_replace(coalesce(a.recipient_phone, ''), '\\D', '', 'g'), 9)
       and coalesce(f.follow_team, '') = coalesce(a.follow_team, '')
       and f.staff_called_at is null
       and not exists (select 1 from ${queueTable} q
                        where q.channel = 'reminder' and q.job_ref = 'follow'
                          and q.person_ref = 'follow-' || f.id::text and q.first_result_at is not null)
       and ($2::text = 'person'
         or (f.scheduled_at at time zone 'Asia/Bangkok')::date = (a.scheduled_at at time zone 'Asia/Bangkok')::date)`;
}

export async function cancelFollowScope(
  anchorId: string,
  scope: FollowCancelScope,
  actor: { sub: string; email: string | null },
): Promise<{ ids: string[]; lumosFailed: number }> {
  const { rows: targets } = await dbQuery<{ id: string }>(cancelScopeTargetsSql(), [anchorId, scope]);
  const ids = targets.map((t) => t.id);
  if (ids.length === 0) return { ids, lumosFailed: 0 };

  const refs = ids.map((id) => `follow-${id}`);
  // แผนที่โดนกระทบ — อ่านก่อนเปลี่ยนสถานะคิว
  const { rows: plans } = await dbQuery<{ plan: string }>(
    `select distinct coalesce(plan_ref, person_ref) as plan from ${queueTable}
      where channel = 'reminder' and job_ref = 'follow' and status = 'pending' and person_ref = any($1::text[])`,
    [refs],
  );
  await dbQuery(
    `update ${followTable} set cancelled_at = now(), updated_at = now(), updated_by = $2, updated_by_name = $3
      where id = any($1::uuid[]) and cancelled_at is null`,
    [ids, actor.sub, actor.email],
  );
  await dbQuery(
    `update ${queueTable} set status = 'cancelled', updated_at = now()
      where channel = 'reminder' and job_ref = 'follow' and status = 'pending' and person_ref = any($1::text[])`,
    [refs],
  );

  let lumosFailed = 0;
  if (!getLumosPushConfig()) return { ids, lumosFailed };
  for (const { plan } of plans) {
    try {
      const { rows: left } = await dbQuery<{ id: string }>(
        `select substring(person_ref from 8) as id from ${queueTable}
          where channel = 'reminder' and job_ref = 'follow' and status = 'pending'
            and coalesce(plan_ref, person_ref) = $1
          order by next_attempt_at limit 1`,
        [plan],
      );
      if (left[0]) {
        const r = await resyncFollowPlanWithLumos(left[0].id, staffNameOfPhone);
        if (!r.pushed && r.rounds > 0) lumosFailed += 1;
      } else {
        await cancelPushedReminderIgnoringMissing(plan);
      }
    } catch (e) {
      lumosFailed += 1;
      logError('follow.cancelScope: แจ้ง Lumos ไม่สำเร็จ', e, { plan, scope });
    }
  }
  return { ids, lumosFailed };
}
