import { describe, expect, it } from 'vitest';
import type { Employee } from '@/types';
import { countEmployeesByBu, filterEmployeesByBu } from '@/lib/wlBuFilters';

function emp(id: string, department_code?: string): Employee {
  return {
    id,
    employee_code: id,
    first_name: 'A',
    last_name: 'B',
    phone: '0',
    status: 'active',
    position: 'WL',
    join_date: '2026-01-01',
    reliability_score: 0,
    utilization_rate: 0,
    total_days_worked: 0,
    total_income: 0,
    total_cost: 0,
    total_issues: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...(department_code ? { department_code } : {}),
  };
}

describe('wlBuFilters', () => {
  const list = [emp('1', 'LBD'), emp('2', 'lba'), emp('3'), emp('4', 'LBD')];

  it('filters employees by normalized BU code', () => {
    expect(filterEmployeesByBu(list, 'LBD').map((e) => e.id)).toEqual(['1', '4']);
    expect(filterEmployeesByBu(list, 'LBA').map((e) => e.id)).toEqual(['2']);
  });

  it('ถัง unassigned = คนที่ยังไม่มีรหัส BU (ต้องเห็นเพื่อจะตั้งค่าให้ได้)', () => {
    expect(filterEmployeesByBu(list, 'unassigned').map((e) => e.id)).toEqual(['3']);
    // รหัสที่ไม่ใช่ของ WL ก็ถือว่ายังไม่ระบุ — ไม่ให้หลุดหายจากทุกถัง
    const withForeignCode = [...list, emp('5', 'DS')];
    expect(filterEmployeesByBu(withForeignCode, 'unassigned').map((e) => e.id)).toEqual(['3', '5']);
  });

  it('counts employees per BU รวมถัง unassigned', () => {
    expect(countEmployeesByBu(list)).toEqual({ LBD: 2, LBA: 1, unassigned: 1 });
    // ทุกคนต้องถูกนับที่ถังใดถังหนึ่งเสมอ — ผลรวมต้องเท่าจำนวนคนทั้งหมด
    const counts = countEmployeesByBu(list);
    expect(counts.LBD + counts.LBA + counts.unassigned).toBe(list.length);
  });
});
