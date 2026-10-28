/**
 * ตอบ AI ว่า "ไป" → หยุดสายที่เหลือของวันนั้น (เจ้าของ 28 ต.ค. 2569 Choice "ยกเลิกสายที่เหลือของวันนั้น")
 * เคสคุณนริศ: 06:40 ตอบ "รอรถตู้ฟอร์ดครับ" แต่ 07:40 ยังโดนโทรอีก 3 ครั้ง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUndefinedTable: () => false }));
const { followSaidGoing, followAnswerOf } = await import('../../api/_lib/callFollowup');
const { answeredButMarkedUnreached } = await import('../../src/lib/followPlanning');

const said = (...lines: string[]) => ({ transcript: lines.map((text) => ({ role: 'candidate', text })) });

describe('followSaidGoing', () => {
  it('ยืนยัน (confirmed) = ไป', () => {
    expect(followSaidGoing('confirmed', {})).toBe(true);
  });
  it('รับสายแล้วบอกว่าไป/กำลังไป = ไป · บอกไม่ไป = ไม่ใช่', () => {
    expect(followSaidGoing('acknowledged', said('ไปครับ กำลังเดินทาง'))).toBe(true);
    expect(followSaidGoing('acknowledged', said('ไม่ไปครับ'))).toBe(false);
  });
  it('🔴 จับใจความไม่ได้ / ไม่รับสาย ห้ามเดาเป็นไป', () => {
    expect(followSaidGoing('unresponsive', said('ไปครับ'))).toBe(false);
    expect(followSaidGoing('no_answer', {})).toBe(false);
  });
  it('ตัวรับผลเรียกยกเลิกสายที่เหลือทั้งตอนไม่ไปและตอนไป', () => {
    const src = readFileSync('api/_lib/callFollowup.ts', 'utf8');
    expect(src).toContain("if ((answer === 'going' || answer === 'not_going') && (followGroupId || followSchedule.scheduled)) {");
    expect(src).toContain("if (answer === 'not_going' || answer === 'reschedule') {");
  });
});

describe('คำตอบของสายติดตาม (28 ต.ค. 2569 · แจ้งเตือนไม่ไป/ขอเลื่อน)', () => {
  it('ไม่ไป = declined หรือรับสายแล้วพูดว่าไม่ไป · ขอเลื่อน = reschedule_requested', () => {
    expect(followAnswerOf('declined', {})).toBe('not_going');
    expect(followAnswerOf('acknowledged', said('ไม่ไปครับ'))).toBe('not_going');
    expect(followAnswerOf('reschedule_requested', {})).toBe('reschedule');
    expect(followAnswerOf('confirmed', {})).toBe('going');
    expect(followAnswerOf('unresponsive', said('ไม่ไปครับ'))).toBe(null);
    expect(followAnswerOf('wrong_person', {})).toBe(null);
  });
  it('🔴 จับใจความไม่ได้ + มีคำพูด ⇒ หน้าติดตามไม่อ่านคำพูดเอง (เชื่อ Lumos) · ไม่รับสาย + มีคำพูดยังอ่านเหมือนเดิม', () => {
    expect(answeredButMarkedUnreached({ call_outcome: 'unresponsive', call_reply: 'ไปครับ' })).toBe(false);
    expect(answeredButMarkedUnreached({ call_outcome: 'no_answer', call_reply: 'ครับ ครับ ผม' })).toBe(true);
  });
});
