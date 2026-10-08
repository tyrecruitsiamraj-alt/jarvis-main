/**
 * แก้ตารางทั้งชุด (เจ้าของ Choice 1 ต.ค. 2569) — ตัวช่วยฝั่งจอ
 * 🔴 ด่าน: สายที่โทรไปแล้ว/เลยเวลาแก้ไม่ได้ · ชุดเดียวกันเท่านั้น · เวลาเป็นเวลาไทยเสมอ · ตรวจกติกาเดียวกับ API
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import {
  bangkokInputToIso,
  draftFromRows,
  followSetRows,
  isEditableFollowRound,
  isoToBangkokInput,
  nextDraftRow,
  scheduleDraftChanged,
  scheduleReplaceBody,
  validateScheduleDraft,
} from './followScheduleEdit';

const NOW = new Date('2026-10-01T03:00:00Z'); // 10:00 เวลาไทย
const row = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: 'r',
    recipient_name: 'ทดสอบ',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-10-02T00:25:00.000Z',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    called_at: null,
    call_mode: 'ai',
    group_id: 'g1',
    ...over,
  }) as FollowEntry;

describe('isEditableFollowRound', () => {
  it('อนาคต + AI ยังไม่โทร = แก้ได้', () => {
    expect(isEditableFollowRound(row({}), NOW)).toBe(true);
  });
  it('🔴 เลยเวลาแล้ว / AI โทรแล้ว / ยกเลิก / ปิดงาน = แก้ไม่ได้', () => {
    expect(isEditableFollowRound(row({ scheduled_at: '2026-10-01T02:00:00.000Z' }), NOW)).toBe(false);
    expect(isEditableFollowRound(row({ call_status: 'completed', call_outcome: 'confirmed' }), NOW)).toBe(false);
    expect(isEditableFollowRound(row({ called_at: '2026-10-01T02:00:00.000Z' }), NOW)).toBe(false);
    expect(isEditableFollowRound(row({ cancelled: true }), NOW)).toBe(false);
    expect(isEditableFollowRound(row({ completed_at: '2026-10-01T02:00:00.000Z' }), NOW)).toBe(false);
  });
  it('🔴 อีกไม่ถึง 3 นาทีถึงเวลา = แก้ไม่ได้ (ไม่ส่งไปกับตาราง · API ตีกลับทั้งชุด 8 ต.ค. 2569)', () => {
    const inMin = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();
    expect(isEditableFollowRound(row({ scheduled_at: inMin(2) }), NOW)).toBe(false);
    expect(isEditableFollowRound(row({ scheduled_at: inMin(4) }), NOW)).toBe(true);
  });
  it('คนโทร: แก้ได้จนกว่าจะลงผล', () => {
    expect(isEditableFollowRound(row({ call_mode: 'manual', call_status: null }), NOW)).toBe(true);
    expect(isEditableFollowRound(row({ call_mode: 'manual', call_status: null, staff_call_outcome: 'went' }), NOW)).toBe(false);
  });
});

describe('followSetRows', () => {
  it('🔴 เฉพาะชุดเดียวกัน ไม่เอาที่ยกเลิก · แถวเก่าไม่มี group = พี่น้องที่ไม่มี group', () => {
    const me = row({ id: 'a' });
    const sibs = [me, row({ id: 'b' }), row({ id: 'c', group_id: 'g2' }), row({ id: 'd', cancelled: true })];
    expect(followSetRows(me, sibs).map((r) => r.id)).toEqual(['a', 'b']);
    const old = row({ id: 'x', group_id: null });
    expect(followSetRows(old, [row({ id: 'y', group_id: null }), row({ id: 'z' })]).map((r) => r.id)).toEqual(['x', 'y']);
  });
});

describe('เวลาไทยในช่องแก้', () => {
  it('ISO ↔ ช่องวันเวลา เป็นเวลาไทยเสมอ', () => {
    expect(isoToBangkokInput('2026-10-02T00:25:00.000Z')).toBe('2026-10-02T07:25');
    expect(bangkokInputToIso('2026-10-02T07:25')).toBe('2026-10-02T00:25:00.000Z');
    expect(bangkokInputToIso('2026-10-02')).toBeNull();
  });
});

describe('ตัวแก้ตาราง', () => {
  const editable = [row({ id: 'b', scheduled_at: '2026-10-03T06:00:00.000Z', call_mode: 'manual' }), row({ id: 'a' })];
  const draft = draftFromRows(editable);

  it('แถวเริ่มต้นเรียงตามเวลา · โหมดเดิม', () => {
    expect(draft.map((d) => [d.id, d.when, d.mode])).toEqual([
      ['a', '2026-10-02T07:25', 'ai'],
      ['b', '2026-10-03T13:00', 'manual'],
    ]);
  });

  it('เพิ่มสาย = เวลาเดิมของสายสุดท้ายในวันถัดไป · โหมดตามสายสุดท้าย', () => {
    expect(nextDraftRow(draft, NOW, 'new-1')).toEqual({ key: 'new-1', id: null, when: '2026-10-04T13:00', mode: 'manual' });
    expect(nextDraftRow([], NOW, 'new-1').when).toBe('2026-10-01T11:00');
  });

  it('🔴 ตรวจกติกาเดียวกับ API: เวลาอดีต · ซ้ำนาที · ไม่ครบ', () => {
    const bad = [
      { key: 'p', id: null, when: '2026-10-01T09:00', mode: 'ai' as const },
      { key: 'x', id: null, when: '2026-10-02T07:25', mode: 'ai' as const },
      { key: 'y', id: null, when: '2026-10-02T07:25', mode: 'ai' as const },
      { key: 'z', id: null, when: '2026-10-02', mode: 'ai' as const },
    ];
    const v = validateScheduleDraft(bad, NOW);
    expect(v.ok).toBe(false);
    expect(Object.keys(v.errors).sort()).toEqual(['p', 'y', 'z']);
    expect(validateScheduleDraft(draft, NOW).ok).toBe(true);
  });

  it('body: สายที่แก้ได้ทั้งหมด + ตารางใหม่ (ที่หายไป = เอาออก) · สายใหม่ไม่มี id', () => {
    const next = [draft[0], { key: 'n', id: null, when: '2026-10-05T09:00', mode: 'ai' as const }];
    expect(scheduleReplaceBody(editable, next)).toEqual({
      replace_ids: ['b', 'a'],
      rounds: [
        { id: 'a', scheduled_at: '2026-10-02T00:25:00.000Z', call_mode: 'ai' },
        { scheduled_at: '2026-10-05T02:00:00.000Z', call_mode: 'ai' },
      ],
    });
  });

  it('ไม่เปลี่ยนอะไร = ไม่ต้องบันทึก · เปลี่ยนโหมด/เวลา/ลบ/เพิ่ม = เปลี่ยน', () => {
    expect(scheduleDraftChanged(draft, [...draft].reverse())).toBe(false);
    expect(scheduleDraftChanged(draft, [{ ...draft[0], mode: 'manual' }, draft[1]])).toBe(true);
    expect(scheduleDraftChanged(draft, [draft[0]])).toBe(true);
  });
});
