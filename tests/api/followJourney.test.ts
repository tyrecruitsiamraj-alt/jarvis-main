/**
 * เส้นทางติดตามบนหน้าหลัก (7 ต.ค. 2569) — เจ้าของ: *"ตัวเลขมันเปลี่ยนไปเปลี่ยนมา … เช็คเองมันดันเคยไม่ตรง ไม่เชื่อใจ"*
 * ล็อก 3 อย่าง: ผลทุกช่องรวมกัน = สายทั้งหมด · ช่องผลตรงกับแผงหน้าติดตาม (ขอเลื่อนอยู่ใต้สรุปไม่ได้) · คนนับไม่ซ้ำ
 */
import { describe, expect, it } from 'vitest';
import { followMatrixColOfCategory } from '@/lib/followCallMatrix';
import type { FollowCallCategory } from '@/lib/followPlanning';
import {
  FOLLOW_CALLER_COLS,
  FOLLOW_JOURNEY_RESULTS,
  followCallerBreakdown,
  journeyCount,
  journeyDaily,
  journeyEventsOf,
  journeyPerDay,
  journeyResultMatrixCol,
  journeyResultOf,
  journeyRowsOf,
  journeyScope,
  type FollowJourneyEvent,
  type FollowJourneyRow,
} from '@/lib/followJourney';

const row = (p: Partial<FollowJourneyRow> & { id: string }): FollowJourneyRow => ({
  person: p.id,
  name: `คน ${p.id}`,
  unit: null,
  bu: null,
  at: '2026-10-07T02:00:00.000Z',
  ymd: '2026-10-07',
  team: 'main',
  caller: 'ai',
  result: 'waiting',
  bucket: 'waiting',
  job: null,
  replaceType: null,
  ...p,
});

// bucket = ช่องของการ์ดผลโทร (server `followLedgerBucket`)
const ROWS: FollowJourneyRow[] = [
  row({ id: '1', person: 'a', result: 'agreed', bucket: 'went' }),
  row({ id: '2', person: 'a', result: 'agreed', caller: 'manual', bucket: 'went' }),
  row({ id: '3', person: 'b', result: 'lost', ymd: '2026-10-05', bucket: 'notWent' }),
  row({ id: '4', person: 'c', result: 'reschedule', bucket: 'reschedule' }),
  row({ id: '5', person: 'd', result: 'other', bucket: 'unclear' }),
  row({ id: '6', person: 'e', result: 'unreachable', caller: 'manual', bucket: 'failed' }),
  row({ id: '7', person: 'f', result: 'cancelled', team: 'replacement', job: 'J1', replaceType: 'WL', bucket: 'cancelled' }),
  row({ id: '8', person: 'f', result: 'waiting', team: 'replacement', job: 'J1', replaceType: 'WL' }),
  row({ id: '9', person: 'g', result: 'waiting', team: 'replacement', job: 'J2', replaceType: 'EX' }),
  row({ id: '10', person: 'h', result: 'waiting', team: 'replacement', replaceType: null }),
];

const EVENTS: FollowJourneyEvent[] = [
  { at: '2026-10-07T03:00:00.000Z', ymd: '2026-10-07', kind: 'edit', job: 'J1', name: 'ก', unit: null },
  { at: '2026-10-07T04:00:00.000Z', ymd: '2026-10-07', kind: 'edit', job: 'J1', name: 'ก', unit: null },
  { at: '2026-10-07T05:00:00.000Z', ymd: '2026-10-07', kind: 'cancel', job: 'J2', name: 'ข', unit: null },
];

describe('followJourney', () => {
  it('ผลทุกช่องรวมกัน = สายทั้งหมด ทุกมุมมอง', () => {
    for (const view of ['all', 'main', 'replacement'] as const) {
      const rows = journeyScope(ROWS, view);
      const sum = FOLLOW_JOURNEY_RESULTS.reduce((n, r) => n + journeyCount(rows, [], r).calls, 0);
      expect(sum).toBe(journeyCount(rows, [], 'added').calls);
      expect(journeyCount(rows, [], 'ai').calls + journeyCount(rows, [], 'manual').calls).toBe(rows.length);
    }
  });

  it('ช่องผลตรงกับแผงหน้าติดตาม — ขอเลื่อนนับใต้สรุปไม่ได้', () => {
    const cats: FollowCallCategory[] = ['agreed', 'lost', 'unreachable', 'other', 'waiting', 'overdue', 'notSent', 'cancelled'];
    for (const c of cats) {
      expect(journeyResultMatrixCol(journeyResultOf(c, null))).toBe(followMatrixColOfCategory(c));
      expect(journeyResultMatrixCol(journeyResultOf(c, 'reschedule_requested'))).toBe(followMatrixColOfCategory(c));
    }
    expect(journeyResultOf('other', 'reschedule_requested')).toBe('reschedule');
    expect(journeyResultOf('other', 'acknowledged')).toBe('other');
    expect(journeyResultOf('overdue', null)).toBe('waiting');
  });

  it('คนนับไม่ซ้ำ สายนับทุกแถว', () => {
    expect(journeyCount(ROWS, [], 'added')).toEqual({ people: 8, calls: 10 });
    expect(journeyCount(ROWS, [], 'agreed')).toEqual({ people: 1, calls: 2 });
    expect(journeyCount(ROWS, [], 'called')).toEqual({ people: 5, calls: 6 });
  });

  it('ส่งคนแทน: ใบ iRecruit · WL = รายชื่อ WL · ไม่ใช่ WL = ที่เหลือ (8 ต.ค. 2569)', () => {
    const rep = journeyScope(ROWS, 'replacement');
    expect(journeyCount(rep, [], 'irecruit')).toEqual({ people: 2, calls: 3 });
    expect(journeyRowsOf(rep, 'inside').map((r) => r.id)).toEqual(['7', '8']);
    expect(journeyRowsOf(rep, 'outside').map((r) => r.id)).toEqual(['9', '10']);
  });

  it('iRecruit แก้/ยกเลิก นับใบไม่ซ้ำ + ครั้ง', () => {
    expect(journeyCount([], EVENTS, 'irecruitEdit')).toEqual({ people: 1, calls: 2 });
    expect(journeyCount([], EVENTS, 'irecruitCancel')).toEqual({ people: 1, calls: 1 });
    expect(journeyEventsOf(EVENTS, 'agreed')).toEqual([]);
  });

  it('รายวันครบทุกวันในช่วง วันว่าง = 0', () => {
    const d = journeyDaily(ROWS, [], 'added');
    expect(d.map((x) => x.ymd)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(d[1]).toEqual({ ymd: '2026-10-06', people: 0, calls: 0 });
    expect(d.reduce((n, x) => n + x.calls, 0)).toBe(ROWS.length);
    expect(journeyDaily([], [], 'added')).toEqual([]);
  });

  it('เฉลี่ยคนต่อวัน = หารด้วยวันที่มีสาย', () => {
    // 5 ต.ค. = 1 คน · 7 ต.ค. = 7 คน ⇒ 4
    expect(journeyPerDay(ROWS)).toBe(4);
    expect(journeyPerDay([])).toBe(0);
  });

  it('กดกล่อง AI โทร / คนโทร: แยก 2 แท็บ · ทุกช่องรวมกัน = ทั้งหมดของแท็บ · AI + คน = ทุกแถว', () => {
    const ai = followCallerBreakdown(ROWS, 'ai');
    const staff = followCallerBreakdown(ROWS, 'manual');
    expect(ai.map((t) => t.team)).toEqual(['main', 'replacement']);
    for (const t of [...ai, ...staff]) {
      expect(FOLLOW_CALLER_COLS.reduce((n, c) => n + t.cols[c].length, 0)).toBe(t.rows.length);
    }
    expect([...ai, ...staff].reduce((n, t) => n + t.rows.length, 0)).toBe(ROWS.length);
    const main = ai[0];
    // 🔴 นับตามช่องของการ์ด (QA 10 ต.ค. 2569): ขอเลื่อนแยกจากสรุปไม่ได้
    expect(main.cols.went.map((r) => r.id)).toEqual(['1']);
    expect(main.cols.notWent.map((r) => r.id)).toEqual(['3']);
    expect(main.cols.reschedule.map((r) => r.id)).toEqual(['4']);
    expect(main.cols.unclear.map((r) => r.id)).toEqual(['5']);
    expect(main.called).toHaveLength(4);
    expect(ai[1].cols.cancelled.map((r) => r.id)).toEqual(['7']);
    expect(ai[1].cols.waiting.map((r) => r.id)).toEqual(['8', '9', '10']);
  });

  it('🔴 ป๊อปนับตามช่องของการ์ด ไม่ใช่หมวดหน้าติดตาม — ผลปิดงาน "ไป" แต่สาย AI ล้มเหลว = ล้มเหลว (QA 10 ต.ค. 2569 ไป 781 ≠ 667)', () => {
    const rows = [row({ id: 'x', result: 'agreed', bucket: 'failed' }), row({ id: 'y', result: 'agreed', bucket: 'went' })];
    const [main] = followCallerBreakdown(rows, 'ai');
    expect(main.cols.went.map((r) => r.id)).toEqual(['y']);
    expect(main.cols.failed.map((r) => r.id)).toEqual(['x']);
    expect(main.called).toHaveLength(2);
  });
});
