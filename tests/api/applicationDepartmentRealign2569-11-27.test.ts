// @vitest-environment node
/**
 * ชื่อที่ผูกใบขอ = BU ของใบขอเสมอ (เจ้าของ 27 พ.ย. 2569 "สถาปนิก · LAO6911033 แล้วทำไมโผล่ของ lbd" · Choice "แก้ทั้งคู่")
 * เจมส์ (LBD) คีย์ให้ใบ LBA ตอนระบบยังไม่รู้ไซต์ ⇒ ติด LBD · ตัวเทียบรอบ ๆ ปรับทุกครั้งที่จดรหัสไซต์ของใบขอ
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a), isPgUndefinedTable: () => false }));

describe('ตัวเทียบ BU ของใบสมัคร', () => {
  beforeEach(() => dbQuery.mockReset());
  it('ส่งเฉพาะใบขอที่รู้ BU จากรหัสไซต์ · LML → LM', async () => {
    dbQuery.mockResolvedValue({ rows: [{ id: 'c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c01' }] });
    const { realignApplicationDepartments } = await import('../../api/_lib/applicationDepartment');
    const n = await realignApplicationDepartments([
      { jobId: 'siamraj-sql:LAO6911033', siteCode: '69LBAL0084' },
      { jobId: 'siamraj-sql:LMO6911009', siteCode: '68LMLL0012' },
      { jobId: 'siamraj-pre:OPL6911201', siteCode: null },
    ]);
    expect(n).toBe(1);
    const [sql, params] = dbQuery.mock.calls[0] as [string, unknown[][]];
    expect(sql).toContain('a.department_code is distinct from t.bu');
    expect(params[0]).toEqual(['siamraj-sql:LAO6911033', 'siamraj-sql:LMO6911009']);
    expect(params[1]).toEqual(['LBA', 'LM']);
  });
  it('ฐานล้ม = คืน 0 ไม่โยน (feed ใบขอต้องไม่พัง) · ไม่มีใบที่รู้ BU = ไม่ยิงฐาน', async () => {
    const { realignApplicationDepartments } = await import('../../api/_lib/applicationDepartment');
    dbQuery.mockRejectedValue(new Error('boom'));
    await expect(realignApplicationDepartments([{ jobId: 'siamraj-sql:LAO6911033', siteCode: '69LBAL0084' }])).resolves.toBe(0);
    dbQuery.mockReset();
    await expect(realignApplicationDepartments([{ jobId: 'siamraj-sql:X', siteCode: null }])).resolves.toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
  });
  it('เรียกทุกครั้งที่จดรหัสไซต์ของใบขอ', () => {
    expect(readFileSync('api/_lib/jobSiteMap.ts', 'utf8')).toContain('await realignApplicationDepartments(rows.map((r) => ({ jobId: r.id, siteCode: r.site })));');
  });
});
