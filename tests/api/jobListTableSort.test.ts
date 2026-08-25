import { describe, it, expect } from 'vitest';
import {
  JOB_LIST_TABLE_COLUMNS,
  JOB_LIST_TABLE_COLUMN_LABEL,
  compareJobsByTableColumn,
  defaultDirForColumn,
  parseTableSort,
  serializeTableSort,
  sortJobsByTableColumn,
  toggleTableSort,
} from '@/lib/jobListTableSort';
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
    request_date: '2026-01-15',
    created_at: '2026-01-15T00:00:00.000Z',
    ...partial,
  };
}

const ids = (rows: JobRequest[]) => rows.map((r) => r.id);

/**
 * เจ้าของสั่ง 20 ส.ค. 2569: กดหัวคอลัมน์เพื่อเลือกการเรียง + *"เช็คด้วยว่ารันเรียงตามที่เลือกจริงไหม"*
 * เทสต์ชุดนี้คือตัวพิสูจน์ว่า "เลือกอะไร ได้อันนั้นจริง" ทุกคอลัมน์
 */
describe('jobListTableSort', () => {
  it('ทุกคอลัมน์มีป้ายชื่อบนจอครบ (เพิ่มคอลัมน์แล้วลืมป้าย เทสต์จับได้)', () => {
    for (const c of JOB_LIST_TABLE_COLUMNS) {
      expect(JOB_LIST_TABLE_COLUMN_LABEL[c], c).toBeTruthy();
    }
  });

  it('เรียงเลขที่ใบขอจากมากไปน้อยได้จริง (คำสั่งตรงของเจ้าของ)', () => {
    const jobs = [
      job({ id: 'a', request_no: 'OPL6908001' }),
      job({ id: 'b', request_no: 'OPL6908010' }),
      job({ id: 'c', request_no: 'OPL6908002' }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'request_no', dir: 'desc' }))).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(ids(sortJobsByTableColumn(jobs, { column: 'request_no', dir: 'asc' }))).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('คงเหลือ (ตัวเลข) เรียงมาก→น้อย และ น้อย→มาก', () => {
    const jobs = [
      job({ id: 'few', request_positions: 2, filled_positions: 1, position_units: 1 }),
      job({ id: 'many', request_positions: 9, filled_positions: 0, position_units: 9 }),
      job({ id: 'mid', request_positions: 5, filled_positions: 0, position_units: 5 }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'remaining', dir: 'desc' }))).toEqual([
      'many',
      'mid',
      'few',
    ]);
    expect(ids(sortJobsByTableColumn(jobs, { column: 'remaining', dir: 'asc' }))).toEqual([
      'few',
      'mid',
      'many',
    ]);
  });

  it('วันที่ต้องการเรียงตามเวลาจริง ไม่ใช่ตามข้อความที่โชว์', () => {
    const jobs = [
      job({ id: 'mar', request_no: 'A1', required_date: '2026-03-01' }),
      job({ id: 'jan', request_no: 'A2', required_date: '2026-01-31' }),
      job({ id: 'feb', request_no: 'A3', required_date: '2026-02-10' }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'required', dir: 'asc' }))).toEqual([
      'jan',
      'feb',
      'mar',
    ]);
  });

  it('วันที่กรอกเรียงจากใหม่สุดก่อนเมื่อเลือก desc', () => {
    const jobs = [
      job({ id: 'old', request_no: 'B1', request_date: '2026-01-01' }),
      job({ id: 'new', request_no: 'B2', request_date: '2026-08-01' }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'submitted', dir: 'desc' }))).toEqual([
      'new',
      'old',
    ]);
  });

  it('ข้อความไทยเรียงตามพจนานุกรมไทย', () => {
    const jobs = [
      job({ id: 'z', request_no: 'C1', unit_name: 'ฮอนด้า' }),
      job({ id: 'k', request_no: 'C2', unit_name: 'กันยงอีเลคทริก' }),
      job({ id: 't', request_no: 'C3', unit_name: 'โตโยต้า' }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'unit', dir: 'asc' }))).toEqual(['k', 't', 'z']);
  });

  it('🔴 ค่าว่างตกท้ายเสมอ ทั้ง asc และ desc', () => {
    const jobs = [
      job({ id: 'empty', request_no: 'D1', resigned_employee_name: '' }),
      job({ id: 'has', request_no: 'D2', resigned_employee_name: 'สมชาย' }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'resigned', dir: 'asc' }))).toEqual([
      'has',
      'empty',
    ]);
    expect(ids(sortJobsByTableColumn(jobs, { column: 'resigned', dir: 'desc' }))).toEqual([
      'has',
      'empty',
    ]);
  });

  it('🔴 ลำดับนิ่ง — ค่าเท่ากันตัดด้วยเลขที่ใบขอ (ไม่งั้นกดหน้า 2 เห็นใบซ้ำ/หาย)', () => {
    const jobs = [
      job({ id: 'b', request_no: 'ZZZ002', unit_name: 'เท่ากัน' }),
      job({ id: 'a', request_no: 'ZZZ001', unit_name: 'เท่ากัน' }),
    ];
    expect(ids(sortJobsByTableColumn(jobs, { column: 'unit', dir: 'asc' }))).toEqual(['a', 'b']);
    expect(ids(sortJobsByTableColumn(jobs, { column: 'unit', dir: 'desc' }))).toEqual(['a', 'b']);
  });

  it('กดหัวคอลัมน์เดิมซ้ำ = สลับทิศ · คอลัมน์ใหม่ = ทิศตั้งต้นของคอลัมน์นั้น', () => {
    expect(toggleTableSort(null, 'request_no')).toEqual({ column: 'request_no', dir: 'asc' });
    expect(toggleTableSort({ column: 'request_no', dir: 'asc' }, 'request_no')).toEqual({
      column: 'request_no',
      dir: 'desc',
    });
    // ตัวเลข/วันที่เริ่มจากมากไปน้อย เพราะคนกดอยากเห็น "มากสุด/ล่าสุด" ก่อน
    expect(toggleTableSort(null, 'remaining')).toEqual({ column: 'remaining', dir: 'desc' });
    expect(defaultDirForColumn('age')).toBe('desc');
    expect(defaultDirForColumn('unit')).toBe('asc');
  });

  it('อ่าน/เขียนลง URL ได้ และค่าเพี้ยนคืน null (ไม่พัง)', () => {
    expect(serializeTableSort({ column: 'age', dir: 'desc' })).toBe('age:desc');
    expect(parseTableSort('age:desc')).toEqual({ column: 'age', dir: 'desc' });
    expect(parseTableSort('ไม่มีคอลัมน์นี้:asc')).toBeNull();
    expect(parseTableSort('age:sideways')).toBeNull();
    expect(parseTableSort(null)).toBeNull();
  });

  it('เทียบตรง ๆ ก็ได้ผลเดียวกับการ sort ทั้งชุด', () => {
    const a = job({ id: 'a', request_no: 'E1', position_units: 1, request_positions: 1 });
    const b = job({ id: 'b', request_no: 'E2', position_units: 5, request_positions: 5 });
    expect(compareJobsByTableColumn(a, b, { column: 'remaining', dir: 'desc' })).toBeGreaterThan(0);
    expect(compareJobsByTableColumn(a, b, { column: 'remaining', dir: 'asc' })).toBeLessThan(0);
  });
  /**
   * 🔴 บั๊กที่เจ้าของเจอ 20 ส.ค. 2569: *"เรียงมั่วมาก เดี๋ยว 0 เดี๋ยว ล่วงหน้า"*
   * ช่อง「ผ่านมา」โชว์คำว่า "ล่วงหน้า" สำหรับใบที่ยังไม่ถึงวันที่ต้องการ แต่เดิมเรียงด้วย
   * จำนวนวันนับจากวันที่กรอก → ใบล่วงหน้าไปแทรกกลางระหว่างเลข
   * กติกา: **เรียงตามสิ่งที่โชว์** · ใบล่วงหน้าต้องเกาะกลุ่มกันปลายเดียว
   */
  describe('คอลัมน์ "ผ่านมา" ต้องเรียงตามสิ่งที่โชว์', () => {
    const TODAY = new Date('2026-08-20T03:00:00.000Z');
    // ล่วงหน้า: กรอกไว้นาน (45 วัน) แต่ยังไม่ถึงวันที่ต้องการ → บนจอเขียน "ล่วงหน้า"
    const advanceFar = job({
      id: 'adv-far',
      request_no: 'F1',
      request_date: '2026-07-06',
      required_date: '2026-12-01',
    });
    const advanceNear = job({
      id: 'adv-near',
      request_no: 'F2',
      request_date: '2026-07-06',
      required_date: '2026-08-25',
    });
    // ผ่านมาแล้ว: เลยวันที่ต้องการ
    const past0 = job({ id: 'p0', request_no: 'F3', request_date: '2026-08-01', required_date: '2026-08-20' });
    const past5 = job({ id: 'p5', request_no: 'F4', request_date: '2026-08-01', required_date: '2026-08-15' });

    it('asc: ใบล่วงหน้าอยู่กลุ่มเดียวกันหน้าสุด แล้วค่อยไล่ 0 → มาก', () => {
      const out = ids(
        sortJobsByTableColumn([past5, advanceNear, past0, advanceFar], { column: 'age', dir: 'asc' }, TODAY),
      );
      // ล่วงหน้าสองใบต้องติดกัน (ไกลกำหนดก่อน ใกล้กำหนดทีหลัง) แล้วจึงเป็นเลขวัน
      expect(out).toEqual(['adv-far', 'adv-near', 'p0', 'p5']);
    });

    it('desc: ผ่านมามากสุดก่อน · ใบล่วงหน้าไปอยู่ท้ายสุดเป็นกลุ่ม', () => {
      const out = ids(
        sortJobsByTableColumn([advanceNear, past0, advanceFar, past5], { column: 'age', dir: 'desc' }, TODAY),
      );
      expect(out).toEqual(['p5', 'p0', 'adv-near', 'adv-far']);
    });

    it('🔴 ห้ามมีใบล่วงหน้าแทรกกลางระหว่างเลขวัน', () => {
      const out = sortJobsByTableColumn(
        [past5, advanceNear, past0, advanceFar],
        { column: 'age', dir: 'asc' },
        TODAY,
      );
      const advanceFlags = out.map((j) => j.id.startsWith('adv'));
      // true ทั้งหมดต้องอยู่ติดกันเป็นก้อนเดียว (ไม่สลับ true/false/true)
      const blocks = advanceFlags.filter((v, i) => i === 0 || advanceFlags[i - 1] !== v).length;
      expect(blocks).toBe(2);
    });
  });
});

