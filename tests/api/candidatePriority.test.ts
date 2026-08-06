import { describe, expect, it } from 'vitest';
import {
  compareCandidatePriority,
  describePriorityScore,
  PRIORITY_WEIGHTS,
  scoreCandidatePriority,
} from '../../src/lib/candidatePriority';

describe('scoreCandidatePriority — ลำดับความสำคัญที่เจ้าของกำหนด', () => {
  it('น้ำหนักไล่ตามลำดับ: อายุ > ที่อยู่ > ประสบการณ์ > คดี/รายได้ > เหล้า-บุหรี่', () => {
    expect(PRIORITY_WEIGHTS.age).toBeGreaterThan(PRIORITY_WEIGHTS.area);
    expect(PRIORITY_WEIGHTS.area).toBeGreaterThan(PRIORITY_WEIGHTS.experience);
    expect(PRIORITY_WEIGHTS.experience).toBeGreaterThan(PRIORITY_WEIGHTS.salary);
  });

  it('ผ่านครบทุกเกณฑ์ที่มีข้อมูล = 100%', () => {
    const s = scoreCandidatePriority({ age: 'pass', area: 'pass', experience: 'pass', salary: 'pass' });
    expect(s.percent).toBe(100);
    expect(s.hardFails).toBe(0);
  });

  it('เกณฑ์ที่ไม่มีข้อมูล (unknown) ไม่ถูกนับ — คนข้อมูลไม่ครบไม่ถูกลงโทษ', () => {
    const partial = scoreCandidatePriority({ age: 'pass', area: 'pass' });
    expect(partial.percent).toBe(100);
    // เหล้า/บุหรี่กับคดี ยังไม่มีข้อมูลจากบอร์ด — ต้องไม่ดึงคะแนนลง
    expect(partial.verdicts.lifestyle).toBe('unknown');
    expect(partial.verdicts.criminalRecord).toBe('unknown');
  });

  it('อายุ/ที่อยู่เป็นเกณฑ์แข็ง — fail แล้วนับ hardFails · เกณฑ์ flexible ไม่นับ', () => {
    expect(scoreCandidatePriority({ age: 'fail', area: 'pass' }).hardFails).toBe(1);
    expect(scoreCandidatePriority({ age: 'fail', area: 'fail' }).hardFails).toBe(2);
    expect(
      scoreCandidatePriority({ age: 'pass', area: 'pass', salary: 'fail', experience: 'fail' }).hardFails,
    ).toBe(0);
  });

  it('flexible fail แค่ลดคะแนน ไม่ตัดตก — warn ได้ครึ่งน้ำหนัก', () => {
    const salaryOver = scoreCandidatePriority({ age: 'pass', area: 'pass', salary: 'fail' });
    const salaryWarn = scoreCandidatePriority({ age: 'pass', area: 'pass', salary: 'warn' });
    const salaryPass = scoreCandidatePriority({ age: 'pass', area: 'pass', salary: 'pass' });
    expect(salaryOver.hardFails).toBe(0);
    expect(salaryOver.percent).toBeLessThan(salaryWarn.percent);
    expect(salaryWarn.percent).toBeLessThan(salaryPass.percent);
  });
});

describe('compareCandidatePriority — ตัวเรียง', () => {
  it('คนอายุไม่เข้าช่วง (เกณฑ์แข็ง) ตกไปท้าย แม้คะแนนรวมด้านอื่นสูงกว่า', () => {
    const goodAge = scoreCandidatePriority({ age: 'pass', area: 'warn', salary: 'fail' });
    const badAge = scoreCandidatePriority({ age: 'fail', area: 'pass', experience: 'pass', salary: 'pass' });
    expect(compareCandidatePriority(goodAge, badAge)).toBeLessThan(0);
  });

  it('เกณฑ์แข็งเท่ากัน → คะแนนมากขึ้นก่อน', () => {
    const near = scoreCandidatePriority({ age: 'pass', area: 'pass' });
    const far = scoreCandidatePriority({ age: 'pass', area: 'fail' });
    expect(compareCandidatePriority(near, far)).toBeLessThan(0);
  });

  it('ลำดับสุดท้าย: ผ่านหมด > รายได้เกิน (flexible) > ที่อยู่ไกล (แข็ง) > อายุไม่เข้า (แข็ง)', () => {
    const rows = [
      { name: 'อายุไม่เข้า', s: scoreCandidatePriority({ age: 'fail', area: 'pass', salary: 'pass' }) },
      { name: 'ผ่านหมด', s: scoreCandidatePriority({ age: 'pass', area: 'pass', salary: 'pass' }) },
      { name: 'ที่อยู่ไกล', s: scoreCandidatePriority({ age: 'pass', area: 'fail', salary: 'pass' }) },
      { name: 'รายได้เกิน', s: scoreCandidatePriority({ age: 'pass', area: 'pass', salary: 'fail' }) },
    ];
    const sorted = [...rows].sort((a, b) => compareCandidatePriority(a.s, b.s)).map((r) => r.name);
    expect(sorted).toEqual(['ผ่านหมด', 'รายได้เกิน', 'ที่อยู่ไกล', 'อายุไม่เข้า']);
  });
});

describe('describePriorityScore', () => {
  it('อธิบายเฉพาะเกณฑ์ที่มีข้อมูล และบอกว่าเกณฑ์แข็งตกไปท้ายลิสต์', () => {
    const lines = describePriorityScore(scoreCandidatePriority({ age: 'fail', area: 'pass' }));
    expect(lines.some((l) => l.includes('อายุ') && l.includes('เกณฑ์แข็ง'))).toBe(true);
    expect(lines.some((l) => l.includes('เหล้า/บุหรี่'))).toBe(false);
  });
});
