/**
 * ═══ ล้างแผนติดตามที่เคยส่งซ้ำด้วยรหัสเดิม (เจ้าของ 22 ต.ค. 2569 Choice "ล้างทีเดียว") ═══
 *
 * > *"ฉันยกเลิกก็ตายพอดีดิ ถ้ายังเกิดเคสแบบนี้ ไม่ต้องทำอย่างอื่นแล้วมั้ง"*
 * ก่อน 21 ต.ค. 09:02 แก้ตารางแล้วส่งแผนซ้ำด้วย `client_contact_id` เดิม (event id ฝั่ง Lumos = `<id>:v<n>`)
 * ⇒ DELETE ทีหลังไม่ได้ผล (โทรหลังยกเลิก 51/61) · ตั้งแต่ 21 ต.ค. ส่งซ้ำด้วย `-g<เวลา>` แล้ว (`followGenerationClientId`)
 *
 * ขั้นตอน: ① ทีม Lumos ยกเลิกทุกแผนรหัสเดิมให้ (`docs/lumos/lumos-cancel-oldid-2569-10-22.md`)
 *          ② แอดมินกดปุ่มที่ ตั้งค่า › เชื่อมระบบภายนอก → ตัวนี้ส่งแผนที่ยังต้องโทรกลับไปด้วยรหัสใหม่ เวลาเดิม
 * 🔴 ก่อนส่งใหม่ ทำเครื่องหมาย "จบแล้ว" (`lumos_plan_closed_at`) ที่หัวขบวนเดิม ⇒ `cancelFollowPlanAtLumos` ข้าม ไม่ยิง DELETE
 *    แผนที่ Lumos ยกเลิกไปแล้ว (DELETE แผนที่จบแล้ว = แผนอื่นของเบอร์เดียวกันหาย · 9 ต.ค. 2569)
 * 🔴 กดก่อน Lumos ยกเลิก = คนโดนโทร 2 สาย — ปุ่มบนจอต้องยืนยันก่อนเสมอ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { replanFollowSetWithLumos } from './lumosDispatch.js';
import { logInfo, logWarn } from './logger.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const followTable = tableInAppSchema('follow_entries');

export type OldIdPlan = { planRef: string; memberIds: string[] };

/** แผนรหัสเดิม (หัวขบวน event `:v` · ยังไม่มีรหัส `-g`) ที่ยังมีสาย AI รอโทรในอนาคต */
export async function listOldIdFollowPlans(): Promise<OldIdPlan[]> {
  const { rows } = await dbQuery<{ plan_ref: string; member_ids: string[] }>(
    `select l.person_ref as plan_ref, array_agg(f.id::text order by f.scheduled_at) as member_ids
       from ${queueTable} l
       join ${queueTable} q
         on q.channel = 'reminder' and q.job_ref = 'follow'
        and coalesce(q.plan_ref, q.person_ref) = l.person_ref and q.status = 'pending'
       join ${followTable} f on 'follow-' || f.id::text = q.person_ref
      where l.channel = 'reminder' and l.job_ref = 'follow' and l.step_position = 0
        and l.lumos_client_id is null and l.push_event_id like '%:v%'
        and f.cancelled_at is null and f.completed_at is null
        and coalesce(f.call_mode, 'ai') = 'ai' and f.scheduled_at > now()
      group by l.person_ref
      order by min(f.scheduled_at)`,
  );
  return rows.map((r) => ({ planRef: r.plan_ref, memberIds: r.member_ids }));
}

export type OldIdRepushResult = { plans: number; calls: number; pushed: number; failed: Array<{ planRef: string; reason: string }> };

export async function repushOldIdFollowPlans(resolveStaffName: (phone: string | null) => Promise<string | null>): Promise<OldIdRepushResult> {
  const plans = await listOldIdFollowPlans();
  const out: OldIdRepushResult = { plans: plans.length, calls: 0, pushed: 0, failed: [] };
  for (const p of plans) {
    out.calls += p.memberIds.length;
    try {
      // Lumos ยกเลิกแผนนี้ให้แล้ว ⇒ จบแล้ว ห้ามยิง DELETE ซ้ำ
      await dbQuery(
        `update ${queueTable} set lumos_plan_closed_at = coalesce(lumos_plan_closed_at, now())
          where channel = 'reminder' and job_ref = 'follow' and person_ref = $1`,
        [p.planRef],
      );
      const r = await replanFollowSetWithLumos({ memberIds: p.memberIds, cancelledIds: [], resolveStaffName });
      if (r.plans > 0 && r.pushedPlans === r.plans) out.pushed += 1;
      else out.failed.push({ planRef: p.planRef, reason: r.reason ?? 'ส่งแผนใหม่ไม่ครบ' });
    } catch (e) {
      logWarn('follow.oldIdRepush.failed', { planRef: p.planRef, reason: e instanceof Error ? e.message : String(e) });
      out.failed.push({ planRef: p.planRef, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  logInfo('follow.oldIdRepush', { plans: out.plans, calls: out.calls, pushed: out.pushed, failed: out.failed.length });
  return out;
}
