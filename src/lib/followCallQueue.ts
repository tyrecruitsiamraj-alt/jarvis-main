/**
 * ═══ "ต้องโทรวันนี้" — สายของวันเรียงตามเวลา แบ่งตามว่าใครต้องทำอะไร (เจ้าของ Choice 12 ต.ค. 2569 "แบบ B เป็นค่าเริ่ม") ═══
 * เจ้าของ: *"ตอนนี้สายในหน้าติดตามมันดูยากมาก จะโทรหาใคร อะไรยังไงไม่รู้"*
 * ตารางเดิมเรียงตามคน และสาย AI กับสายคนปนกัน ⇒ ไม่รู้ว่าต้องโทรใครก่อน
 *
 * 3 กอง (สายละกองเดียว · ทุกสายของวันอยู่สักกอง):
 *   - `staff` คนต้องโทร — สายคนโทรที่ยังไม่มีผล · สายที่ไม่ได้ส่งให้ AI · สาย AI ที่โทรแล้วไม่ได้คำตอบ (ไม่รับสาย/สรุปไม่ได้)
 *     และไม่มีสาย AI ของคนนั้นที่ยังรอโทรอยู่ในวันเดียวกัน (กันคนกับ AI โทรชนกัน)
 *   - `ai` AI จะโทร — ส่งให้ AI แล้ว ยังไม่มีผล (รวมเลยเวลาแต่ผลยังไม่กลับ · ส่ง AI แล้วต้อง AI ไม่ย้ายให้คน)
 *   - `done` จบแล้ว — มีคำตอบ (ไป/ไม่ไป) · คนลงผลแล้ว · ปิดงาน · ยกเลิก
 * ไฟล์นี้ pure — เทสต์ `tests/api/followCallQueue2569-10-12.test.ts`
 */
import type { FollowDayCall, FollowDayPerson, FollowPlanningRow } from './followPlanning';
import { buildFollowDayPeople, followDayPersonDone, followRoundLabel, roundDispatchReason } from './followPlanning';
import { canRecordStaffCall, isStaffCallResult } from './followStaffCall';
import { followCallerOf } from './followListFilter';

export type FollowQueueGroup = 'staff' | 'ai' | 'done';
export const FOLLOW_QUEUE_GROUPS: ReadonlyArray<{ key: FollowQueueGroup; label: string }> = [
  { key: 'staff', label: 'คนต้องโทร' },
  { key: 'ai', label: 'AI จะโทร' },
  { key: 'done', label: 'จบแล้ว' },
];

export type FollowQueueItem = {
  person: FollowDayPerson;
  call: FollowDayCall;
  group: FollowQueueGroup;
  /** บรรทัดบอกว่าทำไมสายนี้อยู่ตรงนี้ / ผลของสาย */
  reason: string;
  /** เลยเวลานัดมากี่นาที (เฉพาะกองคนต้องโทร) · null = ยังไม่ถึง/ไม่รู้เวลา */
  lateMinutes: number | null;
  /** เวลานัด (ms) ใช้เรียง · null = ยังไม่ระบุเวลา (ไปท้ายกอง) */
  at: number | null;
};

const AI_PENDING = new Set(['waiting', 'sent', 'overdue']);

const atOf = (c: FollowDayCall): number | null => {
  if (c.round.entry.time_tbd) return null;
  const t = Date.parse(c.round.entry.scheduled_at ?? '');
  return Number.isFinite(t) ? t : null;
};

export function followQueueGroupOf(call: FollowDayCall, person: FollowDayPerson): { group: FollowQueueGroup; reason: string } {
  const { round } = call;
  const e = round.entry;
  const label = followRoundLabel(round);
  if (round.state === 'cancelled' || round.state === 'closed' || e.completed_at || isStaffCallResult(e)) {
    return { group: 'done', reason: label };
  }
  /**
   * 🔴 QA รอบ 4 (12 ต.ค. 2569) ข้อ 1–2: กติกา "จบแล้ว" ชุดเดียวกับตาราง (`followDayPersonDone`)
   * - คนนั้นจบวันแล้ว (ไม่มีสายเปิด + มีคำตอบ ไป/ไม่ไป) = ทุกสายของวันนั้นจบ — เดิมสายเช้าที่ AI ไม่ได้คำตอบ
   *   ค้างแดงให้คนโทรหาคนที่ตอบว่าไปแล้วในสายถัดมา (12 ต.ค. 5 สาย · 9 ต.ค. 14 สาย)
   * - สายนี้ได้คำตอบ ไป/ไม่ไป หรือถูกยกเลิกแล้ว = จบ — เดิมสายคนโทรที่ยกเลิกแล้วแต่ AI ยังโทรได้ "ไม่ไป"
   *   ไปอยู่กองคนต้องโทรโดยไม่มีปุ่มลงผล (ส่งคนแทน 249 แถว · ปุ่มลงผล 247)
   */
  if (followDayPersonDone(person) !== null) return { group: 'done', reason: label };
  if (call.category === 'agreed' || call.category === 'lost' || e.cancelled) return { group: 'done', reason: label };
  const caller = followCallerOf(e);
  if (caller === 'manual') return { group: 'staff', reason: 'สายคนโทร' };
  if (round.state === 'notSent') return { group: 'staff', reason: roundDispatchReason(round) };
  if (AI_PENDING.has(round.state)) {
    return { group: 'ai', reason: round.state === 'overdue' ? 'ส่งให้ AI แล้ว ยังไม่มีผลกลับ' : 'AI จะโทรตามเวลา' };
  }
  // มีผลจาก AI แล้ว — ขอเลื่อน/ยกเลิก = จบ · ไม่ได้คำตอบ = คนโทรต่อได้ ถ้า AI ไม่มีสายรออยู่อีกในวันนั้น
  if (!canRecordStaffCall(e)) return { group: 'done', reason: label };
  const aiStillCalling = person.calls.some(
    (c) => c !== call && !c.round.entry.cancelled && followCallerOf(c.round.entry) === 'ai' && AI_PENDING.has(c.round.state),
  );
  if (aiStillCalling) return { group: 'done', reason: label };
  return { group: 'staff', reason: `AI โทรแล้ว ${label} → คนโทรต่อ` };
}

export function buildFollowCallQueue(
  people: readonly FollowDayPerson[],
  now: Date = new Date(),
): Record<FollowQueueGroup, FollowQueueItem[]> {
  const out: Record<FollowQueueGroup, FollowQueueItem[]> = { staff: [], ai: [], done: [] };
  for (const person of people) {
    for (const call of person.calls) {
      const { group, reason } = followQueueGroupOf(call, person);
      const at = atOf(call);
      const late = group === 'staff' && at !== null && at < now.getTime() ? Math.floor((now.getTime() - at) / 60_000) : null;
      out[group].push({ person, call, group, reason, lateMinutes: late, at });
    }
  }
  const byTime = (a: FollowQueueItem, b: FollowQueueItem) =>
    (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER) || a.person.row.group.name.localeCompare(b.person.row.group.name, 'th');
  for (const g of Object.keys(out) as FollowQueueGroup[]) out[g].sort(byTime);
  return out;
}

/** "เลย 40 นาที" · "เลย 2 ชม. 5 นาที" */
export function lateText(minutes: number): string {
  if (minutes < 60) return `เลย ${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `เลย ${h} ชม. ${m} นาที` : `เลย ${h} ชม.`;
}

/**
 * ═══ "ต้องตามด่วน · ทั้งเดือน" — กติกาเดียวกับกองของมุมมองต้องโทร (QA รอบ 4 · 12 ต.ค. 2569 ข้อ 3) ═══
 * เดิมนับแค่ `callCategory === 'overdue'` ⇒ สายคนโทรที่เลยเวลา (แท็บคนเริ่มงาน = 'notSent') ไม่ถูกนับ การ์ดขึ้น 0
 * ทั้งที่กองคนต้องโทรค้างแดง · และคนที่จบวันแล้ว (ตอบว่าไปในสายถัดมา) ยังถูกนับ
 * ด่วน = คนต้องโทรที่เลยเวลาแล้ว + ส่ง AI แล้วเลยเวลายังไม่มีผลกลับ (ของเดิมของการ์ด ห้ามหาย)
 * ทีละวันผ่าน `buildFollowDayPeople` → `buildFollowCallQueue` ตัวเดียวกับจอ
 */
export function followUrgentCalls(
  rows: readonly FollowPlanningRow[],
  month: string,
  now: Date = new Date(),
): FollowQueueItem[] {
  const days = new Set<string>();
  for (const row of rows) for (const r of row.rounds) if (r.ymd?.slice(0, 7) === month) days.add(r.ymd);
  const out: FollowQueueItem[] = [];
  for (const ymd of days) {
    const q = buildFollowCallQueue(buildFollowDayPeople(rows, ymd, 'all'), now);
    for (const it of q.staff) if ((it.lateMinutes ?? 0) > 0) out.push(it);
    for (const it of q.ai) if (it.call.round.state === 'overdue') out.push(it);
  }
  return out.sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER));
}
