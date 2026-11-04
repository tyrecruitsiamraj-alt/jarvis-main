/**
 * หน้าภาพรวมหน้าเดียว + ตัวกรองแบบ query (เจ้าของ 4 พ.ย. 2569)
 * > "เอา 3 แท็บมันรวมกันเลยแต่ยังต้องตอบได้ … ใบขอเข้ามาเท่าไหร่ ยกเลิก ปิดแล้ว ดำเนินการสรรหา → ประกาศแล้ว/ยังไม่ประกาศ
 * > → มีคนกรอก/ไม่มีคนกรอก → ใบละกี่คน" · "ใบขอของแบงค์เข้ามาเท่าไหร่ … filter เปลี่ยน ข้อมูลเปลี่ยนตาม เป็นเหมือน query"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_REQUEST_FILTER,
  NO_RECRUITER_KEY,
  appsOfFilter,
  buildRequestFunnel,
  filterRequestRows,
  requestRecruiterOptions,
  requestsOfFunnelKey,
  type RecruitRequestRow,
} from '@/lib/recruitRequestTab';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const row = (no: string, p: Partial<RecruitRequestRow>): RecruitRequestRow => ({
  requestNo: no,
  jobId: `siamraj-sql:${no}`,
  day: '2026-11-03',
  unitName: 'SCB',
  siteCode: 'S1',
  siteName: 'SCB',
  sector: 'bank',
  province: 'กรุงเทพมหานคร',
  district: null,
  subdistrict: null,
  leadKind: null,
  requested: 1,
  filled: 0,
  cancelled: 0,
  remaining: 1,
  released: false,
  applications: 0,
  recruiter: 'แบงค์',
  ...p,
});

const ROWS = [
  row('OPL6911001', { released: true, applications: 5 }),
  row('OPL6911002', { released: true, applications: 12 }),
  row('OPL6911003', { released: true }),
  row('OPL6911004', {}),
  row('OPL6911005', { remaining: 0, cancelled: 1 }), // ยกเลิกทั้งใบ
  row('OPL6911006', { remaining: 0, filled: 1 }), // ปิดแล้ว
  row('OPL6911007', { released: true, applications: 3, recruiter: 'เล็ก' }),
  row('OPL6911008', { recruiter: null }),
];

describe('ใบขอเข้ามา ไล่เป็นชั้น', () => {
  const f = buildRequestFunnel(ROWS);
  it('🔴 เข้ามา = ยกเลิก + ปิดแล้ว + ดำเนินการ · ดำเนินการ = ยังไม่ประกาศ + ประกาศแล้ว · ประกาศแล้ว = ไม่มีคนกรอก + มีคนกรอก', () => {
    expect(f.total).toBe(f.cancelled.requests + f.closed.requests + f.active.requests);
    const released = requestsOfFunnelKey(ROWS, 'released').length;
    expect(f.active.requests).toBe(f.active.notReleased + released);
    expect(released).toBe(f.active.releasedNoApps + f.active.releasedWithApps);
    expect([f.total, f.cancelled.requests, f.closed.requests, f.active.requests, f.active.notReleased, released]).toEqual([8, 1, 1, 6, 2, 4]);
  });
  it('กด "มีคนกรอก" = ใบละกี่คน คนกรอกมากสุดก่อน', () => {
    expect(requestsOfFunnelKey(ROWS, 'releasedWithApps').map((r) => [r.requestNo, r.applications])).toEqual([
      ['OPL6911002', 12],
      ['OPL6911001', 5],
      ['OPL6911007', 3],
    ]);
  });
});

describe('ตัวกรองเจ้าหน้าที่สรรหา', () => {
  it('ตัวเลือก: ใบมากสุดก่อน · คนที่มีแค่ใบเก่าที่มีคนกรอกก็ขึ้น (0 ใบ) · ยังไม่ได้ตั้งอยู่ท้าย', () => {
    expect(requestRecruiterOptions(ROWS, ['หมิว', 'แบงค์', null])).toEqual([
      { value: 'แบงค์', label: 'แบงค์', n: 6 },
      { value: 'เล็ก', label: 'เล็ก', n: 1 },
      { value: 'หมิว', label: 'หมิว', n: 0 },
      { value: NO_RECRUITER_KEY, label: 'ยังไม่ได้ตั้งเจ้าหน้าที่สรรหา', n: 1 },
    ]);
  });

  it('ใบขอ: เลือกแบงค์ = ทุกการ์ดเหลือใบของแบงค์ · ยังไม่ได้ตั้ง = ใบที่ไม่มีเจ้าหน้าที่', () => {
    expect(filterRequestRows(ROWS, { ...EMPTY_REQUEST_FILTER, recruiter: 'แบงค์' })).toHaveLength(6);
    expect(filterRequestRows(ROWS, { ...EMPTY_REQUEST_FILTER, recruiter: NO_RECRUITER_KEY }).map((r) => r.requestNo)).toEqual(['OPL6911008']);
  });

  it('รายชื่อ: เลือกแบงค์ = คนที่กรอกใบของแบงค์ทุกใบ (รวมใบเก่าที่ไม่ได้เข้ามาในช่วง) · กรองพื้นที่ด้วย = ต้องผ่านทั้งคู่', () => {
    const app = (id: string, jobId: string | null) => ({ id, jobId }) as RecruitAppFact;
    const apps = [app('a1', 'siamraj-sql:OPL6911001'), app('a2', 'siamraj-sql:OPL6905114'), app('a3', 'siamraj-sql:OPL6911007'), app('a4', null)];
    const recruiterOf = (jobId: string) => ({ 'siamraj-sql:OPL6911001': 'แบงค์', 'siamraj-sql:OPL6905114': 'แบงค์', 'siamraj-sql:OPL6911007': 'เล็ก' })[jobId] ?? null;
    const bank = { ...EMPTY_REQUEST_FILTER, recruiter: 'แบงค์' };
    expect(appsOfFilter(apps, bank, filterRequestRows(ROWS, bank), recruiterOf).map((a) => a.id)).toEqual(['a1', 'a2']);
    const bankBkk = { ...bank, province: 'กรุงเทพมหานคร' };
    expect(appsOfFilter(apps, bankBkk, filterRequestRows(ROWS, bankBkk), recruiterOf).map((a) => a.id)).toEqual(['a1']);
    expect(appsOfFilter(apps, EMPTY_REQUEST_FILTER, ROWS, recruiterOf)).toHaveLength(4);
  });

  it('API ใส่เจ้าหน้าที่ให้ใบขอรายใบ · แถบกรองมีช่องเจ้าหน้าที่ · รายชื่อกรองด้วยตัวเดียวกัน', () => {
    expect(readFileSync('api/_handlers/recruit-overview.ts', 'utf8')).toContain('await attachRequestRecruiters([...rowsCur, ...rowsPrev]);');
    const tab = readFileSync('src/components/dashboard-trends/RequestTab.tsx', 'utf8');
    expect(tab).toContain('ariaLabel="เจ้าหน้าที่สรรหา"');
    expect(tab).toContain('appsOf: (list) => appsOfFilter(list, f, all, (jobId) => appJobs?.[jobId]?.recruiter ?? null),');
    expect(tab).toContain('testId="request-tab-released"');
  });
});
