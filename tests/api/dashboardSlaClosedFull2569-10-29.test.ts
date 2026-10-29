/**
 * Dashboard: ตาราง "ปิดทัน / ไม่ทัน" ต้องเท่าการ์ด "ใบขอเร่งด่วนแค่ไหน" (เจ้าของ 29 ต.ค. 2569 "ยอดมันไม่ตรงกันหรอ")
 * Choice "นับใบปิดที่ฝั่ง ERP ส่งมาเป็นยอดรวม" — วัดแล้ว ERP ใช้เวลาเท่ากันไม่ว่าเพดานเท่าไหร่ ⇒ ปลดเพดานให้ส่งครบ
 * (ตัวคิด SLA + ตัวกรองบนจอชุดเดิม ไม่เขียนนิยามซ้ำฝั่ง SQL)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ใบปิดครบทุกใบ', () => {
  it('เพดานฝั่ง ERP 20,000 · เส้นรับ limit · Dashboard โหมดทั้งหมดขอครบและดึงให้เองตอนเปิดหน้า', () => {
    expect(read('api/_lib/siamrajSqlServerClosed.ts')).toContain('Math.min(Math.max(options.limit ?? 3000, 1), 20000)');
    expect(read('api/_handlers/siamraj-unit-requests.ts')).toContain('limit: closedLimit');
    const page = read('src/pages/dashboard/SupervisorDashboard.tsx');
    expect(page).toContain('fetchSiamrajClosedRequests(throughputFrom, throughputTo, 20000)');
    expect(page).toContain('if (!period) requestClosedTotals();');
  });
});

describe('ตาราง = ใบชุดเดียวกับการ์ดใบขอเร่งด่วน', () => {
  it('ใบในชุดของการ์ดที่หาใบไม่เจอ = คิด SLA ไม่ได้ ของชนิดนั้น (ยอดรวมเท่าการ์ด)', async () => {
    const { buildSlaByLeadKind } = await import('../../src/lib/dashboard/slaByLeadKind');
    const t = buildSlaByLeadKind([], new Date('2026-10-29T03:00:00Z'), { retroactive: 2, advance: 1 });
    expect(t.totalRow.total).toBe(3);
    expect(t.totalRow.cells.unknown).toBe(3);
    const page = read('src/pages/dashboard/SupervisorDashboard.tsx');
    expect(page).toContain('buildSlaByLeadKind(slaCohort.records, new Date(), slaCohort.extraUnknown, slaCohort.kindOf)');
    // ใบปิดยังไม่มา = ชุดเดิม (กันช่องคิด SLA ไม่ได้บวมระหว่างรอ)
    expect(page).toContain('if (cohortScope.records.length === 0 || period || !closedAllJobs) {');
    expect(page).toContain('filterRecordsForSlaCell(slaCohort.records, kind, cell, new Date(), slaCohort.kindOf)');
  });
});
