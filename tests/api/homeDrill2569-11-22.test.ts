/**
 * กดกล่องหน้าหลัก → 12 เดือน → รายวัน → BU → เหตุผล (เจ้าของ 22 พ.ย. 2569) + ผู้สมัครเข้าระบบแตกที่มา
 * ข้อมูลสมมติ (ไม่มีชื่อคนจริง) · ตัวนับเดียวกับเลขบนกล่อง ⇒ เดือนไหนก็รวมเท่ากล่องของเดือนนั้น
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildDrillPayload,
  drillBuShares,
  drillDayBars,
  drillFrom,
  drillIds,
  drillMonthBars,
  drillMonthList,
  drillReasonRows,
  type DrillSource,
} from '@/lib/homeDrill';
import { buildApplicantFunnel } from '@/lib/homeOverviewFunnel';
import { recruitProportionRows } from '@/lib/homeProportion';
import { entryKindOf, summarizeEntry } from '@/lib/homeEntryKind';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

let seq = 0;
const fact = (createdAt: string, bu: string | null, over: Partial<RecruitAppFact> = {}): RecruitAppFact =>
  ({ id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, createdAt, bu, jobId: 'siamraj-sql:OPL6911001', phoneOk: true, calledByAi: false, calledByStaff: false, ...over }) as RecruitAppFact;
const src = (f: RecruitAppFact, createdBy: string | null = null, channelLabel: string | null = null): DrillSource => ({ fact: f, entry: { source: null, createdBy, channelLabel } });

const sources: DrillSource[] = [
  src(fact('2026-11-05T03:00:00Z', 'LBD', { calledByAi: true, aiAnswer: 'said_yes' } as Partial<RecruitAppFact>)),
  src(fact('2026-11-05T05:00:00Z', 'LBD', { calledByAi: true, aiAnswer: 'no_pickup' } as Partial<RecruitAppFact>)),
  src(fact('2026-11-06T03:00:00Z', 'LBA', { calledByAi: true, aiAnswer: 'said_no' } as Partial<RecruitAppFact>), 'staff@example.test', 'Webjob · Jobthai'),
  src(fact('2026-10-31T18:00:00Z', 'LBA'), 'staff@example.test', 'Facebook · Facebook Group'), // 1 พ.ย. เวลาไทย
  src(fact('2026-10-20T03:00:00Z', null, { calledByStaff: true } as Partial<RecruitAppFact>)),
];
const p = buildDrillPayload(sources, '2025-12-01', '2026-11-22', null, Date.parse('2026-11-22T03:00:00Z'));

describe('แผงไล่ 12 เดือน', () => {
  it('ช่วง = วันที่ 1 ของเดือนที่ย้อน 11 เดือน ถึงวันนี้ · 12 เดือนครบแม้เดือนว่าง', () => {
    expect(drillFrom('2026-11-22')).toBe('2025-12-01');
    expect(drillFrom('2026-01-05')).toBe('2025-02-01');
    expect(drillMonthList('2025-12-01', '2026-11-22')).toHaveLength(12);
    const bars = drillMonthBars(p, 'applied');
    expect(bars.map((b) => b.total)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4]);
  });

  it('เดือนนี้ในแผง = เลขบนกล่องของเดือนนี้ (ตัวนับเดียวกัน · วันที่กรอกเวลาไทย)', () => {
    const nov = sources.map((s) => s.fact).filter((f) => Date.parse(f.createdAt as string) >= Date.parse('2026-10-31T17:00:00Z'));
    for (const step of buildApplicantFunnel(nov)) {
      const bar = drillMonthBars(p, step.key as never).find((b) => b.key === '2026-11');
      expect([step.key, bar?.total]).toEqual([step.key, step.value]);
      const reasons = drillReasonRows(p, step.key as never, { month: '2026-11' });
      for (const r of step.rows) expect([r.key, reasons.rows.find((x) => x.key === r.key)?.n]).toEqual([r.key, r.value]);
    }
    const pre = recruitProportionRows(nov, null, null).find((r) => r.key === 'prescreen');
    expect(drillMonthBars(p, 'prescreen').find((b) => b.key === '2026-11')?.total).toBe(pre?.ladder?.total);
  });

  it('แท่งรายวันเป็น 100% แบ่ง BU · ยอด + % ของ BU รวมกัน = ยอดของขอบเขต', () => {
    const days = drillDayBars(p, 'applied', '2026-11');
    expect(days).toHaveLength(22);
    expect(days.find((d) => d.key === '2026-11-05')?.byBu).toEqual([{ bu: 'LBD', n: 2 }]);
    const shares = drillBuShares(p, 'applied', { month: '2026-11' });
    expect(shares.total).toBe(4);
    expect(shares.rows.reduce((s, r) => s + r.n, 0)).toBe(4);
    expect(shares.rows.map((r) => [r.bu, r.pct])).toEqual([['LBA', 50], ['LBD', 50]]);
  });

  it('กด BU = เหตุผลของ BU นั้น ยอด + % · ครบทุกเหตุของกล่อง (ว่าง = 0) · รายชื่อตรงขอบเขต', () => {
    const r = drillReasonRows(p, 'ai', { month: '2026-11', bu: 'LBD' });
    expect(r.total).toBe(2);
    expect(r.rows.find((x) => x.key === 'yes')).toMatchObject({ n: 1, pct: 50 });
    expect(r.rows.find((x) => x.key === 'outOfArea')).toMatchObject({ n: 0, pct: 0 });
    expect(drillIds(p, 'ai', { month: '2026-11', bu: 'LBD' }, 'yes')).toHaveLength(1);
    expect(drillIds(p, 'applied', { day: '2026-11-01' })).toHaveLength(1);
  });

  it('ไม่ส่งชื่อ/เบอร์ — มีแต่รหัสต่อใบ', () => {
    const json = JSON.stringify(p);
    expect(json).not.toContain('example.test');
    expect(json).not.toContain('phone');
  });

  it('เส้นอ่านอย่างเดียว ลงทะเบียนแล้ว · หน้าหลักเปิดแผงก่อน สรุปเดิมอยู่ปุ่มในแผง', () => {
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/home-drill': homeDrillHandler");
    const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    expect(page).toContain('setDrillStep({ box: s.key, step: s })');
    expect(page).toContain("label: 'สรุปช่วงวันที่บนหน้า'");
    expect(readFileSync('src/components/home-overview/ProportionTab.tsx', 'utf8')).toContain("apps: 'entry'");
  });
});

describe('ผู้สมัครเข้าระบบ — แตกคนคีย์/นำเข้าตามที่มา (Choice เจ้าของ 22 พ.ย. 2569)', () => {
  it('ทางเข้า 7 ทาง จากช่องดิบ', () => {
    expect(entryKindOf({ source: 'irecruit', createdBy: 'iRecruit', channelLabel: null })).toBe('irecruit');
    expect(entryKindOf({ source: 'apply_page', createdBy: null, channelLabel: 'Facebook · Facebook Group' })).toBe('self');
    expect(entryKindOf({ source: 'apply_page', createdBy: 'So Scraping', channelLabel: 'Scrap · JobThai' })).toBe('soScraping');
    expect(entryKindOf({ source: 'apply_page', createdBy: 'staff@example.test', channelLabel: 'Webjob · Jobthai' })).toBe('staffWebjob');
    expect(entryKindOf({ source: 'apply_page', createdBy: 'staff@example.test', channelLabel: 'Facebook ' })).toBe('staffFacebook');
    expect(entryKindOf({ source: 'apply_page', createdBy: 'staff@example.test', channelLabel: 'Tiktok · Tiktok Live' })).toBe('staffTiktok');
    expect(entryKindOf({ source: 'apply_page', createdBy: 'staff@example.test', channelLabel: 'Offline · Call in' })).toBe('staffOther');
  });
  it('รวมจากแถวที่ฐานจัดกลุ่ม = ยอดเดิม', () => {
    const c = summarizeEntry([
      { source: 'apply_page', createdBy: null, channelLabel: '', n: 823 },
      { source: 'irecruit', createdBy: 'iRecruit', channelLabel: 'iRecruit ', n: 106 },
      { source: 'apply_page', createdBy: 'a@example.test', channelLabel: 'Webjob ', n: 1531 },
      { source: 'apply_page', createdBy: 'b@example.test', channelLabel: 'Facebook ', n: 562 },
    ]);
    expect(c).toMatchObject({ self: 823, irecruit: 106, staffWebjob: 1531, staffFacebook: 562, staffTiktok: 0 });
  });
});
