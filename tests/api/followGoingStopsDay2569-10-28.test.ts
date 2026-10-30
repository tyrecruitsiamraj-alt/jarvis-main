/**
 * ตอบ AI ว่า "ไป" → หยุดสายที่เหลือของวันนั้น (เจ้าของ 28 ต.ค. 2569 Choice "ยกเลิกสายที่เหลือของวันนั้น")
 * เคสคุณนริศ: 06:40 ตอบ "รอรถตู้ฟอร์ดครับ" แต่ 07:40 ยังโดนโทรอีก 3 ครั้ง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUndefinedTable: () => false }));
const { followSaidGoing, followAnswerOf, followSaidQuit } = await import('../../api/_lib/callFollowup');
const { answeredButMarkedUnreached } = await import('../../src/lib/followPlanning');

const said = (...lines: string[]) => ({ transcript: lines.map((text) => ({ role: 'candidate', text })) });

describe('followSaidGoing', () => {
  it('ยืนยัน (confirmed) = ไป', () => {
    expect(followSaidGoing('confirmed')).toBe(true);
  });
  it('🔴 รับสายแล้ว (acknowledged) ไม่ใช่ไป แม้สรุปบอกว่าไป — ยึดรหัสของ Lumos (30 ต.ค. 2569)', () => {
    expect(followSaidGoing('acknowledged')).toBe(false);
  });
  it('🔴 จับใจความไม่ได้ / ไม่รับสาย ห้ามเดาเป็นไป', () => {
    expect(followSaidGoing('unresponsive')).toBe(false);
    expect(followSaidGoing('no_answer')).toBe(false);
  });
  it('ตัวรับผลเรียกยกเลิกสายที่เหลือทั้งตอนไม่ไปและตอนไป', () => {
    const src = readFileSync('api/_lib/callFollowup.ts', 'utf8');
    expect(src).toContain("if ((answer === 'going' || answer === 'not_going') && (followGroupId || followSchedule.scheduled)) {");
    expect(src).toContain("if (answer === 'not_going' || answer === 'reschedule') {");
  });
});

describe('คำตอบของสายติดตาม (28 ต.ค. 2569 · แจ้งเตือนไม่ไป/ขอเลื่อน)', () => {
  it('ไม่ไป = declined เท่านั้น · ขอเลื่อน = reschedule_requested · รับสายแล้ว = ไม่ตัดสิน (30 ต.ค. 2569 ยึดรหัสของ Lumos)', () => {
    expect(followAnswerOf('declined')).toBe('not_going');
    expect(followAnswerOf('acknowledged')).toBe(null);
    expect(followAnswerOf('reschedule_requested')).toBe('reschedule');
    expect(followAnswerOf('confirmed')).toBe('going');
    expect(followAnswerOf('unresponsive')).toBe(null);
    expect(followAnswerOf('wrong_person')).toBe(null);
  });
  it('🔴 จับใจความไม่ได้ + มีคำพูด ⇒ หน้าติดตามไม่อ่านคำพูดเอง (เชื่อ Lumos) · ไม่รับสาย + มีคำพูดยังอ่านเหมือนเดิม', () => {
    expect(answeredButMarkedUnreached({ call_outcome: 'unresponsive', call_reply: 'ไปครับ' })).toBe(false);
    expect(answeredButMarkedUnreached({ call_outcome: 'no_answer', call_reply: 'ครับ ครับ ผม' })).toBe(true);
  });
});

describe('บอกไม่ทำแล้ว (28 ต.ค. 2569 Choice "คนกดหยุดเอง")', () => {
  it('จับคำลาออก/ไม่ทำแล้ว ⇒ กระดิ่งแยก · ไม่ไปธรรมดาไม่ใช่', () => {
    expect(followSaidQuit(said('ผมลาออกแล้วครับ'))).toBe(true);
    expect(followSaidQuit({ summary: 'ผู้รับสายแจ้งว่าไม่ทำแล้ว' })).toBe(true);
    expect(followSaidQuit(said('วันนี้ไม่สบาย ไม่ไปครับ'))).toBe(false);
  });
  it('ระบบไม่ยกเลิกวันอื่นเอง — ยังหยุดแค่วันนั้น (ตัวยกเลิกเดิม) · คนกด ยกเลิก › ทั้งชุด', () => {
    const src = readFileSync('api/_lib/callFollowup.ts', 'utf8');
    expect(src).toContain("type: quit ? 'follow_quit'");
    expect(src).toContain('กด บันทึกว่าเสร็จสิ้น › ยกเลิก › ทั้งชุด เพื่อหยุด');
  });
});
