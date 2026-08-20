import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dashboardCohortYmd, effectiveRequestDateYmd } from '@/lib/jobUrgency';
import { filterJobsByRequestDate } from '@/lib/dashboard/buildDashboardData';
import { filterJobsForThroughput, jobsToThroughputRecords } from '@/lib/dashboard/throughput';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & Pick<JobRequest, 'id'>): JobRequest {
  return {
    unit_name: 'หน่วยงาน',
    location_address: '',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    job_type: 'driver',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-01-15',
    created_at: '2026-01-15T00:00:00.000Z',
    ...partial,
  };
}

/**
 * 🔴 เจ้าของเคาะ 20 ส.ค. 2569: งวดของ Dashboard (เข้ามา/ปิด/ยกเลิก/คงเหลือ)
 * นับจาก **วันที่ต้องการคน** ไม่ใช่วันที่กรอกใบ — *"เปลี่ยนเป็นวันที่ต้องการ ทั้งชุด"*
 *
 * เทสต์ชุดนี้กันการถอยกลับ (เดิม SQL ใช้ `request_date` · ฝั่งหน้าใช้ของผสม)
 * และกันไม่ให้ใบที่ไม่มีวันที่ต้องการหลุดจากทุกงวดเงียบ ๆ
 */
describe('งวด Dashboard นับจากวันที่ต้องการ', () => {
  it('มีวันที่ต้องการ → ใช้วันที่ต้องการ (ไม่ใช่วันที่กรอก)', () => {
    const j = job({ id: 'a', request_date: '2026-01-15', required_date: '2026-03-01' });
    expect(dashboardCohortYmd(j)).toBe('2026-03-01');
  });

  it('🔴 ไม่มีวันที่ต้องการ → fallback วันที่กรอก (ห้ามคืน null ทิ้งใบ)', () => {
    const j = job({ id: 'b', request_date: '2026-01-15', required_date: null });
    expect(dashboardCohortYmd(j)).toBe('2026-01-15');
  });

  it('ไม่มีทั้งสองวัน → null (ไม่มีอะไรให้จัดงวด)', () => {
    const j = job({ id: 'c', request_date: null, created_at: null as unknown as string });
    expect(dashboardCohortYmd(j)).toBeNull();
  });

  it('🔴 คนละตัวกับ effectiveRequestDateYmd (นาฬิกา SLA/ledger) — ห้ามยุบรวม', () => {
    // ย้อนหลัง: ต้องการ 1 ม.ค. แต่กรอก 15 ม.ค. → SLA เริ่มนับวันที่กรอก
    const retro = job({ id: 'd', request_date: '2026-01-15', required_date: '2026-01-01' });
    expect(effectiveRequestDateYmd(retro)).toBe('2026-01-15');
    // แต่งวดของ Dashboard ยังเป็นเดือนที่ลูกค้าต้องการคน
    expect(dashboardCohortYmd(retro)).toBe('2026-01-01');
  });

  it('filterJobsByRequestDate เอาใบเข้างวดตามวันที่ต้องการ', () => {
    const jobs = [
      job({ id: 'jan', request_date: '2026-01-15', required_date: '2026-01-20' }),
      job({ id: 'mar', request_date: '2026-01-15', required_date: '2026-03-05' }),
    ];
    const march = filterJobsByRequestDate(jobs, '2026-03-01', '2026-03-31');
    expect(march.map((j) => j.id)).toEqual(['mar']);
    const january = filterJobsByRequestDate(jobs, '2026-01-01', '2026-01-31');
    expect(january.map((j) => j.id)).toEqual(['jan']);
  });

  it('filterJobsForThroughput ใช้ฐานเดียวกัน', () => {
    const jobs = [job({ id: 'mar', request_date: '2026-01-15', required_date: '2026-03-05' })];
    expect(filterJobsForThroughput(jobs, '2026-01-01', '2026-01-31')).toHaveLength(0);
    expect(filterJobsForThroughput(jobs, '2026-03-01', '2026-03-31')).toHaveLength(1);
  });

  it('jobsToThroughputRecords ติดเดือนตามวันที่ต้องการ', () => {
    const records = jobsToThroughputRecords([
      job({ id: 'x', request_date: '2026-01-15', required_date: '2026-03-05', position_units: 2 }),
    ]);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) expect(r.requestDate).toBe('2026-03-05');
  });

  it('🔴 ฝั่ง API (SQL) ต้องใช้ want_date_from + COALESCE กัน NULL — ต้องตรงกับฝั่งหน้า', () => {
    const src = readFileSync(
      path.resolve(process.cwd(), 'api/_lib/siamrajSqlServerThroughput.ts'),
      'utf8',
    );
    // ตัวคัดว่าใบไหนอยู่ในงวด
    expect(src).toMatch(/COALESCE\(\$\{alias\}\.want_date_from, \$\{alias\}\.request_date\)/);
    // ตัวอ่านวันของแถว — วันที่ต้องการก่อน แล้วค่อย fallback วันที่กรอก
    expect(src).toMatch(/toYmd\(row\.want_date_from\) \|\| toYmd\(row\.request_date\)/);
  });
});
