/**
 * การ์ดที่นับฝั่งเซิร์ฟเวอร์เปลี่ยนตามตัวกรอง (เจ้าของ 4 พ.ย. 2569 "ให้การ์ดที่เหลือเปลี่ยนตามตัวกรองด้วย")
 * งานค้างตอนนี้ · ผลงานรายคน · คนแจ้งเข้ามาจากช่องทางไหน — 🔴 รวมทุกใบ = ยอดรวมเดิม
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aiOfJobs, backlogOfJobs, staffOfJobs } from '@/lib/recruitOverviewScope';
import { buildChannelPlacement, placementOfRequests, UNKNOWN_CHANNEL } from '@/lib/channelPlacement';
import { EMPTY_REQUEST_FILTER, jobFilterOf, type RecruitRequestRow } from '@/lib/recruitRequestTab';
import { backlogByJob, groupByJob, toAiRow, toBacklog, toStaffRows } from '../../api/_handlers/recruit-overview';

const NOW = Date.parse('2026-11-04T07:00:00Z');
const J1 = 'siamraj-sql:OPL6911001';
const J2 = 'siamraj-sql:OPL6911002';

describe('งานค้างตอนนี้ แยกต่อใบ', () => {
  const rows = [
    { created_at: '2026-11-04T01:00:00Z', job_id: J1, bad_phone: false, called: false, in_queue: true },
    { created_at: '2026-10-20T01:00:00Z', job_id: J1, bad_phone: true, called: false, in_queue: false },
    { created_at: '2026-11-02T01:00:00Z', job_id: J2, bad_phone: false, called: false, in_queue: false },
    { created_at: '2026-11-01T01:00:00Z', job_id: null, bad_phone: false, called: false, in_queue: false },
    { created_at: '2026-11-01T01:00:00Z', job_id: J2, called: true, ai_outcome: 'interested', ai_at: '2026-11-03T01:00:00Z', staff_last_at: null },
  ];
  const appt = [
    { job_id: J1, overdue: 2, next7: 1 },
    { job_id: J2, overdue: 0, next7: 3 },
  ];
  const total = toBacklog(rows, appt, NOW);
  const by = backlogByJob(rows, appt, NOW, () => 'unknown');

  it('🔴 รวมทุกใบ (ไม่กรอง) = ยอดรวมเดิมทุกช่อง', () => {
    expect(backlogOfJobs(by, () => true, total)).toEqual(total);
  });
  it('เลือกใบเดียว = นับเฉพาะใบนั้น · ใบสมัครที่ไม่ผูกใบขอไม่นับตอนกรอง', () => {
    const one = backlogOfJobs(by, (j) => j === J1, total);
    expect([one.uncalled.total, one.uncalled.inQueue, one.uncalled.badPhone, one.appointments]).toEqual([2, 1, 1, { overdue: 2, next7: 1 }]);
    expect(backlogOfJobs(by, () => false, total).uncalled.total).toBe(0);
  });
  it('ตารางผลนัดยังไม่พร้อม (null) = ยังเป็น null ตอนกรอง', () => {
    const t = toBacklog(rows, null, NOW);
    expect(backlogOfJobs(backlogByJob(rows, null, NOW, () => 'unknown'), (j) => j === J1, t).appointments).toBeNull();
  });
});

describe('ผลงานรายคน แยกต่อใบ', () => {
  const events = [
    { kind: 'claim', app_id: 'a1', name: 'แบงค์', job_id: J1 },
    { kind: 'log', app_id: 'a1', name: 'แบงค์', reached: true, appt: true, job_id: J1 },
    { kind: 'log', app_id: 'a2', name: 'แบงค์', reached: false, appt: false, job_id: J2 },
    { kind: 'hold', app_id: 'a3', name: 'เล็ก', reached: true, appt: false, job_id: J2 },
  ];
  const showed = new Set(['a1']);
  const by = Object.fromEntries([...groupByJob(events)].map(([k, r]) => [k, toStaffRows(r, showed)]));
  it('🔴 รวมทุกใบ = ตารางเดิม · เลือกใบ = เฉพาะงานของใบนั้น', () => {
    expect(staffOfJobs(by, () => true)).toEqual(toStaffRows(events, showed));
    expect(staffOfJobs(by, (j) => j === J2).map((r) => [r.name, r.called, r.reached])).toEqual([
      ['แบงค์', 1, 0],
      ['เล็ก', 1, 1],
    ]);
  });
  it('AI: รวมทุกใบ = เดิม', () => {
    const ai = [
      { app_id: 'a1', outcome: 'interested', reached: true, at: '2026-11-03T01:00:00Z', job_id: J1 },
      { app_id: 'a2', outcome: 'no_answer', reached: false, at: '2026-11-03T01:00:00Z', job_id: J2 },
    ];
    const byAi = Object.fromEntries([...groupByJob(ai)].map(([k, r]) => [k, toAiRow(r)]));
    expect(aiOfJobs(byAi, () => true)).toEqual(toAiRow(ai));
  });
});

describe('คนแจ้งเข้า แยกตามใบขอ', () => {
  const win = { from: '2026-11-01', to: '2026-11-04' };
  const regs = [{ phone9: '811111111', at: '2026-10-25T01:00:00Z', channel: 'Facebook', sub: 'กลุ่ม A' }];
  const informs = [
    { phone9: '811111111', at: '2026-11-02', requestNo: 'OPL6911001' },
    { phone9: '822222222', at: '2026-11-03', requestNo: 'OPL6911002' },
    { phone9: '833333333', at: '2026-11-03', requestNo: 'OPL6911002', erpNews: { code: '1', name: null } },
  ];
  const p = buildChannelPlacement(regs, informs, win);
  it('🔴 รวมทุกใบ = แจ้งเข้าทั้งหมด · แยกใบได้ · ลงทะเบียน = 0 (ผูกใบขอไม่ได้)', () => {
    const all = placementOfRequests(p, () => true);
    expect([all.informed, all.matched]).toEqual([p.informed, p.matched]);
    const two = placementOfRequests(p, (rq) => rq === 'OPL6911002');
    expect(two.informed).toBe(2);
    expect(two.rows.find((r) => r.channel === UNKNOWN_CHANNEL)?.placed).toBe(1);
    expect(two.rows.every((r) => r.registered === 0)).toBe(true);
  });
});

describe('ตัวตัดสินเดียว + ต่อสาย', () => {
  it('ไม่กรอง = ผ่านทุกใบรวมไม่ผูกใบขอ · กรองเจ้าหน้าที่ = ตามเจ้าหน้าที่ของใบ', () => {
    const rows: RecruitRequestRow[] = [];
    expect(jobFilterOf(EMPTY_REQUEST_FILTER, rows, () => null)(null)).toBe(true);
    const ok = jobFilterOf({ ...EMPTY_REQUEST_FILTER, recruiter: 'แบงค์' }, rows, (j) => (j === J1 ? 'แบงค์' : 'เล็ก'));
    expect([ok(J1), ok(J2), ok(null)]).toEqual([true, false, false]);
  });
  it('หน้าใช้ยอดที่กรองแล้วทั้งสามการ์ด · ไม่มีคำว่า "ทุกใบขอ" แล้ว', () => {
    const src = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(src).toContain('backlogOfJobs(data.backlogByJob, sc.jobOk, data.backlog)');
    expect(src).toContain('<StaffTable staff={staff} ai={ai} />');
    expect(src).toContain('<ChannelPlacementTable data={placement} placedOnly={placementFiltered} />');
    expect(src).not.toContain('ทุกใบขอ');
    const api = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(api).toContain('body.backlogByJob = backlogByJob(');
    expect(api).toContain('body.staffByJob = ');
    expect(readFileSync('api/_lib/channelPlacementSql.ts', 'utf8')).toContain('RTRIM(IH.request_no) AS rq');
  });
});
