// @vitest-environment node
/**
 * ═══ ชุด Journey 3 ต.ค. 2569 — ตรรกะใหม่ 4 ตัว ═══
 *
 * 1. `followedSpan` — "ติดตามมา N วัน" บนการ์ดติดตามครบ (ข้อ 14) · นับช่วงวันแรก→วันสุดท้าย
 *    ไม่นับถึงวันนี้ (ตัวเลขห้ามโตเองตอนกองค้าง) · ยกเลิกไม่นับ
 * 2. `followRoundPeople` — รอบแรกกี่คน รอบ 2+ กี่คน (ข้อ 15) · นับคนด้วยเบอร์ ไม่ใช่สาย
 * 3. `followCallerStats` — AI/คนโทร โทรเท่าไหร่ ติดต่อได้เท่าไหร่ · ผลคนลงเองทับผลคิว
 *    (นิยามเดียวกับ `effectiveCallOutcome` ของหน้ารายการ)
 * 4. `buildAftercareRealPlans` — หน้าดูแลใช้รอบที่ตั้งตอนย้าย ไม่คิดใหม่จากวันเริ่มงาน
 */
import { describe, expect, it } from 'vitest';
import { followedSpan } from '../../src/lib/followCompletion.js';
import { followCallerStats, followRoundPeople } from '../../src/lib/trends/followTrends.js';
import type { FollowTrendRow } from '../../src/lib/trends/types.js';
import { aftercareRealPlanSummary, buildAftercareRealPlans } from '../../src/lib/aftercarePlanning.js';
import type { FollowEntry } from '../../src/lib/followApi.js';

const trendRow = (over: Partial<FollowTrendRow>): FollowTrendRow => ({
  id: Math.random().toString(36).slice(2),
  createdAt: null,
  scheduledAt: null,
  resultAt: null,
  completedAt: null,
  cancelledAt: null,
  outcomeCode: null,
  callStatus: null,
  callOutcome: null,
  attempt: null,
  callRound: 1,
  callMode: 'ai',
  phoneKey: null,
  staffCallOutcome: null,
  staffCalledAt: null,
  topic: 'ติดตามเริ่มงาน',
  unitName: null,
  siteCode: null,
  staffId: null,
  staffName: null,
  bu: null,
  ...over,
});

const entry = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: Math.random().toString(36).slice(2),
    recipient_name: 'ทดสอบ',
    recipient_phone: '+66890000001',
    topic: 'ถามความเป็นอยู่หลังเริ่มงาน',
    scheduled_at: '2026-10-05T03:00:00Z',
    cancelled: false,
    completed_at: null,
    call_status: null,
    call_outcome: null,
    staff_call_outcome: null,
    ...over,
  }) as unknown as FollowEntry;

const RANGE = { from: '2026-10-01', to: '2026-10-31' };

describe('followedSpan — ติดตามมา N วัน (Journey ข้อ 14)', () => {
  it('ช่วง 1-7 ต.ค. = 7 วัน (รวมปลายสองข้าง) และนับเฉพาะสายที่ไม่ยกเลิก', () => {
    const span = followedSpan({
      rounds: [
        { cancelled: false, scheduled_at: '2026-10-01T02:00:00Z' },
        { cancelled: false, scheduled_at: '2026-10-07T10:00:00Z' },
        // ยกเลิกวันหลังสุด — ห้ามลากช่วงให้ยาวขึ้น
        { cancelled: true, scheduled_at: '2026-10-20T02:00:00Z' },
      ] as FollowEntry[],
    });
    expect(span).toMatchObject({ days: 7, from: '2026-10-01', to: '2026-10-07', calls: 2 });
  });

  it('วันเดียว = 1 วัน · ไม่มีสายเลย = null (จอไม่ขึ้นบรรทัด)', () => {
    expect(followedSpan({ rounds: [{ cancelled: false, scheduled_at: '2026-10-03T01:00:00Z' }] as FollowEntry[] })?.days).toBe(1);
    expect(followedSpan({ rounds: [] })).toBeNull();
    expect(followedSpan({ rounds: [{ cancelled: true, scheduled_at: '2026-10-03T01:00:00Z' }] as FollowEntry[] })).toBeNull();
  });

  it('ข้ามเที่ยงคืนไทย — 17:30Z คือวันถัดไปของกรุงเทพ', () => {
    const span = followedSpan({
      rounds: [{ cancelled: false, scheduled_at: '2026-10-01T17:30:00Z' }] as FollowEntry[],
    });
    expect(span?.from).toBe('2026-10-02');
  });
});

describe('followRoundPeople — รอบแรกกี่คน รอบ 2+ กี่คน (Journey ข้อ 15)', () => {
  it('นับเป็นคน (เบอร์เดียวหลายสายรอบเดียวกัน = 1 คน) และยกเลิกไม่นับ', () => {
    const rows = [
      trendRow({ phoneKey: '890000001', callRound: 1, scheduledAt: '2026-10-03T02:00:00Z' }),
      trendRow({ phoneKey: '890000001', callRound: 1, scheduledAt: '2026-10-04T02:00:00Z' }),
      trendRow({ phoneKey: '890000001', callRound: 2, scheduledAt: '2026-10-05T02:00:00Z' }),
      trendRow({ phoneKey: '890000002', callRound: 3, scheduledAt: '2026-10-05T02:00:00Z' }),
      trendRow({ phoneKey: '890000003', callRound: 1, scheduledAt: '2026-10-05T02:00:00Z', cancelledAt: '2026-10-05T03:00:00Z' }),
      // นอกช่วง — ไม่นับ
      trendRow({ phoneKey: '890000004', callRound: 1, scheduledAt: '2026-11-05T02:00:00Z' }),
    ];
    expect(followRoundPeople(rows, RANGE)).toEqual({ first: 1, later: 2 });
  });

  it('ไม่มีเบอร์ = นับด้วย id (ไม่หายเงียบ) · callRound null = สายแรก', () => {
    const rows = [
      trendRow({ phoneKey: null, callRound: null, scheduledAt: '2026-10-03T02:00:00Z' }),
      trendRow({ phoneKey: null, callRound: null, scheduledAt: '2026-10-03T02:00:00Z' }),
    ];
    expect(followRoundPeople(rows, RANGE)).toEqual({ first: 2, later: 0 });
  });
});

describe('followCallerStats — AI/คนโทร โทรเท่าไหร่ ติดต่อได้เท่าไหร่', () => {
  it('ฝั่ง AI ใช้ผลคิว · ฝั่งคนใช้ผลที่คนลงเอง (acknowledged = ติดต่อได้)', () => {
    const rows = [
      trendRow({ callMode: 'ai', callStatus: 'completed', callOutcome: 'confirmed', resultAt: '2026-10-03T02:00:00Z' }),
      trendRow({ callMode: 'ai', callStatus: 'completed', callOutcome: 'no_answer', resultAt: '2026-10-03T02:00:00Z' }),
      trendRow({ callMode: 'manual', staffCallOutcome: 'acknowledged', staffCalledAt: '2026-10-03T02:00:00Z' }),
      trendRow({ callMode: 'manual', staffCallOutcome: 'no_answer', staffCalledAt: '2026-10-03T02:00:00Z' }),
      // ยังไม่มีผล — ไม่นับเป็น "โทรแล้ว"
      trendRow({ callMode: 'manual' }),
      trendRow({ callMode: 'ai', callStatus: 'pending' }),
    ];
    expect(followCallerStats(rows, RANGE)).toEqual({
      ai: { calls: 2, connected: 1 },
      manual: { calls: 2, connected: 1 },
    });
  });

  it('ผลที่คนลงเองทับผลคิว และนับที่วันที่คนลง ไม่ใช่วันผลคิว', () => {
    const rows = [
      trendRow({
        callMode: 'manual',
        callStatus: 'completed',
        callOutcome: 'no_answer',
        resultAt: '2026-09-01T02:00:00Z', // นอกช่วง
        staffCallOutcome: 'confirmed',
        staffCalledAt: '2026-10-03T02:00:00Z', // ในช่วง
      }),
    ];
    expect(followCallerStats(rows, RANGE)).toEqual({
      ai: { calls: 0, connected: 0 },
      manual: { calls: 1, connected: 1 },
    });
  });
});

describe('buildAftercareRealPlans — หน้าดูแลใช้รอบที่ตั้งตอนย้าย (แหล่งเดียว)', () => {
  const now = new Date('2026-10-05T00:00:00Z');

  it('จับกลุ่มด้วยเบอร์ 9 ตัวท้าย · แยก มีผลแล้ว/เลยกำหนด/นัดถัดไป', () => {
    const plans = buildAftercareRealPlans(
      [
        entry({ scheduled_at: '2026-10-01T02:00:00Z', completed_at: '2026-10-01T03:00:00Z' }),
        entry({ scheduled_at: '2026-10-03T02:00:00Z' }), // เลยเวลาแล้ว ไม่มีผล
        entry({ id: 'next-one', scheduled_at: '2026-10-10T02:00:00Z' }),
        entry({ scheduled_at: '2026-10-02T02:00:00Z', cancelled: true }), // ยกเลิก — หายทั้งแผน
      ],
      now,
    );
    const plan = plans.get('890000001');
    expect(plan).toBeTruthy();
    expect(plan?.calls).toHaveLength(3);
    expect(plan?.done).toBe(1);
    expect(plan?.overdue).toBe(1);
    expect(plan?.next?.id).toBe('next-one');
    expect(aftercareRealPlanSummary(plan!)).toBe('ตั้งรอบไว้ 3 สาย · มีผลแล้ว 1 · เลยกำหนด 1');
  });

  it('ผลที่คนลงเอง (staff_call_outcome) นับว่ามีผลแล้ว — ไม่ใช่เลยกำหนด', () => {
    const plans = buildAftercareRealPlans(
      [entry({ scheduled_at: '2026-10-01T02:00:00Z', staff_call_outcome: 'acknowledged' } as Partial<FollowEntry>)],
      now,
    );
    const plan = plans.get('890000001');
    expect(plan?.done).toBe(1);
    expect(plan?.overdue).toBe(0);
  });

  it('ยกเลิกหมด = ไม่มีแผน (ถอยไปรอบ preset จากวันเริ่มงาน)', () => {
    const plans = buildAftercareRealPlans([entry({ cancelled: true })], now);
    expect(plans.size).toBe(0);
  });
});
