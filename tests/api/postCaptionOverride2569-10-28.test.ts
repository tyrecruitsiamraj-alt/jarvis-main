import { describe, expect, it } from 'vitest';
import { cleanFieldOverrides } from '../../api/_lib/siamrajUnitNotes';

/** ข้อความประกาศที่แก้ใน Autopost เก็บกับใบขอ (เจ้าของ 28 ต.ค. 2569) */
describe('field_overrides.post_caption', () => {
  it('ตัวกรองฝั่ง API รับ (คงขึ้นบรรทัด) · null = ล้าง', () => {
    const text = 'รับสมัครคนสวน\nมีโอที ขึ้นอยู่กับหน่วยงาน';
    expect(cleanFieldOverrides({ post_caption: text })?.post_caption).toBe(text);
    expect(cleanFieldOverrides({ post_caption: null })?.post_caption ?? null).toBe(null);
  });
});
