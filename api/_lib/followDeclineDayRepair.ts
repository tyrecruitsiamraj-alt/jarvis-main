/**
 * ═══ ตอบ AI ว่า "วันนี้ไม่ไป" → หยุดแค่วันนั้น วันถัดไปโทรต่อ (เจ้าของ 7 ต.ค. 2569 เช้า) ═══
 *
 * เจ้าของถาม *"ส่งไปหา lumos ครบไหม"* → วัดจริง: 3 คนตอบวันแรกว่า "ไม่ไป" (ลาป่วย 2 · วันหยุด 1)
 * `cancelFollowSetAfterDecline` ยกเลิกแผนที่ Lumos **ทั้งชุดทุกวัน** แต่แถวติดตามของวันถัดไปยังเปิดอยู่
 * (จอขึ้น "ส่งให้ AI แล้ว") ⇒ 14 สายที่ Lumos ไม่มีวันโทร
 * Choice เจ้าของ: "ส่ง AI โทรต่อตามตาราง" · กติกาใหม่ "หยุดแค่วันนั้น วันถัดไปโทรต่อ"
 * (แทนข้อเคาะ 16 ส.ค. 2569 "บอกยกเลิก = หยุดทั้งชุด")
 *
 * ตัวซ่อม (เดินทุกรอบของตัวส่งซ้ำงานติดตาม · เครื่องที่มีคีย์ push เท่านั้น):
 *   หาแถวติดตาม AI ที่ยังเปิด · คิวทุกแถวถูกยกเลิก · ชุดเดียวกันมีคนตอบ declined **วันก่อนหน้า** แถวนั้น
 *   - ยังไม่ถึงเวลา → คืนคิวเป็น pending แล้วส่งแผนใหม่ให้ Lumos (`resyncFollowPlanWithLumos`)
 *   - เลยเวลาไปแล้ว → **ไม่แตะ** (จอขึ้นเลยเวลานัด คนตัดสินเอง)
 *     🔴 เดิมสลับเป็นคนโทรเอง — เจ้าของ 7 ต.ค. 2569 ปัญหา Lumos ข้อ 3: *"ไม่ต้องการให้เปลี่ยนอัตโนมัติ"*
 *     (ณัฐพล · อิทธิชัย ถูกตัวนี้สลับตอน 08:17)
 *   แถวของ **วันเดียวกับที่ตอบว่าไม่ไป** ไม่แตะ (หยุดวันนั้นตามกติกา)
 * 🔴 แถวที่ซ่อมแล้วมีคิว pending ⇒ ไม่เข้าเงื่อนไขอีก (ไม่วนซ้ำ)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { resyncFollowPlanWithLumos } from './lumosDispatch.js';
import { staffNameOfPhone } from './followStaffName.js';
import { logError, logInfo } from './logger.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');
/** สายที่จะถึงเวลาในอีกไม่กี่นาที ไม่ส่งใหม่ (กันส่งเวลาที่กลายเป็นอดีตระหว่างทาง) */
const MIN_LEAD_MINUTES = 3;

type OrphanRow = { id: string; group_id: string | null; future: boolean };

/** แถวที่ค้างเพราะตอบไม่ไปวันก่อน — แยกออกมาให้ตรวจแบบอ่านอย่างเดียวได้ */
export function declineOrphanSql(): string {
  return `
    select f.id::text as id, f.group_id::text as group_id,
           (f.scheduled_at > now() + interval '${MIN_LEAD_MINUTES} minutes') as future
      from ${followTable} f
     where f.cancelled_at is null and f.completed_at is null
       and coalesce(f.call_mode, 'ai') = 'ai'
       and coalesce(f.follow_team, '') <> 'replacement'
       and f.group_id is not null
       and f.scheduled_at > now() + interval '${MIN_LEAD_MINUTES} minutes'
       and exists (select 1 from ${queueTable} q
                    where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text)
       and not exists (select 1 from ${queueTable} q
                    where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
                      and q.status <> 'cancelled')
       and exists (
         select 1 from ${followTable} g
           join ${queueTable} x on x.channel = 'reminder' and x.job_ref = 'follow' and x.person_ref = 'follow-' || g.id::text
          where g.group_id = f.group_id and x.last_outcome = 'declined'
            and (g.scheduled_at at time zone 'Asia/Bangkok')::date < (f.scheduled_at at time zone 'Asia/Bangkok')::date
       )
     order by f.group_id, f.scheduled_at
     limit 200`;
}

export async function repairDeclinedFollowDays(): Promise<{ resent: number; groups: number; errors: number }> {
  const out = { resent: 0, groups: 0, errors: 0 };
  if (!getLumosPushConfig()) return out;
  const { rows } = await dbQuery<OrphanRow>(declineOrphanSql());
  if (rows.length === 0) return out;


  // ยังไม่ถึงเวลา → คืนคิว + ส่งแผนใหม่ทีละชุด
  const byGroup = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.future || !r.group_id) continue;
    byGroup.set(r.group_id, [...(byGroup.get(r.group_id) ?? []), r.id]);
  }
  for (const [groupId, ids] of byGroup) {
    try {
      await dbQuery(
        `update ${queueTable} set status = 'pending', updated_at = now()
          where channel = 'reminder' and job_ref = 'follow' and status = 'cancelled'
            and person_ref = any($1::text[])`,
        [ids.map((id) => `follow-${id}`)],
      );
      const res = await resyncFollowPlanWithLumos(ids[0], staffNameOfPhone);
      if (res.pushed) {
        out.resent += res.rounds;
        out.groups += 1;
      } else {
        out.errors += 1;
        logError('follow.declineDayRepair: ส่งแผนใหม่ไม่สำเร็จ', new Error(res.reason ?? 'unknown'), { groupId, rounds: ids.length });
      }
    } catch (e) {
      out.errors += 1;
      logError('follow.declineDayRepair: ชุดนี้ล้ม', e, { groupId });
    }
  }
  logInfo('follow.declineDayRepair', out);
  return out;
}
