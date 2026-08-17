/**
 * ป้าย "ที่มาของคน" ฝั่งหน้าเว็บ (16 ส.ค. 2569) — นับ/กรอง/ป้าย
 *
 * พังเงียบที่คุมไว้: ใบที่ยังไม่รู้ที่มา (server เก่า) ถูกยัดรวมเป็น "สมัครใหม่"
 * → เลขบนชิปโกหกว่าคนสมัครเองเยอะกว่าความจริง
 */
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_ORIGIN_CLASS,
  APPLICATION_ORIGIN_HINT,
  APPLICATION_ORIGIN_LABEL,
  countApplicationsByOrigin,
  filterApplicationsByOrigin,
  isApplicationOrigin,
  type ApplicationOrigin,
} from '@/lib/publicApplicationsApi';

const row = (origin?: ApplicationOrigin) => ({ origin });

describe('countApplicationsByOrigin', () => {
  it('นับแยกครบ และคืนทุกช่องเสมอแม้เป็น 0', () => {
    expect(countApplicationsByOrigin([])).toEqual({
      self_apply: 0,
      ai_found: 0,
      staff_added: 0,
      unknown: 0,
    });
  });

  it('ใบที่ไม่รู้ที่มา ไปช่อง unknown ไม่ใช่ self_apply', () => {
    const c = countApplicationsByOrigin([row(), row('self_apply'), row('ai_found'), row()]);
    expect(c.unknown).toBe(2);
    expect(c.self_apply).toBe(1);
    expect(c.ai_found).toBe(1);
  });

  it('ยอดรวมทุกช่อง = จำนวนใบทั้งหมดเสมอ (ไม่มีใครหาย ไม่มีใครถูกนับซ้ำ)', () => {
    const items = [row('ai_found'), row('ai_found'), row('staff_added'), row(), row('self_apply')];
    const c = countApplicationsByOrigin(items);
    expect(c.self_apply + c.ai_found + c.staff_added + c.unknown).toBe(items.length);
  });

  it('ค่าที่ไม่รู้จักจาก server (สตริงแปลก) ไปช่อง unknown', () => {
    const c = countApplicationsByOrigin([{ origin: 'weird' as ApplicationOrigin }]);
    expect(c.unknown).toBe(1);
  });
});

describe('filterApplicationsByOrigin', () => {
  const items = [row('self_apply'), row('ai_found'), row('staff_added'), row()];

  it("'all' = ไม่กรอง (คืนก้อนเดิม)", () => {
    expect(filterApplicationsByOrigin(items, 'all')).toHaveLength(4);
  });

  it('กรองได้ตรงกลุ่ม', () => {
    expect(filterApplicationsByOrigin(items, 'ai_found')).toEqual([row('ai_found')]);
  });

  it('กรองกลุ่มไหนก็ไม่ติดใบที่ไม่รู้ที่มามาด้วย', () => {
    for (const o of ['self_apply', 'ai_found', 'staff_added'] as ApplicationOrigin[]) {
      expect(filterApplicationsByOrigin(items, o).every((x) => x.origin === o)).toBe(true);
    }
  });
});

describe('ป้าย/สี', () => {
  it('ป้ายเป็นคำที่เจ้าของใช้จริง', () => {
    expect(APPLICATION_ORIGIN_LABEL.self_apply).toBe('สมัครใหม่');
    expect(APPLICATION_ORIGIN_LABEL.ai_found).toBe('AI หาให้');
  });

  it('ทุกที่มามีป้าย + คำอธิบาย + สี ครบ และสีมีคู่ dark: (กติกาชิปของโปรเจกต์)', () => {
    for (const o of ['self_apply', 'ai_found', 'staff_added'] as ApplicationOrigin[]) {
      expect(APPLICATION_ORIGIN_LABEL[o]).toBeTruthy();
      expect(APPLICATION_ORIGIN_HINT[o]).toBeTruthy();
      expect(APPLICATION_ORIGIN_CLASS[o]).toContain('dark:');
    }
  });

  it('isApplicationOrigin กันค่าเพี้ยนจาก server', () => {
    expect(isApplicationOrigin('ai_found')).toBe(true);
    expect(isApplicationOrigin('')).toBe(false);
  });
});
