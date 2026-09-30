/**
 * ข้อความในสีของแท่ง (รอบ 17 · 30 ก.ย. 2569)
 * 🔴 ด่าน: เจ้าของ *"ในการ์ดมีแค่เลขกับ % พอ เพราะคำอธิบายบอกหมดแล้ว"* ⇒ ในแท่งมีแค่เลข + % ไม่มีชื่อก้อน/BU ·
 *    ที่ไม่พอก็ลดลงเป็นบรรทัดเดียว → % อย่างเดียว → ไม่เขียน · สีเดียวเต็มแท่งที่เลขอยู่บนหัวแล้ว = ไม่ขึ้นเลขซ้ำ
 */
import { describe, expect, it } from 'vitest';
import { barLabelLines } from './barLabel';

describe('ข้อความในแท่ง — เลข + %', () => {
  it('สูงพอ = สองบรรทัด เลขบน % ล่าง', () => {
    expect(barLabelLines(92, 45, 60, 40)).toEqual(['92', '45%']);
    expect(barLabelLines(1234, 60, 60, 40)).toEqual(['1,234', '60%']);
  });

  it('สูงไม่พอสองบรรทัด = บรรทัดเดียว "เลข · %"', () => {
    expect(barLabelLines(92, 45, 80, 20)).toEqual(['92 · 45%']);
  });

  it('แคบ = % อย่างเดียว · เล็กเกิน/ไม่มีค่า = ไม่เขียน', () => {
    expect(barLabelLines(92, 45, 30, 20)).toEqual(['45%']);
    expect(barLabelLines(92, 45, 10, 40)).toEqual([]);
    expect(barLabelLines(92, 45, 80, 10)).toEqual([]);
    expect(barLabelLines(0, 0, 80, 40)).toEqual([]);
    expect(barLabelLines(5, 10, Number.NaN, 40)).toEqual([]);
  });

  it('สีเดียวเต็มแท่ง (เลขยอดอยู่บนหัวแล้ว) = % อย่างเดียว ไม่ขึ้นเลขเดียวกันซ้ำสองที่', () => {
    expect(barLabelLines(50, 100, 60, 120, true)).toEqual(['100%']);
  });

  it('🔴 ไม่มีชื่อก้อน/BU อยู่ในแท่ง (ป้ายสีด้านบนบอกแล้ว)', () => {
    for (const lines of [barLabelLines(92, 45, 200, 60), barLabelLines(92, 45, 200, 20)]) {
      expect(lines.join(' ')).not.toMatch(/AI|คน|โทร|LBD|BU/);
    }
  });
});
