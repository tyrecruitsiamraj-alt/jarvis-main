// @vitest-environment node
/**
 * ภาพรวมงานสรรหาหน้าเดียว 4 ข้อ (เจ้าของ 11 พ.ย. 2569 "ทำไมต้องแยกกัน เอามันรวมกันเลย" → แบบร่างรอบ 2 "ทำตามแบบร่างนี้")
 * 1 ใครต้องทำอะไร · 2 ทำแล้วเป็นไง · 3 ที่มามาจากใคร · 4 ช่องทางไหนทำได้ดี — ทุกตารางบวกกันลงตัว
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STUCK_TODO_COLUMNS, stuckTodoByOwner, stuckTodoPeople, type StuckReasonKey, type StuckRequest } from '@/lib/recruitStuck';
import { buildCallerResults } from '@/lib/callerResults';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const counts = (p: Partial<StuckRequest['signals']['counts']> = {}) =>
  ({ apps: 0, aiCalled: 0, aiYes: 0, aiNo: 0, aiOutOfArea: 0, aiNoPickup: 0, aiOther: 0, staffCalled: 0, staffFollowed: 0, staffReached: 0, aiYesNoStaff: 0, interested: 0, notInterested: 0, appointed: 0, apptFailed: 0, showed: 0, noShow: 0, passed: 0, notPassed: 0, followStarts: 0, aftercare: 0, ...p }) as StuckRequest['signals']['counts'];
const req = (no: string, recruiter: string | null, reason: StuckReasonKey, sig: Partial<StuckRequest['signals']> = {}, c: Partial<StuckRequest['signals']['counts']> = {}) =>
  ({ requestNo: no, jobId: `siamraj-sql:${no}`, recruiter, reason, ageDays: 3, signals: { released: true, links: 1, post: null, uncalled: 0, queued: 0, counts: counts(c), ...sig } }) as unknown as StuckRequest;

describe('1 ใครต้องทำอะไร', () => {
  const rows = [
    req('OPL6911001', 'คิว', 'not_released'),
    req('OPL6911002', 'คิว', 'names_not_called', { uncalled: 4 }),
    req('OPL6911003', 'คิว', 'staff_not_calling', { uncalled: 0 }, { aiYesNoStaff: 2 }),
    req('OPL6911004', 'แบงค์', 'calling_no_interest', { uncalled: 6 }),
    req('OPL6911005', 'แบงค์', 'waiting_start', {}, { appointed: 3 }),
    req('OPL6911006', null, 'not_posted'),
  ];
  it('ทุกใบอยู่ช่องเดียว · แถวรวมเท่าใบทั้งหมด · ใบไม่มีเจ้าหน้าที่ลงแถวยังไม่ได้ตั้ง', () => {
    const t = stuckTodoByOwner(rows);
    expect(t.map((o) => [o.owner, o.total])).toEqual([['คิว', 3], ['แบงค์', 2], ['ยังไม่ได้ตั้งเจ้าหน้าที่สรรหา', 1]]);
    for (const o of t) expect(STUCK_TODO_COLUMNS.reduce((n, c) => n + o.cells[c.key].length, 0)).toBe(o.total);
    expect(t.reduce((n, o) => n + o.total, 0)).toBe(rows.length);
  });
  it('คนในช่อง: รอโทร = ยังไม่มีใครโทร (AI ว่าสนใจ = คนที่ยังไม่โทรต่อ) · เหลือโทร = ยังไม่ได้โทร · รอปิดใบ = นัดได้ · ช่องประกาศ/โพสต์ = 0', () => {
    expect(rows.map(stuckTodoPeople)).toEqual([0, 4, 2, 6, 3, 0]);
  });
});

const fact = (id: string, p: Partial<RecruitAppFact>) => ({ id, claimedBy: null, logOk: null, appointmentAt: null, attendance: null, informed: null, calledByAi: false, aiAnswer: null, ...p }) as unknown as RecruitAppFact;

describe('2 ทำแล้วเป็นไง — ทุกขั้นบอกทำแล้ว/ยังไม่ทำ และบวกกันเท่าขั้นก่อนหน้า', () => {
  const cohort = [
    fact('a1', { claimedBy: 'อ้น' }),
    fact('a2', { claimedBy: 'อ้น', logOk: false }),
    fact('a3', { claimedBy: 'อ้น', logOk: true }),
    fact('a4', { claimedBy: 'อ้น', logOk: true, appointmentAt: '2026-11-12T03:00:00Z' }),
    fact('a5', { claimedBy: 'อ้น', logOk: true, appointmentAt: '2026-11-10T03:00:00Z', attendance: 'no_show' }),
    fact('a6', { claimedBy: 'อ้น', logOk: true, appointmentAt: '2026-11-09T03:00:00Z', attendance: 'showed', informed: false }),
    fact('a7', { claimedBy: 'อ้น', logOk: true, appointmentAt: '2026-11-08T03:00:00Z', attendance: 'showed', informed: true }),
    fact('b1', { calledByAi: false }),
    fact('b2', { calledByAi: true, aiAnswer: 'no_pickup' }),
    fact('b3', { calledByAi: true, aiAnswer: 'said_no' }),
    fact('b4', { calledByAi: true, aiAnswer: 'said_yes' }),
  ];
  const r = buildCallerResults(cohort);
  const n = (ids: string[]) => ids.length;
  it('คนโทร', () => {
    const o = r.rows[0];
    expect(o.who).toBe('อ้น');
    expect(n(o.kept)).toBe(n(o.notLogged) + n(o.notOk) + n(o.ok));
    expect(n(o.ok)).toBe(n(o.notBooked) + n(o.booked));
    expect(n(o.booked)).toBe(n(o.attPending) + n(o.noShow) + n(o.showed));
    expect(n(o.showed)).toBe(n(o.notInformed) + n(o.informed));
    expect([o.kept, o.notLogged, o.notOk, o.ok, o.notBooked, o.booked, o.attPending, o.noShow, o.showed, o.notInformed, o.informed].map(n)).toEqual([7, 1, 1, 5, 1, 4, 1, 1, 2, 1, 1]);
    expect(n(r.total.kept)).toBe(7);
  });
  it('AI = รายชื่อที่ยังไม่มีคนเก็บ: ส่ง = ยังไม่โทร + ติดต่อไม่ได้ + ติดต่อได้ · สนใจอยู่ในติดต่อได้ · คนโทร + AI = ทั้งหมด', () => {
    expect([r.ai.sent, r.ai.notCalled, r.ai.unreachable, r.ai.reached, r.ai.notInterested, r.ai.interested].map(n)).toEqual([4, 1, 1, 2, 1, 1]);
    expect(n(r.total.kept) + n(r.ai.sent)).toBe(cohort.length);
  });
});

describe('หน้าเดียว ไม่มีแท็บ', () => {
  const body = readFileSync('src/components/dashboard-trends/stuck/RecruitStuckBody.tsx', 'utf8');
  it('4 ข้อเรียงต่อกัน · การ์ดเดิมของแท็บอยู่ครบ · ไม่มีแท็บเจาะรายละเอียด', () => {
    for (const t of ['title="1. ใครต้องทำอะไร"', 'title="2. ทำแล้วเป็นไง"', 'title="3. ที่มามาจากใคร"', 'title="4. ช่องทางไหนทำได้ดี"']) expect(body).toContain(t);
    expect(body.indexOf('title="1. ใครต้องทำอะไร"')).toBeLessThan(body.indexOf('title="2. ทำแล้วเป็นไง"'));
    expect(body).not.toContain('detailTab');
    expect(body).not.toContain('เจาะรายละเอียด');
    for (const c of ['<ReleaseProgressCard', '<PersonJourneyCard', '<ReasonColumns', '<StuckAreaTable', '<MonthlyBarsCard']) expect(body).toContain(c);
  });
});

describe('ป๊อปรายชื่อบอกว่าอยู่ที่ใคร ค้างกี่วัน (เจ้าของ 11 พ.ย. 2569 "เก็บไปแล้วยังไม่โทรอยู่ใคร ค้างมากี่วันแล้ว")', () => {
  it('ไม่มีคนเก็บ · เก็บแล้วยังไม่ลงผลหลังเก็บ = ค้าง N วัน (วันไทย) · ลงผลหลังเก็บ = โทรแล้ว · สรุปต่อคน', async () => {
    const { holderStateOf, holderSummary } = await import('@/lib/recruitOverviewApi');
    const now = new Date('2026-11-11T05:00:00Z');
    const free = holderStateOf({ claimed_by: null, claimed_at: null, last_log_at: null, last_log_ok: null }, now);
    const wait = holderStateOf({ claimed_by: 'อ้น', claimed_at: '2026-11-07T18:00:00Z', last_log_at: '2026-11-05T03:00:00Z', last_log_ok: false }, now);
    const done = holderStateOf({ claimed_by: 'อ้น', claimed_at: '2026-11-07T18:00:00Z', last_log_at: '2026-11-09T03:00:00Z', last_log_ok: true }, now);
    expect(free).toEqual({ kind: 'free' });
    // เก็บ 8 พ.ย. ตีหนึ่งเวลาไทย → 11 พ.ย. = 3 วัน · ลงผลก่อนเก็บไม่นับ
    expect(wait).toEqual({ kind: 'waiting', who: 'อ้น', days: 3 });
    expect(done).toMatchObject({ kind: 'called', who: 'อ้น', ok: true });
    expect(holderSummary([free, wait, wait, done])).toEqual({ waiting: [{ who: 'อ้น', n: 2, maxDays: 3 }], free: 1, called: 1 });
  });
});
