import { describe, it, expect } from 'vitest';
import { isSolidProposalAction, type ProposalStatus } from '@/lib/candidateProposalsApi';

/**
 * 🔴 เจ้าของทัก 21 ส.ค. 2569: *"คนนี้อยู่ใน Todo ทำ[ไม]บอกลงงานแล้ว"* (การ์ด #1808)
 * ตรวจฐานแล้วไม่มี proposal สักแถว — สถานะไม่เพี้ยน แต่ปุ่ม "ลงงานแล้ว" ถูกทำเขียวทึบ
 * ไว้ตลอดเวลา คนเปิดป๊อปมาจึงอ่านว่าระบบบอกว่าลงงานแล้ว
 * เทสต์ชุดนี้กันไม่ให้ปุ่มไหนทึบโดยที่ยังไม่มีสถานะจริง
 */
const ALL: ProposalStatus[] = ['proposed', 'reserved', 'contacted', 'placed', 'rejected', 'cancelled'];

describe('isSolidProposalAction', () => {
  it('🔴 ยังไม่มี proposal = ไม่มีปุ่มไหนทึบเลย (บั๊กที่เจ้าของเจอ)', () => {
    for (const st of ALL) {
      expect(isSolidProposalAction(st, null), st).toBe(false);
      expect(isSolidProposalAction(st, undefined), st).toBe(false);
    }
  });

  it('🔴 "ลงงานแล้ว" ห้ามทึบเมื่อสถานะจริงเป็นอย่างอื่น', () => {
    expect(isSolidProposalAction('placed', 'proposed')).toBe(false);
    expect(isSolidProposalAction('placed', 'reserved')).toBe(false);
    expect(isSolidProposalAction('placed', 'contacted')).toBe(false);
    expect(isSolidProposalAction('placed', 'rejected')).toBe(false);
  });

  it('ทึบเฉพาะปุ่มที่ตรงกับสถานะปัจจุบัน', () => {
    for (const st of ALL) {
      expect(isSolidProposalAction(st, st), st).toBe(true);
      for (const other of ALL.filter((x) => x !== st)) {
        expect(isSolidProposalAction(other, st), `${other} vs ${st}`).toBe(false);
      }
    }
  });
});
