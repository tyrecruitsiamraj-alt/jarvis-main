/**
 * แผนกของใบที่เจ้าหน้าที่คีย์ = แผนกของใบขอ (เจ้าของ 18 พ.ย. 2569 "ติดตามใบขอ + แก้ของเก่า")
 * เดิมคน LBD คีย์ให้ใบขอ LBA 515 ใบ ติด LBD หมด ⇒ หัวหน้า LBD เห็น/เก็บงาน LBA
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a), isPgUndefinedTable: () => false }));

const { staffEntryDepartmentFor } = await import('../../api/_lib/applicationDepartment');

beforeEach(() => dbQuery.mockReset());

describe('staffEntryDepartmentFor', () => {
  it('ผูกใบขอ = BU จากรหัสไซต์ของใบขอก่อน (19 พ.ย. 2569) — LMO6911010 ไซต์ 69LML0022 = LM แม้คนคีย์อยู่ LBD', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ site_code: '69LML0022' }] });
    expect(await staffEntryDepartmentFor('siamraj-sql:LMO6911010', 'LBD')).toBe('LM');
  });
  it('ไม่รู้ไซต์ = แผนกจากประกาศของใบขอ', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ department_code: 'LBA' }] });
    expect(await staffEntryDepartmentFor('siamraj-sql:LAO6911001', 'LBD')).toBe('LBA');
  });
  it('ไม่รู้ทั้งไซต์และประกาศ = แผนกของคนคีย์', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    expect(await staffEntryDepartmentFor('siamraj-sql:OPL6907053', 'LBD')).toBe('LBD');
  });
  it('migration 189 แก้ใบที่ไม่มีประกาศ — เก็บค่าเดิมไว้ย้อนกลับ', () => {
    const sql = readFileSync('migrations/189_application_department_site_bu.sql', 'utf8');
    expect(sql).toContain('application_department_fix_189');
    expect(sql).toContain("when 'LML' then 'LM'");
  });
  it('ไม่ผูกใบขอ = แผนกของคนคีย์ ไม่ถามฐาน', async () => {
    expect(await staffEntryDepartmentFor(null, 'LBD')).toBe('LBD');
    expect(dbQuery).not.toHaveBeenCalled();
  });
  it('ทุกทางคีย์ใช้ตัวเดียวกัน + migration แก้ของเก่าเก็บค่าเดิมไว้ย้อนกลับ', () => {
    for (const f of ['api/_handlers/job-applications.ts', 'api/_handlers/job-applications-import.ts', 'api/_handlers/scrap-candidates.ts']) {
      expect(readFileSync(f, 'utf8')).toContain('staffEntryDepartmentFor');
    }
    const sql = readFileSync('migrations/187_application_department_follow_request.sql', 'utf8');
    expect(sql).toContain('application_department_fix_187');
    expect(sql).toContain('old_department_code');
  });
});
