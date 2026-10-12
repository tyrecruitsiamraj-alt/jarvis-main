/**
 * หน้าติดตาม 12 ต.ค. 2569 (เจ้าของ Choice: แบบ A ตาราง AI | คน | รวม · แบบ B "ต้องโทรวันนี้" เป็นค่าเริ่ม · ช่องละ "N คน · M สาย")
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowDayCall, FollowDayPerson, FollowPlanningRound } from '@/lib/followPlanning';
import { buildFollowCallQueue, clusterQueueByPerson, FOLLOW_QUEUE_PAGE_SIZES, followQueueGroupOf, followUrgentCalls, lateText } from '@/lib/followCallQueue';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowPlanningRows } from '@/lib/followPlanning';
import { FOLLOW_PANEL_LINES, followPanelLists, followPeopleCount, type FollowMatrixCol } from '@/lib/followCallMatrix';

const NOW = new Date('2026-10-12T02:00:00Z'); // 09:00 ไทย

function entry(over: Partial<FollowEntry>): FollowEntry {
  return {
    id: over.id ?? 'e',
    recipient_name: 'สมชาย',
    recipient_phone: '0811111111',
    topic: 'ติดตามเริ่มงาน',
    scheduled_at: '2026-10-12T01:00:00Z',
    cancelled: false,
    call_mode: 'ai',
    call_status: 'pending',
    call_outcome: null,
    ...over,
  } as FollowEntry;
}

function call(e: FollowEntry, state: FollowPlanningRound['state'], category: FollowDayCall['category']): FollowDayCall {
  return { row: {} as FollowDayCall['row'], round: { entry: e, state, ymd: '2026-10-12', time: null } as FollowPlanningRound, slot: 1, category };
}

function person(name: string, calls: FollowDayCall[]): FollowDayPerson {
  const row = { group: { key: name, name, phone: '0811111111', unitName: 'หน่วย' } } as unknown as FollowDayPerson['row'];
  return { row, calls: calls.map((c) => ({ ...c, row })), headline: 'waiting' };
}

describe('ต้องโทรวันนี้ — สายละกองเดียว', () => {
  it('สายคนโทรที่ยังไม่มีผล = คนต้องโทร · ส่ง AI แล้วรอผล = AI จะโทร (เลยเวลาก็ยังเป็นของ AI)', () => {
    const manual = call(entry({ id: 'm', call_mode: 'manual', call_status: null }), 'notSent', 'notSent');
    const aiWait = call(entry({ id: 'a1' }), 'sent', 'waiting');
    const aiLate = call(entry({ id: 'a2' }), 'overdue', 'overdue');
    const p = person('ก', [manual, aiWait, aiLate]);
    expect(followQueueGroupOf(manual, p).group).toBe('staff');
    expect(followQueueGroupOf(aiWait, p).group).toBe('ai');
    expect(followQueueGroupOf(aiLate, p)).toEqual({ group: 'ai', reason: 'ส่งให้ AI แล้ว ยังไม่มีผลกลับ' });
  });

  it('🔴 AI โทรแล้วไม่ได้คำตอบ = คนโทรต่อ — แต่ถ้า AI ยังมีสายรอของคนนั้นในวันเดียวกัน ห้ามให้คนโทรชน', () => {
    const noAnswer = call(entry({ id: 'n', call_status: 'completed', call_outcome: 'no_answer' }), 'result', 'unreachable');
    expect(followQueueGroupOf(noAnswer, person('ข', [noAnswer])).group).toBe('staff');
    const later = call(entry({ id: 'l' }), 'sent', 'waiting');
    expect(followQueueGroupOf(noAnswer, person('ข', [noAnswer, later])).group).toBe('done');
  });

  it('ได้คำตอบ/คนลงผล/ยกเลิก/ปิดงาน = จบแล้ว', () => {
    const went = call(entry({ id: 'w', call_status: 'completed', call_outcome: 'confirmed' }), 'result', 'agreed');
    const staff = call(entry({ id: 's', call_mode: 'manual', staff_call_outcome: 'confirmed' }), 'result', 'agreed');
    const cancelled = call(entry({ id: 'c', cancelled: true }), 'cancelled', 'cancelled');
    const p = person('ค', [went, staff, cancelled]);
    for (const c of [went, staff, cancelled]) expect(followQueueGroupOf(c, p).group).toBe('done');
  });

  it('เรียงตามเวลา · เลยเวลาบอกกี่นาที (เฉพาะคนต้องโทร) · ทุกสายอยู่สักกอง', () => {
    const a = call(entry({ id: 'a', call_mode: 'manual', call_status: null, scheduled_at: '2026-10-12T01:20:00Z' }), 'notSent', 'notSent');
    const b = call(entry({ id: 'b', call_mode: 'manual', call_status: null, scheduled_at: '2026-10-12T00:00:00Z' }), 'notSent', 'notSent');
    const c = call(entry({ id: 'c', scheduled_at: '2026-10-12T03:00:00Z' }), 'sent', 'waiting');
    const q = buildFollowCallQueue([person('ง', [a, b, c])], NOW);
    expect(q.staff.map((i) => i.call.round.entry.id)).toEqual(['b', 'a']);
    expect(q.staff.map((i) => i.lateMinutes)).toEqual([120, 40]);
    expect(q.ai[0].lateMinutes).toBeNull();
    expect(q.staff.length + q.ai.length + q.done.length).toBe(3);
    expect(lateText(40)).toBe('เลย 40 นาที');
    expect(lateText(125)).toBe('เลย 2 ชม. 5 นาที');
  });
});

describe('QA รอบ 4 (12 ต.ค. 2569) — กติกาจบแล้วชุดเดียวกับตาราง', () => {
  it('🔴 ข้อ 1: สายเช้า AI ไม่ได้คำตอบ แต่สายถัดมาวันเดียวกันตอบว่าไปแล้ว = จบ ไม่ใช่คนต้องโทร', () => {
    const morning = call(entry({ id: 'm', call_status: 'completed', call_outcome: 'no_answer' }), 'result', 'unreachable');
    const later = call(entry({ id: 'l', call_status: 'completed', call_outcome: 'confirmed' }), 'result', 'agreed');
    expect(followQueueGroupOf(morning, person('จ', [morning, later])).group).toBe('done');
    // ยังมีสายเปิดของวันนั้น (กติกาเจ้าของ 8 ต.ค. "ต้องจบของวันนั้นก่อน") = ยังไม่จบทั้งคน
    const manualOpen = call(entry({ id: 'o', call_mode: 'manual', call_status: null }), 'notSent', 'notSent');
    expect(followQueueGroupOf(manualOpen, person('จ', [manualOpen, later])).group).toBe('staff');
  });

  it('🔴 ข้อ 2: สายคนโทรที่ยกเลิกแล้วแต่ AI ยังโทรได้ "ไม่ไป" = จบ (เดิมค้างกองคนต้องโทรไม่มีปุ่มลงผล)', () => {
    const c = call(
      entry({ id: 'x', call_mode: 'manual', cancelled: true, call_status: 'cancelled', call_outcome: 'declined' }),
      'result',
      'lost',
    );
    const open = call(entry({ id: 'y', call_mode: 'manual', call_status: null }), 'notSent', 'notSent');
    expect(followQueueGroupOf(c, person('ฉ', [c, open])).group).toBe('done');
  });

  it('🔴 ข้อ 3: ต้องตามด่วน = คนต้องโทรที่เลยเวลา + AI เลยเวลาไม่มีผล · คนที่จบวันแล้วไม่นับ', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    const e = (over: Partial<FollowEntry>) => entry({ topic: 'ติดตามเริ่มงาน', created_at: '2026-10-01T00:00:00Z', ...over });
    const entries = [
      // ก: สายคนโทรเลยเวลา ยังไม่ได้ลงผล → ด่วน (เดิมการ์ดไม่นับ เพราะหมวดเป็น notSent)
      e({ id: 'a', recipient_phone: '0811111111', call_mode: 'manual', call_status: null, scheduled_at: '2026-10-12T01:00:00Z' }),
      // ข: เช้าไม่รับสาย สายถัดมาตอบว่าไป → จบวัน ไม่ด่วน
      e({ id: 'b1', recipient_phone: '0822222222', call_status: 'completed', call_outcome: 'no_answer', scheduled_at: '2026-10-12T00:00:00Z' }),
      e({ id: 'b2', recipient_phone: '0822222222', call_status: 'completed', call_outcome: 'confirmed', scheduled_at: '2026-10-12T01:00:00Z' }),
      // ค: ส่ง AI แล้วเลยเวลา ผลยังไม่กลับ → ด่วน (ของเดิมของการ์ด)
      e({ id: 'c', recipient_phone: '0833333333', call_status: 'pending', scheduled_at: '2026-10-12T02:00:00Z' }),
      // ง: สายคนโทรยังไม่ถึงเวลา → ไม่ด่วน
      e({ id: 'd', recipient_phone: '0844444444', call_mode: 'manual', call_status: null, scheduled_at: '2026-10-12T12:00:00Z' }),
    ];
    const rows = buildFollowPlanningRows(groupFollowEntries(entries, now), now);
    const ids = followUrgentCalls(rows, '2026-10', now).map((it) => it.call.round.entry.id);
    expect(ids.sort()).toEqual(['a', 'c']);
  });
});

describe('คนต้องโทร: ชื่อเดียวกันติดกัน + แบ่งหน้าเป็นชื่อ (เจ้าของสั่ง 12 ต.ค. 2569)', () => {
  it('สายของคนเดียวกันอยู่ก้อนเดียว เรียงก้อนตามสายแรกสุด · ในก้อนเรียงตามเวลา · ตัวเลือก 10/20/30/40', () => {
    const m = (id: string, name: string, phone: string, at: string) =>
      call(entry({ id, recipient_name: name, recipient_phone: phone, call_mode: 'manual', call_status: null, scheduled_at: at }), 'notSent', 'notSent');
    const a1 = m('a1', 'ก', '0811111111', '2026-10-12T03:00:00Z');
    const b1 = m('b1', 'ข', '0822222222', '2026-10-12T01:00:00Z');
    const a2 = m('a2', 'ก', '0811111111', '2026-10-12T00:30:00Z');
    const b2 = m('b2', 'ข', '0822222222', '2026-10-12T04:00:00Z');
    const q = buildFollowCallQueue([person('ก', [a1, a2]), person('ข', [b1, b2])], NOW);
    // เรียงตามเวลาอย่างเดียว = a2 b1 a1 b2 (ชื่อสลับกัน) → จับก้อน = [a2 a1] [b1 b2]
    expect(q.staff.map((i) => i.call.round.entry.id)).toEqual(['a2', 'b1', 'a1', 'b2']);
    expect(clusterQueueByPerson(q.staff).map((c) => c.map((i) => i.call.round.entry.id))).toEqual([
      ['a2', 'a1'],
      ['b1', 'b2'],
    ]);
    expect([...FOLLOW_QUEUE_PAGE_SIZES]).toEqual([10, 20, 30, 40]);
  });
});

describe('แผงตาราง AI | คน | รวม', () => {
  const e = (id: string, phone = '0811111111') => entry({ id, recipient_phone: phone });
  const row: Record<FollowMatrixCol, FollowEntry[]> = {
    total: [e('1'), e('2'), e('3', '0822222222'), e('4', '0833333333'), e('5', '0844444444')],
    went: [e('1'), e('2')],
    notWent: [],
    noAnswer: [e('3', '0822222222')],
    unclear: [],
    waiting: [e('4', '0833333333')],
    cancelled: [e('5', '0844444444')],
  };

  it('เรียง โทรทั้งหมด → โทรไปแล้ว → ผล 4 แบบ → รอโทร → ยกเลิก · โทรไปแล้ว + รอโทร + ยกเลิก = ทั้งหมด', () => {
    expect(FOLLOW_PANEL_LINES.map((l) => l.key)).toEqual(['total', 'called', 'went', 'notWent', 'noAnswer', 'unclear', 'waiting', 'cancelled']);
    const p = followPanelLists(row);
    expect(p.called.length + p.waiting.length + p.cancelled.length).toBe(p.total.length);
  });

  it('"N คน · M สาย" — คนเดียวกันหลายสายนับคนเดียว', () => {
    const p = followPanelLists(row);
    expect([followPeopleCount(p.went), p.went.length]).toEqual([1, 2]);
    expect([followPeopleCount(p.total), p.total.length]).toEqual([4, 5]);
  });
});
