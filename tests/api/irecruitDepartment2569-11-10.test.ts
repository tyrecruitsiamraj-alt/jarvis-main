// @vitest-environment node
/**
 * ใบที่ดึงจาก iRecruit ติดแผนกตามเจ้าหน้าที่ที่ดูแล (เจ้าของ 10 พ.ย. 2569 Choice "ตามแผนกของเจ้าหน้าที่ที่ดูแล")
 * เจอจริง: Supervisor LBD เห็นชิป iRecruit = 0 — ใบที่ดึงมาไม่มีแผนกและไม่ผูกใบขอ ⇒ คนที่ล็อกแผนกมองไม่เห็นเลย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplicationsListQuery } from '../../api/_handlers/job-applications';

describe('แผนกของใบ iRecruit', () => {
  it('เติมเฉพาะใบ iRecruit ที่ยังไม่มีแผนก · ไม่ผูกใบขอ · ชื่อตรงผู้ใช้ที่ได้แผนกเดียว · ไม่นับ Administrator · ไม่ทับของเดิม', () => {
    const src = readFileSync('api/_lib/irecruitApplicantImport.ts', 'utf8');
    const fn = src.slice(src.indexOf('export async function fillIrecruitDepartments'));
    for (const guard of [
      "a.created_by_name = '${IRECRUIT_IMPORT_CREATED_BY}' and a.job_id is null",
      "nullif(btrim(a.department_code), '') is null",
      "s.nd = 1 and s.k <> 'administrator'",
      'count(distinct btrim(u.department_code)) as nd',
      'coalesce(u.is_active, true)',
    ]) {
      expect(fn).toContain(guard);
    }
    // รันทุกรอบดึง (ใบเก่า + ใบที่เพิ่งดึง) และกลืน error ไม่ให้รอบดึงล้ม
    expect(src.match(/await fillIrecruitDepartments\(\)/g)?.length).toBe(2);
  });
  it('คนที่ล็อกแผนก: ใบ iRecruit ที่หาเจ้าหน้าที่ไม่เจอ (ไม่มีแผนก) = ทุกแผนกเห็น · ใบที่มีแผนกแล้วตามแผนกปกติ', () => {
    const q = buildApplicationsListQuery({ viewerId: 'u1', scopedJobIds: new Set(['siamraj-sql:OPL6911001']), viewerDepartment: ['LBD'] });
    expect(q.sql).toContain("department_code = any(");
    expect(q.sql).toContain("(created_by_name = 'iRecruit' and job_id is null and nullif(btrim(department_code), '') is null)");
    const admin = buildApplicationsListQuery({ viewerId: 'u1' });
    expect(admin.sql).not.toContain("created_by_name = 'iRecruit' and job_id is null");
  });
});
