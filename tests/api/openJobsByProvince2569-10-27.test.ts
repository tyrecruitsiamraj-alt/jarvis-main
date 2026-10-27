// @vitest-environment node
/**
 * งานตามจังหวัด — หน้าภาพรวม แท็บใบขอ (เจ้าของ 27 ต.ค. 2569 "งานจังหวัดไหนเยอะ และเป็นลักษณะอะไร")
 * 🔴 ทุกใบอยู่หนึ่งจังหวัด ⇒ ผลรวมทุกแถว = ใบขอที่เปิดทั้งหมด · ไม่ระบุจังหวัดอยู่ท้าย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NO_PROVINCE, openJobsByProvince } from '@/lib/openJobsByProvince';
import type { JobRequest } from '@/types';

const job = (o: Partial<JobRequest>) => ({ id: Math.random().toString(36), position_units: 1, ...o }) as JobRequest;

describe('openJobsByProvince', () => {
  const jobs = [
    job({ override_province: 'สมุทรปราการ', job_description_code_1: 'คนสวน', position_units: 3 }),
    job({ override_province: 'สมุทรปราการ', job_description_code_1: 'แม่บ้าน', position_units: 1 }),
    job({ override_province: 'กรุงเทพมหานคร', job_description_code_1: 'แม่บ้าน', position_units: 2 }),
    job({ location_address: '' }),
  ];
  it('เรียงอัตรามากสุดก่อน · ลักษณะงานเรียงอัตรา · ไม่ระบุจังหวัดท้าย · รวม = ทั้งหมด', () => {
    const rows = openJobsByProvince(jobs);
    expect(rows.map((r) => [r.province, r.requests, r.positions])).toEqual([
      ['สมุทรปราการ', 2, 4],
      ['กรุงเทพมหานคร', 1, 2],
      [NO_PROVINCE, 1, 1],
    ]);
    expect(rows[0].types.map((t) => t.positions)).toEqual([3, 1]);
    expect(rows.reduce((a, r) => a + r.requests, 0)).toBe(jobs.length);
  });
  it('หน้าภาพรวมได้ใบขอเปิดชุดเดียวกับกล่องงาน', () => {
    expect(readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8')).toContain('openJobs={loading ? null : jobs}');
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('<ProvinceJobsCard jobs={openJobs} />');
  });
});
