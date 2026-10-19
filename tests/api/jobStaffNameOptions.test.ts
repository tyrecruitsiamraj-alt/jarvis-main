import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ⚠️ ปิดขั้นย้ายแล้ว 19 ต.ค. 2569 — ตอนนี้ชื่อมาจากหน้าผู้ใช้งานที่เดียว (ดู describe แรก)
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

// 🔴 19 ต.ค. 2569 เจ้าของ "รายชื่อพวกเจ้าหน้าที่ก็ต้องมาจาก หน้าตั้งค่า ผู้ใช้งาน" — ปิดขั้นย้าย · รายชื่อทีมชุดเก่าไม่ใช้แล้ว
describe('ชื่อผู้รับผิดชอบบนใบขอ = หน้าผู้ใช้งานที่เดียว (+ ชื่อที่ติดบนใบขอจริง เฉพาะตัวกรอง)', () => {
  it('รายชื่อทีมชุดเก่าไม่ขึ้นแล้ว (ลบบัญชีในหน้าผู้ใช้งาน = หาย)', () => {
    state = { ...empty, recruiters: ['หมิว', 'ต่อ'] };
    expect(buildRecruiterNameOptions()).toEqual([]);
  });

  it('ชื่อที่ตั้งสายงานในหน้าผู้ใช้งานขึ้น · ชื่อทีมชุดเก่าไม่ปน', () => {
    state = {
      ...empty,
      recruiters: ['หมิว'],
      directory: [{ name: 'ปู', phone: '', lanes: ['recruiter'] }],
    };
    expect(buildRecruiterNameOptions()).toEqual(['ปู']);
  });

  it('ยังไม่ได้ใส่เบอร์ก็เลือกบนใบขอได้ — ใบขอใช้แค่ชื่อ', () => {
    state = { ...empty, directory: [{ name: 'กร', phone: '', lanes: ['screener'] }] };
    expect(buildScreenerNameOptions()).toEqual(['กร']);
  });

  it('ชื่อบนใบขอซ้ำกับหน้าผู้ใช้งาน = ชื่อเดียว (เทียบไม่สนตัวพิมพ์ · ใช้ตัวสะกดของหน้าผู้ใช้งาน)', () => {
    state = { ...empty, directory: [{ name: 'cream', phone: '0812345678', lanes: ['screener'] }] };
    expect(buildScreenerNameOptions([{ screener_name: 'Cream' }] as never)).toEqual(['cream']);
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

  it('ชื่อที่ติดอยู่บนใบขอจริงยังกรองได้ จนกว่าจะเปลี่ยนคน (Choice 19 ต.ค. 2569)', () => {
    state = { ...empty, recruiters: ['หมิว'] };
    const jobs = [{ recruiter_name: 'พลอย' }, { recruiter_name: 'โจ้lba' }] as never;
    expect(buildRecruiterNameOptions(jobs)).toEqual(['โจ้lba', 'พลอย']);
  });

  it('ช่องเลือกผู้รับผิดชอบไม่มีกล่องเพิ่ม/ลบรายชื่อทีมชุดเก่า · ถอดแท็บตั้งค่าทีมแล้ว', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const sel = readFileSync('src/components/jobs/RosterBackedStaffSelect.tsx', 'utf8');
    expect(sel).not.toContain('mutateJobStaffRemote');
    expect(sel).not.toContain('canManageRoster');
    expect(existsSync('src/pages/settings/JobStaffRosterTab.tsx')).toBe(false);
  });
});
