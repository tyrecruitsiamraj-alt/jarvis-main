import { describe, expect, it } from 'vitest';
import { EM_DASH, dashIfEmpty } from '../../src/lib/displayFallback';

describe('dashIfEmpty', () => {
  it('null / undefined / สตริงว่าง / เว้นวรรคล้วน → ขีด', () => {
    expect(dashIfEmpty(null)).toBe(EM_DASH);
    expect(dashIfEmpty(undefined)).toBe(EM_DASH);
    expect(dashIfEmpty('')).toBe(EM_DASH);
    expect(dashIfEmpty('   ')).toBe(EM_DASH);
  });

  it('เลข 0 ต้องได้ "0" ไม่ใช่ขีด — 0 คือคำตอบจริง ไม่ใช่ช่องว่าง', () => {
    // กับดักของ `v || EM_DASH`: น้ำหนัก/ส่วนสูง/จำนวน ที่เป็น 0 จะกลายเป็นขีดเงียบ ๆ
    expect(dashIfEmpty(0)).toBe('0');
  });

  it('ค่าปกติคืนตัวเอง (ตัดหัวท้ายให้)', () => {
    expect(dashIfEmpty('สมชาย')).toBe('สมชาย');
    expect(dashIfEmpty('  สมชาย  ')).toBe('สมชาย');
    expect(dashIfEmpty(42)).toBe('42');
    expect(dashIfEmpty(-1)).toBe('-1');
  });

  it('เลขที่ไม่ใช่ตัวเลขจริง (NaN / Infinity) ถือว่าไม่มีค่า', () => {
    expect(dashIfEmpty(Number.NaN)).toBe(EM_DASH);
    expect(dashIfEmpty(Number.POSITIVE_INFINITY)).toBe(EM_DASH);
  });

  it('ขีดที่ใช้เป็น em dash ตัวเดียวทั้งระบบ ไม่ใช่ hyphen', () => {
    // formatYmdDmyBe คืน ASCII '-' ซึ่งเป็นคนละตัว — จงใจไม่แก้ที่นั่น (มีเทสต์คุมและคนเรียกทั้งระบบ)
    expect(EM_DASH).toBe('—');
    expect(EM_DASH).not.toBe('-');
  });
});
