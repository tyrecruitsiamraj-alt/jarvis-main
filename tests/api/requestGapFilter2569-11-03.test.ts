/**
 * ตัวกรอง "ข้อมูลใบขอ" หน้าใบขอ (เจ้าของ 3 พ.ย. 2569 "เพิ่ม filter ให้ทีเพื่อดูว่าใบขอไหนที่ รายละเอียดไม่ครบ")
 * ตัวตัดสิน = requestGapsOf ตัวเดียวกับบรรทัด "ขาด:" บนการ์ด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchesRequestGapFilter, REQUEST_GAP_FILTER_OPTIONS, requestGapsOf } from '@/lib/publishReadiness';
import { parseJobListSearchParams, buildJobListSearchParams } from '@/lib/jobListPageState';
import type { JobRequest } from '@/types';

const full = {
  id: 'siamraj-sql:OPL6910074',
  work_place: 'อ.เมือง จ.ชลบุรี',
  location_address: 'อ.เมือง จ.ชลบุรี',
  total_income: 16304,
  base_salary: 16304,
  gender_requirement: 'M',
  age_range_min: 22,
  age_range_max: 60,
  work_schedule: 'จันทร์-เสาร์ 08.00-17.00 น.',
  requirements: ['มีใบขับขี่'],
  job_details: ['ขับรถผู้บริหาร'],
} as unknown as JobRequest;

describe('ตัวกรองข้อมูลใบขอ', () => {
  it('ตัวเลือก: ไม่ครบ · ครบ · ขาด<ช่อง>', () => {
    expect(REQUEST_GAP_FILTER_OPTIONS.slice(0, 3).map((o) => o.label)).toEqual(['ไม่ครบ', 'ครบ', 'ขาดสถานที่']);
  });
  it('ไม่เลือก = ทุกใบ · ไม่ครบ/ครบ/ขาดช่อง ตรงกับ requestGapsOf', () => {
    const noAge = { ...full, age_range_min: null, age_range_max: null } as JobRequest;
    expect(requestGapsOf(noAge)).toContain('age');
    expect(matchesRequestGapFilter(noAge, [])).toBe(true);
    expect(matchesRequestGapFilter(noAge, ['missing'])).toBe(true);
    expect(matchesRequestGapFilter(noAge, ['complete'])).toBe(requestGapsOf(noAge).length === 0);
    expect(matchesRequestGapFilter(noAge, ['age'])).toBe(true);
    expect(matchesRequestGapFilter(noAge, ['requirements'])).toBe(requestGapsOf(noAge).includes('requirements'));
  });
  it('อยู่ในลิงก์ ?gap= และค่าที่ไม่รู้จักถูกตัด', () => {
    const st = parseJobListSearchParams(new URLSearchParams('gap=missing,age,xx'));
    expect(st.gapFilter).toEqual(['missing', 'age']);
    expect(buildJobListSearchParams(st).get('gap')).toBe('missing,age');
  });
  it('หน้าใบขอมีตัวกรองนี้', () => {
    const src = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');
    expect(src).toContain('label="ข้อมูลใบขอ"');
    expect(src).toContain('if (!matchesRequestGapFilter(j, gapFilter)) return false;');
  });
});
