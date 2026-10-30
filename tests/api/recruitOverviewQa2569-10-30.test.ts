/**
 * QA 30 ต.ค. 2569 ก้อน 2 ภาพรวมงานสรรหา — การ์ดแนวโน้มใบขอนับเหมือนการ์ดบน · ตัวกรองไปถึงทุกการ์ด · คำ/ชื่อชุดเดียว
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REQUEST_TREND_BUCKETS, requestTrendBucketOf, requestTrendRows, requestTrendSeries } from '../../src/lib/recruitRequestTrend';
import { buildRequestFunnel, type RecruitRequestRow } from '../../src/lib/recruitRequestTab';
import { mainChannelOf, erpChannelOf } from '../../src/lib/channelPlacement';
import { CONTACT_BUCKET_LABEL } from '../../src/lib/recruitContactTab';

const row = (o: Partial<RecruitRequestRow>): RecruitRequestRow => ({
  requestNo: 'OPL6910101', jobId: 'siamraj-sql:OPL6910101', day: '2026-10-28', unitName: 'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)', siteCode: null, siteName: null,
  sector: 'bank', province: 'กรุงเทพมหานคร', district: null, subdistrict: null, leadKind: 'urgent', requested: 1, filled: 0, cancelled: 0, remaining: 1,
  released: false, applications: 0, ...o,
});

describe('แนวโน้มใบขอ = การ์ดใบขอเข้ามา', () => {
  const rows = [
    row({}),
    row({ requestNo: 'B', jobId: 'b', released: true, applications: 4 }),
    row({ requestNo: 'C', jobId: 'c', released: true }),
    row({ requestNo: 'D', jobId: 'd', remaining: 0, filled: 1 }),
    row({ requestNo: 'E', jobId: 'e', remaining: 0, cancelled: 1 }),
  ];
  it('ถังทุกถังรวม = ใบขอเข้ามา · เลขเท่าการ์ดบน', () => {
    const t = Object.fromEntries(requestTrendRows(rows, null).map((r) => [r.key, r.cur]));
    const f = buildRequestFunnel(rows);
    expect(REQUEST_TREND_BUCKETS.reduce((n, k) => n + (t[k] ?? 0), 0)).toBe(t.total);
    expect([t.total, t.cancelled, t.closed, t.notReleased, t.releasedNoApps, t.releasedWithApps]).toEqual([
      f.total, f.cancelled.requests, f.closed.requests, f.active.notReleased, f.active.releasedNoApps, f.active.releasedWithApps,
    ]);
    expect(rows.map(requestTrendBucketOf)).toEqual(['notReleased', 'releasedWithApps', 'releasedNoApps', 'closed', 'cancelled']);
  });
  it('รายวันจากวันที่ใบส่งเข้ามา · วันว่าง = 0', () => {
    expect(requestTrendSeries('total', '2026-10-27', '2026-10-28', rows)).toEqual([{ day: '2026-10-27', n: 0 }, { day: '2026-10-28', n: 5 }]);
  });
});

describe('ชื่อ/คำชุดเดียว', () => {
  it('ช่องทาง: Jobbkk = JOBBKK · Facebook จาก ERP = Facebook ไม่ระบุ', () => {
    expect(mainChannelOf('Jobbkk', null)).toBe('JOBBKK');
    expect(erpChannelOf({ code: '1', name: 'Facebook' })).toBe('Facebook ไม่ระบุ');
    expect(erpChannelOf({ code: null, name: 'Jobthai.com' })).toBe('Jobthai');
  });
  it('แท็บการติดต่อใช้ รอโทร · ติดต่อได้ ชุดเดียวกับการ์ดเทียบ', () => {
    expect(CONTACT_BUCKET_LABEL.waiting).toBe('รอโทร');
    expect(readFileSync('src/components/dashboard-trends/ContactTab.tsx', 'utf8')).toContain("ok: 'ติดต่อได้'");
  });
  it('ภาพรวม Online: การ์ดอื่นตามตัวกรอง · ปุ่มรีเฟรชเหลือปุ่มเดียว · กดช่องทางเลื่อนจอไปการ์ด', () => {
    const page = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(page).toContain('const fv = sc.active ? overviewViewOf(sc.appsOf(apps ?? []), data, win) : view;');
    expect(readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8')).toContain("onRefresh={view === 'dashboard' ? undefined");
    expect(readFileSync('src/components/dashboard-trends/RequestTab.tsx', 'utf8')).toContain('scopedRef.current?.scrollIntoView');
  });
});
