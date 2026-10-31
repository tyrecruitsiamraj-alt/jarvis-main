/**
 * Dashboard โหมดทั้งหมด: สมการจบที่การ์ดเหลือหาเลขเดียว (เจ้าของ 31 ต.ค. 2569 Choice "เลขเดียว 398 + แตกให้เห็น")
 * ของจริง: 6,327 − 4,117 − 1,915 = 295 + ใบขอชั่วคราว 38 + ต้องการคนหลังช่วงนี้ 65 = เหลือหา 398
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRemainingBridge } from '@/lib/dashboard/remainingBridge';
import type { JobRequest } from '@/types';
import type { ThroughputRecord } from '@/lib/dashboard/throughput';

const job = (no: string, remaining: number, required: string | null, pre = false) =>
  ({
    id: pre ? `siamraj-pre:${no}` : `siamraj-sql:${no}`,
    externalId: no,
    request_no: no,
    status: 'open',
    required_date: required,
    request_positions: remaining,
    filled_positions: 0,
    cancelled_positions: 0,
  }) as unknown as JobRequest;
const rec = (no: string, day: string, units: number): ThroughputRecord => ({
  requestNo: no,
  jobId: `siamraj-sql:${no}`,
  requestDate: day,
  closureDate: null,
  positionUnits: units,
  isOpen: true,
  kind: 'remaining',
});

describe('buildRemainingBridge', () => {
  it('ยังเปิดในช่วง + ใบขอชั่วคราว + ต้องการคนหลังช่วง/ก่อนช่วง ± ยอดต่าง = เหลือหา', () => {
    const jobs = [
      job('LBD6910001', 2, '2026-10-05'),
      job('LBD6910002', 1, '2026-11-02'), // ยอด ERP ไม่ดึงมา (วันต้องการคนหลังช่วง)
      job('LBD6708001', 1, '2024-08-20'), // ก่อนช่วง
      job('PRE-1', 3, '2026-10-10', true),
    ];
    const b = buildRemainingBridge(jobs, [rec('LBD6910001', '2026-10-05', 3)], '2024-09-01', '2026-10-31', 3);
    expect(b).toEqual({ inPeriod: 3, prequest: 3, before: 1, after: 1, noRecord: 0, adjust: -1, total: 7 });
    expect(b.inPeriod + b.prequest + b.before + b.after + b.noRecord + b.adjust).toBe(b.total);
  });

  it('จอใช้สะพานนี้ในสมการโหมดทั้งหมด', () => {
    const src = readFileSync('src/components/dashboard/analytics/DashboardShell.tsx', 'utf8');
    expect(src).toContain("['ต้องการคนหลังช่วงนี้', b.after]");
    expect(src).toContain('= <b>เหลือหา {n(b.total)} อัตรา</b>');
    expect(src).not.toContain('ยังเปิดหาอยู่');
  });
});
