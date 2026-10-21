/**
 * ค้นเลขใบขอบนหน้าใบขอ — เลขท้ายเหมือนกันแต่ตัวอักษรนำหน้าคนละตัว ต้องไม่ขึ้น
 * (เจ้าของ 21 ต.ค. 2569: ค้น LBM6910003 แล้ว OPL/PEO/LAM/SQ/DSO6910003 ขึ้นมาด้วย "ก็งงดิ่")
 */
import { describe, expect, it } from 'vitest';
import { requestNoMatchesSearch } from '@/lib/siamrajRequestNo';

describe('requestNoMatchesSearch', () => {
  it('เลขเต็มตรงใบเดียว', () => {
    expect(requestNoMatchesSearch('LBM6910003', 'LBM6910003')).toBe(true);
    for (const other of ['OPL6910003', 'PEO6910003', 'LAM6910003', 'SQ6910003', 'DSO6910003']) {
      expect(requestNoMatchesSearch('LBM6910003', other)).toBe(false);
    }
  });
  it('ย่อตัวอักษรได้เหมือนเดิม · พิมพ์แค่ตัวเลขเจอทุกใบที่ลงท้ายเลขนี้', () => {
    expect(requestNoMatchesSearch('lm6905015', 'LBM6905015')).toBe(true);
    expect(requestNoMatchesSearch('6910003', 'OPL6910003')).toBe(true);
    expect(requestNoMatchesSearch('6910003', 'LBM6910003')).toBe(true);
    expect(requestNoMatchesSearch('ml6905015', 'LBM6905015')).toBe(false);
  });
  it('พิมพ์ส่วนต้น ๆ ยังเจอ', () => {
    expect(requestNoMatchesSearch('LBM691', 'LBM6910003')).toBe(true);
  });
});
