import { describe, it, expect } from 'vitest';
import {
  filterJobBoardRows,
  type JobBoardRowFilterState,
} from '../../src/lib/jobBoardRowFilter';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & Pick<JobRequest, 'id'>): JobRequest {
  return {
    unit_name: 'หน่วยงาน',
    location_address: '',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    job_type: 'driver',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const EMPTY: JobBoardRowFilterState = {
  search: '',
  provinceFilter: '',
  districtFilter: '',
  positionFilter: '',
  subtypeFilter: '',
  recruiterFilter: '',
  contractTypeFilter: '',
  drivingPositionGroup: false,
};

describe('filterJobBoardRows', () => {
  it('ไม่ตั้งตัวกรองเลย = ได้ครบทุกแถว', () => {
    const rows = [job({ id: 'a' }), job({ id: 'b' })];
    expect(filterJobBoardRows(rows, EMPTY).filtered).toHaveLength(2);
  });

  it('กรองจังหวัดจากที่อยู่', () => {
    const rows = [
      job({ id: 'bkk', location_address: 'แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร' }),
      job({ id: 'cnx', location_address: 'ตำบลสุเทพ อำเภอเมือง จังหวัดเชียงใหม่' }),
    ];
    const out = filterJobBoardRows(rows, { ...EMPTY, provinceFilter: 'เชียงใหม่' }).filtered;
    expect(out.map((j) => j.id)).toEqual(['cnx']);
  });

  it('กรองลักษณะงานย่อย', () => {
    const rows = [
      job({ id: 'a', job_description_code_2: 'ส่วนกลาง' }),
      job({ id: 'b', job_description_code_2: 'Valet Parking' }),
    ];
    const out = filterJobBoardRows(rows, { ...EMPTY, subtypeFilter: 'Valet Parking' }).filtered;
    expect(out.map((j) => j.id)).toEqual(['b']);
  });

  it('กรองเจ้าหน้าที่สรรหา + ประเภทสัญญา', () => {
    const rows = [
      job({ id: 'a', recruiter_name: 'ใหม่', contract_type_name: 'คนอย่างเดียว' }),
      job({ id: 'b', recruiter_name: 'เจมส์', contract_type_name: 'คน+รถ' }),
    ];
    expect(
      filterJobBoardRows(rows, { ...EMPTY, recruiterFilter: 'เจมส์' }).filtered.map((j) => j.id),
    ).toEqual(['b']);
    expect(
      filterJobBoardRows(rows, { ...EMPTY, contractTypeFilter: 'คนอย่างเดียว' }).filtered.map(
        (j) => j.id,
      ),
    ).toEqual(['a']);
  });

  it('คำค้นที่ตรงเป๊ะไม่ใช้ของใกล้เคียง', () => {
    const rows = [job({ id: 'a', unit_name: 'โตโยต้า มอเตอร์' }), job({ id: 'b', unit_name: 'ฮอนด้า' })];
    const out = filterJobBoardRows(rows, { ...EMPTY, search: 'ฮอนด้า' });
    expect(out.filtered.map((j) => j.id)).toEqual(['b']);
    expect(out.usedRelatedFallback).toBe(false);
  });

  // ⚠️ ชิป "ด่วน" (+ skipUrgencyChip) ถูกถอดทิ้งทั้งฟีเจอร์ 20 ส.ค. 2569 — เจ้าของสั่ง
  it('🔴 ตัวกรองใช้ได้กับใบที่ปิดแล้วเหมือนใบเปิด (กล่องปิดแล้ว/ยกเลิกกรองในหน้าเดิม)', () => {
    const closed = [
      job({ id: 'c1', status: 'closed', location_address: 'เขตบางนา กรุงเทพมหานคร' }),
      job({ id: 'c2', status: 'closed', location_address: 'อำเภอเมือง จังหวัดชลบุรี' }),
    ];
    const out = filterJobBoardRows(closed, { ...EMPTY, provinceFilter: 'ชลบุรี' }).filtered;
    expect(out.map((j) => j.id)).toEqual(['c2']);
  });
});
