/**
 * เลข "วันที่ D · สายที่ N" (เจ้าของสั่ง 1 ต.ค. 2569: *"วันที่ 1 สายที่ 1 2 วันที่ 2 สายที่ 1 2 ไม่ใช่ 1 2 3 4 5 6"*)
 * 🔴 ด่าน: นับใหม่ทุกวัน · วัน "ไม่โทร" ไม่ทำให้เลขวันเลื่อน · สายที่ยกเลิกไม่กินเลขของสายที่ยังอยู่ ·
 *    แถวเก่าไม่มีชุดใช้ `call_round` เดิม · `call_round` ที่เก็บไม่ถูกแตะ · แท็บ "สายที่ 1" = สายแรกของทุกวัน
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import {
  followDayCallLabel,
  followDayCallPositions,
  scheduleDraftDayCallLabels,
  withFollowDayCalls,
} from '@/lib/followDayCall';
import { followRoundSlot } from '@/lib/followRoundBuckets';

/** เวลาไทยของวันที่ d ต.ค. 2569 */
const at = (d: number, hh: number, mm = 0) =>
  new Date(`2026-10-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`).toISOString();

const row = (over: Partial<FollowEntry>): FollowEntry =>
  ({ id: 'x', group_id: 'g', scheduled_at: at(1, 9), call_round: null, cancelled: false, ...over }) as FollowEntry;

describe('followDayCallPositions', () => {
  it('🔴 ตาราง 3 วัน × 2 สาย (call_round 1–6) ⇒ วันที่ 1–3 · สายที่ 1 2 ทุกวัน · call_round เดิมไม่ถูกแตะ', () => {
    const rows = [1, 2, 3].flatMap((d, i) => [
      row({ id: `d${d}a`, scheduled_at: at(d, 9), call_round: i * 2 + 1 }),
      row({ id: `d${d}b`, scheduled_at: at(d, 15), call_round: i * 2 + 2 }),
    ]);
    const enriched = withFollowDayCalls(rows);
    expect(enriched.map((e) => followDayCallLabel({ day: e.call_day, call: e.call_of_day }))).toEqual([
      'วันที่ 1 · สายที่ 1',
      'วันที่ 1 · สายที่ 2',
      'วันที่ 2 · สายที่ 1',
      'วันที่ 2 · สายที่ 2',
      'วันที่ 3 · สายที่ 1',
      'วันที่ 3 · สายที่ 2',
    ]);
    expect(enriched.map((e) => e.call_round)).toEqual([1, 2, 3, 4, 5, 6]);
    // แท็บ "สายที่ 1" = สายแรกของทุกวัน (เดิมวันที่ 2–3 ทั้งหมดไปกอง "3 ขึ้นไป")
    expect(enriched.map((e) => followRoundSlot(e))).toEqual([1, 2, 1, 2, 1, 2]);
  });

  it('🔴 วันที่ "ไม่โทร" ไม่ทำให้เลขวันเลื่อน — นับวันตามปฏิทินจากวันแรกของชุด', () => {
    const pos = followDayCallPositions([
      row({ id: 'a', scheduled_at: at(1, 9), call_round: 1 }),
      row({ id: 'b', scheduled_at: at(4, 9), call_round: 2 }),
    ]);
    expect(pos.get('b')).toEqual({ day: 4, call: 1 });
  });

  it('ชุดวันเดียว ⇒ ไม่มีเลขวัน · เรียงตาม call_round ก่อนเวลา (ตั้งสาย 2 ไว้ก่อนสาย 1 ได้ เห็นได้ ไม่ถูกกลบ)', () => {
    const pos = followDayCallPositions([
      row({ id: 'r2', scheduled_at: at(1, 16, 30), call_round: 2 }),
      row({ id: 'r1', scheduled_at: at(1, 16, 35), call_round: 1 }),
    ]);
    expect(pos.get('r1')).toEqual({ day: null, call: 1 });
    expect(pos.get('r2')).toEqual({ day: null, call: 2 });
    expect(followDayCallLabel(pos.get('r2')!)).toBe('สายที่ 2');
  });

  it('🔴 ยกเลิกสายเช้า ⇒ สายบ่ายเป็นสายที่ 1 ของวันนั้น · ตัวที่ยกเลิกใช้ลำดับเดิมของมัน · วันแรกที่ยกเลิกยังนับเป็นวันที่ 1', () => {
    const pos = followDayCallPositions([
      row({ id: 'day1', scheduled_at: at(1, 9), call_round: 1, cancelled: true }),
      row({ id: 'am', scheduled_at: at(2, 9), call_round: 2, cancelled: true }),
      row({ id: 'pm', scheduled_at: at(2, 15), call_round: 3 }),
    ]);
    expect(pos.get('pm')).toEqual({ day: 2, call: 1 });
    expect(pos.get('am')).toEqual({ day: 2, call: 1 });
    expect(pos.get('day1')).toEqual({ day: 1, call: 1 });
  });

  it('แถวเก่าไม่มีชุด ⇒ ใช้ call_round ที่คนเลือกไว้ · ไม่มี call_round ⇒ null (ถอยไป attempt เหมือนเดิม)', () => {
    const pos = followDayCallPositions([
      row({ id: 'old5', group_id: null, call_round: 5 }),
      row({ id: 'old', group_id: null, call_round: null }),
    ]);
    expect(pos.get('old5')).toEqual({ day: null, call: 5 });
    expect(followDayCallLabel(pos.get('old5')!)).toBe('สายที่ 5');
    expect(pos.get('old')).toEqual({ day: null, call: null });
    expect(followDayCallLabel(pos.get('old')!)).toBeNull();
    const [e] = withFollowDayCalls([row({ id: 'old', group_id: null, call_round: null, call_attempt: 2, call_status: 'completed' })]);
    expect(followRoundSlot(e)).toBe(2);
  });

  it('สองชุดของคนเดียวกันนับแยกกัน · สายตอนตีหนึ่งไทยเป็นวันของไทย ไม่ใช่วันของ UTC', () => {
    const pos = followDayCallPositions([
      row({ id: 'g1a', group_id: 'g1', scheduled_at: at(1, 9) }),
      row({ id: 'g1b', group_id: 'g1', scheduled_at: at(2, 1) }),
      row({ id: 'g2a', group_id: 'g2', scheduled_at: at(2, 9) }),
    ]);
    expect(pos.get('g1b')).toEqual({ day: 2, call: 1 });
    expect(pos.get('g2a')).toEqual({ day: null, call: 1 });
  });
});

describe('scheduleDraftDayCallLabels (ตัวแก้ตาราง)', () => {
  it('คิดจากเวลาในช่องตอนนี้ · ย้ายสายไปอีกวันแล้วป้ายเปลี่ยนตาม · เวลาอ่านไม่ออก = null', () => {
    const labels = scheduleDraftDayCallLabels([
      { key: 'done', iso: at(1, 9) },
      { key: 'a', iso: at(1, 15) },
      { key: 'b', iso: at(3, 9) },
      { key: 'bad', iso: null },
    ]);
    expect([...labels.entries()]).toEqual([
      ['done', 'วันที่ 1 · สายที่ 1'],
      ['a', 'วันที่ 1 · สายที่ 2'],
      ['b', 'วันที่ 3 · สายที่ 1'],
      ['bad', null],
    ]);
  });
});

describe('แถวส่งคนแทนจาก iRecruit = สายที่ 1/2/3 ตาม Journey (6 ต.ค. 2569)', () => {
  it('คอนเฟิร์ม = สายที่ 1 · ก่อน 1 ชม. = สายที่ 2 · ก่อน 15 นาที = สายที่ 3 · ไม่มีเลขวัน', () => {
    const rows = [
      row({ id: 'c', group_id: 'g', scheduled_at: at(1, 9), source_ref: 'irecruit-replace:J1:confirm:abc' }),
      row({ id: 'l60', group_id: 'g', scheduled_at: at(2, 0), source_ref: 'irecruit-replace:J1:lead60:abc' }),
      row({ id: 'l15', group_id: 'g', scheduled_at: at(2, 1), source_ref: 'irecruit-replace:J1:lead15:abc' }),
    ];
    const out = withFollowDayCalls(rows);
    expect(out.map((e) => [e.id, e.call_day, e.call_of_day])).toEqual([
      ['c', null, 1],
      ['l60', null, 2],
      ['l15', null, 3],
    ]);
  });

  it('แถวคีย์เอง / รุ่นเก่าหนึ่งใบหนึ่งสาย = กติกาเดิม', () => {
    const [e] = withFollowDayCalls([row({ id: 'x', group_id: null, call_round: 2, source_ref: 'irecruit-replace:OLD' })]);
    expect(e.call_of_day).toBe(2);
  });
});

/** 🔴 "ติดตามครั้งที่" ตอนเพิ่มคน (137 · เจ้าของ 6 ต.ค. 2569) — เลขวันแรกของชุด วันถัดไปนับต่อ */
describe('ติดตามครั้งที่ (plan_day_start)', () => {
  it('ตารางหลายวันเริ่มครั้งที่ 3 ⇒ วันที่ 3, 4, 5', () => {
    const pos = followDayCallPositions([
      row({ id: 'a', scheduled_at: at(1, 9), call_round: 1, plan_day_start: 3 }),
      row({ id: 'b', scheduled_at: at(2, 9), call_round: 2, plan_day_start: 3 }),
      row({ id: 'c', scheduled_at: at(3, 9), call_round: 3, plan_day_start: 3 }),
    ]);
    expect([pos.get('a')?.day, pos.get('b')?.day, pos.get('c')?.day]).toEqual([3, 4, 5]);
  });
  it('ชุดวันเดียวตั้งครั้งที่ 2 ⇒ ขึ้น "วันที่ 2 · สายที่ N" (ไม่ตั้ง = ไม่มีเลขวันตามเดิม)', () => {
    const pos = followDayCallPositions([
      row({ id: 'a', scheduled_at: at(1, 9), call_round: 1, plan_day_start: 2 }),
      row({ id: 'b', scheduled_at: at(1, 10), call_round: 2, plan_day_start: 2 }),
    ]);
    expect(followDayCallLabel(pos.get('b')!)).toBe('วันที่ 2 · สายที่ 2');
  });
  it('แถวไม่มีชุด ตั้งครั้งที่ 4 ⇒ วันที่ 4 · ตั้ง 1/ไม่ตั้ง = ไม่มีเลขวัน', () => {
    const pos = followDayCallPositions([
      row({ id: 'x', group_id: null, scheduled_at: at(1, 9), call_round: 1, plan_day_start: 4 }),
      row({ id: 'y', group_id: null, scheduled_at: at(1, 9), call_round: 1, plan_day_start: 1 }),
    ]);
    expect(pos.get('x')?.day).toBe(4);
    expect(pos.get('y')?.day).toBeNull();
  });
});
