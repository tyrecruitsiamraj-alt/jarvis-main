/**
 * สมุดบัญชีติดตาม (7 ต.ค. 2569) — ยกมา + เพิ่ม − ได้ผล − ยกเลิก = คงเหลือ ต้องลงตัวทุกช่วง
 * เจ้าของ: *"ขอมั่นใจตัวเลขด้วยว่า บวกลบแล้วเท่ากัน ไม่ใช่ … อีกที่เหลือหายไรเงี้ยไม่เอาแบบนั้น"*
 */
import { describe, expect, it } from 'vitest';
import { buildLedger, ledgerBalances, openAt, type LedgerCall, type LedgerNote } from '@/lib/followLedger';

const call = (p: Partial<LedgerCall> & { id: string; createdAt: string }): LedgerCall => ({
  name: `คน ${p.id}`,
  unit: null,
  bu: null,
  team: 'main',
  caller: 'ai',
  scheduledAt: p.createdAt,
  createdBy: 'a@x',
  sentAt: null,
  exit: null,
  ...p,
});

const D = (d: string) => `2026-10-0${d}:00.000Z`;
const CALLS: LedgerCall[] = [
  // เข้าก่อนช่วง จบในช่วง
  call({ id: '1', createdAt: D('1T01:00'), exit: { kind: 'result', at: D('3T02:00'), by: 'AI', result: 'agreed' } }),
  // เข้าก่อนช่วง จบก่อนช่วง (ไม่ยกมา)
  call({ id: '2', createdAt: D('1T01:00'), exit: { kind: 'cancel', at: D('1T05:00'), by: 'b@x', result: 'cancelled' } }),
  // เข้าก่อนช่วง ยังไม่จบ
  call({ id: '3', createdAt: D('1T02:00') }),
  // เข้าในช่วง จบในช่วง
  call({ id: '4', createdAt: D('3T01:00'), sentAt: D('3T01:01'), exit: { kind: 'cancel', at: D('4T01:00'), by: 'iRecruit', result: 'cancelled' } }),
  // เข้าในช่วง จบหลังช่วง
  call({ id: '5', createdAt: D('4T01:00'), caller: 'manual', exit: { kind: 'result', at: D('7T01:00'), by: 'c@x', result: 'lost' } }),
  // ผลลงก่อนเวลาสร้าง (ข้อมูลเก่า) — ปัดเป็นเวลาเข้า
  call({ id: '6', createdAt: D('4T03:00'), exit: { kind: 'result', at: D('2T03:00'), by: 'AI', result: 'agreed' } }),
  // เข้าหลังช่วง
  call({ id: '7', createdAt: D('8T01:00') }),
];
const NOTES: LedgerNote[] = [
  { callId: '3', at: D('3T09:00'), kind: 'edit', by: 'a@x' },
  { callId: '3', at: D('9T09:00'), kind: 'edit', by: 'a@x' },
  { callId: 'gone', at: D('3T09:00'), kind: 'edit', by: 'a@x' },
];

const start = new Date(D('3T00:00'));
const end = new Date(D('6T00:00'));

describe('followLedger', () => {
  it('ยกมา + เพิ่ม − ได้ผล − ยกเลิก = คงเหลือ', () => {
    const l = buildLedger(CALLS, NOTES, start, end);
    expect(l).toMatchObject({ opening: 2, added: 3, results: 2, cancelled: 1, closing: 2 });
    expect(ledgerBalances(l)).toBe(true);
  });

  it('ลงตัวทุกช่วงที่เลือก (รวมไม่จำกัดต้น/ท้าย)', () => {
    const days = ['1T00:00', '2T00:00', '3T00:00', '4T03:00', '5T00:00', '7T00:00', '9T00:00'].map((d) => new Date(D(d)));
    for (const a of [null, ...days]) {
      for (const b of [...days, null]) {
        if (a && b && a >= b) continue;
        const l = buildLedger(CALLS, NOTES, a, b);
        expect(ledgerBalances(l), `${a?.toISOString()} → ${b?.toISOString()}`).toBe(true);
        // ยอดคงเหลือบรรทัดล่าสุด = คงเหลือ
        if (l.lines.length) expect(l.lines[0].balance).toBe(l.closing);
      }
    }
  });

  it('ยอดต่อบรรทัดเดินตามเวลา · ส่ง/แก้ ไม่กระทบยอด · รายการของสายที่ลบไปแล้วไม่ขึ้น', () => {
    const l = buildLedger(CALLS, NOTES, start, end);
    const asc = [...l.lines].reverse();
    expect(asc.map((x) => `${x.call.id}:${x.kind}:${x.balance}`)).toEqual([
      '4:add:3',
      '4:send:3',
      '1:result:2',
      '3:edit:2',
      // เวลาเดียวกัน (4 ต.ค. 01:00) = เข้าก่อนออก
      '5:add:3',
      '4:cancel:2',
      '6:add:3',
      '6:result:2',
    ]);
  });

  it('ผลลงก่อนเวลาสร้าง = นับเป็นจบตอนเข้า (ไม่ติดลบ ไม่หาย)', () => {
    expect(openAt(CALLS[5], Date.parse(D('4T03:00')))).toBe(false);
    expect(openAt(CALLS[5], Date.parse(D('4T02:00')))).toBe(false);
  });
});
