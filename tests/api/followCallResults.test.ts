// @vitest-environment node
/**
 * บรรทัด "ผลการโทรของ AI" รายสาย — เจ้าของแจ้ง 3 ก.ย. 2569:
 * *"ยังไม่โชว์สถานะผลการโทรทั้ง 2 สายในหน้าแดชบอร์ด"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ต้องแยก **ยืนยันว่าไป** ออกจาก **ไม่ไปแล้ว** (7 กล่องเดิมกลืนสองอันนี้ไว้ใน "โทรติด")
 * 2. รอบที่ยกเลิกไม่ใช่ผลการโทร — ห้ามนับ
 * 3. ยังไม่มีผลเลย ⇒ `null` (ห้ามขึ้นบรรทัดว่างหรือขึ้นเลข 0)
 * 4. ผลที่ระบบยังไม่รู้จัก (Lumos เพิ่มคำใหม่) ต้องยังขึ้นจอ ห้ามหายเงียบ
 */
import { describe, expect, it } from 'vitest';
import {
  answeredCallCount,
  countFollowCallResults,
  followCallResultSummary,
  hasConnectedResult,
  overdueWaitingCount,
} from '../../src/lib/followCallResults.js';
import { roundSignal } from '../../src/lib/followRoundVisual.js';

const row = (call_outcome: string | null, cancelled = false) => ({ call_outcome, cancelled });

describe('countFollowCallResults', () => {
  it('🔴 แยก "ไป" ออกจาก "ไม่ไป" — สองอย่างนี้เคยรวมกันอยู่ในช่อง "โทรติด"', () => {
    const res = countFollowCallResults([
      row('confirmed'),
      row('confirmed'),
      row('declined'),
      row('acknowledged'),
    ]);
    expect(res.map((r) => [r.code, r.count])).toEqual([
      ['confirmed', 2],
      ['declined', 1],
      ['acknowledged', 1],
    ]);
    // คำบนจอต้องอ่านรู้เรื่อง ไม่ใช่โค้ดดิบ
    expect(res[0].label).toContain('ไป');
    expect(res[0].label).not.toBe('confirmed');
  });

  it('รอบที่ยกเลิกไม่นับเป็นผลการโทร', () => {
    expect(countFollowCallResults([row('confirmed', true), row('declined')])).toHaveLength(1);
  });

  it('ยังไม่มีผล / ผลว่าง ⇒ ไม่มีอะไรเลย', () => {
    expect(countFollowCallResults([row(null), row('   ')])).toHaveLength(0);
    expect(answeredCallCount([row(null)])).toBe(0);
  });

  it('ผลที่ยังไม่รู้จักต้องยังขึ้นจอ (ห้ามหายเงียบ)', () => {
    const res = countFollowCallResults([row('brand_new_outcome')]);
    expect(res).toEqual([{ code: 'brand_new_outcome', label: 'brand_new_outcome', count: 1 }]);
  });

  it('เรียงตอบแล้วก่อน ยกหูไม่ได้ทีหลัง', () => {
    const res = countFollowCallResults([row('no_answer'), row('confirmed')]);
    expect(res[0].code).toBe('confirmed');
  });
});

describe('followCallResultSummary', () => {
  it('บอกยอดรวม + แยกรายผล', () => {
    const text = followCallResultSummary([row('confirmed'), row('declined'), row('declined')]);
    expect(text).toContain('AI ได้คำตอบแล้ว 3 สาย');
    expect(text).toContain('2');
  });

  it('ไม่มีผลเลย ⇒ null (จอไปขึ้นข้อความอื่นเอง)', () => {
    expect(followCallResultSummary([row(null)])).toBeNull();
    expect(followCallResultSummary([])).toBeNull();
  });
});

describe('hasConnectedResult', () => {
  it('คุยกับคนได้ = จริง · ยกหูไม่ได้ล้วน = เท็จ', () => {
    expect(hasConnectedResult([row('declined')])).toBe(true);
    expect(hasConnectedResult([row('no_answer'), row('busy')])).toBe(false);
  });
});


/**
 * 🔴 แถบบนแผงเคยขึ้น *"รอโทร 12 คน — ยังไม่ถึงเวลาที่ตั้งไว้"* ตอนบ่าย
 * ทั้งที่นัดไว้ 08:20 (วัดจริง 3 ก.ย. 2569) — คำโกหกนี้กลบเรื่องใหญ่ที่สุดของหน้า
 * (สายไม่ถูกยิงออกจากคิว) ⇒ ต้องแยก "เลยเวลาแล้ว" ออกจาก "ยังไม่ถึงเวลา"
 */
describe('overdueWaitingCount — สายที่เลยเวลาแล้วยังไม่ถูกส่งไปโทร', () => {
  const NOW = new Date('2026-09-03T15:00:00+07:00');
  const wait = (over: Record<string, unknown>) => ({
    cancelled: false,
    call_outcome: null,
    call_status: 'pending',
    completed_at: null,
    ...over,
  });

  it('เลยเวลาแล้วยังค้างคิว = นับ', () => {
    expect(
      overdueWaitingCount([wait({ scheduled_at: '2026-09-03T08:20:00+07:00' })], NOW),
    ).toBe(1);
  });

  it('ยังไม่ถึงเวลา = ไม่นับ', () => {
    expect(
      overdueWaitingCount([wait({ scheduled_at: '2026-09-03T18:00:00+07:00' })], NOW),
    ).toBe(0);
  });

  it('AI รับไปแล้ว (delivered) = กำลังโทร ไม่ใช่ค้างคิว', () => {
    expect(
      overdueWaitingCount(
        [wait({ scheduled_at: '2026-09-03T08:20:00+07:00', call_status: 'delivered' })],
        NOW,
      ),
    ).toBe(0);
  });

  it('มีผลแล้ว / ยกเลิก / ปิดงานแล้ว = ไม่นับ', () => {
    const at = '2026-09-03T08:20:00+07:00';
    expect(overdueWaitingCount([wait({ scheduled_at: at, call_outcome: 'confirmed' })], NOW)).toBe(0);
    expect(overdueWaitingCount([wait({ scheduled_at: at, cancelled: true })], NOW)).toBe(0);
    expect(overdueWaitingCount([wait({ scheduled_at: at, completed_at: at })], NOW)).toBe(0);
  });

  it('🔴 แถบบนแผงต้องเลิกพูดว่า "ยังไม่ถึงเวลา" เมื่อเลยเวลาแล้ว', () => {
    const counts = {
      all: 12, waiting: 12, calling: 0, connected: 0, unreached: 0, went: 0, not_went: 0,
    };
    const late = roundSignal(counts, 12);
    expect(late.text).toContain('เลยเวลานัดแล้ว');
    expect(late.text).not.toContain('ยังไม่ถึงเวลา');
    expect(late.level).toBe('act');

    const early = roundSignal(counts, 0);
    expect(early.text).toContain('ยังไม่ถึงเวลา');
  });
});
