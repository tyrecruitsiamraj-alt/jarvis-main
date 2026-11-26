// @vitest-environment node
/**
 * กดส่ง AI ซ้ำแล้วไม่เข้าคิว เพราะเบอร์ถูกพัก — จอต้องบอกเหตุจริง + วันที่ AI โทรได้อีก
 * (เจ้าของ 26 พ.ย. 2569 · LAO6910013: คนที่บอก AI ว่าไม่สนใจ จอขึ้น "แจ้งว่าไม่หางานแล้ว / เบอร์เสีย" ทั้งที่ไม่ใช่ ·
 *  ทั้งระบบเบอร์พักเพราะไม่สนใจ 572 เบอร์)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { suppressionReasonText } from '../../src/lib/callFollowupPolicy';

describe('suppressionReasonText', () => {
  it('ไม่สนใจ = บอกตรง ๆ + วันที่ AI โทรได้อีก (เวลาไทย)', () => {
    expect(suppressionReasonText('declined', '2026-12-25T17:30:00Z')).toBe('เคยบอก AI ว่าไม่สนใจ · AI โทรได้อีก 26 ธ.ค.');
  });
  it('เหตุอื่นแยกคำ · ไม่ปนกันแบบเดิม', () => {
    expect(suppressionReasonText('not_looking', '2026-12-26T02:00:00Z')).toBe('แจ้งว่าไม่หางานแล้ว · AI โทรได้อีก 26 ธ.ค.');
    expect(suppressionReasonText('wrong_number', '2026-12-03T02:00:00Z')).toBe('เบอร์ผิด / ไม่ใช่เจ้าตัว · AI โทรได้อีก 3 ธ.ค.');
    expect(suppressionReasonText('pdpa', '2099-12-31T00:00:00Z')).toBe('ขอให้หยุดติดต่อ — AI ไม่โทร');
  });
  it('วันที่อ่านไม่ได้ = ไม่บอกวัน · ไม่รู้เหตุ = คำกลาง', () => {
    expect(suppressionReasonText('declined', 'x')).toBe('เคยบอก AI ว่าไม่สนใจ');
    expect(suppressionReasonText(null, null)).toBe('เบอร์นี้ถูกพักอยู่');
  });
  it('ตัวเข้าคิวใช้เหตุจริงทุกเส้น · คำเดิมที่ผิดหายแล้ว', () => {
    const src = readFileSync('api/_lib/lumosDispatch.ts', 'utf8');
    expect(src).not.toContain('แจ้งว่าไม่หางานแล้ว / เบอร์เสีย');
    expect((src.match(/suppressedWhy\.get\(ref\) \?\? SUPPRESSED_REASON/g) ?? []).length).toBe(6);
    expect(src).toContain('listSuppressedPhoneMap(');
  });
});
