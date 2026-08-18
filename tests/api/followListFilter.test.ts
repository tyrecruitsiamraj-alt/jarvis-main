import { describe, it, expect } from 'vitest';
import {
  followLifecycleTab,
  filterFollowEntries,
  countFollowTabs,
  listFollowOwners,
  inTimeBand,
  type FollowFilter,
} from '../../src/lib/followListFilter';
import type { FollowEntry } from '../../src/lib/followApi';

/**
 * แยกหน้าตามสถานะ + filter ประจำวัน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-6)
 * 4 แท็บ: กำลังตาม/สำเร็จ/สิ้นสุด/ยกเลิก · filter วันที่/ช่วงเวลา/เจ้าของงาน
 */

let seq = 0;
function entry(over: Partial<FollowEntry>): FollowEntry {
  seq += 1;
  return {
    id: `id-${seq}`,
    recipient_name: 'สมชาย',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-08-18T09:00:00+07:00',
    created_by_name: 'คิว',
    created_at: '2026-08-17T09:00:00+07:00',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

describe('followLifecycleTab — รอบเดียวอยู่ได้แท็บเดียว', () => {
  it('ยังไม่ปิด ยังไม่ยกเลิก = กำลังตาม', () => {
    expect(followLifecycleTab(entry({}))).toBe('active');
  });

  it('ยกเลิกรายการ (ตัดสายก่อนถึงวัน) = ยกเลิก — เช็คก่อนสถานะปิดงาน', () => {
    expect(followLifecycleTab(entry({ cancelled: true }))).toBe('cancelled');
  });

  it('ปิดงาน ไปแล้ว/ถึงแล้ว/เสร็จสิ้น(เก่า) = สำเร็จ', () => {
    for (const o of ['went', 'arrived', 'done']) {
      expect(followLifecycleTab(entry({ completed_at: 'x', outcome_code: o }))).toBe('success');
    }
  });

  it('ปิดงาน ยกเลิกงาน/job_cancelled = ยกเลิก (คู่กับ entry.cancelled)', () => {
    expect(followLifecycleTab(entry({ completed_at: 'x', outcome_code: 'cancelled' }))).toBe('cancelled');
    expect(followLifecycleTab(entry({ completed_at: 'x', outcome_code: 'job_cancelled' }))).toBe('cancelled');
  });

  it('ปิดงาน ลา/เลื่อน/ไม่ไป/อื่นๆ = สิ้นสุด', () => {
    for (const o of ['leave', 'postponed', 'no_show_start', 'other']) {
      expect(followLifecycleTab(entry({ completed_at: 'x', outcome_code: o }))).toBe('ended');
    }
  });
});

describe('inTimeBand — เวลาไทย', () => {
  it('เช้า 06-12 · บ่าย 12-17 · เย็น 17-20 (ปลายเปิด)', () => {
    expect(inTimeBand('2026-08-18T09:00:00+07:00', 'morning')).toBe(true);
    expect(inTimeBand('2026-08-18T12:00:00+07:00', 'morning')).toBe(false); // 12:00 = บ่าย
    expect(inTimeBand('2026-08-18T12:00:00+07:00', 'afternoon')).toBe(true);
    expect(inTimeBand('2026-08-18T17:00:00+07:00', 'afternoon')).toBe(false);
    expect(inTimeBand('2026-08-18T18:00:00+07:00', 'evening')).toBe(true);
  });

  it('🔴 เทียบเป็นเวลาไทย — 02:00Z = 09:00 ไทย = เช้า', () => {
    expect(inTimeBand('2026-08-18T02:00:00Z', 'morning')).toBe(true);
  });

  it("band ว่าง = ผ่านทุกเวลา · อ่านเวลาไม่ได้ = ไม่ผ่าน (เมื่อระบุ band)", () => {
    expect(inTimeBand(null, '')).toBe(true);
    expect(inTimeBand(null, 'morning')).toBe(false);
  });
});

describe('filterFollowEntries — ทุกเงื่อนไข AND', () => {
  const base: FollowFilter = { tab: 'active', date: '', band: '', owner: '' };

  it('กรองด้วยแท็บก่อน', () => {
    const rows = [entry({}), entry({ cancelled: true }), entry({ completed_at: 'x', outcome_code: 'went' })];
    expect(filterFollowEntries(rows, { ...base, tab: 'active' })).toHaveLength(1);
    expect(filterFollowEntries(rows, { ...base, tab: 'cancelled' })).toHaveLength(1);
    expect(filterFollowEntries(rows, { ...base, tab: 'success' })).toHaveLength(1);
  });

  it('วันที่ + ช่วงเวลา + เจ้าของงาน รวมกัน', () => {
    const rows = [
      entry({ scheduled_at: '2026-08-18T09:00:00+07:00', created_by_name: 'คิว' }),
      entry({ scheduled_at: '2026-08-18T14:00:00+07:00', created_by_name: 'คิว' }), // บ่าย ตกไป
      entry({ scheduled_at: '2026-08-18T09:00:00+07:00', created_by_name: 'บี' }), // คนอื่น ตกไป
      entry({ scheduled_at: '2026-08-19T09:00:00+07:00', created_by_name: 'คิว' }), // คนละวัน ตกไป
    ];
    const out = filterFollowEntries(rows, {
      tab: 'active',
      date: '2026-08-18',
      band: 'morning',
      owner: 'คิว',
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(rows[0].id);
  });

  it('ช่องว่างทั้งหมด (นอกจากแท็บ) = เอาทุกรอบในแท็บนั้น', () => {
    const rows = [entry({}), entry({ scheduled_at: '2026-08-25T09:00:00+07:00', created_by_name: 'ใครก็ได้' })];
    expect(filterFollowEntries(rows, base)).toHaveLength(2);
  });
});

describe('countFollowTabs / listFollowOwners', () => {
  it('นับรอบต่อแท็บครบ ไม่ซ้ำ', () => {
    const rows = [
      entry({}),
      entry({}),
      entry({ cancelled: true }),
      entry({ completed_at: 'x', outcome_code: 'arrived' }),
      entry({ completed_at: 'x', outcome_code: 'leave' }),
    ];
    expect(countFollowTabs(rows)).toEqual({ active: 2, success: 1, ended: 1, cancelled: 1 });
  });

  it('รายชื่อเจ้าของงาน distinct + เรียง + ตัดว่าง', () => {
    const rows = [
      entry({ created_by_name: 'บี' }),
      entry({ created_by_name: 'คิว' }),
      entry({ created_by_name: 'คิว' }),
      entry({ created_by_name: '  ' }),
      entry({ created_by_name: null }),
    ];
    expect(listFollowOwners(rows)).toEqual(['คิว', 'บี']);
  });
});
