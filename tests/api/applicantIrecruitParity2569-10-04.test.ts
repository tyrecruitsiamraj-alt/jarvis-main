/**
 * แท็บผู้สมัครเติมของที่ขาดจาก iRecruit (เจ้าของ 4 ต.ค. 2569):
 * คอลัมน์สถานะ · ตัวกรอง ขั้นตอน/สถานะ/สถานะการติดต่อ/ใบขับขี่/ข้อมูลผู้สรรหา · ปุ่มรายงาน · ส่ง AI โทรรายแถว ·
 * ดูข้อมูลแบบรูป · ยกเลิกข้อมูลผู้สมัคร (ซ่อนจากรายชื่อหลัก กู้คืนได้ · AI ไม่โทรเอง)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { applicantContactStateOf, applicantProcessOf } from '@/lib/applicantProcess';
import { APPLICANT_EXPORT_HEADERS, applicantExportCsv, applicantExportRows } from '@/lib/applicantExport';
import { applyApplicantFilters, buildApplicantFacets, EMPTY_APPLICANT_FILTER_STATE } from '@/lib/applicantFilters';
import { OVERVIEW_BUCKETS } from '../../api/_lib/applicantOverviewSql';

const app = (over: Partial<PublicApplication>): PublicApplication =>
  ({ id: 'x', full_name: 'ก ข', phone: '0800000000', status: 'new', created_at: '2026-10-04T03:00:00Z', ...over }) as PublicApplication;

describe('ขั้นตอน + สถานะแบบ iRecruit', () => {
  it('ไล่ครบทุกขั้น', () => {
    expect(applicantProcessOf(app({}))).toEqual({ step: 'contact', state: 'pending' });
    expect(applicantProcessOf(app({ last_contact_ok: false }))).toEqual({ step: 'contact', state: 'fail' });
    expect(applicantProcessOf(app({ last_contact_ok: true }))).toEqual({ step: 'appointment', state: 'pending' });
    expect(applicantProcessOf(app({ last_contact_ok: true, appointment_at: '2026-10-06T05:00:00Z' }))).toEqual({ step: 'follow', state: 'pending' });
    expect(applicantProcessOf(app({ appointment_at: '2026-10-06T05:00:00Z', attendance_result: 'showed' }))).toEqual({ step: 'follow', state: 'ok' });
    expect(applicantProcessOf(app({ appointment_at: '2026-10-06T05:00:00Z', attendance_result: 'no_show' }))).toEqual({ step: 'follow', state: 'fail' });
  });
  it('สถานะการติดต่อ: ยังไม่โทร / โทรแล้ว / นัดสัมภาษณ์แล้ว', () => {
    expect(applicantContactStateOf(app({}))).toBe('not_called');
    expect(applicantContactStateOf(app({ dial_count: 1 }))).toBe('called');
    expect(applicantContactStateOf(app({ last_call_status: 'failed' }))).toBe('called');
    expect(applicantContactStateOf(app({ appointment_at: '2026-10-06T05:00:00Z' }))).toBe('appointed');
  });
});

describe('ตัวกรองที่เติมจาก iRecruit', () => {
  const facts = { tab: 'candidates' as const, now: new Date('2026-10-04T05:00:00Z') };
  const rows = [
    app({ id: 'a' }),
    app({ id: 'b', last_contact_ok: true, license_types: ['ใบขับขี่บุคคล 5 ปี', 'ใบขับขี่ ท.2'], specific_type: 'คิว' }),
  ];
  it('ขั้นตอน/สถานะ/สถานะการติดต่อ/ใบขับขี่/ข้อมูลผู้สรรหา มีเลขต่อท้าย · กรองได้', () => {
    const keys = buildApplicantFacets(rows, EMPTY_APPLICANT_FILTER_STATE, facts).map((f) => f.key);
    for (const k of ['step', 'status', 'contactState', 'license', 'specific']) expect(keys).toContain(k);
    expect(applyApplicantFilters(rows, { selection: { step: ['appointment'] } }, facts).map((r) => r.id)).toEqual(['b']);
    expect(applyApplicantFilters(rows, { selection: { license: ['ใบขับขี่ ท.2'] } }, facts).map((r) => r.id)).toEqual(['b']);
  });
});

describe('ปุ่มรายงาน', () => {
  it('ไฟล์มี BOM (Excel อ่านไทยถูก) · หัวคอลัมน์ · ข้อความมีจุลภาคถูกครอบ', () => {
    const csv = applicantExportCsv([app({ full_name: 'ก, ข' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(APPLICANT_EXPORT_HEADERS.join(','));
    expect(csv).toContain('"ก, ข"');
    expect(applicantExportRows([app({})])[0][5]).toBe('รอดำเนินการ');
  });
});

describe('ต่อสายในหน้าเว็บ + ด่าน AI', () => {
  const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
  it('ดูข้อมูลของแท็บผู้สมัคร = ป๊อปโหมด profile · ส่ง AI รายแถวผ่านป๊อปยืนยัน · มุมมองที่ยกเลิกกู้คืนได้', () => {
    expect(ws).toContain('mode="profile"');
    expect(ws).toMatch(/action === 'ai'\) \{\s*askSendAi\(\[row\.id\]\)/);
    expect(ws).toContain("actionsOverride={cancelledView ? ['view', 'restore'] : undefined}");
    expect(ws).not.toContain('ApplicantProfileDialog');
  });
  it('🔴 worker ส่ง AI ข้ามใบที่ยกเลิกข้อมูล', () => {
    expect(OVERVIEW_BUCKETS.awaiting_call_choice).toMatch(/not exists \(select 1 from .*application_cancellations/);
  });
});
