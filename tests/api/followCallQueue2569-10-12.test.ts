/**
 * หน้าติดตาม 12 ต.ค. 2569 (เจ้าของ Choice: แบบ A ตาราง AI | คน | รวม · แบบ B "ต้องโทรวันนี้" เป็นค่าเริ่ม · ช่องละ "N คน · M สาย")
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowDayCall, FollowDayPerson, FollowPlanningRound } from '@/lib/followPlanning';
import { buildFollowCallQueue, followQueueGroupOf, lateText } from '@/lib/followCallQueue';
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
