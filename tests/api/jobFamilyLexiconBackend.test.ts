import { describe, expect, it } from 'vitest';
import {
  classifyJobFamily,
  candidateMatchesFamily,
  isJobFamilyCode,
  selectShortlist,
  type ScoredCandidate,
} from '../../api/_lib/jobFamilyLexicon';

describe('classifyJobFamily / candidateMatchesFamily (backend)', () => {
  it('classifies meter-reading into family D, not driver family C', () => {
    expect(classifyJobFamily('พนักงาน อ่านมาตร')).toBe('D');
    expect(classifyJobFamily('ขับรถ ส่วนกลาง')).toBe('C');
  });

  it('a driver candidate does not match family D (meter reading / admin)', () => {
    expect(candidateMatchesFamily('ขับรถ / รถผู้บริหารต่างชาติ', 'D')).toBe(false);
    expect(candidateMatchesFamily('ขับรถ / รถผู้บริหารต่างชาติ', 'C')).toBe(true);
  });

  it('isJobFamilyCode validates AI-returned family codes', () => {
    expect(isJobFamilyCode('D')).toBe(true);
    expect(isJobFamilyCode('?')).toBe(false);
    expect(isJobFamilyCode('Z')).toBe(false);
  });
});

describe('selectShortlist — the fix for cross-family forced matches', () => {
  const candidateText = (c: { skill: string }) => c.skill;

  it('regression: a driver-only pool must NOT be offered to a meter-reading job', () => {
    // reproduces the reported bug: job family D (อ่านมาตร), pool is 100% drivers (family C)
    const scored: ScoredCandidate<{ skill: string }>[] = [
      { c: { skill: 'ขับรถ / ส่วนกลาง' }, s: 0 },
      { c: { skill: 'ขับรถ / รถผู้บริหารต่างชาติ' }, s: 0 },
      { c: { skill: 'ขับรถ / valet' }, s: 0 },
    ];
    const result = selectShortlist(scored, 20, 'D', candidateText);
    expect(result).toHaveLength(0);
  });

  it('fills fallback slots only with same-family candidates when scored matches are insufficient', () => {
    const scored: ScoredCandidate<{ skill: string }>[] = [
      { c: { skill: 'ขับรถ / ส่วนกลาง' }, s: 0 },
      { c: { skill: 'ธุรการ / คีย์ข้อมูล' }, s: 0 },
      { c: { skill: 'แคชเชียร์' }, s: 0 },
    ];
    const result = selectShortlist(scored, 20, 'D', candidateText);
    expect(result).toHaveLength(2);
    expect(result.every((r) => /ธุรการ|แคชเชียร์/.test(r.c.skill))).toBe(true);
  });

  it('uses scored (>0) candidates as-is when they already cover half the shortlist size', () => {
    const scored: ScoredCandidate<{ skill: string }>[] = [
      { c: { skill: 'อ่านมาตรน้ำ' }, s: 5 },
      { c: { skill: 'อ่านมาตรไฟ' }, s: 5 },
      { c: { skill: 'ขับรถ' }, s: 0 },
    ];
    const result = selectShortlist(scored, 4, 'D', candidateText);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.s > 0)).toBe(true);
  });

  it('falls back to the old (family-agnostic) behavior when family cannot be determined', () => {
    const scored: ScoredCandidate<{ skill: string }>[] = [
      { c: { skill: 'ขับรถ' }, s: 0 },
      { c: { skill: 'ธุรการ' }, s: 0 },
    ];
    const result = selectShortlist(scored, 20, null, candidateText);
    expect(result).toHaveLength(2);
  });
});
