import { describe, expect, it } from 'vitest';
import { MATCH_RANK_UNKNOWN, matchRankFromTier, matchRankLabel } from '../../src/lib/matchRank';

describe('matchRankFromTier — เขียวได้โทรก่อน แดงไว้ท้าย', () => {
  it('ทิศทางต้องคงที่: เขียว < เหลือง < แดง (เลขน้อย = ได้ก่อน)', () => {
    expect(matchRankFromTier('green')).toBeLessThan(matchRankFromTier('yellow'));
    expect(matchRankFromTier('yellow')).toBeLessThan(matchRankFromTier('red'));
  });

  it('⚠️ ไม่มี tier = ระดับกลางเท่าเหลือง ไม่ใช่ท้ายแถว', () => {
    // งานจากหน้า Follow กับคนที่เจ้าหน้าที่ติ๊กเองไม่มีคะแนน AI —
    // ดันไปท้ายแถวจะถ่วงงานด่วนทันทีที่เปิดใช้ โดยไม่มีใครสั่ง
    expect(matchRankFromTier(null)).toBe(matchRankFromTier('yellow'));
    expect(matchRankFromTier(undefined)).toBe(MATCH_RANK_UNKNOWN);
    expect(matchRankFromTier('')).toBe(MATCH_RANK_UNKNOWN);
    expect(matchRankFromTier('มั่ว')).toBe(MATCH_RANK_UNKNOWN);
  });

  it('⚠️ ต้องเป็นตัวเลขจริงเสมอ ห้ามคืน null/NaN — คิวรีเอาไปเทียบแบบ row comparison', () => {
    for (const v of ['green', 'yellow', 'red', null, undefined, '', 'GREEN', 0 as unknown as string]) {
      const r = matchRankFromTier(v as string | null | undefined);
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
    }
  });

  it('ตัวพิมพ์ใหญ่ไม่ถือว่ารู้จัก (ค่าจริงจาก AI เป็นตัวเล็กเสมอ — เดาให้จะกลบบั๊กข้อมูล)', () => {
    expect(matchRankFromTier('GREEN')).toBe(MATCH_RANK_UNKNOWN);
  });
});

describe('matchRankLabel — บอกเหตุผลที่คนนี้ถูกโทรก่อน', () => {
  it('สามระดับพูดคนละอย่าง และไม่มีอันไหนว่าง', () => {
    const labels = ['green', 'yellow', 'red', null].map((t) => matchRankLabel(t));
    expect(new Set(labels).size).toBe(4);
    for (const l of labels) expect(l.length).toBeGreaterThan(0);
  });

  it('เขียวต้องสื่อว่าได้ก่อน · ไม่มีคะแนนต้องบอกว่าอยู่ระดับกลาง (ไม่ใช่ "แย่")', () => {
    expect(matchRankLabel('green')).toContain('ก่อน');
    expect(matchRankLabel(null)).toContain('กลาง');
  });
});
