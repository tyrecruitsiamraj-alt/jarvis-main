import { describe, expect, it } from 'vitest';
import {
  addDays,
  bangkokYmd,
  breakdown,
  bucketKey,
  bucketLabel,
  bucketRange,
  daysBetween,
  defaultRange,
  deltaPct,
  previousRange,
  sameRangeLastYear,
  seriesByBucket,
  sumInRange,
} from './timeBuckets';

describe('bangkokYmd — วันที่ตามปฏิทินกรุงเทพ', () => {
  it('ตีหนึ่งไทย (18:00 UTC เมื่อวาน) ต้องเป็นวันนี้', () => {
    expect(bangkokYmd('2026-09-27T18:30:00Z')).toBe('2026-09-28');
  });
  it('YYYY-MM-DD ส่งกลับตรง ๆ · ค่าว่าง/อ่านไม่ออก = null (ห้ามเดาเป็นวันนี้)', () => {
    expect(bangkokYmd('2026-09-28')).toBe('2026-09-28');
    expect(bangkokYmd(null)).toBeNull();
    expect(bangkokYmd('')).toBeNull();
    expect(bangkokYmd('ไม่ใช่วันที่')).toBeNull();
  });
});

describe('bucketKey — คีย์งวด', () => {
  it('สัปดาห์เริ่มวันจันทร์ (28 ก.ย. 2569 เป็นวันจันทร์)', () => {
    expect(bucketKey('2026-09-28', 'week')).toBe('2026-09-28');
    expect(bucketKey('2026-09-27', 'week')).toBe('2026-09-21'); // อาทิตย์ → จันทร์ก่อนหน้า
    expect(bucketKey('2026-10-04', 'week')).toBe('2026-09-28');
  });
  it('เดือน · ไตรมาส · ปี', () => {
    expect(bucketKey('2026-09-28', 'month')).toBe('2026-09');
    expect(bucketKey('2026-09-28', 'quarter')).toBe('2026-Q3');
    expect(bucketKey('2026-10-01', 'quarter')).toBe('2026-Q4');
    expect(bucketKey('2026-01-01', 'quarter')).toBe('2026-Q1');
    expect(bucketKey('2026-09-28', 'year')).toBe('2026');
  });
});

describe('bucketRange — งวดต่อเนื่อง ไม่ข้ามงวดว่าง', () => {
  it('วัน', () => {
    expect(bucketRange('2026-09-27', '2026-09-30', 'day')).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
  });
  it('เดือนข้ามปี', () => {
    expect(bucketRange('2025-11-15', '2026-02-03', 'month')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('ไตรมาสข้ามปี', () => {
    expect(bucketRange('2025-08-01', '2026-02-01', 'quarter')).toEqual(['2025-Q3', '2025-Q4', '2026-Q1']);
  });
  it('from > to หรือรูปแบบผิด = ว่าง', () => {
    expect(bucketRange('2026-09-30', '2026-09-01', 'day')).toEqual([]);
    expect(bucketRange('x', '2026-09-01', 'day')).toEqual([]);
  });
});

describe('bucketLabel — ป้ายไทย พ.ศ.', () => {
  it('ทุกงวด', () => {
    expect(bucketLabel('2026-09-28', 'day')).toBe('28 ก.ย.');
    expect(bucketLabel('2026-09-28', 'week')).toBe('28 ก.ย.–4 ต.ค.');
    expect(bucketLabel('2026-09-21', 'week')).toBe('21–27 ก.ย.');
    expect(bucketLabel('2026-09', 'month')).toBe('ก.ย. 69');
    expect(bucketLabel('2026-Q3', 'quarter')).toBe('Q3/69');
    expect(bucketLabel('2026', 'year')).toBe('2569');
  });
});

describe('ช่วงเวลา', () => {
  it('defaultRange เดือน = 12 เดือนรวมเดือนนี้ เริ่มวันที่ 1', () => {
    expect(defaultRange('month', '2026-09-28')).toEqual({ from: '2025-10-01', to: '2026-09-28' });
  });
  it('defaultRange วัน = 30 วันรวมวันนี้', () => {
    const r = defaultRange('day', '2026-09-28');
    expect(r).toEqual({ from: '2026-08-30', to: '2026-09-28' });
    expect(daysBetween(r.from, r.to) + 1).toBe(30);
  });
  it('previousRange ยาวเท่ากันและจบวันก่อนหน้า', () => {
    expect(previousRange('2026-09-22', '2026-09-28')).toEqual({ from: '2026-09-15', to: '2026-09-21' });
  });
  it('sameRangeLastYear · 29 ก.พ. → 28 ก.พ.', () => {
    expect(sameRangeLastYear('2026-09-01', '2026-09-28')).toEqual({ from: '2025-09-01', to: '2025-09-28' });
    expect(sameRangeLastYear('2028-02-29', '2028-03-01')).toEqual({ from: '2027-02-28', to: '2027-03-01' });
  });
  it('addDays ข้ามเดือน/ปี', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('deltaPct — ฐาน 0 บอกไม่ได้', () => {
  it('คิด % ปัด 1 ตำแหน่ง', () => {
    expect(deltaPct(214, 184)).toBe(16.3);
    expect(deltaPct(77, 95)).toBe(-18.9);
  });
  it('ฐาน 0 = null (ห้าม ∞)', () => {
    expect(deltaPct(5, 0)).toBeNull();
    expect(deltaPct(0, 0)).toBeNull();
  });
});

describe('seriesByBucket / sumInRange', () => {
  const items = [
    { at: '2026-09-22', n: 2 },
    { at: '2026-09-22', n: 1 },
    { at: '2026-09-24', n: 5 },
    { at: '2026-09-10', n: 9 }, // นอกช่วง
    { at: null, n: 7 }, // ไม่มีวันที่ = ไม่นับ
  ];
  const range = { from: '2026-09-21', to: '2026-09-24' };
  it('เติมวันว่างเป็น 0 และเรียงตามเวลา', () => {
    const s = seriesByBucket(items, (i) => i.at, range, 'day', (i) => i.n);
    expect(s.map((p) => [p.key, p.value])).toEqual([
      ['2026-09-21', 0],
      ['2026-09-22', 3],
      ['2026-09-23', 0],
      ['2026-09-24', 5],
    ]);
  });
  it('ผลรวมรายสัปดาห์ = ผลรวมรายวัน (แบ่งงวดแล้วเลขต้องไม่หาย)', () => {
    const d = seriesByBucket(items, (i) => i.at, range, 'day').reduce((a, p) => a + p.value, 0);
    const w = seriesByBucket(items, (i) => i.at, range, 'week').reduce((a, p) => a + p.value, 0);
    expect(w).toBe(d);
    expect(sumInRange(items, (i) => i.at, range)).toBe(d);
  });
});

describe('breakdown — แยกมิติ + เทียบช่วงก่อน', () => {
  const rows = [
    { at: '2026-09-25', bu: 'LBD' },
    { at: '2026-09-25', bu: 'LBD' },
    { at: '2026-09-26', bu: 'LBA' },
    { at: '2026-09-26', bu: '' },
    { at: '2026-09-18', bu: 'LBD' },
  ];
  it('ค่าว่าง = ไม่ระบุ · ผลรวมเท่ายอดรวม · มี delta', () => {
    const b = breakdown(
      rows,
      (r) => r.at,
      (r) => r.bu,
      { from: '2026-09-22', to: '2026-09-28' },
      { from: '2026-09-15', to: '2026-09-21' },
    );
    expect(b.map((r) => [r.dim, r.value, r.previous])).toEqual([
      ['LBD', 2, 1],
      ['LBA', 1, 0],
      ['ไม่ระบุ', 1, 0],
    ]);
    expect(b[0].delta).toBe(100);
    expect(b[1].delta).toBeNull();
    expect(b.reduce((a, r) => a + r.value, 0)).toBe(4);
  });
  it('เกิน top รวบเป็น "อื่น ๆ" โดยผลรวมไม่หาย', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ at: '2026-09-25', bu: `B${i}` }));
    const b = breakdown(many, (r) => r.at, (r) => r.bu, { from: '2026-09-22', to: '2026-09-28' }, null, 5);
    expect(b).toHaveLength(6);
    expect(b[5].dim).toBe('อื่น ๆ');
    expect(b.reduce((a, r) => a + r.value, 0)).toBe(12);
  });
});
