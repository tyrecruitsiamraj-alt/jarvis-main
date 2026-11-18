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
  it('ผูกใบขอ = แผนกของใบขอ แม้คนคีย์อยู่อีกแผนก', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ department_code: 'LBA' }] });
    expect(await staffEntryDepartmentFor('siamraj-sql:LAO6911001', 'LBD')).toBe('LBA');
  });
  it('ใบขอยังไม่มีประกาศที่บอกแผนก = แผนกของคนคีย์', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [] });
    expect(await staffEntryDepartmentFor('siamraj-sql:OPL6907053', 'LBD')).toBe('LBD');
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
