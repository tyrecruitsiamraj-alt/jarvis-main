/**
 * ใบจากบอท LINE / สมัครเองหน้าเว็บ (ไม่มีลิงก์ ไม่มีคนคีย์) = เจ้าหน้าที่สรรหาของใบขอ
 * (เจ้าของ 19 พ.ย. 2569 "ทำไมพอเข้ามาทาง Line มันไม่ระบุเจ้าหน้าที่สรรหา" · Choice เจ้าหน้าที่สรรหาของใบขอ)
 * ลองกับฐานจริง (อ่านอย่างเดียว) 1–19 พ.ย.: OPL6905114 → แบงค์ · LBM6903002 → หมิว · คิวรี 0.8 วิ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('ใครเอาเข้ามา: ไม่มีลิงก์ ไม่มีคนคีย์', () => {
  it('ถอยไปเจ้าหน้าที่สรรหาของใบขอ (siamraj_unit_assignments) · ใบขอชั่วคราวคีย์ id เต็มมาก่อน', async () => {
    const { factsSql } = await import('../../api/_handlers/recruit-overview');
    const sql = factsSql();
    expect(sql).toMatch(/else coalesce\(nullif\(btrim\(a\.created_by_name\), ''\),\s*\(select nullif\(btrim\(ua\.recruiter_name\), ''\) from \S*siamraj_unit_assignments/);
    expect(sql).toContain("where ua.request_no in (split_part(a.job_id, ':', 2), a.job_id)");
    expect(readFileSync('src/components/recruit-rm/ApplicantInfoPanel.tsx', 'utf8')).toContain('show(applicantResponsibleName(a, jobRecruiter))');
  });
});
