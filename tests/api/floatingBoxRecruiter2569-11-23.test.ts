/**
 * กล่องลอย: ผู้สรรหาของผู้สมัคร = เจ้าหน้าที่สรรหาที่เลือกตอน Gen link (เจ้าของ 23 พ.ย. 2569)
 * "เลือกชื่อแล้วแต่ชื่อคนสรรหาไม่วิ่งไปตามกล่องใครกล่องมัน" · "Gen link ของกล่องลอย ทำไมไม่ทำให้เหมือนกล่องปกติ
 * แค่ต้องเพิ่มชื่อเจ้าหน้าที่สรรหาเอง" · Choice "ชื่อที่เลือกตอน Gen link"
 * + คำบนจอ "ผู้รับผิดชอบ" ของใบสมัคร เปลี่ยนเป็น "คนนำเข้า"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applicantLinkRecruiter, applicantRecruiterName, applicantResponsibleName } from '../../src/lib/recruitRm';
import { linkRecruiterSql } from '../../api/_lib/recruitPostings';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ข้อมูลผู้สรรหาของใบสมัคร', () => {
  // ใบที่สมัครผ่านลิงก์ของกล่องลอย "ผู้บริหารคนไทย" (ไม่มีใบขอ)
  const floating = { recruiter_name: undefined, standalone_kind: 'exec_th', link_recruiter_name: 'คิว' };
  // ใบที่สมัครผ่านลิงก์ของใบขอ OPL6911081
  const bound = { recruiter_name: undefined, standalone_kind: undefined, link_recruiter_name: 'ว่าน' };

  it('กล่องลอย = ชื่อที่เลือกตอน Gen link (เดิมว่างเพราะไม่มีใบขอ)', () => {
    expect(applicantRecruiterName(floating, null)).toBe('คิว');
    expect(applicantLinkRecruiter(floating)).toBe('คิว');
  });
  it('ผูกใบขอ = เจ้าหน้าที่สรรหาของใบขอ ไม่ใช้ชื่อของลิงก์', () => {
    expect(applicantRecruiterName(bound, 'แบงค์')).toBe('แบงค์');
    expect(applicantRecruiterName(bound, null)).toBeNull();
    expect(applicantLinkRecruiter(bound)).toBeNull();
  });
  it('แก้รายคนไว้แล้ว = ใช้ที่แก้ ทั้งกล่องลอยและใบขอ', () => {
    expect(applicantRecruiterName({ ...floating, recruiter_name: ' เล็ก ' }, null)).toBe('เล็ก');
    expect(applicantRecruiterName({ ...bound, recruiter_name: 'เล็ก' }, 'แบงค์')).toBe('เล็ก');
  });
  it('🔴 ลิงก์ที่ไม่ได้เลือกเจ้าหน้าที่สรรหา = ว่าง · ไม่ถอยไปคนกด Gen link (ลิงก์เก่าคนกดคือทีม Online)', () => {
    const old = { recruiter_name: undefined, standalone_kind: 'exec_th', link_recruiter_name: undefined, posting_owner_name: 'เจมส์' };
    expect(applicantRecruiterName(old, null)).toBeNull();
    expect(applicantRecruiterName({ recruiter_name: undefined, standalone_kind: 'exec_th', link_recruiter_name: ' ' }, null)).toBeNull();
    const sql = linkRecruiterSql('a.link_id');
    expect(sql).toContain('lk.responsible_user_id');
    expect(sql).toContain('lk.responsible_name');
    expect(sql).not.toContain('created_by');
    const api = read('api/_handlers/job-applications.ts');
    expect(api).toContain("${linkRecruiterSql('a.link_id')} as link_recruiter_name");
    // ชั้นถอยของฐานเก่าต้องมีคอลัมน์นี้ครบ (ไม่งั้น union/ตัวอ่านพัง)
    expect(api.match(/null::text as link_recruiter_name/g)?.length).toBe(3);
  });
  it('คนนำเข้า (เดิมผู้รับผิดชอบ) ยังหาแบบเดิม: ที่เลือกตอนคีย์/นำเข้า › ลิงก์ › ใบขอ', () => {
    expect(applicantResponsibleName({ responsible_name: 'เจมส์', posting_owner_name: 'คิว' }, 'แบงค์')).toBe('เจมส์');
    expect(applicantResponsibleName({ responsible_name: undefined, posting_owner_name: 'คิว' }, 'แบงค์')).toBe('คิว');
    expect(applicantResponsibleName({ responsible_name: undefined, posting_owner_name: undefined }, 'แบงค์')).toBe('แบงค์');
  });
});

describe('จอที่ใช้กติกานี้', () => {
  it('คอลัมน์เจ้าของงาน/ตัวกรอง/รายงาน (RmWorkspace) และป๊อปผู้สมัคร ใช้ตัวเดียวกัน', () => {
    expect(read('src/components/recruit-rm/RmWorkspace.tsx')).toContain('applicantRecruiterName(r, jobRecruiterOf?.(r))');
    const panel = read('src/components/recruit-rm/ApplicantInfoPanel.tsx');
    expect(panel).toContain('show(applicantRecruiterName(a, recruiterName))');
    expect(panel).toContain('`ตามลิงก์ (${linkRecruiter})`');
  });
  it('คำบนจอของใบสมัคร = "คนนำเข้า" · ลิงก์ = "เจ้าหน้าที่สรรหา" (คำเดียวกับช่องในฟอร์ม Gen link)', () => {
    const panel = read('src/components/recruit-rm/ApplicantInfoPanel.tsx');
    expect(panel).toContain('<Field label="คนนำเข้า">');
    expect(panel).not.toContain('label="ผู้รับผิดชอบ"');
    expect(read('src/components/recruit-rm/AddApplicantDialog.tsx')).toContain('>คนนำเข้า</label>');
    expect(read('src/components/recruit-rm/ImportApplicantsDialog.tsx')).not.toMatch(/['">]\s*(เลือก)?ผู้รับผิดชอบ/);
    expect(read('src/lib/applicantExport.ts')).toContain("'คนนำเข้า',");
    expect(read('src/components/jobs/PostingLinksList.tsx')).toContain('เจ้าหน้าที่สรรหา ${owner}');
  });
});
