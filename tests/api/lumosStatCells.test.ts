import { describe, expect, it } from 'vitest';
import {
  LUMOS_FIXED_STAT_ORDER,
  lumosExtraStatChips,
  lumosFixedStatCells,
  lumosProgressChip,
} from '../../src/lib/lumosStatCells';
import type { LumosJobCallSummaryRow } from '../../src/lib/lumosDispatchApi';

function row(partial: Partial<LumosJobCallSummaryRow> = {}): LumosJobCallSummaryRow {
  return {
    pendingApproval: 0,
    sent: 0,
    called: 0,
    confirmed: 0,
    declined: 0,
    no_answer: 0,
    reschedule: 0,
    needsHuman: 0,
    ...partial,
  };
}

describe('lumosFixedStatCells — 6 ช่องเสมอ ไม่ว่าข้อมูลจะเป็นอะไร', () => {
  it('ไม่มีแถวสรุปเลย (undefined) ก็ยังได้ 6 ช่องเป็น 0', () => {
    const cells = lumosFixedStatCells(undefined);
    expect(cells).toHaveLength(6);
    expect(cells.every((c) => c.value === 0)).toBe(true);
  });

  it('เคสบั๊กเดิม: sent=0 และ pendingApproval=0 ต้องได้ 6 ช่อง ไม่ใช่แถบว่าง', () => {
    // ใบที่มีแถวในคิวแต่ถูกยกเลิกหมด → sent = 0 ทั้งที่ object มีอยู่
    // ของเดิม component คืน null ตรงนี้ → การ์ดขึ้นหัวข้อ "ผลโทรในใบนี้" แล้วใต้หัวข้อว่างเปล่า
    expect(lumosFixedStatCells(row({ sent: 0, pendingApproval: 0 }))).toHaveLength(6);
  });

  it('มีข้อมูลครบทุกช่องพิเศษ ก็ยังได้ 6 ช่องเท่าเดิม (ช่องพิเศษไม่เบียดเข้ามา)', () => {
    const cells = lumosFixedStatCells(
      row({ sent: 10, called: 4, confirmed: 1, declined: 1, no_answer: 2, pendingApproval: 3, reschedule: 2, needsHuman: 5 }),
    );
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.key)).not.toContain('pendingApproval');
  });

  it('ลำดับช่องตรงกับ LUMOS_FIXED_STAT_ORDER เป๊ะ — เลขต้องตรงคอลัมน์ข้ามการ์ด', () => {
    expect(lumosFixedStatCells(row({ sent: 5, called: 2 })).map((c) => c.key)).toEqual([
      ...LUMOS_FIXED_STAT_ORDER,
    ]);
    // ลำดับต้องไม่ขึ้นกับข้อมูล — ใบที่ว่างเปล่าก็ต้องเรียงแบบเดียวกัน
    expect(lumosFixedStatCells(undefined).map((c) => c.key)).toEqual([...LUMOS_FIXED_STAT_ORDER]);
  });

  it('เหลือ = ส่ง − โทรแล้ว', () => {
    const cells = lumosFixedStatCells(row({ sent: 31, called: 2 }));
    expect(cells.find((c) => c.key === 'waiting')?.value).toBe(29);
  });

  it('ข้อมูลเพี้ยน (โทรแล้ว > ส่ง) ต้องไม่โชว์เลขติดลบ', () => {
    const cells = lumosFixedStatCells(row({ sent: 2, called: 9 }));
    expect(cells.find((c) => c.key === 'waiting')?.value).toBe(0);
  });

  it('ทุกช่องมี label / tone / title ครบ (title คือคำอธิบายที่คนอ่านตอน hover)', () => {
    for (const c of lumosFixedStatCells(row({ sent: 1 }))) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.title.length).toBeGreaterThan(0);
      expect(typeof c.tone).toBe('string');
    }
  });
});

describe('lumosExtraStatChips — โผล่เฉพาะตอนมีค่า', () => {
  it('ไม่มีข้อมูล / เป็น 0 ทั้งสามตัว → ไม่มีชิป', () => {
    expect(lumosExtraStatChips(undefined)).toEqual([]);
    expect(lumosExtraStatChips(row())).toEqual([]);
  });

  it('คืนเฉพาะตัวที่ > 0', () => {
    expect(lumosExtraStatChips(row({ reschedule: 2 })).map((c) => c.key)).toEqual(['reschedule']);
    expect(lumosExtraStatChips(row({ needsHuman: 1 })).map((c) => c.key)).toEqual(['needsHuman']);
  });

  it('ลำดับคงที่: รออนุมัติ → ขอเลื่อน → ต้องคนตาม', () => {
    expect(lumosExtraStatChips(row({ pendingApproval: 1, reschedule: 1, needsHuman: 1 })).map((c) => c.key)).toEqual([
      'pendingApproval',
      'reschedule',
      'needsHuman',
    ]);
  });
});

describe('lumosProgressChip — ยอดคนในใบ ไม่ผูกกับผลโทรอีกแล้ว', () => {
  it('0/0/0 → ไม่มีชิป (เคสจริง 127 ใบบนฐาน)', () => {
    expect(lumosProgressChip({ contacted: 0, reserved: 0, placed: 0 })).toBeNull();
  });

  it('มีค่าแม้ช่องเดียวก็ต้องขึ้น (เคสจริง DS5812006 ที่เคยถูกกลบ)', () => {
    const chip = lumosProgressChip({ contacted: 1, reserved: 1, placed: 0 });
    expect(chip?.text).toBe('ติดต่อ 1 · จอง 1 · ลงงาน 0');
  });

  it('ค่าติดลบที่หลุดมาถือว่าไม่มี', () => {
    expect(lumosProgressChip({ contacted: -1, reserved: 0, placed: 0 })).toBeNull();
  });
});
