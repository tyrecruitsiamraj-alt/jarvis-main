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
import { followPersonKey } from './followGrouping';

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
 * ═══ "สายที่จะไม่ถูกโทร" — กติกาเดียวทุกจอ (เจ้าของสั่ง 13 ต.ค. 2569 "อะไรที่จะไม่โทร และมีโอกาสจะไม่โทร จะกันให้หมด") ═══
 * แทนการ์ด "ต้องตามด่วน · ทั้งเดือน" เดิม (QA รอบ 4 ข้อ 3) · ทุกวันที่มีในแท็บ ไม่ใช่แค่เดือนที่ดู (Choice "ให้ทีมเคลียร์ของเก่าด้วย")
 * ทีละวันผ่าน `buildFollowDayPeople` → `buildFollowCallQueue` ตัวเดียวกับกองบนจอ (คนที่จบวันแล้วไม่นับ)
 *   - `ai_not_sent` AI จะไม่โทร — ส่งไม่ได้ (ปิดส่ง · รับไปโทรเอง · ห้ามโทร · ตรวจไม่ได้ · ไม่มีเบอร์ · ส่งไม่ถึง · Lumos ไม่รับ) ทุกเวลา รวมอนาคต
 *   - `ai_late`     ส่ง AI แล้ว เลยเวลา 15 นาทียังไม่มีผล
 *   - `staff_late`  คนต้องโทร เลยเวลา 15 นาทียังไม่ลงผล (สายคนโทร + สาย AI ที่ไม่ได้คำตอบ)
 *   - `tbd`         ยังไม่ระบุเวลา ถึงวันแล้ว
 */
export type FollowAtRiskKind = 'ai_not_sent' | 'ai_late' | 'staff_late' | 'tbd';
export const FOLLOW_AT_RISK_KINDS: ReadonlyArray<{ key: FollowAtRiskKind; label: string }> = [
  { key: 'staff_late', label: 'คนยังไม่โทร' },
  { key: 'ai_not_sent', label: 'AI ส่งไม่ได้' },
  { key: 'ai_late', label: 'AI เลยเวลาไม่มีผล' },
  { key: 'tbd', label: 'ยังไม่ระบุเวลา' },
];
/** dispatch_state ที่แปลว่า AI จะไม่โทรสายนี้ — ชุดเดียวกับป้าย "ไม่ได้ส่ง" (`followDispatchState.ts`) */
const AI_NOT_SENT_STATES = new Set(['held', 'suppressed', 'guarded', 'no_phone', 'off', 'push_failed', 'not_imported']);
const AT_RISK_GRACE_MIN = 15;
/** 🔴 `Intl` ระดับโมดูลเท่านั้น */
const BKK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });

export type FollowAtRiskItem = FollowQueueItem & { kind: FollowAtRiskKind };

export function followAtRiskKindOf(it: FollowQueueItem, todayYmd: string): FollowAtRiskKind | null {
  const e = it.call.round.entry;
  if (it.group === 'done') return null;
  const late = it.at !== null ? it.lateMinutes ?? 0 : 0;
  if (e.call_mode !== 'manual' && AI_NOT_SENT_STATES.has(String(e.dispatch_state ?? ''))) return 'ai_not_sent';
  if (it.group === 'ai') {
    return it.call.round.state === 'overdue' && it.at !== null && late >= AT_RISK_GRACE_MIN ? 'ai_late' : null;
  }
  if (e.time_tbd) return (it.call.round.ymd ?? '9999') <= todayYmd ? 'tbd' : null;
  if (e.call_mode !== 'manual' && it.call.round.state === 'notSent') return 'ai_not_sent';
  return late >= AT_RISK_GRACE_MIN ? 'staff_late' : null;
}

export function followAtRiskCalls(rows: readonly FollowPlanningRow[], now: Date = new Date()): FollowAtRiskItem[] {
  const days = new Set<string>();
  for (const row of rows) for (const r of row.rounds) if (r.ymd) days.add(r.ymd);
  const todayYmd = BKK_YMD.format(now);
  const out: FollowAtRiskItem[] = [];
  for (const ymd of days) {
    const q = buildFollowCallQueue(buildFollowDayPeople(rows, ymd, 'all'), now);
    for (const it of [...q.staff, ...q.ai]) {
      // lateMinutes ของกอง AI เป็น null โดยตั้งใจ (ป้ายเลยเวลาบอกเฉพาะกองคน) — คิดเองที่นี่
      const item = it.group === 'ai' && it.at !== null ? { ...it, lateMinutes: Math.floor((now.getTime() - it.at) / 60_000) } : it;
      const kind = followAtRiskKindOf(item, todayYmd);
      if (kind) out.push({ ...item, kind });
    }
  }
  return out.sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER));
}

/**
 * ═══ กองคนต้องโทร: ชื่อเดียวกันอยู่ติดกัน (เจ้าของสั่ง 12 ต.ค. 2569) ═══
 * *"คนต้องโทร ถ้าชื่อเดียวกันเอาไว้ติดกัน และทำเป็น Pagination เลือกได้จะดูทีละ 10 20 30 40 ชื่อ"*
 * ก้อนละคน (`followPersonKey` ตัวเดียวกับแผง — เบอร์ + เรื่อง + ชื่อ) · เรียงก้อนตามสายแรกสุดของคนนั้น ในก้อนเรียงตามเวลา
 * แบ่งหน้านับเป็น "ชื่อ" ไม่ใช่สาย
 */
export const FOLLOW_QUEUE_PAGE_SIZES = [10, 20, 30, 40] as const;

export function clusterQueueByPerson(items: readonly FollowQueueItem[]): FollowQueueItem[][] {
  const byKey = new Map<string, FollowQueueItem[]>();
  for (const it of items) {
    const key = followPersonKey(it.call.round.entry);
    const list = byKey.get(key);
    if (list) list.push(it);
    else byKey.set(key, [it]);
  }
  const at = (it: FollowQueueItem) => it.at ?? Number.MAX_SAFE_INTEGER;
  const clusters = [...byKey.values()].map((list) => [...list].sort((a, b) => at(a) - at(b)));
  return clusters.sort(
    (a, b) => at(a[0]) - at(b[0]) || a[0].person.row.group.name.localeCompare(b[0].person.row.group.name, 'th'),
  );
}
