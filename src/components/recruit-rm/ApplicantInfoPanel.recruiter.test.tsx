/**
 * ป๊อปผู้สมัคร: "ข้อมูลผู้สรรหา" กับ "ผู้รับผิดชอบ" (เจ้าของ 16 ต.ค. 2569)
 * > *"เจ้าของงาน มีชื่อ แต่ ข้อมูลผู้สรรหา ไม่ขึ้นอะ … ผู้รับผิดชอบ ก็ไม่มีเนี่ย"*
 * > *"ผู้สรรหาก็พวก คิว แบงค์ไรนั่นไง · ผู้รับผิดชอบ ก็ทีม online อะ ว่าน เจมส์ ไรงี้"*
 *
 * - ข้อมูลผู้สรรหา = เจ้าหน้าที่สรรหาของใบขอ (ชื่อเดียวกับคอลัมน์ "เจ้าของงาน") — เดิมอ่าน `specific_type` ซึ่งผูกผิดความหมาย
 * - ผู้รับผิดชอบ = ที่เลือกตอนคีย์/นำเข้า → ผู้รับผิดชอบของลิงก์ที่สมัครเข้ามา (ทีม Online · ไม่ได้ตั้ง = คนสร้างลิงก์)
 * - ประเภทเจาะจง (`specific_type`) ถอดออกหมดแล้ว ทั้งป๊อป ตัวกรอง ไฟล์รายงาน ไฟล์นำเข้า (เจ้าของ 27 ต.ค. 2569 "ฉันบอกให้เอาออก")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApplicantInfoPanel from '@/components/recruit-rm/ApplicantInfoPanel';
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { profileDraftOf } from '@/lib/applicantProfileEdit';
import { applicantResponsibleName } from '@/lib/recruitRm';
import { APPLICANT_EXPORT_HEADERS, applicantExportRows } from '@/lib/applicantExport';
import { buildApplicantFacets, EMPTY_APPLICANT_FILTER_STATE } from '@/lib/applicantFilters';

const app = (over: Partial<PublicApplication> = {}): PublicApplication =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    full_name: 'นายทดสอบ ระบบ',
    first_name: 'ทดสอบ',
    last_name: 'ระบบ',
    phone: '0812345678',
    age: 33,
    gender: 'male',
    status: 'new',
    created_at: '2026-10-16T03:00:00.000Z',
    has_document: false,
    ...over,
  }) as PublicApplication;

/** ค่าของช่องที่มีป้ายนี้ในป๊อป */
const fieldValue = (label: string): string => {
  const p = screen.getByText(label, { selector: 'p' });
  return (p.nextElementSibling?.textContent ?? '').trim();
};

const renderPanel = (a: PublicApplication, recruiterName: string | null) =>
  render(
    <ApplicantInfoPanel
      application={a}
      editing={false}
      draft={profileDraftOf(a)}
      onDraft={() => {}}
      recruiterName={recruiterName}
    />,
  );

describe('ป๊อปผู้สมัคร: ข้อมูลผู้สรรหา · ผู้รับผิดชอบ · ประเภทเจาะจง', () => {
  it('🔴 ข้อมูลผู้สรรหา = เจ้าหน้าที่สรรหาของใบขอ · ผู้รับผิดชอบ = ทีม Online ของลิงก์', () => {
    renderPanel(app({ posting_owner_name: 'เจ้าหน้าที่ออนไลน์ ก' }), 'เจ้าหน้าที่สรรหา ก');
    expect(fieldValue('ข้อมูลผู้สรรหา')).toBe('เจ้าหน้าที่สรรหา ก');
    expect(fieldValue('ผู้รับผิดชอบ')).toBe('เจ้าหน้าที่ออนไลน์ ก');
    expect(screen.queryByText('ประเภทเจาะจง')).toBeNull();
  });

  it('ผู้รับผิดชอบที่เลือกตอนคีย์มาก่อนของลิงก์ · ประเภทเจาะจงไม่ขึ้นที่ไหนในป๊อป', () => {
    renderPanel(
      app({ responsible_name: 'คนคีย์ ก', posting_owner_name: 'เจ้าหน้าที่ออนไลน์ ก', specific_type: 'เจาะจง (ฟรี)' }),
      null,
    );
    expect(fieldValue('ข้อมูลผู้สรรหา')).toBe('—');
    expect(fieldValue('ผู้รับผิดชอบ')).toBe('คนคีย์ ก');
    expect(screen.queryByText('เจาะจง (ฟรี)')).toBeNull();
  });

  it('ไม่มีข้อมูล = ขีด (ช่องไม่หาย)', () => {
    renderPanel(app(), null);
    for (const label of ['ข้อมูลผู้สรรหา', 'ผู้รับผิดชอบ']) expect(fieldValue(label)).toBe('—');
  });
});

describe('applicantResponsibleName', () => {
  it('คีย์เอง → ลิงก์ → null · ตัดช่องว่าง', () => {
    expect(applicantResponsibleName({ responsible_name: ' ก ', posting_owner_name: 'ข' })).toBe('ก');
    expect(applicantResponsibleName({ responsible_name: '  ', posting_owner_name: ' ข ' })).toBe('ข');
    expect(applicantResponsibleName({})).toBeNull();
  });
});

describe('ทุกจุดใช้ความหมายเดียวกัน', () => {
  it('server ส่งผู้รับผิดชอบของลิงก์มากับรายชื่อ (ชุดคอลัมน์ 2 ชั้นบน) · ไม่ได้ตั้ง = ชื่อเล่นคนสร้างลิงก์', () => {
    const src = readFileSync('api/_handlers/job-applications.ts', 'utf8');
    expect(src.match(/\$\{POSTING_OWNER_SQL\},/g)?.length).toBe(2);
    expect(src).toContain("coalesce(nullif(btrim(p.responsible_name), ''), nullif(btrim(u.nickname), ''), nullif(btrim(u.full_name), ''))");
    expect(src).toContain('posting_owner_name: r.posting_owner_name || undefined,');
    // สมัครผ่านหน้าประกาศโดยไม่ผ่านลิงก์ = คนที่กดประกาศใบขอนั้น (เจ้าของ "หน้าประกาศก็ดูสิ่ใครส่งขึ้นไป")
    expect(src).toContain("left join ${tableInAppSchema('users')} ru on ru.id::text = r.released_by::text");
    expect(src).toContain('where a.posting_id is null and r.job_id = a.job_id)');
  });

  it('หน้าแม่ส่งชื่อผู้สรรหาเข้าป๊อปทุกทาง (แท็บผู้สมัคร · การติดต่อ · ป๊อปการ์ดใบขอ)', () => {
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    // 19 ต.ค. 2569: ผู้สรรหาแก้รายคนได้ — recruiterOf = ที่แก้ก่อน ไม่มีค่อยใช้ของใบขอ · jobRecruiterOf = ของใบขอ (ตัวเลือก "ตามใบขอ")
    expect(ws).toContain('recruiterName={recruiterOf(profileApp)}');
    expect(ws).toContain('jobRecruiterName={jobRecruiterOf?.(profileApp) ?? null}');
    expect(ws).toContain('recruiterName={contactApp ? recruiterOf(contactApp) : null}');
    expect(ws).toContain("(r.recruiter_name ?? '').trim() || jobRecruiterOf?.(r) || null");
    expect(ws.match(/downloadApplicantExport\(shown, \{ recruiterOf \}\)/g)?.length).toBe(2);
    expect(readFileSync('src/components/jobs/JobApplicantsDialog.tsx', 'utf8')).toContain(
      'recruiterName={job?.recruiter_name?.trim() || null}',
    );
  });

  it('ไม่มีตัวกรองประเภทเจาะจงแล้ว (27 ต.ค. 2569)', () => {
    const facets = buildApplicantFacets([app({ specific_type: 'เจาะจง (ฟรี)' })], EMPTY_APPLICANT_FILTER_STATE, {
      tab: 'appointments',
      now: new Date('2026-10-16T05:00:00Z'),
    });
    expect(facets.some((f) => f.label === 'ประเภทเจาะจง')).toBe(false);
  });

  it('ไฟล์รายงาน: ข้อมูลผู้สรรหา = ผู้สรรหาของใบขอ · ผู้รับผิดชอบ = ทีม Online · ไม่มีคอลัมน์ประเภทเจาะจง', () => {
    expect(APPLICANT_EXPORT_HEADERS.slice(-2)).toEqual(['ข้อมูลผู้สรรหา', 'ผู้รับผิดชอบ']);
    expect(APPLICANT_EXPORT_HEADERS).not.toContain('ประเภทเจาะจง');
    const [row] = applicantExportRows([app({ posting_owner_name: 'เจ้าหน้าที่ออนไลน์ ก', specific_type: 'เจาะจง (ฟรี)' })], {
      recruiterOf: () => 'เจ้าหน้าที่สรรหา ก',
    });
    expect(row.slice(-2)).toEqual(['เจ้าหน้าที่สรรหา ก', 'เจ้าหน้าที่ออนไลน์ ก']);
  });
});
