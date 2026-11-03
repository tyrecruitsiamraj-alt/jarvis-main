/**
 * ใบขอขาดอะไร (เจ้าของ 3 พ.ย. 2569 "บอกเลยได้ไหมว่า ใบขอขาดอะไร เช่น ขาดอายุ ขาดเพศ ขาดคุณสมบัติ ขาดเงินเดือน")
 * ตัวตัดสินเดียว `requestGapsOf` · 3 ช่องแรกเป็นชุดเดียวกับ "พร้อมประกาศ" ของกล่องงาน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLISH_GAP_KEYS, REQUEST_GAP_KEYS, publishGapsOf, requestGapsOf } from '@/lib/publishReadiness';
import type { JobRequest } from '@/types';

const base = {
  id: 'siamraj-sql:LAO6909012',
  request_no: 'LAO6909012',
  unit_name: 'วิริยะประกันภัย',
  location_address: 'บริษัท วิริยะประกันภัย จำกัด (มหาชน) แขวงบางพลัด เขตบางพลัด กรุงเทพฯ',
  monthly_income: 15000,
  total_income: 15000,
  gender_requirement: 'หญิง',
  age_range_min: 20,
  age_range_max: 35,
  work_schedule: 'จันทร์-ศุกร์ 08.30-17.30',
  requirements: ['วุฒิ ม.6'],
  job_details: ['รับสายลูกค้า'],
} as unknown as JobRequest;

describe('requestGapsOf', () => {
  it('ครบทุกช่อง = ไม่ขาด', () => {
    expect(requestGapsOf(base)).toEqual([]);
  });
  it('ขาดอายุ · วันเวลาทำงาน · คุณสมบัติ · รายละเอียดงาน', () => {
    const j = { ...base, age_range_min: undefined, age_range_max: undefined, work_schedule: '', requirements: [], job_details: ['  '] } as unknown as JobRequest;
    expect(requestGapsOf(j)).toEqual(['age', 'schedule', 'requirements', 'details']);
  });
  it('มีอายุข้างเดียวก็ไม่ขาด', () => {
    expect(requestGapsOf({ ...base, age_range_min: undefined } as unknown as JobRequest)).not.toContain('age');
  });
  it('3 ช่องแรก = ชุดพร้อมประกาศของกล่องงาน (นิยามเดียว)', () => {
    expect(REQUEST_GAP_KEYS.slice(0, 3)).toEqual([...PUBLISH_GAP_KEYS]);
    const j = { ...base, monthly_income: undefined, total_income: undefined, requirements: [] } as unknown as JobRequest;
    expect(publishGapsOf(j)).toEqual(['income']);
    expect(requestGapsOf(j)).toEqual(['income', 'requirements']);
  });
  it('การ์ดและแถวตารางหน้าใบขอใช้บรรทัดเดียวกัน', () => {
    const page = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');
    expect(page.match(/<RequestGapsLine job=\{j\}/g)).toHaveLength(2);
  });
});
