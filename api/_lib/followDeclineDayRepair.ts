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

type OrphanRow = { id: string; group_id: string | null; plan: string; future: boolean };

/**
 * แถวที่ค้างเพราะตอบไม่ไปวันก่อน — แยกออกมาให้ตรวจแบบอ่านอย่างเดียวได้
 * ค้างได้ 2 แบบ (ต้องมีคนตอบ declined ในชุดเดียวกัน **วันก่อนหน้า**):
 *   A. คิวทุกแถวของสายนี้ถูกยกเลิก (แบบเดิม)
 *   B. 🔴 คิวขึ้น pending แต่แผนของมันถึง Lumos **ก่อน** คำตอบไม่ไป ⇒ แผนนั้นโดนยกเลิกที่ Lumos ไปแล้ว
 *      (8 ต.ค. 2569 ณัฐพล · อิทธิชัย: รอบซ่อม 7 ต.ค. คืนคิวทุกวันแต่ส่งกลับแค่แผนแรกของชุด
 *       — แผนละวัน ⇒ วันที่เหลือขึ้น "ส่งให้ AI แล้ว" แต่ Lumos ไม่มีแผน ไม่โทร)
 * คืน `plan` = รหัสแผน (แผนละวัน) — ซ่อมทีละแผน ไม่ใช่ทีละชุด
 */
export function declineOrphanSql(): string {
  return `
    select f.id::text as id, f.group_id::text as group_id,
           coalesce(q.plan_ref, q.person_ref) as plan,
           (f.scheduled_at > now() + interval '${MIN_LEAD_MINUTES} minutes') as future
      from ${followTable} f
      join ${queueTable} q
        on q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
      join lateral (
        select max(coalesce(x.last_result_at, x.first_result_at, x.updated_at)) as declined_at
          from ${followTable} g
          join ${queueTable} x on x.channel = 'reminder' and x.job_ref = 'follow' and x.person_ref = 'follow-' || g.id::text
         where g.group_id = f.group_id and x.last_outcome = 'declined'
           and (g.scheduled_at at time zone 'Asia/Bangkok')::date < (f.scheduled_at at time zone 'Asia/Bangkok')::date
      ) d on d.declined_at is not null
     where f.cancelled_at is null and f.completed_at is null
       and coalesce(f.call_mode, 'ai') = 'ai'
       and coalesce(f.follow_team, '') <> 'replacement'
       and f.group_id is not null
       and f.scheduled_at > now() + interval '${MIN_LEAD_MINUTES} minutes'
       and (
         -- A. คิวทุกแถวถูกยกเลิก
         not exists (select 1 from ${queueTable} y
                      where y.channel = 'reminder' and y.job_ref = 'follow' and y.person_ref = 'follow-' || f.id::text
                        and y.status <> 'cancelled')
         -- B. รอโทรอยู่ แต่หัวขบวนของแผนถึง Lumos ก่อนคำตอบไม่ไป (แผนโดนยกเลิกที่ Lumos แล้ว)
         or (q.status = 'pending' and q.result is null and exists (
               select 1 from ${queueTable} l
                where l.channel = 'reminder' and l.job_ref = 'follow'
                  and l.person_ref = coalesce(q.plan_ref, q.person_ref)
                  and l.push_accepted_at < d.declined_at))
       )
     order by f.group_id, f.scheduled_at
     limit 200`;
}

export async function repairDeclinedFollowDays(): Promise<{ resent: number; plans: number; errors: number }> {
  const out = { resent: 0, plans: 0, errors: 0 };
  if (!getLumosPushConfig()) return out;
  const { rows } = await dbQuery<OrphanRow>(declineOrphanSql());
  if (rows.length === 0) return out;

  // ยังไม่ถึงเวลา → คืนคิว + ส่งแผนใหม่ **ทีละแผน** (แผนละวัน — 7 ต.ค. ส่งแค่แผนแรกของชุด วันที่เหลือไม่ถึง Lumos)
  const byPlan = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.future) continue;
    byPlan.set(r.plan, [...(byPlan.get(r.plan) ?? []), r.id]);
  }
  for (const [plan, ids] of byPlan) {
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
        out.plans += 1;
      } else {
        out.errors += 1;
        logError('follow.declineDayRepair: ส่งแผนใหม่ไม่สำเร็จ', new Error(res.reason ?? 'unknown'), { plan, rounds: ids.length });
      }
    } catch (e) {
      out.errors += 1;
      logError('follow.declineDayRepair: แผนนี้ล้ม', e, { plan });
    }
  }
  logInfo('follow.declineDayRepair', out);
  return out;
}
