import { describe, expect, it } from 'vitest';
import {
  buildBoardUnitOptions,
  filterBoardUnits,
  unitSearchBlob,
  type BoardUnitOption,
} from '@/lib/boardUnitPicker';
import type { JobRequest } from '@/types';

const job = (over: Partial<JobRequest> = {}): JobRequest =>
  ({
    id: 'siamraj-sql:OPL6908001',
    request_no: 'OPL6908001',
    unit_name: 'ฮอนด้า',
    site_code: '69LBD0001',
    position_units: 2,
    job_description_code_1: 'พนักงานขับรถ',
    job_type: 'driver',
    job_category: 'staffing',
    status: 'open',
    required_date: '2026-09-01',
    ...over,
  }) as unknown as JobRequest;

describe('buildBoardUnitOptions', () => {
  it('ยุบใบขอหลายใบของไซต์เดียวเป็นหน่วยงานเดียว + รวมอัตรา', () => {
    const units = buildBoardUnitOptions([
      job({ request_no: 'OPL6908001', position_units: 2 }),
      job({ request_no: 'OPL6908002', position_units: 3, job_description_code_1: 'ธุรการ' }),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].siteCode).toBe('69LBD0001');
    expect(units[0].openRequests).toBe(2);
    expect(units[0].remainingPositions).toBe(5);
    expect(units[0].roles).toEqual(['พนักงานขับรถ', 'ธุรการ']);
  });

  it('🔴 ใบขอที่ไม่มีรหัสไซต์ต้องตกไป — เลือกแล้วระบุหน่วยงานไม่ได้อยู่ดี', () => {
    const units = buildBoardUnitOptions([
      job({ site_code: '' }),
      job({ site_code: undefined }),
      job({ site_code: '   ' }),
    ]);
    expect(units).toEqual([]);
  });

  it('คนละไซต์ = คนละหน่วยงาน แม้ชื่อจะเหมือนกัน', () => {
    const units = buildBoardUnitOptions([
      job({ site_code: 'A1', unit_name: 'สยามราชธานี', position_units: 1 }),
      job({ site_code: 'A2', unit_name: 'สยามราชธานี', position_units: 4 }),
    ]);
    expect(units.map((u) => u.siteCode)).toEqual(['A2', 'A1']);
  });

  it('เรียงอัตราที่ยังต้องหามากสุดก่อน · เท่ากันเรียงชื่อไทย', () => {
    const units = buildBoardUnitOptions([
      job({ site_code: 'S1', unit_name: 'ขนส่ง', position_units: 1 }),
      job({ site_code: 'S2', unit_name: 'กรุงเทพ', position_units: 1 }),
      job({ site_code: 'S3', unit_name: 'โตโยต้า', position_units: 9 }),
    ]);
    expect(units.map((u) => u.unitName)).toEqual(['โตโยต้า', 'กรุงเทพ', 'ขนส่ง']);
  });

  it('อัตราที่หายไป/ไม่ใช่ตัวเลข นับเป็น 0 ไม่ใช่ NaN', () => {
    const units = buildBoardUnitOptions([
      job({ position_units: undefined }),
      job({ request_no: 'X2', position_units: null as unknown as number }),
    ]);
    expect(units[0].remainingPositions).toBe(0);
  });

  it('เก็บได้ไม่เกิน 3 ตำแหน่ง และไม่ซ้ำ', () => {
    const units = buildBoardUnitOptions([
      job({ request_no: 'A', job_description_code_1: 'ขับรถ' }),
      job({ request_no: 'B', job_description_code_1: 'ขับรถ' }),
      job({ request_no: 'C', job_description_code_1: 'ธุรการ' }),
      job({ request_no: 'D', job_description_code_1: 'ช่าง' }),
      job({ request_no: 'E', job_description_code_1: 'แม่บ้าน' }),
    ]);
    expect(units[0].roles).toEqual(['ขับรถ', 'ธุรการ', 'ช่าง']);
  });

  it('เลขที่ใบตัวอย่าง = ใบ**แรก**ที่เจอ ห้ามถูกใบหลังทับ · ไม่มีเลขเลย = null', () => {
    expect(buildBoardUnitOptions([job()])[0].sampleRequestNo).toBe('OPL6908001');
    expect(
      buildBoardUnitOptions([
        job({ request_no: 'OPL6908001' }),
        job({ request_no: 'OPL6908002' }),
        job({ request_no: 'OPL6908003' }),
      ])[0].sampleRequestNo,
    ).toBe('OPL6908001');
    // ใบแรกไม่มีเลข ใบถัดมามี → เก็บของใบที่มีจริง (ไม่ค้างเป็น null)
    expect(
      buildBoardUnitOptions([job({ request_no: '' }), job({ request_no: 'OPL6908009' })])[0]
        .sampleRequestNo,
    ).toBe('OPL6908009');
    expect(buildBoardUnitOptions([job({ request_no: '' })])[0].sampleRequestNo).toBeNull();
  });
});

describe('filterBoardUnits', () => {
  const units: BoardUnitOption[] = buildBoardUnitOptions([
    job({ site_code: '69LBD0001', unit_name: 'ฮอนด้า', job_description_code_1: 'พนักงานขับรถ' }),
    job({ site_code: '69LBA0002', unit_name: 'ทาทา สตีล', request_no: 'LAO6907002', job_description_code_1: 'ธุรการ' }),
  ]);

  it('ค้นด้วยชื่อ / รหัสไซต์ / เลขที่ใบ / ตำแหน่ง ได้หมด', () => {
    expect(filterBoardUnits(units, 'ฮอนด้า').map((u) => u.siteCode)).toEqual(['69LBD0001']);
    expect(filterBoardUnits(units, '69LBA0002').map((u) => u.unitName)).toEqual(['ทาทา สตีล']);
    expect(filterBoardUnits(units, 'LAO6907002').map((u) => u.unitName)).toEqual(['ทาทา สตีล']);
    expect(filterBoardUnits(units, 'ธุรการ').map((u) => u.unitName)).toEqual(['ทาทา สตีล']);
  });

  it('หลายคำต้องเจอครบทุกคำ (AND)', () => {
    expect(filterBoardUnits(units, 'ทาทา ธุรการ')).toHaveLength(1);
    expect(filterBoardUnits(units, 'ทาทา ขับรถ')).toHaveLength(0);
  });

  it('คำค้นว่าง = คืนทั้งหมด · limit ตัดจำนวนแถว', () => {
    expect(filterBoardUnits(units, '   ')).toHaveLength(2);
    expect(filterBoardUnits(units, '', 1)).toHaveLength(1);
    expect(filterBoardUnits(units, 'ก', 1).length).toBeLessThanOrEqual(1);
  });

  it('blob เป็นตัวพิมพ์เล็ก — ค้นด้วยตัวใหญ่ก็เจอ', () => {
    expect(unitSearchBlob(units[0])).toBe(unitSearchBlob(units[0]).toLowerCase());
    expect(filterBoardUnits(units, 'lao6907002')).toHaveLength(1);
  });
});
