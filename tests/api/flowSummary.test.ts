import { describe, it, expect } from 'vitest';
import { personRefToProposal, jobRefDisplay } from '../../api/_handlers/matching-flow-summary';
import { callResultsThisMonth, confirmedThisMonth, type FlowSummary } from '../../src/lib/flowSummaryApi';

describe('personRefToProposal — mapping ต้องตรงกับ unique key ของ candidate_proposals', () => {
  it('card-<id> → board', () => {
    expect(personRefToProposal('card-123')).toEqual({ source: 'board', ref: '123' });
  });
  it('ir-<id> → irecruit', () => {
    expect(personRefToProposal('ir-45')).toEqual({ source: 'irecruit', ref: '45' });
  });
  it('ref แปลก (เช่น follow-xxx) → null ไม่เดา', () => {
    expect(personRefToProposal('follow-abc')).toBeNull();
    expect(personRefToProposal('')).toBeNull();
  });
});

describe('jobRefDisplay', () => {
  it('ตัด prefix แหล่งข้อมูลออก เหลือเลขใบขอ', () => {
    expect(jobRefDisplay('siamraj-sql:OPL6907125')).toBe('OPL6907125');
    expect(jobRefDisplay('OPL6907125')).toBe('OPL6907125');
  });
});

describe('callResultsThisMonth — เลขใหญ่ของขั้น "ผลจากการโทร" บนหน้าหลัก', () => {
  const flowWith = (outcomes: Record<string, number>) =>
    ({ lumos: { outcomes_month: outcomes } }) as unknown as FlowSummary;

  it('รวมผลกลับทุกแบบ ไม่ใช่แค่คนสนใจ', () => {
    const flow = flowWith({ confirmed: 5, declined: 3, no_answer: 7, unresponsive: 2, wrong_person: 1 });
    expect(callResultsThisMonth(flow)).toBe(18);
    expect(confirmedThisMonth(flow)).toBe(5);
  });

  it('เดือนที่ยังไม่มีผลกลับเลย = 0 (ไม่ NaN)', () => {
    expect(callResultsThisMonth(flowWith({}))).toBe(0);
  });
});
