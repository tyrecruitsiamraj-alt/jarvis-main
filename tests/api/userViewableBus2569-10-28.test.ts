import { describe, expect, it } from 'vitest';
import { lockedBuOf, viewableBusOf } from '../../src/lib/userViewableBus';

// เจ้าของ 28 ต.ค. 2569 "sirirat.j เขาบอกทำไมไม่เห็นของ bu อื่น" — ตั้งดูเพิ่มแล้วแต่หน้าเว็บล็อก BU หลักอย่างเดียว
describe('BU ที่ผู้ใช้ดูได้ (หน้าเว็บ)', () => {
  it('BU หลัก + ดูเพิ่ม = ดูหลาย BU ไม่ล็อก', () => {
    const u = { role: 'supervisor' as const, department_code: 'LBD', extra_department_codes: ['SN', 'DS', 'LM', 'LBA'] };
    expect(viewableBusOf(u)).toEqual(['LBD', 'SN', 'DS', 'LM', 'LBA']);
    expect(lockedBuOf(u)).toBeNull();
  });
  it('BU เดียว = ล็อก · admin = ทุก BU · ไม่มี BU หลัก = ไม่เห็น', () => {
    expect(lockedBuOf({ role: 'staff', department_code: 'lba', extra_department_codes: [] })).toBe('LBA');
    expect(viewableBusOf({ role: 'admin', department_code: 'LBD', extra_department_codes: [] })).toBeNull();
    expect(viewableBusOf({ role: 'staff', department_code: undefined, extra_department_codes: ['LBD'] })).toEqual([]);
  });
  it('/api/auth/me ส่ง BU ดูเพิ่ม · หน้าเว็บอ่านเข้า user', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('api/_handlers/auth/me.ts', 'utf8')).toContain('extra_department_codes: (row.extra_department_codes ?? [])');
    expect(readFileSync('src/contexts/AuthContext.tsx', 'utf8')).toContain('extra_department_codes: Array.isArray(raw.extra_department_codes)');
    expect(readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8')).toContain('const lockedDepartmentCode = lockedBuOf(user);');
  });
});
