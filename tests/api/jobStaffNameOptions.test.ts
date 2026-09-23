import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ลิสต์ผู้รับผิดชอบบนใบขอ **รวมชื่อจากสองที่** ระหว่างย้าย (เจ้าของสั่ง 23 ก.ย. 2569:
 * *"แล้วต่อไปหน้าใบขอจะเอาชื่อจากไหนมาให้เขาเลือก"* → ย้ายมาหน้าผู้ใช้งาน **ทำเป็นขั้น**)
 *
 * 🔴 กติกาที่ต้องไม่หลุด: **ชื่อเดิมห้ามหาย** ระหว่างทยอยกรอกหน้าผู้ใช้งาน
 */

type State = {
  directory: Array<{ name: string; phone: string; lanes: string[] }>;
  recruiters: string[];
  screeners: string[];
  opls: string[];
  onlines: string[];
  pickerExcludedRecruiters: string[];
  pickerExcludedScreeners: string[];
  pickerExcludedOpls: string[];
  pickerExcludedOnlines: string[];
};

let state: State | null = null;

vi.mock('@/lib/jobStaffRemote', () => ({
  getJobStaffApiCache: () => state,
}));

const {
  buildRecruiterNameOptions,
  buildScreenerNameOptions,
  buildOplNameOptions,
  buildOnlineNameOptions,
} = await import('../../src/lib/jobStaffNames');

const empty: State = {
  directory: [],
  recruiters: [],
  screeners: [],
  opls: [],
  onlines: [],
  pickerExcludedRecruiters: [],
  pickerExcludedScreeners: [],
  pickerExcludedOpls: [],
  pickerExcludedOnlines: [],
};

beforeEach(() => {
  state = { ...empty };
});

describe('ชื่อผู้รับผิดชอบบนใบขอ = หน้าทีม + หน้าผู้ใช้งาน + ชื่อที่โผล่บนใบขอจริง', () => {
  it('หน้าผู้ใช้งานยังว่าง = ได้ชื่อเท่าเดิมทุกประการ (ขั้นที่ 1 ต้องไม่เปลี่ยนอะไรเลย)', () => {
    state = { ...empty, recruiters: ['หมิว', 'คิว'] };
    expect(buildRecruiterNameOptions()).toEqual(['คิว', 'หมิว']);
  });

  it('ชื่อที่กรอกในหน้าผู้ใช้งานโผล่เพิ่ม โดยชื่อเดิมยังอยู่ครบ', () => {
    state = {
      ...empty,
      recruiters: ['หมิว'],
      directory: [{ name: 'ปู', phone: '', lanes: ['recruiter'] }],
    };
    expect(buildRecruiterNameOptions()).toEqual(['ปู', 'หมิว']);
  });

  it('ยังไม่ได้ใส่เบอร์ก็เลือกบนใบขอได้ — ใบขอใช้แค่ชื่อ', () => {
    state = { ...empty, directory: [{ name: 'กร', phone: '', lanes: ['screener'] }] };
    expect(buildScreenerNameOptions()).toEqual(['กร']);
  });

  it('ชื่อเดียวกันในสองที่ = ชื่อเดียว (เทียบไม่สนตัวพิมพ์)', () => {
    state = {
      ...empty,
      screeners: ['Cream'],
      directory: [{ name: 'cream', phone: '0812345678', lanes: ['screener'] }],
    };
    expect(buildScreenerNameOptions()).toEqual(['Cream']);
  });

  it('แยกตามสายงาน — คนสาย opl ไม่ไปโผล่ในลิสต์สรรหา', () => {
    state = {
      ...empty,
      directory: [
        { name: 'เจมส์', phone: '', lanes: ['opl'] },
        { name: 'ปู', phone: '', lanes: ['recruiter', 'screener'] },
      ],
    };
    expect(buildOplNameOptions()).toEqual(['เจมส์']);
    expect(buildRecruiterNameOptions()).toEqual(['ปู']);
    expect(buildScreenerNameOptions()).toEqual(['ปู']);
    expect(buildOnlineNameOptions()).toEqual([]);
  });

  it('ชื่อที่แอดมินซ่อนไว้ ต้องถูกกรองทั้งจากหน้าทีมและหน้าผู้ใช้งาน', () => {
    state = {
      ...empty,
      recruiters: ['หมิว'],
      directory: [{ name: 'ปู', phone: '', lanes: ['recruiter'] }],
      pickerExcludedRecruiters: ['ปู', 'หมิว'],
    };
    expect(buildRecruiterNameOptions()).toEqual([]);
  });

  it('ชื่อที่ติดอยู่บนใบขอจริงแต่ไม่อยู่ในสองที่ ก็ยังต้องเลือกได้ (เจอจริง 3 ชื่อ)', () => {
    state = { ...empty, recruiters: ['หมิว'] };
    const jobs = [{ recruiter_name: 'พลอย' }, { recruiter_name: 'โจ้lba' }] as never;
    expect(buildRecruiterNameOptions(jobs)).toEqual(['โจ้lba', 'พลอย', 'หมิว']);
  });
});
