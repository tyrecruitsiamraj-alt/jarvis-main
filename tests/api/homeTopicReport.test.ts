/**
 * รายงานผลโทร งานสรรหา / จับคู่งาน / ดูแลหลังเริ่มงาน (7 ต.ค. 2569)
 * ล็อก: ก้อนตรงกติกากล่อง · ผลล่าสุดผลเดียว (ฝั่งใหม่กว่าชนะ) · ทุกช่องรวม = ทั้งหมด · BU ไม่มีงานไม่ขึ้น · ในก้อนครบ 4 แถว
 */
import { describe, expect, it } from 'vitest';
import {
  buildAftercareReport,
  buildApplicantsReport,
  buildMatchingReport,
  dispatchKindOf,
  emptyMatchingFlow,
  fastCallerOf,
  firstCallerOf,
  interestColOf,
  reportBuBlocks,
  REPORT_SEGS,
  segOf,
  type ReportSourceRow,
} from '@/lib/homeTopicReport';

const row = (p: Partial<ReportSourceRow>): ReportSourceRow => ({
  ai: false,
  staff: false,
  bu: 'LBD',
  ai_outcome: null,
  ai_summary: null,
  ai_reply: null,
  ai_at: null,
  staff_outcome: null,
  staff_at: null,
  ...p,
});

describe('homeTopicReport', () => {
  it('ก้อน = กติกาเดียวกับกล่อง', () => {
    expect(segOf({ ai: true, staff: false })).toBe('ai');
    expect(segOf({ ai: false, staff: true })).toBe('staff');
    expect(segOf({ ai: true, staff: true })).toBe('both');
    expect(segOf({ ai: false, staff: false })).toBe('notCalled');
  });

  it('ผลล่าสุดผลเดียว — ฝั่งใหม่กว่าชนะ · บันทึกติดต่อที่ใหม่กว่า: ไม่สำเร็จ = ไม่สนใจ', () => {
    expect(interestColOf(row({ ai: true, ai_outcome: 'confirmed', ai_at: '2026-10-01T01:00:00Z' }))).toBe('interested');
    expect(interestColOf(row({ ai: true, ai_outcome: 'no_answer', ai_at: '2026-10-01T01:00:00Z' }))).toBe('noAnswer');
    // AI สนใจ แล้วคนโทรทีหลังได้ไม่สนใจ ⇒ ไม่สนใจ
    expect(
      interestColOf(
        row({
          ai: true,
          staff: true,
          ai_outcome: 'confirmed',
          ai_at: '2026-10-01T01:00:00Z',
          staff_outcome: 'declined',
          staff_at: '2026-10-01T02:00:00Z',
        }),
      ),
    ).toBe('notInterested');
    expect(interestColOf(row({ staff: true, log_ok: false, log_at: '2026-10-02T00:00:00Z' }))).toBe('notInterested');
    expect(interestColOf(row({}))).toBe('noResult');
  });

  it('ผู้สมัคร: เส้นทาง · ทุกก้อนรวม = ทั้งหมด · ไม่มีส่วนใบที่ยังรอแล้ว', () => {
    const rows = [
      row({ ai: true, ai_outcome: 'confirmed', ai_at: '2026-10-01T01:00:00Z', appointment: true, attendance: 'showed' }),
      row({ ai: true, ai_outcome: 'no_answer', ai_at: '2026-10-01T01:00:00Z' }),
      row({
        ai: true,
        staff: true,
        ai_outcome: 'confirmed',
        ai_at: '2026-10-01T01:00:00Z',
        staff_outcome: 'confirmed',
        staff_at: '2026-10-02T01:00:00Z',
      }),
      row({ bu: 'LBA', in_queue: true }),
      row({ bu: 'LBA', age: 60 }),
      row({ bu: null }),
    ];
    const r = buildApplicantsReport(rows, 5, 9);
    expect(r.funnel.map((f) => [f.key, f.value])).toEqual([
      ['jobsIn', 9],
      ['published', 5],
      ['total', 6],
      ['called', 3],
      ['fast', 0],
      ['interested', 2],
      ['appointment', 1],
      ['showed', 1],
    ]);
    // แยกในขั้นรวมกัน = เลขของขั้นเสมอ
    for (const f of r.funnel) if (f.parts) expect(f.parts.reduce((n, p) => n + p.value, 0)).toBe(f.value);
    const parts = (k: string) => Object.fromEntries((r.funnel.find((f) => f.key === k)?.parts ?? []).map((p) => [p.key, p.value]));
    expect(parts('total')).toEqual({ auto: 0, manual: 0, overAge: 1, notSent: 5 });
    expect(parts('called')).toEqual({ ai: 2, staff: 0, both: 1 });
    const blocks = reportBuBlocks(r);
    expect(blocks.map((b) => [b.bu, b.total])).toEqual([
      ['LBD', 3],
      ['LBA', 2],
      [null, 1],
    ]);
    expect(blocks.reduce((n, b) => n + b.total, 0)).toBe(rows.length);
    for (const b of blocks) {
      // ครบ 4 ก้อนเสมอ · แต่ละก้อนช่องรวม = ทั้งหมดของก้อน
      expect(Object.keys(b.bySeg)).toEqual(REPORT_SEGS.map((s) => s.key));
      for (const s of REPORT_SEGS) expect(Object.values(b.bySeg[s.key].cols).reduce((n, v) => n + v, 0)).toBe(b.bySeg[s.key].total);
    }
    // เจ้าของ 7 ต.ค. 2569: "งานสรรหา และ จับคู่งาน จะเอาพวกใบที่ยังรอมาทำไม" → เอาออก
    expect(r.extra.map((x) => x.title)).toEqual(['ส่งต่อให้คน']);
    const hand = Object.fromEntries(r.extra[0].items.map((i) => [i.key, i.value]));
    expect(hand).toMatchObject({ handoff: 1, staffResult: 1 });
  });

  it('ส่ง AI เอง/คนสั่ง ดูจากเวลา · โทรทันที 15 นาที · ใครโทรคนแรก', () => {
    const at = (m: number) => new Date(Date.parse('2026-10-01T03:00:00Z') + m * 60_000).toISOString();
    const base = { created_at: at(0) };
    expect(dispatchKindOf(row({ ...base, ai_queued_at: at(0.1) }))).toBe('auto');
    expect(dispatchKindOf(row({ ...base, ai_queued_at: at(30) }))).toBe('manual');
    expect(dispatchKindOf(row({ ...base, age: 60 }))).toBe('overAge');
    expect(dispatchKindOf(row({ ...base }))).toBe('notSent');
    const both = row({ ...base, ai: true, staff: true, first_ai_at: at(20), first_staff_at: at(5) });
    expect(firstCallerOf(both)).toBe('staff');
    expect(fastCallerOf(both)).toBe('staff');
    expect(fastCallerOf(row({ ...base, ai: true, first_ai_at: at(16) }))).toBeNull();
    expect(fastCallerOf(row({ ...base, ai: true, first_ai_at: at(3) }))).toBe('ai');
    // นัดที่ไม่มีหลักฐานโทร = คน (คนเป็นคนลงนัด)
    const r = buildApplicantsReport(
      [row({ ...base, appointment: true }), row({ ...base, ai: true, first_ai_at: at(1), appointment: true })],
      0,
    );
    const appt = Object.fromEntries((r.funnel.find((f) => f.key === 'appointment')?.parts ?? []).map((p) => [p.key, p.value]));
    expect(appt).toEqual({ ai: 1, staff: 1 });
  });

  it('จับคู่งาน / ดูแลหลังเริ่มงาน: รวม = ทั้งหมด · ว่าง = ไม่มีก้อน', () => {
    expect(reportBuBlocks(buildMatchingReport([], emptyMatchingFlow()))).toEqual([]);
    // เส้นทางจับคู่งาน (เจ้าของ "เข้ามากี่ใบ Ai match รอแล้วเท่าไหร่ คนโทร … คิดต่อให้บ้าง")
    const flow = {
      ...emptyMatchingFlow(),
      jobsIn: 37,
      jobsMatched: 37,
      jobsRecommend: 33,
      jobsNone: 4,
      matched: 555,
      green: 248,
      yellow: 267,
      red: 40,
    };
    const m = buildMatchingReport(
      [row({ ai: true, ai_outcome: 'declined', ai_at: '2026-10-01T00:00:00Z' }), row({ waiting_ai: true })],
      flow,
    );
    expect(m.funnel.map((f) => [f.key, f.value])).toEqual([
      ['jobsIn', 37],
      ['jobsMatched', 37],
      ['jobsRecommend', 33],
      ['matched', 555],
      ['total', 2],
      ['called', 1],
      ['interested', 0],
      ['reserved', 0],
      ['placed', 0],
    ]);
    expect(m.funnel.find((f) => f.key === 'matched')?.parts?.map((p) => p.value)).toEqual([248, 267, 40]);
    expect(m.cols.slice(0, 2).map((c) => c.label)).toEqual(['ไป', 'ไม่ไป']);
    expect(m.extra.map((x) => x.title)).toEqual(['ต้องสั่งงาน', 'ส่งต่อให้คน']);
    const a = buildAftercareReport([
      row({ ai: true, ai_outcome: 'confirmed', ai_at: '2026-10-01T00:00:00Z' }),
      row({ staff: true, staff_outcome: 'no_answer', staff_at: '2026-10-01T00:00:00Z' }),
    ]);
    const b = reportBuBlocks(a)[0];
    expect(b.sum).toMatchObject({ reached: 1, noAnswer: 1 });
  });
});
