import { describe, it, expect } from 'vitest';
import { genderVerdict, ageVerdict, scoreMatch, describeScoreBreakdown } from './scoreIrecruitMatch';

describe('genderVerdict', () => {
  it('na when job does not require a gender', () => {
    expect(genderVerdict({ gender_requirement: '' }, 'm')).toBe('na');
    expect(genderVerdict({ gender_requirement: 'ไม่ระบุ' }, 'หญิง')).toBe('na');
  });

  it('na when candidate sex is unknown', () => {
    expect(genderVerdict({ gender_requirement: 'ชาย' }, null)).toBe('na');
  });

  it('matches male across encodings', () => {
    expect(genderVerdict({ gender_requirement: 'ชาย' }, 'm')).toBe('pass');
    expect(genderVerdict({ gender_requirement: 'ชาย' }, 'male')).toBe('pass');
    expect(genderVerdict({ gender_requirement: 'ชาย' }, 'ชาย')).toBe('pass');
    expect(genderVerdict({ gender_requirement: 'ชาย' }, 'f')).toBe('fail');
  });

  it('matches female across encodings', () => {
    expect(genderVerdict({ gender_requirement: 'หญิง' }, 'f')).toBe('pass');
    expect(genderVerdict({ gender_requirement: 'หญิง' }, 'ชาย')).toBe('fail');
  });
});

describe('ageVerdict', () => {
  it('na when no range specified', () => {
    expect(ageVerdict({}, 30)).toBe('na');
  });

  it('na when candidate age unknown', () => {
    expect(ageVerdict({ age_range_min: 20, age_range_max: 40 }, null)).toBe('na');
  });

  it('pass within range, fail outside', () => {
    expect(ageVerdict({ age_range_min: 20, age_range_max: 40 }, 30)).toBe('pass');
    expect(ageVerdict({ age_range_min: 20, age_range_max: 40 }, 18)).toBe('fail');
    expect(ageVerdict({ age_range_min: 20, age_range_max: 40 }, 41)).toBe('fail');
  });

  it('handles open-ended ranges', () => {
    expect(ageVerdict({ age_range_min: 20 }, 60)).toBe('pass');
    expect(ageVerdict({ age_range_max: 40 }, 10)).toBe('pass');
    expect(ageVerdict({ age_range_max: 40 }, 41)).toBe('fail');
  });
});

describe('scoreMatch', () => {
  const job = { gender_requirement: 'ชาย', age_range_min: 20, age_range_max: 40 };

  it('perfect: right gender, in-range age, closest area = 100%', () => {
    const s = scoreMatch({ sex: 'm', age: 30 }, job, { rank: 0, reason: 'ใกล้เขตจุดงาน' });
    expect(s).toMatchObject({ percent: 100, gender: 'pass', age: 'pass', areaRank: 0 });
  });

  it('wrong gender drops the score but area/age still count', () => {
    // earned = area40 + age30 = 70 ; total = 40+30+30 = 100 -> 70%
    const s = scoreMatch({ sex: 'f', age: 30 }, job, { rank: 0, reason: 'ใกล้เขตจุดงาน' });
    expect(s.percent).toBe(70);
    expect(s.gender).toBe('fail');
  });

  it('far area lowers area component', () => {
    // rank 4 -> area 0 ; earned = gender30 + age30 = 60 ; total 100 -> 60%
    const s = scoreMatch({ sex: 'm', age: 30 }, job, { rank: 4, reason: 'ห่างพื้นที่งาน' });
    expect(s.percent).toBe(60);
  });

  it('normalizes when job specifies no gender/age (area only)', () => {
    const s = scoreMatch({ sex: 'm', age: 30 }, {}, { rank: 2, reason: 'จังหวัดตรง' });
    // only area applies: earned 20 / total 40 -> 50%
    expect(s).toMatchObject({ percent: 50, gender: 'na', age: 'na' });
  });
});

describe('describeScoreBreakdown', () => {
  it('lists area/gender/age lines for hover tooltip', () => {
    const s = scoreMatch(
      { sex: 'm', age: 30 },
      { gender_requirement: 'ชาย', age_range_min: 20, age_range_max: 40 },
      { rank: 0, reason: 'ใกล้เขตจุดงาน' },
    );
    const lines = describeScoreBreakdown(s);
    expect(lines[0]).toContain('100%');
    expect(lines.some((l) => l.includes('พื้นที่') && l.includes('ใกล้เขตจุดงาน'))).toBe(true);
    expect(lines.some((l) => l.includes('เพศ') && l.includes('ตรงเกณฑ์'))).toBe(true);
    expect(lines.some((l) => l.includes('อายุ') && l.includes('ตรงเกณฑ์'))).toBe(true);
  });
});
