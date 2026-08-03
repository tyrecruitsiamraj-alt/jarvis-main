import { describe, it, expect } from 'vitest';
import { personRefToProposal, jobRefDisplay } from '../../api/_handlers/matching-flow-summary';

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
