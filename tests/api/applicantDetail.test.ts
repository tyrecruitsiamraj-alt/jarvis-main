// @vitest-environment node
/**
 * ตรรกะของป๊อปรายละเอียดผู้สมัคร (โฉม iRecruit · 1 ต.ค. 2569)
 * 🔴 ป้ายผลโทรใช้ป้ายกลางเดิม ห้ามตั้งคำใหม่ · วันนัดไม่มีเวลา คำใต้ขั้นที่ 2 ต้องไม่สัญญาว่าตั้งเวลาได้
 */
import { describe, expect, it } from 'vitest';
import {
  DETAIL_TABS,
  PROCESS_STEPS,
  appointmentLogs,
  contactChoiceOf,
  detailCallRows,
  followUpChoiceOf,
  followUpSide,
} from '../../src/lib/applicantDetail.js';
import { CALL_OUTCOME_LABEL } from '../../src/lib/callOutcomeTone.js';
import { CALL_RESULT_LABEL } from '../../src/lib/callHoldsApi.js';

describe('ป๊อปรายละเอียด — โครงตามรูป', () => {
  it('แท็บ 6 แท็บ เรียงตามรูป', () => {
    expect(DETAIL_TABS.map((t) => t.label)).toEqual([
      'ข้อมูลผู้สมัคร',
      'ประวัติการสมัคร',
      'การโทร',
      'การติดต่อ',
      'การนัดหมาย',
      'ติดตามนัดหมาย',
    ]);
  });

  it('3 ขั้น · ขั้นนัดหมายไม่พูดถึงเวลา (วันนัดเก็บเป็นวัน)', () => {
    expect(PROCESS_STEPS.map((s) => s.title)).toEqual(['การติดต่อ', 'การนัดหมาย', 'การติดตามนัด']);
    expect(PROCESS_STEPS[1].hint).not.toContain('เวลา');
  });
});

describe('ค่าที่เลือกไว้ตอนเปิดป๊อป', () => {
  it('ผลติดต่อล่าสุด', () => {
    expect(contactChoiceOf({ last_contact_ok: true })).toBe('ok');
    expect(contactChoiceOf({ last_contact_ok: false })).toBe('fail');
    expect(contactChoiceOf({ last_contact_ok: null })).toBeNull();
  });

  it('ผลติดตามนัด: มาตามนัด = สำเร็จ · ไม่มา/เลื่อนนัด = ไม่สำเร็จ', () => {
    expect(followUpChoiceOf({ attendance_result: 'showed' })).toBe('showed');
    expect(followUpChoiceOf({ attendance_result: 'bogus' })).toBeNull();
    expect(followUpSide('showed')).toBe('ok');
    expect(followUpSide('no_show')).toBe('fail');
    expect(followUpSide('rescheduled')).toBe('fail');
    expect(followUpSide(null)).toBeNull();
  });
});

describe('แท็บการโทร', () => {
  it('รวมสาย AI + สายที่คนถือ เรียงล่าสุดก่อน ด้วยป้ายกลางเดิม', () => {
    const rows = detailCallRows(
      [
        { id: 1, status: 'completed', created_at: '2026-09-01T03:00:00Z', result_at: '2026-09-01T03:05:00Z', outcome: 'no_answer', attempts: 1, next_attempt_at: null },
        { id: 2, status: 'completed', created_at: '2026-09-03T03:00:00Z', result_at: null, outcome: 'confirmed', attempts: 2, next_attempt_at: null },
        { id: 3, status: 'pending', created_at: '2026-09-04T03:00:00Z', result_at: null, outcome: null, attempts: 1, next_attempt_at: null },
      ],
      [
        { id: 'h1', held_at: '2026-09-02T03:00:00Z', held_by_name: 'staff@example.com', released_at: '2026-09-02T04:00:00Z', release_reason: 'result', outcome: 'declined', note: 'ไม่สะดวก' },
        { id: 'h2', held_at: '2026-09-05T03:00:00Z', held_by_name: null, released_at: null, release_reason: null, outcome: null, note: null },
      ],
    );
    expect(rows.map((r) => [r.key, r.who, r.result, r.note])).toEqual([
      ['staff-h2', 'เจ้าหน้าที่', 'ถือไว้โทรอยู่', null],
      ['ai-3', 'AI', 'รอ AI โทร', null],
      ['ai-2', 'AI', CALL_OUTCOME_LABEL.confirmed, 'โทรครั้งที่ 2'],
      ['staff-h1', 'staff@example.com', CALL_RESULT_LABEL.declined, 'ไม่สะดวก'],
      ['ai-1', 'AI', CALL_OUTCOME_LABEL.no_answer, null],
    ]);
  });

  it('แท็บการนัดหมาย = เฉพาะครั้งที่มีวันนัด', () => {
    const base = { applicationId: 'a', ok: true, reasonId: null, reasonLabel: null, appointmentPlace: null, jobId: null, jobLabel: null, note: null, createdByName: null, createdAt: '2026-09-01T00:00:00Z' };
    const logs = [
      { ...base, id: '1', appointmentAt: '2026-09-10T05:00:00Z' },
      { ...base, id: '2', appointmentAt: null },
    ];
    expect(appointmentLogs(logs).map((l) => l.id)).toEqual(['1']);
  });
});
