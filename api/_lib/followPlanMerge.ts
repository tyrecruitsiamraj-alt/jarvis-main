/**
 * ═══ ตัวตรวจ "1 เบอร์ 1 วัน = 1 แผน" (เจ้าของ 9 ต.ค. 2569 "ถ้ามันผิดที่เราก็ต้องแก้ที่เรา ไม่แก้ชุ่ยๆ") ═══
 *
 * ทางส่งแผนทุกทางรวมแผนเองแล้ว (`groupFollowPlans` · `followPhoneDayMates` ใน lumosDispatch)
 * ตัวนี้เป็นชั้นสุดท้าย: เดินทุกรอบของตัวส่งซ้ำงานติดตาม หาเบอร์ที่ยังมีสาย AI รอโทร **มากกว่า 1 แผนในวันเดียว**
 * (ของค้างก่อนแก้ · ทางใหม่ที่ลืมรวม) แล้วรวมเป็นแผนเดียวด้วย `replanFollowSetWithLumos` — **สายยังเป็น AI ทุกสาย** ไม่ย้ายให้คน
 *
 * เคสจริง 9 ต.ค. 2569: เบอร์เดียว 2 แผน (07:00 · 07:45) ⇒ ผลกลับแค่แผนเดียว 7 ใน 10 เบอร์
 * 🔴 ไม่แตะสายที่อีกไม่ถึง 3 นาทีจะถึงเวลา (ยกเลิก/ส่งใหม่ตอนนั้น = เสี่ยงหลุดสาย)
 * 🔴 ไม่แตะกลุ่มที่เพิ่งมีคนแก้ภายใน 1 นาที (กันชนกับการแก้ที่กำลังส่งอยู่)
 * 🔴 รวมได้ไม่เกิน `MAX_MERGE_PER_RUN` กลุ่มต่อรอบ — ถ้า Lumos ล่ม ไม่ยิงถล่ม
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { replanFollowSetWithLumos } from './lumosDispatch.js';
import { staffNameOfPhone } from './followStaffName.js';
import { logError, logInfo, logWarn } from './logger.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

export const MERGE_MIN_LEAD_MINUTES = 3;
export const MAX_MERGE_PER_RUN = 10;

/** กลุ่ม เบอร์+วัน ที่มีสาย AI รอโทรมากกว่า 1 แผน — คืน id ของทุกสายในกลุ่ม */
export function splitPlansSql(): string {
  return `
    select array_agg(f.id::text order by f.scheduled_at) as ids
      from ${followTable} f
      join ${queueTable} q
        on q.channel = 'reminder' and q.job_ref = 'follow'
       and q.person_ref = 'follow-' || f.id::text and q.status = 'pending'
     where f.cancelled_at is null and f.completed_at is null
       and coalesce(f.call_mode, 'ai') = 'ai'
       and f.scheduled_at > now() + interval '${MERGE_MIN_LEAD_MINUTES} minutes'
     group by f.recipient_phone, (f.scheduled_at at time zone 'Asia/Bangkok')::date
    having count(distinct coalesce(q.plan_ref, q.person_ref)) > 1
       and max(q.updated_at) < now() - interval '1 minute'
     order by min(f.scheduled_at)
     limit ${MAX_MERGE_PER_RUN}`;
}

export async function mergeSplitFollowPlans(): Promise<{ groups: number; merged: number; errors: number }> {
  const out = { groups: 0, merged: 0, errors: 0 };
  if (!getLumosPushConfig()) return out;
  const { rows } = await dbQuery<{ ids: string[] }>(splitPlansSql());
  out.groups = rows.length;
  for (const r of rows) {
    try {
      const res = await replanFollowSetWithLumos({ memberIds: r.ids, cancelledIds: [], resolveStaffName: staffNameOfPhone });
      if (res.plans > 0 && res.pushedPlans === res.plans) out.merged += 1;
      else {
        out.errors += 1;
        logWarn('follow.planMerge: รวมแผนไม่ครบ', { ids: r.ids, reason: res.reason });
      }
    } catch (e) {
      out.errors += 1;
      logError('follow.planMerge: กลุ่มนี้ล้ม', e, { ids: r.ids });
    }
  }
  if (out.groups > 0) logInfo('follow.planMerge', out);
  return out;
}
