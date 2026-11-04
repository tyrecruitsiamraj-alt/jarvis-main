/**
 * หน้าภาพรวมงานสรรหาโฉมใหม่ (เจ้าของ 4 พ.ย. 2569 "เอาทำเลย"): ใบขอที่ยังต้องหา ติดตรงไหน · ติดที่ใคร · พื้นที่ · เทียบเดือน
 * > "ปิดไม่ได้เพราะไม่มีคนนะ หรือ มีคนแต่คนไม่โทรนะ หรือ ปิดไม่ได้เพราะไม่ได้โพสต์ด้วยซ้ำ … โทรจนไม่มีชื่อแล้ว"
 * 🔴 ทุกใบมี 1 เหตุ · 4 ช่วงรวมเท่าทั้งหมด · ติดที่ใคร/พื้นที่ รวมเท่าทั้งหมด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  NO_RECRUITER_LABEL,
  STUCK_PHASES,
  STUCK_REASON_LABEL,
  monthlySeries,
  stuckByOwner,
  stuckByPhase,
  stuckByPlace,
  stuckByReason,
  stuckPhaseOf,
  stuckReasonOf,
  stuckSteps,
  type StuckRequest,
  type StuckSignals,
} from '@/lib/recruitStuck';
import type { PipelineCounts } from '@/lib/requestPipeline';

const counts = (p: Partial<PipelineCounts> = {}): PipelineCounts => ({
  apps: 0, aiCalled: 0, aiYes: 0, aiNo: 0, aiOutOfArea: 0, aiNoPickup: 0, aiOther: 0, staffCalled: 0, staffFollowed: 0, staffReached: 0,
  aiYesNoStaff: 0, interested: 0, notInterested: 0, appointed: 0, apptFailed: 0, showed: 0, noShow: 0, passed: 0, notPassed: 0, followStarts: 0, aftercare: 0, ...p,
});
const sig = (p: Partial<StuckSignals> & { c?: Partial<PipelineCounts> } = {}): StuckSignals => ({ released: true, links: 1, post: null, uncalled: 0, queued: 0, ...p, counts: counts(p.c) });

describe('ใบติดตรงไหน — เหตุเดียวต่อใบ', () => {
  it('ยังไม่ประกาศ → ประกาศแล้วแต่ยังไม่ได้โพสต์ (ไม่มีลิงก์ ไม่เคยสั่ง) → โพสต์แล้วยังไม่มีคนกรอก', () => {
    expect(stuckReasonOf(sig({ released: false }))).toBe('not_released');
    expect(stuckReasonOf(sig({ links: 0 }))).toBe('not_posted');
    expect(stuckReasonOf(sig({ links: 0, post: 'rejected' }))).toBe('not_posted');
    expect(stuckReasonOf(sig({ links: 0, post: 'posted' }))).toBe('no_apps');
    expect(stuckReasonOf(sig({ links: 2 }))).toBe('no_apps');
  });
  it('มีชื่อแล้ว: ในคิว AI / ไม่มีใครโทร / AI สนใจแล้วคนยังไม่โทรต่อ', () => {
    expect(stuckReasonOf(sig({ queued: 3, uncalled: 3, c: { apps: 3 } }))).toBe('queued_not_called');
    expect(stuckReasonOf(sig({ uncalled: 3, c: { apps: 3 } }))).toBe('names_not_called');
    expect(stuckReasonOf(sig({ c: { apps: 3, aiCalled: 3, aiYes: 2 } }))).toBe('staff_not_calling');
  });
  it('โทรแล้ว: ยังไม่ครบ / ชื่อหมด / ติดต่อไม่ได้ / ไม่สนใจ · ได้คน: นัด → มา → ผ่าน → รอเริ่มงาน', () => {
    expect(stuckReasonOf(sig({ uncalled: 2, c: { apps: 5, aiCalled: 3 } }))).toBe('calling_no_interest');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5 } }))).toBe('names_exhausted');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, staffFollowed: 2 } }))).toBe('cannot_reach');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, staffFollowed: 2, staffReached: 2, notInterested: 2 } }))).toBe('not_interested');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, staffFollowed: 2, staffReached: 2, interested: 1 } }))).toBe('no_appointment');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, appointed: 1 } }))).toBe('appointed_not_show');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, appointed: 1, showed: 1 } }))).toBe('showed_not_passed');
    expect(stuckReasonOf(sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, appointed: 1, showed: 1, passed: 1 } }))).toBe('waiting_start');
  });
  it('ทุกเหตุอยู่ในช่วงเดียว · 4 ช่วงครอบทุกเหตุ', () => {
    const all = Object.keys(STUCK_REASON_LABEL);
    expect(STUCK_PHASES.flatMap((p) => p.reasons).sort()).toEqual([...all].sort());
    for (const k of all) expect(STUCK_PHASES.some((p) => p.key === stuckPhaseOf(k as never))).toBe(true);
  });
});

const row = (no: string, p: Partial<StuckRequest>): StuckRequest => ({
  requestNo: no, jobId: `siamraj-sql:${no}`, day: '2026-11-01', unitName: 'SCB', position: 'ขับรถ', siteCode: 'S', siteName: 'SCB', sector: null,
  province: 'กรุงเทพมหานคร', district: 'ปทุมวัน', subdistrict: null, leadKind: null, subtype: null, requested: 1, filled: 0, cancelled: 0, remaining: 1,
  released: true, applications: 0, recruiter: 'แบงค์', ageDays: 3, bu: 'LBD', screener: null, signals: sig(), reason: 'no_apps', releasedAt: null, releasedBy: null, ...p,
});
const ROWS = [
  row('A', { reason: 'not_released', ageDays: 40 }),
  row('B', { reason: 'no_apps' }),
  row('C', { reason: 'staff_not_calling', recruiter: 'หมิว', province: 'ชลบุรี', district: 'ศรีราชา' }),
  row('D', { reason: 'not_interested', recruiter: null, province: null, district: null, ageDays: null }),
  row('E', { reason: 'appointed_not_show', recruiter: 'หมิว', remaining: 2 }),
];

describe('รวมเท่าทั้งหมด', () => {
  it('🔴 4 ช่วง · ทุกเหตุ · ติดที่ใคร · พื้นที่ (จังหวัด→อำเภอ) รวมเท่าใบทั้งหมด', () => {
    const ph = stuckByPhase(ROWS);
    expect(Object.values(ph).reduce((s, l) => s + l.length, 0)).toBe(ROWS.length);
    expect(Object.values(stuckByReason(ROWS)).reduce((s, l) => s + l.length, 0)).toBe(ROWS.length);
    const owners = stuckByOwner(ROWS);
    expect(owners.reduce((s, o) => s + o.rows.length, 0)).toBe(ROWS.length);
    expect(owners.map((o) => [o.name, o.rows.length, o.oldest])).toEqual([
      ['แบงค์', 2, 40],
      ['หมิว', 2, 3],
      [NO_RECRUITER_LABEL, 1, 0],
    ]);
    const places = stuckByPlace(ROWS);
    expect(places.reduce((s, p) => s + p.rows.length, 0)).toBe(ROWS.length);
    expect(places.map((p) => [p.name, p.rows.length, p.children.map((c) => c.name)])).toEqual([
      ['กรุงเทพมหานคร', 3, ['ปทุมวัน']],
      ['ชลบุรี', 1, ['ศรีราชา']],
      ['ไม่ระบุ', 1, ['ไม่ระบุ']],
    ]);
    for (const o of owners) expect(Object.values(o.byPhase).reduce((s, l) => s + l.length, 0)).toBe(o.rows.length);
  });
  it('เส้นทางของใบ: ขั้นที่ติดมีป้าย · ขั้นอื่นไม่มี', () => {
    const steps = stuckSteps(row('X', { reason: 'cannot_reach', signals: sig({ c: { apps: 5, aiCalled: 5, aiYes: 2, staffFollowed: 2 } }) }));
    expect(steps.filter((s) => s.stuck).map((s) => s.key)).toEqual(['reached']);
    expect(steps.find((s) => s.key === 'apps')?.value).toBe(5);
  });
  it('เทียบเดือน: รวมเฉพาะใบที่ผ่านตัวกรอง · ไม่กรอง = รวมทุกใบ', () => {
    const rows = [
      { month: '2026-10', jobId: 'j1', requests: 1, apps: 10, booked: 2, informed: 1 },
      { month: '2026-10', jobId: 'j2', requests: 1, apps: 5, booked: 0, informed: 0 },
      { month: '2026-11', jobId: 'j1', requests: 0, apps: 3, booked: 1, informed: 0 },
      { month: '2026-11', jobId: '', requests: 0, apps: 4, booked: 0, informed: 0 },
    ];
    expect(monthlySeries(rows, 'apps', () => true)).toEqual([{ month: '2026-10', value: 15 }, { month: '2026-11', value: 7 }]);
    expect(monthlySeries(rows, 'apps', (j) => j === 'j1')).toEqual([{ month: '2026-10', value: 10 }, { month: '2026-11', value: 3 }]);
  });
});

describe('ต่อสาย', () => {
  it('API ลงทะเบียน · ใช้ตัวนับคนชุดเดียวกับเส้น 12 ขั้น · เหตุตัดสินที่ lib เดียว', () => {
    const api = readFileSync('api/_handlers/recruit-stuck.ts', 'utf8');
    expect(api).toContain('countsOf(fs, 0, 0)');
    expect(api).toContain('reason: stuckReasonOf(signals)');
    expect(api).toContain("readUnitRequestListThroughCache({ limit: 500, departmentScope })");
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/recruit-stuck': recruitStuckHandler as ApiHandler,");
  });
});
