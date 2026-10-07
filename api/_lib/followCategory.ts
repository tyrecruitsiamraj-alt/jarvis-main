/**
 * ═══ หมวดของสายติดตาม ฝั่งเซิร์ฟเวอร์ — ตัวเดียวที่ Dashboard และหน้าหลักใช้ (6 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"หน้าหลัก ก็คือยอดที่มาจากตัวเลขพวกนี้เพราะงั้นอย่าเพี้ยน อย่าเอ๋อ"*
 * ⇒ หมวด (ตอบว่าไป / ตอบว่าไม่ไป / ไม่รับสาย / สรุปไม่ได้ / รอโทร / ยกเลิก) + สายที่ คิดด้วยฟังก์ชันกลาง
 *   ตัวเดียวกับหน้าติดตาม (`callCategory` · `followRoundSlot` · ผลที่คนกดของวันนั้น `staffDayVerdicts`)
 *
 * ช่องของคิวที่ต้อง select มาด้วย = `FOLLOW_QUEUE_CALL_COLS` (ชุดเดียวกับรายการของหน้าติดตาม `listFollow`)
 * 🔴 คำพูด/สรุปของสายใช้จัดหมวดในนี้เท่านั้น ห้ามส่งออกไปหน้าเว็บ
 */
import type { FollowEntry } from '../../src/lib/followApi.js';
import { withFollowDayCalls } from '../../src/lib/followDayCall.js';
import { followGroupKey } from '../../src/lib/followGrouping.js';
import { followCallerOf } from '../../src/lib/followListFilter.js';
import {
  callCategory,
  dayVerdictOf,
  followRoundState,
  staffDayVerdicts,
  type FollowCallCategory,
  type FollowPlanningRound,
} from '../../src/lib/followPlanning.js';
import { followRoundSlot } from '../../src/lib/followRoundBuckets.js';

/** ช่องของคิว Lumos ที่การจัดหมวดต้องใช้ — ต่อ `left join <queue> q on <FOLLOW_QUEUE_MATCH>` */
export const FOLLOW_QUEUE_CALL_COLS = `q.status as call_status,
            coalesce(q.last_outcome, q.result->>'outcome') as call_outcome,
            q.attempt_count as attempt,
            q.result->>'summary' as call_summary,
            (select string_agg(x.t->>'text', ' · ' order by x.ord)
               from jsonb_array_elements(
                      case when jsonb_typeof(q.result->'transcript') = 'array' then q.result->'transcript' else '[]'::jsonb end
                    ) with ordinality as x(t, ord)
              where x.t->>'role' = 'candidate' and coalesce(btrim(x.t->>'text'), '') <> '') as call_reply`;

/** ช่องของแถว follow_entries ที่การจัดหมวดต้องใช้ */
export const FOLLOW_ENTRY_CATEGORY_COLS = `f.id::text as id, f.scheduled_at, f.completed_at, f.cancelled_at, f.outcome_code,
            f.call_round, f.staff_call_outcome, f.staff_called_at, f.topic, f.group_id::text as group_id,
            f.recipient_name, f.recipient_phone, f.source_ref, f.note`;

const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

/** แถวดิบจาก SQL → รูปที่ฟังก์ชันกลางของหน้าติดตามอ่าน (ยกเลิกการติดตาม = ยกเลิกในคิวด้วย ตัวเดียวกับ `listFollow`) */
function toEntry(r: Record<string, unknown>): FollowEntry {
  return {
    id: String(r.id),
    recipient_name: clean(r.recipient_name) ?? '',
    recipient_phone: clean(r.recipient_phone) ?? '',
    topic: clean(r.topic) ?? '',
    group_id: clean(r.group_id),
    source_ref: clean(r.source_ref),
    // หมายเหตุของสายส่งคนแทน = วันเข้างาน (`replaceWorkYmd`) — ผลที่คนกดของวันต้องอยู่วันเดียวกับจอ
    note: clean(r.note),
    scheduled_at: iso(r.scheduled_at),
    completed_at: iso(r.completed_at),
    outcome_code: clean(r.outcome_code),
    cancelled: r.cancelled_at != null,
    call_status: r.cancelled_at != null ? 'cancelled' : clean(r.call_status),
    call_outcome: clean(r.call_outcome),
    call_summary: clean(r.call_summary),
    call_reply: clean(r.call_reply),
    call_round: r.call_round == null ? null : Number(r.call_round),
    call_attempt: r.attempt == null ? null : Number(r.attempt),
    staff_call_outcome: clean(r.staff_call_outcome),
    staff_called_at: iso(r.staff_called_at),
    call_mode: r.call_mode === 'manual' ? 'manual' : 'ai',
  } as unknown as FollowEntry;
}

/** หมวด + สายที่ ของทุกแถว (คีย์ = id) — ส่งแถวของวันเดียวกันมาครบ ไม่งั้นลำดับสายในวัน/ผลที่คนกดของวันเพี้ยน */
export function categorizeFollowRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  now: Date = new Date(),
): Map<string, { category: FollowCallCategory; slot: 1 | 2 | 3; caller: 'ai' | 'manual' }> {
  const entries = withFollowDayCalls(rows.map(toEntry));
  const verdicts = staffDayVerdicts(entries, followGroupKey);
  return new Map(
    entries.map((e) => {
      const round = {
        entry: e,
        state: followRoundState(e, now),
        time: null,
        ymd: null,
        dayVerdict: dayVerdictOf(verdicts, followGroupKey(e), e),
      } as FollowPlanningRound;
      return [e.id, { category: callCategory(round), slot: followRoundSlot(e) ?? 1, caller: followCallerOf(e) }] as const;
    }),
  );
}
