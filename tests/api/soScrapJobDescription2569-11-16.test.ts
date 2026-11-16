import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { soScrapSnapshot } from '../../src/lib/soScraping';
import { erpLinesText } from '../../src/lib/unitRequestDetail';
import type { JobRequest } from '@/types';

/**
 * 16 พ.ย. 2569: คำขอ Scrap ต้องมี "รายละเอียดงาน" + คุณสมบัติ เหมือนหน้ารายละเอียดใบขอ
 * เคส LMO6911012 — หน้าที่คุมทีมพนักงานดูแลสวน แต่ So Scraping เห็นแค่ position "คนสวน" ไปค้นพนักงาน
 */
const base = {
  id: 'siamraj-sql:LMO6911012', request_no: 'LMO6911012', unit_name: 'หน่วยงาน', location_address: 'อ.บางพลี จ.สมุทรปราการ', override_province: 'สมุทรปราการ',
  status: 'open', urgency: 'advance', total_income: 15000, job_type: 'other', job_category: 'private', penalty_per_day: 0, days_without_worker: 0, total_penalty: 0,
  request_date: '2026-11-10', created_at: '2026-11-10T00:00:00.000Z', staff_title_name: 'คนสวน', request_positions: 1,
} as unknown as JobRequest;

describe('คำขอ Scrap ส่งรายละเอียดงาน + คุณสมบัติ', () => {
  it('ใส่ job_description / qualifications เป็นข้อความเต็มเหมือนบนจอ', () => {
    const job = { ...base, erp_job_details: ['วางแผนและควบคุมการปฏิบัติงานของทีมพนักงานดูแลสวน', '  ตรวจงานประจำวัน  '], erp_requirements: ['มีประสบการณ์คุมทีม 2 ปี'] } as JobRequest;
    const snap = soScrapSnapshot(job, 'คนสวน');
    expect(snap.job_description).toBe('วางแผนและควบคุมการปฏิบัติงานของทีมพนักงานดูแลสวน\nตรวจงานประจำวัน');
    expect(snap.job_description).toBe(erpLinesText(job, 'job_details'));
    expect(snap.qualifications).toBe('มีประสบการณ์คุมทีม 2 ปี');
    expect(snap.position).toBe('คนสวน');
  });

  it('ใช้ของ ERP แม้ทีมแก้ทับในป๊อปประกาศ (ตรงกับหน้ารายละเอียดใบขอ)', () => {
    const job = { ...base, erp_job_details: ['ของ ERP'], job_details: ['ที่ทีมแก้'] } as JobRequest;
    expect(soScrapSnapshot(job).job_description).toBe('ของ ERP');
  });

  it('ไม่มีรายละเอียดงาน/คุณสมบัติ = ส่งแบบเดิม ไม่มีช่องว่าง', () => {
    const snap = soScrapSnapshot({ ...base, erp_job_details: ['  '], erp_requirements: [] } as JobRequest);
    expect('job_description' in snap).toBe(false);
    expect('qualifications' in snap).toBe(false);
    expect('job_description' in soScrapSnapshot(base)).toBe(false);
  });

  it('สั่งครั้งแรกและสั่งใหม่ผ่านทางเดียวกัน · หน้ารายละเอียดใบขอใช้ตัวจัดข้อความตัวเดียวกัน', () => {
    const btn = readFileSync('src/components/jobs/OrderPostButton.tsx', 'utf8');
    expect(btn.match(/requestType: 'scraping'/g)?.length).toBe(1);
    expect(btn).toContain('...soScrapSnapshot(job, title),');
    const info = readFileSync('src/components/jobs/UnitRequestInfoFields.tsx', 'utf8');
    expect(info).toContain("import { erpLinesText, moneyFieldText } from '@/lib/unitRequestDetail';");
    expect(info).not.toContain('function erpLinesText');
  });
});
