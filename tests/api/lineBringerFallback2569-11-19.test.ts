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

describe('แก้ข้อมูลจาก LINE (เจ้าของ 19 พ.ย. 2569 "แก้ข้อมูลจาก line ด้วย")', () => {
  it('migration 192 เก็บค่าเดิมก่อนแก้ · แก้เฉพาะใบ LINE ที่ไม่มีลิงก์/คนคีย์/ผู้รับผิดชอบ · ไม่ลบแถว', () => {
    const m = readFileSync('migrations/192_line_application_responsible.sql', 'utf8');
    expect(m).toContain('create table if not exists application_responsible_fix_192');
    expect(m).toContain("(a.line_user_id is not null or a.referral_source = 'line_oa' or a.channel_label ilike '%Line AI%')");
    expect(m).toContain("and nullif(btrim(a.responsible_name), '') is null");
    expect(m).not.toMatch(/\bdelete\b|\bdrop\b|\btruncate\b/i);
  });
  it('ใบใหม่จาก LINE ได้ผู้รับผิดชอบหลังบันทึกใบ · พลาดแค่ log ใบไม่ล้ม', () => {
    const src = readFileSync('api/_handlers/public/apply.ts', 'utf8');
    expect(src).toContain("if (!v.linkId && v.jobId && (lineUserId || /line ai/i.test(channelLabel ?? ''))) {");
    expect(src).toContain(".catch((e: unknown) => logWarn('public_apply.line_responsible_failed'");
  });
});
