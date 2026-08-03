import { describe, it, expect } from 'vitest';
import { recommendedTarget, recommendedCount } from '../../api/_lib/boardCandidateMatcher';
import { boardColumnBadge } from '../../src/lib/lumosDispatchApi';

describe('recommendedTarget — เป้า = อัตราที่ขอ × 3 (กติกา 3 ส.ค. 2569)', () => {
  it('ขอ 3 อัตรา → ต้องหาให้ได้อย่างน้อย 9', () => {
    expect(recommendedTarget({ position_units: 3 })).toBe(9);
  });
  it('request_positions มาก่อน position_units (ฟิลด์เดียวกับหน้าจอ)', () => {
    expect(recommendedTarget({ request_positions: 5, position_units: 2 })).toBe(15);
  });
  it('ไม่ระบุ/ค่าเพี้ยน → ขั้นต่ำ 1 อัตรา = เป้า 3', () => {
    expect(recommendedTarget({})).toBe(3);
    expect(recommendedTarget({ position_units: 0 })).toBe(3);
    expect(recommendedTarget({ position_units: 'abc' })).toBe(3);
    expect(recommendedTarget({ position_units: null })).toBe(3);
  });
});

describe('recommendedCount — นับเฉพาะเขียว+เหลือง (แดงไม่นับเข้าเป้า)', () => {
  it('นับถูกและใช้ตัดสินว่าต้องค้นถังต่อไหม', () => {
    const matches = [
      { tier: 'green' as const },
      { tier: 'yellow' as const },
      { tier: 'red' as const },
      { tier: 'green' as const },
    ];
    expect(recommendedCount(matches)).toBe(3);
    // ขอ 1 อัตรา เป้า 3 → 3 คน = พอดี ไม่ต้องค้นถัง "ไม่มีงาน"
    expect(recommendedCount(matches) < recommendedTarget({ position_units: 1 })).toBe(false);
    // ขอ 2 อัตรา เป้า 6 → 3 คน = ไม่พอ ต้องค้นต่อ
    expect(recommendedCount(matches) < recommendedTarget({ position_units: 2 })).toBe(true);
  });
});

describe('boardColumnBadge — ป้ายบอกถังที่มา', () => {
  it('To do = ค่าปกติ ไม่ติดป้าย', () => {
    expect(boardColumnBadge('To do')).toBeNull();
    expect(boardColumnBadge(null)).toBeNull();
    expect(boardColumnBadge(undefined)).toBeNull();
  });
  it('ไม่มีงาน / Re Use มีป้ายชัดเจน', () => {
    expect(boardColumnBadge('ไม่มีงาน')?.text).toContain('รองาน');
    expect(boardColumnBadge('Re Use')?.text).toContain('Re Use');
    expect(boardColumnBadge('Re Use')?.text).toContain('เช็คสถานะ');
  });
});
