// @vitest-environment node
/** แท็บการโทรบอกเหตุจริงที่งานหลุดจากมือ (เจ้าของ 11 พ.ย. 2569 "คืนงานไม่บันทึกผล คืออะไร" → Choice "บอกเหตุจริง") */
import { describe, expect, it } from 'vitest';
import { detailCallRows } from '@/lib/applicantDetail';

const hold = (id: string, release_reason: string | null, released = true) => ({
  id,
  held_at: `2026-11-0${id}T03:00:00Z`,
  held_by_name: 'อ้น',
  released_at: released ? '2026-11-10T03:00:00Z' : null,
  release_reason,
  outcome: null,
  note: null,
});

describe('เหตุที่คืนงาน', () => {
  it('หลุด 24 ชม. · ส่ง AI · กดคืน · หัวหน้าโอน · ไม่รู้เหตุ = คำเดิม · ยังถือ = ถือไว้โทรอยู่', () => {
    const rows = detailCallRows([], [hold('1', 'expired'), hold('2', 'to_ai'), hold('3', 'manual'), hold('4', 'transferred'), hold('5', null), hold('6', null, false)]);
    const by = Object.fromEntries(rows.map((r) => [r.key, r.result]));
    expect(by).toEqual({
      'staff-1': 'หลุด ครบ 24 ชม. ไม่ลงผล',
      'staff-2': 'ส่งให้ AI โทร',
      'staff-3': 'กดคืนงาน',
      'staff-4': 'หัวหน้าโอนงาน',
      'staff-5': 'คืนงานโดยไม่บันทึกผล',
      'staff-6': 'ถือไว้โทรอยู่',
    });
  });
});
