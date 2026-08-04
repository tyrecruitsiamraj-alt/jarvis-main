import { describe, expect, it } from 'vitest';
import { ageUrgencyLevelFromDays, JOB_AGE_URGENCY_META } from '@/lib/jobUrgency';

/**
 * เกณฑ์ที่เจ้าของกำหนด: ≤7 วัน ยังไม่ด่วน · 8–30 เริ่มด่วน · 31–60 ด่วน · 60+ ด่วนมาก
 * ล็อกไว้เป็นเทสต์เพราะสีบนหน้า Matching ใช้ตัดสินใจว่าจะหยิบใบไหนทำก่อน
 */
describe('ageUrgencyLevelFromDays', () => {
  it('แบ่งระดับตามขอบเขตวันที่ตกลงกันไว้', () => {
    expect(ageUrgencyLevelFromDays(0)).toBe('fresh');
    expect(ageUrgencyLevelFromDays(7)).toBe('fresh');
    expect(ageUrgencyLevelFromDays(8)).toBe('warming');
    expect(ageUrgencyLevelFromDays(30)).toBe('warming');
    expect(ageUrgencyLevelFromDays(31)).toBe('urgent');
    expect(ageUrgencyLevelFromDays(60)).toBe('urgent');
    expect(ageUrgencyLevelFromDays(61)).toBe('critical');
    expect(ageUrgencyLevelFromDays(9999)).toBe('critical');
  });

  it('ไม่รู้อายุ → unknown (ต้องไม่เดาว่าเป็นสีเขียว ไม่งั้นใบที่ข้อมูลขาดจะดูเหมือนงานสบาย)', () => {
    expect(ageUrgencyLevelFromDays(null)).toBe('unknown');
    expect(ageUrgencyLevelFromDays(Number.NaN)).toBe('unknown');
  });

  it('ทุกระดับมีสี/ป้ายครบ (ไม่มีช่องว่างให้ UI พัง)', () => {
    for (const lv of ['fresh', 'warming', 'urgent', 'critical', 'unknown'] as const) {
      const meta = JOB_AGE_URGENCY_META[lv];
      expect(meta.label).toBeTruthy();
      expect(meta.barCls).toBeTruthy();
      expect(meta.chipCls).toBeTruthy();
      expect(meta.dotCls).toBeTruthy();
    }
  });
});
