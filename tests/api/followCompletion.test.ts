// @vitest-environment node
/**
 * Phase 7.1-7.2 — กอง "โทรครบแล้ว" + ปุ่มย้ายไปดูแลหลังเริ่มงาน
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. นับที่ระดับ **คน (กลุ่ม)** ไม่ใช่ระดับรอบ — 1 วัน = 1 แถว (092) ถ้านับเป็นรอบ
 *    คนเดียวจะโผล่หลายครั้งและเลขเฟ้อ
 * 2. **ยังมีนัดข้างหน้า = ยังไม่ครบ** (กล่องนี้ต้องเป็นงานที่พร้อมส่งต่อจริง)
 * 3. `needs_human` เข้ากองด้วย (เจ้าของระบุมาในโจทย์)
 * 4. **ผลออกมาว่าไม่ไป = ไม่เข้ากอง** (ไม่มีอะไรให้ดูแลต่อ)
 * 5. ยกเลิกหมดทุกรอบ = ไม่ใช่ "โทรครบ"
 */
import { describe, expect, it } from 'vitest';
import {
  COMPLETION_REASON_LABEL,
  completedFollowSummary,
  isRoundSettled,
  selectCompletedFollowPeople,
} from '../../src/lib/followCompletion.js';
import type { FollowGroup } from '../../src/lib/followGrouping.js';

type RoundInput = {
  cancelled?: boolean;
  completed_at?: string | null;
  outcome_code?: string | null;
  call_outcome?: string | null;
  followup_state?: string | null;
};

const round = (over: RoundInput = {}) =>
  ({
    id: `r${Math.abs(JSON.stringify(over).length)}`,
    cancelled: false,
    completed_at: null,
    outcome_code: null,
    call_outcome: null,
    followup_state: null,
    ...over,
  }) as never;

const group = (name: string, rounds: unknown[], nextRound: unknown = null): FollowGroup =>
  ({
    key: `k-${name}`,
    name,
    phone: '0812345678',
    topic: 'แจ้งเข้างาน',
    unitName: 'หน่วยงาน ก',
    siteCode: 'S1',
    createdByName: null,
    rounds,
    activeCount: (rounds as RoundInput[]).filter((r) => !r.cancelled).length,
    nextRound,
    todayOrdinal: null,
    latestCreatedAt: null,
  }) as unknown as FollowGroup;

describe('isRoundSettled', () => {
  it('ยกเลิก = ไม่ต้องนับ (ถือว่าเดินจบ)', () => {
    expect(isRoundSettled({ cancelled: true })).toBe(true);
  });

  it('ปิดงานพร้อมผล / มีผลโทร / needs_human = จบ', () => {
    expect(isRoundSettled({ completed_at: '2026-08-20T00:00:00Z', outcome_code: 'went' })).toBe(true);
    expect(isRoundSettled({ call_outcome: 'confirmed' })).toBe(true);
    expect(isRoundSettled({ followup_state: 'needs_human' })).toBe(true);
  });

  it('ยังไม่มีอะไรเลย = ยังไม่จบ', () => {
    expect(isRoundSettled({})).toBe(false);
    expect(isRoundSettled({ followup_state: 'retry_scheduled' })).toBe(false);
  });
});

describe('เลือกคนที่โทรครบแล้ว', () => {
  it('ทุกรอบจบ + ไม่มีนัดข้างหน้า + ปิดงานว่าไปแล้ว → เข้ากอง (closed_success)', () => {
    const people = selectCompletedFollowPeople([
      group('ก', [round({ completed_at: 'x', outcome_code: 'went' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('closed_success');
    expect(people[0].roundsDone).toBe(1);
  });

  it('🔴 ยังมีนัดข้างหน้า = ยังไม่ครบ', () => {
    const people = selectCompletedFollowPeople([
      group('ข', [round({ call_outcome: 'confirmed' })], round({})),
    ]);
    expect(people).toHaveLength(0);
  });

  it('มีรอบที่ยังไม่มีผล = ยังไม่ครบ', () => {
    const people = selectCompletedFollowPeople([
      group('ค', [round({ call_outcome: 'confirmed' }), round({})]),
    ]);
    expect(people).toHaveLength(0);
  });

  it('needs_human เข้ากอง (AI เอาไม่อยู่ ต้องคนตาม)', () => {
    const people = selectCompletedFollowPeople([
      group('ง', [round({ followup_state: 'needs_human' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('needs_human');
  });

  it('🔴 ผลว่าไม่ไป (ยกเลิก/ไม่ไปเริ่มงาน) = ไม่เข้ากอง', () => {
    for (const code of ['cancelled', 'job_cancelled', 'no_show_start']) {
      const people = selectCompletedFollowPeople([
        group('จ', [round({ completed_at: 'x', outcome_code: code })]),
      ]);
      expect(people).toHaveLength(0);
    }
  });

  it('ยกเลิกทุกรอบ = ไม่ใช่ "โทรครบ"', () => {
    const people = selectCompletedFollowPeople([group('ฉ', [round({ cancelled: true })])]);
    expect(people).toHaveLength(0);
  });

  it('โทรครบแต่ยังไม่ปิดงาน = เข้ากองแบบ called_no_close', () => {
    const people = selectCompletedFollowPeople([
      group('ช', [round({ call_outcome: 'no_answer' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('called_no_close');
  });

  it('เรียงจบดีขึ้นก่อน (พร้อมส่งต่อเลย)', () => {
    const people = selectCompletedFollowPeople([
      group('ต้องคนตาม', [round({ followup_state: 'needs_human' })]),
      group('จบดี', [round({ completed_at: 'x', outcome_code: 'arrived' })]),
    ]);
    expect(people.map((p) => p.reason)).toEqual(['closed_success', 'needs_human']);
  });
});

describe('สรุปใต้หัวกล่อง', () => {
  it('ไม่มีของ = null (กล่องซ่อนตัวเอง)', () => {
    expect(completedFollowSummary([])).toBeNull();
  });

  it('บอกจำนวนแยกตามเหตุผล ด้วยคำเดียวกับที่โชว์บนแถว', () => {
    const people = selectCompletedFollowPeople([
      group('a', [round({ completed_at: 'x', outcome_code: 'went' })]),
      group('b', [round({ followup_state: 'needs_human' })]),
    ]);
    const summary = completedFollowSummary(people) ?? '';
    expect(summary).toContain(COMPLETION_REASON_LABEL.closed_success);
    expect(summary).toContain(COMPLETION_REASON_LABEL.needs_human);
  });
});
