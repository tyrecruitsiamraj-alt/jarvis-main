import { describe, it, expect } from 'vitest';
import { JOB_LANES, JOB_LANE_LABEL, isJobLane, jobLanesText } from '../../src/lib/jobLanes';
import { parseAppUser } from '../../src/lib/userApi';

describe('สายงานของคนในระบบ (114)', () => {
  it('มี 4 สาย และมีคำไทยครบทุกสาย', () => {
    expect(JOB_LANES).toEqual(['recruiter', 'screener', 'opl', 'online']);
    for (const lane of JOB_LANES) expect(JOB_LANE_LABEL[lane]).toBeTruthy();
  });

  it('ค่าที่ไม่รู้จักไม่ผ่าน', () => {
    expect(isJobLane('recruiter')).toBe(true);
    expect(isJobLane('manager')).toBe(false);
    expect(isJobLane(null)).toBe(false);
  });

  it('🔴 ยังไม่ได้ตั้ง = เขียนว่า "ยังไม่ตั้ง" ไม่ใช่ "ไม่มีสายงาน"', () => {
    expect(jobLanesText([])).toBe('ยังไม่ตั้ง');
    expect(jobLanesText(undefined)).toBe('ยังไม่ตั้ง');
    expect(jobLanesText(['recruiter', 'opl'])).toBe('สรรหา · OPL');
    // ค่าเพี้ยนจากฐานถูกกรองทิ้ง ไม่พ่นรหัสดิบขึ้นจอ
    expect(jobLanesText(['recruiter', 'ผีหลอก'])).toBe('สรรหา');
  });
});

describe('parseAppUser — ช่องใหม่ต้องไม่ถูกทิ้ง', () => {
  const base = {
    id: 'u1',
    email: 'a@b.com',
    role: 'staff',
    is_active: true,
    created_at: '2026-09-01',
    full_name: 'A B',
  };

  it('🔴 ชื่อเล่น + สายงานผ่านตัวตรวจมาถึงจอ (เคยหายทั้งที่ฐานบันทึกแล้ว)', () => {
    const u = parseAppUser({ ...base, nickname: ' ครีม ', job_lanes: ['screener'] });
    expect(u?.nickname).toBe('ครีม');
    expect(u?.job_lanes).toEqual(['screener']);
  });

  it('ไม่ส่งมา = null / อาเรย์ว่าง (ไม่ใช่ undefined ให้จอเดาเอง)', () => {
    const u = parseAppUser(base);
    expect(u?.nickname).toBeNull();
    expect(u?.job_lanes).toEqual([]);
  });
});
