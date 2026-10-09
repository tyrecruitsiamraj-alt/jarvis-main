/**
 * ═══ ตอบ AI ว่า "ขอให้โทรกลับ" → สร้างสายโทรกลับ (AI) ให้คนเดิมเอง (เจ้าของ 9 ต.ค. 2569 "ตั้งสายโทรกลับเองเลย") ═══
 *
 * เดินในเส้นรับผล (`POST /api/lumos/reminder/results`) หลังจับคู่ผลได้ — ผล `reschedule_requested` ของงานติดตาม
 * ⇒ สร้างแถวติดตามใหม่ (ชุดเดิม · ทีมเดิม · หัวข้อ/หมายเหตุเดิม · AI โทร) ตามเวลาที่ขอ แล้วส่งเข้าคิว
 *   (`enqueueFollowReminder` — รวมแผนกับสายอื่นของเบอร์เดียวกันวันเดียวกันให้เอง · 1 เบอร์ 1 วัน = 1 แผน)
 * เวลา/เพดาน = `src/lib/followCallback.ts` (pure)
 * 🔴 กันสร้างซ้ำด้วย `source_ref` (unique) — Lumos ยิงผลเดิมซ้ำได้
 * 🔴 ห้ามทำให้การรับผลล้ม — ผู้เรียกกลืน error (ผลถูกจดไปแล้ว)
 * 🔴 สายที่ยกเลิก/ปิดงาน/คนลงผลเองไปแล้ว = ไม่โทรกลับ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { enqueueFollowReminder } from './lumosDispatch.js';
import { staffNameOfPhone } from './followStaffName.js';
import { getCallFollowupPolicy } from './callFollowupPolicyStore.js';
import { pickRequestedCallbackAt } from './callFollowup.js';
import { isAutoDispatchEnabled } from './lumosDispatchMode.js';
import { logInfo } from './logger.js';
import { nextCallbackRef, resolveCallbackAt } from '../../src/lib/followCallback.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

type SourceRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
  staff_phone: string | null;
  unit_name: string | null;
  source_ref: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  staff_call_outcome: string | null;
};

export type FollowCallbackResult = { created: string | null; at?: string; reason: string };

export async function scheduleFollowCallbackFromResult(
  item: Record<string, unknown>,
  now: Date = new Date(),
): Promise<FollowCallbackResult> {
  const ref = typeof item.client_contact_id === 'string' ? item.client_contact_id.trim() : '';
  if (item.outcome !== 'reschedule_requested' || !ref.startsWith('follow-')) return { created: null, reason: 'ไม่ใช่ขอโทรกลับของงานติดตาม' };
  const step = Number.isInteger(item.step_position) ? Number(item.step_position) : 0;

  // ผลของสายไหน — แผนเดียวหลายสาย: จับด้วยรหัสแผน + ลำดับ step (ตัวเดียวกับ applyLumosResult)
  const { rows: qrows } = await dbQuery<{ person_ref: string }>(
    `select person_ref from ${queueTable}
      where channel = 'reminder' and job_ref = 'follow'
        and coalesce(plan_ref, person_ref) = $1 and coalesce(step_position, 0) = $2
      limit 1`,
    [ref, step],
  );
  const personRef = qrows[0]?.person_ref ?? ref;
  const sourceId = personRef.slice('follow-'.length);

  const { rows } = await dbQuery<SourceRow>(
    `select id::text as id, recipient_name, recipient_phone, topic, note, staff_phone, unit_name, source_ref,
            cancelled_at, completed_at, staff_call_outcome
       from ${followTable} where id::text = $1 limit 1`,
    [sourceId],
  );
  const src = rows[0];
  if (!src) return { created: null, reason: 'ไม่พบสายต้นทาง' };
  if (src.cancelled_at || src.completed_at || src.staff_call_outcome) {
    return { created: null, reason: 'สายนี้ยกเลิก/ปิดงาน/ลงผลเองแล้ว — ไม่โทรกลับ' };
  }
  const next = nextCallbackRef(src);
  if (!next) return { created: null, reason: 'ขอให้โทรกลับครบเพดานแล้ว — จบที่ผลขอเลื่อน' };

  const policy = await getCallFollowupPolicy();
  const nextAction = (typeof item.next_action === 'object' && item.next_action !== null ? item.next_action : {}) as Record<string, unknown>;
  const { at, source } = resolveCallbackAt({
    explicit: pickRequestedCallbackAt(item),
    dueAt: typeof nextAction.due_at === 'string' ? nextAction.due_at : null,
    text: typeof item.summary === 'string' ? item.summary : null,
    now,
    defaultHours: policy.rescheduleDefaultHours,
  });

  const { rows: created } = await dbQuery<{ id: string; call_round: number | null }>(
    `insert into ${followTable}
       (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at, group_id, unit_name, site_code,
        call_round, call_mode, created_by_name, follow_team, source_ref, replace_type, plan_day_start, plan_day_no)
     select recipient_name, recipient_phone, topic, note, staff_phone, $2::timestamptz, group_id, unit_name, site_code,
            call_round, 'ai', 'AI · ขอให้โทรกลับ', follow_team, $3, replace_type, plan_day_start, plan_day_no
       from ${followTable} where id::text = $1
     on conflict (source_ref) where source_ref is not null do nothing
     returning id::text as id, call_round`,
    [src.id, at.toISOString(), next.ref],
  );
  const row = created[0];
  if (!row) return { created: null, reason: 'ตั้งสายโทรกลับไว้แล้ว (ผลซ้ำ)' };

  let state = 'off';
  if (await isAutoDispatchEnabled('follow_entry')) {
    state = await enqueueFollowReminder({
      id: row.id,
      recipient_name: src.recipient_name,
      recipient_phone: src.recipient_phone,
      topic: src.topic,
      note: src.note,
      staffPhone: src.staff_phone,
      staffName: await staffNameOfPhone(src.staff_phone),
      unitName: src.unit_name,
      scheduled_at: at,
      callTimes: null,
      callRound: row.call_round,
    });
  }
  await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1::uuid`, [row.id, state]);
  logInfo('follow.callback.created', { sourceId: src.id, callbackId: row.id, at: at.toISOString(), timeFrom: source, depth: next.depth, state });
  return { created: row.id, at: at.toISOString(), reason: `ตั้งสายโทรกลับ (${source})` };
}
