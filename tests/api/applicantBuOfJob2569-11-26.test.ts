// @vitest-environment node
/**
 * ตัวกรอง BU แท็บผู้สมัคร = BU ของใบขอที่สมัคร (ไซต์ก่อน) ไม่ใช่แผนกคนคีย์ (เจ้าของ 26 พ.ย. 2569
 * "ทำไม ไอซ์มาโชว์ เพราะฉันเลือก Lbd" — ใบของ LAO6911009 ไซต์ LBA แต่ใบสมัครตีตรา LBD)
 */
import { describe, expect, it } from 'vitest';
import { applyApplicantFilters, type ApplicantFacetFacts } from '../../src/lib/applicantFilters';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const app = (id: string, job: string | null, dept: string) =>
  ({ id, full_name: id, job_id: job, department_code: dept, status: 'new', created_at: '2026-11-26T06:13:00Z' }) as PublicApplication;

describe('BU ของใบสมัคร', () => {
  const rows = [app('lba-job-keyed-by-lbd', 'siamraj-sql:LAO6911009', 'LBD'), app('lbd-job', 'siamraj-sql:OPL6911103', 'LBD'), app('no-job', null, 'LBD')];
  const facts: ApplicantFacetFacts = {
    tab: 'candidates',
    now: new Date('2026-11-26T08:00:00Z'),
    buOf: (r) => (r.job_id === 'siamraj-sql:LAO6911009' ? 'LBA' : r.job_id === 'siamraj-sql:OPL6911103' ? 'LBD' : null),
  };
  it('กรอง LBD ไม่ได้ใบของใบขอ LBA แม้คนคีย์อยู่ LBD · ใบไม่ผูกใบขอใช้ BU บนใบ', () => {
    expect(applyApplicantFilters(rows, { selection: { bu: ['LBD'] } }, facts).map((r) => r.id)).toEqual(['lbd-job', 'no-job']);
    expect(applyApplicantFilters(rows, { selection: { bu: ['LBA'] } }, facts).map((r) => r.id)).toEqual(['lba-job-keyed-by-lbd']);
  });
});
