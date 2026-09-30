// @vitest-environment node
/**
 * ═══ ลงผลโทรของรอบคนโทร (migration 130 · เจ้าของเคาะ 30 ก.ย. 2569) ═══
 *
 * > เจ้าของ Choice: *"เพิ่มปุ่มลงผลโทร"* — หน้าหลักนับ "คนโทร" จาก **โทรจริงที่มีผลบันทึก**
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ศัพท์ผลต้องชุดเดียวกับผลที่เจ้าหน้าที่ลงในกล่องงาน — แยกชุดเมื่อไหร่ สี/คำของสองแหล่งจะเพี้ยนกันเอง
 * 2. ค่าที่อ่านไม่ออก = ปฏิเสธ ห้ามเดาเป็นผลใดผลหนึ่ง
 * 3. ลงผลได้เฉพาะรอบคนโทร — รอบของ AI ลงซ้อนไม่ได้ (นับสายเดียวสองฝั่ง)
 * 4. ลงผลแล้วช่องปฏิทิน/กล่องนับต้องเปลี่ยนตาม — ไม่งั้นรอบที่โทรจบแล้วยังขึ้น "ไม่ได้ส่ง" ตลอดไป
 */
import { describe, expect, it } from 'vitest';
import { CALL_RESULT_OUTCOMES as SERVER_HOLD_OUTCOMES } from '../../api/_lib/candidateCallHolds.js';
import { CALL_RESULT_OUTCOMES as CLIENT_HOLD_OUTCOMES } from '../../src/lib/callHoldsApi.js';
import type { FollowEntry } from '../../src/lib/followApi.js';
import {
  FOLLOW_STAFF_CALL_NOTE_MAX,
  FOLLOW_STAFF_CALL_OUTCOMES,
  canRecordStaffCall,
  effectiveCallOutcome,
  followStaffCallText,
  validateFollowStaffCall,
} from '../../src/lib/followStaffCall.js';
import { callCategory, followRoundState, roundResultLabel, roundTone } from '../../src/lib/followPlanning.js';
import { inFollowRoundBucket } from '../../src/lib/followRoundBuckets.js';

const NOW = new Date('2026-09-30T05:00:00Z'); // 12:00 น. เวลาไทย

function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  return {
    id: 'e1',
    recipient_name: 'ทดสอบ',
    recipient_phone: '0800000000',
    topic: 'ยืนยันวันเริ่มงาน',
    note: null,
    scheduled_at: '2026-09-30T02:00:00Z',
    created_by_name: null,
    created_at: '2026-09-29T02:00:00Z',
    cancelled: false,
    call_status: null,
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    call_mode: 'manual',
    dispatch_state: 'manual',
    ...over,
  } as FollowEntry;
}

const round = (e: FollowEntry) => ({ entry: e, state: followRoundState(e, NOW), time: '09:00', ymd: '2026-09-30' });

describe('ศัพท์ผลชุดเดียวกับผลที่เจ้าหน้าที่ลงในกล่องงาน', () => {
  it('ตรงกับชุดของ server และของหน้าเว็บทุกตัว เรียงเหมือนกัน', () => {
    expect([...FOLLOW_STAFF_CALL_OUTCOMES]).toEqual([...SERVER_HOLD_OUTCOMES]);
    expect([...FOLLOW_STAFF_CALL_OUTCOMES]).toEqual([...CLIENT_HOLD_OUTCOMES]);
  });

  it('ใช้คำของงานติดตาม ไม่ใช่คำของงานหาคน', () => {
    expect(followStaffCallText('confirmed')).toBe('ยืนยันว่าไป');
    expect(followStaffCallText('declined')).toBe('ยกเลิก — ไม่ไปแล้ว');
    expect(followStaffCallText('no_answer')).toBe('ไม่รับสาย');
  });
});

describe('ตรวจค่าก่อนบันทึก (ตัวเดียวทั้งฟอร์มและ server)', () => {
  it('ผลที่รู้จัก + หมายเหตุตัดช่องว่าง', () => {
    expect(validateFollowStaffCall({ outcome: 'confirmed', note: '  ไปแน่นอน  ' })).toEqual({
      ok: true,
      value: { outcome: 'confirmed', note: 'ไปแน่นอน' },
    });
  });

  it('หมายเหตุว่าง = null (ไม่เก็บสตริงว่าง)', () => {
    const v = validateFollowStaffCall({ outcome: 'no_answer', note: '   ' });
    expect(v.ok && v.value.note).toBeNull();
  });

  it('🔴 ผลที่อ่านไม่ออก = ปฏิเสธ ห้ามเดา', () => {
    for (const bad of ['answered', '', null, undefined, 'CONFIRMED ', 1]) {
      const v = validateFollowStaffCall({ outcome: bad });
      expect(v.ok, String(bad)).toBe(false);
    }
  });

  it('หมายเหตุยาวเกินเพดาน = ปฏิเสธ', () => {
    const v = validateFollowStaffCall({ outcome: 'confirmed', note: 'ก'.repeat(FOLLOW_STAFF_CALL_NOTE_MAX + 1) });
    expect(v.ok).toBe(false);
  });
});

describe('ลงผลได้เฉพาะรอบคนโทร', () => {
  it('รอบคนโทรที่ยังไม่ยกเลิก = ได้', () => {
    expect(canRecordStaffCall(entry())).toBe(true);
  });
  it('🔴 รอบของ AI = ไม่ได้ (นับสายเดียวสองฝั่ง)', () => {
    expect(canRecordStaffCall(entry({ call_mode: 'ai' }))).toBe(false);
  });
  it('รอบที่ยกเลิก = ไม่ได้', () => {
    expect(canRecordStaffCall(entry({ cancelled: true }))).toBe(false);
  });
});

describe('ผลของสาย = ผลจาก AI ก่อน แล้วค่อยผลที่คนลง', () => {
  it('มีแต่ผลที่คนลง', () => {
    expect(effectiveCallOutcome({ call_outcome: null, staff_call_outcome: 'declined' })).toBe('declined');
  });
  it('มีทั้งคู่ (ข้อมูลที่ไม่ควรเกิด) = ผลจาก AI ชนะ', () => {
    expect(effectiveCallOutcome({ call_outcome: 'no_answer', staff_call_outcome: 'confirmed' })).toBe('no_answer');
  });
  it('ไม่มีเลย = null', () => {
    expect(effectiveCallOutcome({ call_outcome: '  ', staff_call_outcome: null })).toBeNull();
  });
});

describe('ปฏิทิน: ลงผลแล้วช่องต้องเปลี่ยนตาม', () => {
  it('รอบคนโทรที่ยังไม่ลงผล = ไม่ได้ส่งให้ AI (พฤติกรรมเดิม)', () => {
    expect(followRoundState(entry(), NOW)).toBe('notSent');
  });

  it('ลงผล "ยืนยันว่าไป" = มีผลแล้ว · สีเขียว · หมวดตอบว่าไป', () => {
    const e = entry({ staff_call_outcome: 'confirmed', staff_called_at: '2026-09-30T03:00:00Z' });
    const r = round(e);
    expect(r.state).toBe('result');
    expect(roundResultLabel(r)).toBe('ยืนยันว่าไป');
    expect(roundTone(r)).toBe('success');
    expect(callCategory(r)).toBe('agreed');
  });

  it('ลงผล "ไม่รับสาย" = หมวดไม่ได้คำตอบ', () => {
    const r = round(entry({ staff_call_outcome: 'no_answer', staff_called_at: '2026-09-30T03:00:00Z' }));
    expect(callCategory(r)).toBe('unreachable');
  });

  it('ปิดงานแล้วยังชนะผลโทร (ลำดับเดิมไม่เปลี่ยน)', () => {
    const e = entry({ staff_call_outcome: 'confirmed', completed_at: '2026-09-30T04:00:00Z', outcome_code: 'went' });
    expect(followRoundState(e, NOW)).toBe('closed');
  });
});

describe('กล่องนับของรอบ: สายที่คนโทรจบแล้วต้องออกจาก "รอโทร"', () => {
  it('ยังไม่ลงผล = รอโทร (พฤติกรรมเดิม)', () => {
    const e = entry();
    expect(inFollowRoundBucket(e, 'waiting')).toBe(true);
    expect(inFollowRoundBucket(e, 'connected')).toBe(false);
  });

  it('ลงผลแล้ว = โทรติด/โทรไม่ติด ตามผล', () => {
    expect(inFollowRoundBucket(entry({ staff_call_outcome: 'confirmed' }), 'connected')).toBe(true);
    expect(inFollowRoundBucket(entry({ staff_call_outcome: 'confirmed' }), 'waiting')).toBe(false);
    expect(inFollowRoundBucket(entry({ staff_call_outcome: 'no_answer' }), 'unreached')).toBe(true);
  });
});
