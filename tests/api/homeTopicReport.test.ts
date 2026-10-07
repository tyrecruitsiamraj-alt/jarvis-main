/**
 * รายงานผลโทร งานสรรหา / จับคู่งาน / ดูแลหลังเริ่มงาน (7 ต.ค. 2569)
 * ล็อก: ก้อนตรงกติกากล่อง · ผลล่าสุดผลเดียว (ฝั่งใหม่กว่าชนะ) · ทุกช่องรวม = ทั้งหมด · BU ไม่มีงานไม่ขึ้น · ในก้อนครบ 4 แถว
 */
import { describe, expect, it } from 'vitest';
import {
  buildAftercareReport,
  buildApplicantsReport,
  buildMatchingReport,
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

  it('ผู้สมัคร: เส้นทาง · ทุกก้อนรวม = ทั้งหมด · ใบที่ยังรอ', () => {
    const rows = [
      row({ ai: true, ai_outcome: 'confirmed', ai_at: '2026-10-01T01:00:00Z', appointment: true, attendance: 'showed' }),
      row({ ai: true, ai_outcome: 'no_answer', ai_at: '2026-10-01T01:00:00Z', retry: true }),
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
    const r = buildApplicantsReport(rows, 5);
    expect(r.funnel.map((f) => [f.key, f.value])).toEqual([
      ['published', 5],
      ['total', 6],
      ['called', 3],
      ['interested', 2],
      ['appointment', 1],
      ['showed', 1],
    ]);
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
    const wait = Object.fromEntries(r.extra[1].items.map((i) => [i.key, i.value]));
    expect(wait).toMatchObject({ retry: 1, inQueue: 1, overAge: 1, untouched: 1 });
    const hand = Object.fromEntries(r.extra[0].items.map((i) => [i.key, i.value]));
    expect(hand).toMatchObject({ handoff: 1, staffResult: 1 });
  });

  it('จับคู่งาน / ดูแลหลังเริ่มงาน: รวม = ทั้งหมด · ว่าง = ไม่มีก้อน', () => {
    const none = { jobs: 0, people: 0, green: 0, yellow: 0, red: 0 };
    expect(reportBuBlocks(buildMatchingReport([], none))).toEqual([]);
    // จับคู่ไว้รอ (เจ้าของ "ยังใช้อยู่ … ต้อง match ไว้รอ") อยู่หน้าเส้นทาง · สีรวม = คนที่จับคู่ไว้
    const m = buildMatchingReport([row({ ai: true, ai_outcome: 'declined', ai_at: '2026-10-01T00:00:00Z' }), row({ waiting_ai: true })], {
      jobs: 38,
      people: 560,
      green: 300,
      yellow: 200,
      red: 60,
    });
    expect(m.funnel.map((f) => [f.key, f.value])).toEqual([
      ['jobsMatched', 38],
      ['matched', 560],
      ['total', 2],
      ['called', 1],
      ['interested', 0],
    ]);
    const tiers = m.extra[0].items.reduce((n, i) => n + i.value, 0);
    expect(tiers).toBe(560);
    const a = buildAftercareReport([
      row({ ai: true, ai_outcome: 'confirmed', ai_at: '2026-10-01T00:00:00Z' }),
      row({ staff: true, staff_outcome: 'no_answer', staff_at: '2026-10-01T00:00:00Z' }),
    ]);
    const b = reportBuBlocks(a)[0];
    expect(b.sum).toMatchObject({ reached: 1, noAnswer: 1 });
  });
});
