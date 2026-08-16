/**
 * แยกเลนงานโทร (16 ส.ค. 2569: "งานคัดสรรก็ให้มีหน้าการติดต่อของเขาเอง ไม่ปนกัน")
 *
 * พังเงียบที่คุมไว้: จัดเลนผิดข้าง → งานโผล่หน้าคนละทีม แล้วไม่มีใครโทร
 * (ทั้งสองหน้าต่างคิดว่า "ไม่ใช่ของฉัน")
 */
import { describe, expect, it } from 'vitest';
import { CALL_LANE_LABEL, filterHoldsByLane, holdLane } from '@/lib/callLane';
import type { CallHoldSource } from '@/lib/callHoldsApi';

describe('holdLane — ตัดสินจากชนิดคน ไม่ใช่คนที่กดเก็บ', () => {
  it('iRecruit = คนยังไม่สมัคร → เลนสรรหา', () => {
    expect(holdLane('irecruit')).toBe('recruit');
  });

  it('คนบนบอร์ด + ใบสมัคร = คนสมัครแล้ว → เลนคัดสรร', () => {
    expect(holdLane('board')).toBe('selection');
    expect(holdLane('application')).toBe('selection');
  });

  it('ทุก source ต้องตกเลนใดเลนหนึ่ง — เพิ่ม source ใหม่แล้วลืมจัดเลน = เทสต์นี้เตือน', () => {
    const sources: CallHoldSource[] = ['board', 'irecruit', 'application'];
    for (const s of sources) {
      expect(['recruit', 'selection']).toContain(holdLane(s));
    }
  });
});

describe('filterHoldsByLane', () => {
  const holds = [
    { id: '1', source: 'irecruit' as CallHoldSource },
    { id: '2', source: 'board' as CallHoldSource },
    { id: '3', source: 'application' as CallHoldSource },
  ];

  it('สองเลนรวมกันได้ครบทุกแถว — ไม่มีใครหาย ไม่มีใครโผล่สองหน้า', () => {
    const recruit = filterHoldsByLane(holds, 'recruit');
    const selection = filterHoldsByLane(holds, 'selection');
    expect(recruit.map((h) => h.id)).toEqual(['1']);
    expect(selection.map((h) => h.id)).toEqual(['2', '3']);
    expect(recruit.length + selection.length).toBe(holds.length);
  });

  it('ไม่ส่ง lane = คืนทั้งหมด (พฤติกรรมเดิม)', () => {
    expect(filterHoldsByLane(holds, undefined)).toHaveLength(3);
  });

  it('ป้ายสองเลนต้องไม่ซ้ำกัน (ขึ้นหัวหน้าจอ)', () => {
    expect(CALL_LANE_LABEL.recruit).not.toBe(CALL_LANE_LABEL.selection);
  });
});
