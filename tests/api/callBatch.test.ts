// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  CALL_BATCH_STATUSES,
  CALL_BATCH_STATUS_LABEL,
  CALL_BATCH_UNDO_MINUTES,
  activeItemCount,
  canEditBatch,
  isCallBatchStatus,
  undoMsLeft,
  type CallBatch,
} from '../../src/lib/callBatch';

const NOW = new Date('2026-08-07T03:00:00.000Z').getTime();

function batch(over: Partial<CallBatch> = {}): CallBatch {
  return {
    id: 'b1',
    channel: 'reminder',
    jobId: 'siamraj-sql:DS1',
    requestNo: 'DS1',
    status: 'pending_approval',
    releaseAt: null,
    createdByName: 'ตั้ม',
    approvedByName: null,
    approvedAt: null,
    dispatchedAt: null,
    cancelledAt: null,
    cancelReason: null,
    note: null,
    createdAt: '2026-08-07T02:00:00.000Z',
    items: [
      { id: 'i1', source: 'board', candidateRef: '1', candidateName: 'ก', removed: false },
      { id: 'i2', source: 'board', candidateRef: '2', candidateName: 'ข', removed: false },
    ],
    ...over,
  };
}

describe('สถานะชุดส่งงาน', () => {
  it('ทุกสถานะมีป้ายไทยครบ — ไม่มีตัวไหนโชว์เป็นรหัสดิบ', () => {
    for (const s of CALL_BATCH_STATUSES) {
      expect(CALL_BATCH_STATUS_LABEL[s]).toBeTruthy();
    }
  });

  it('type guard รับเฉพาะสถานะที่รู้จัก', () => {
    expect(isCallBatchStatus('approved')).toBe(true);
    expect(isCallBatchStatus('released')).toBe(false);
  });
});

describe('แก้ไข/ยกเลิกได้เมื่อไหร่', () => {
  it('ก่อนเข้าคิวจริงแก้ได้ — รวมช่วงหลังอนุมัติ (นี่คือ "ช่วงถอนคำ")', () => {
    expect(canEditBatch(batch({ status: 'draft' }))).toBe(true);
    expect(canEditBatch(batch({ status: 'pending_approval' }))).toBe(true);
    expect(canEditBatch(batch({ status: 'approved' }))).toBe(true);
  });

  it('เข้าคิวแล้ว/ยกเลิกแล้ว แก้ไม่ได้', () => {
    expect(canEditBatch(batch({ status: 'dispatched' }))).toBe(false);
    expect(canEditBatch(batch({ status: 'cancelled' }))).toBe(false);
  });
});

describe('ช่วงถอนคำ', () => {
  it('อนุมัติแล้ว → นับถอยหลังตาม release_at', () => {
    const releaseAt = new Date(NOW + 5 * 60 * 1000).toISOString();
    const left = undoMsLeft(batch({ status: 'approved', releaseAt }), NOW);
    expect(Math.round(left / 60000)).toBe(5);
  });

  it('ยังไม่อนุมัติ → ไม่มีช่วงถอนคำ', () => {
    expect(undoMsLeft(batch({ status: 'pending_approval', releaseAt: null }), NOW)).toBe(0);
  });

  it('เลยเวลาปล่อยแล้ว → ติดลบ (ตัวเรียกถือว่าหมดสิทธิ์ถอน)', () => {
    const releaseAt = new Date(NOW - 60 * 1000).toISOString();
    expect(undoMsLeft(batch({ status: 'approved', releaseAt }), NOW)).toBeLessThan(0);
  });

  it('ค่าเริ่มต้นของช่วงถอนคำต้องมากกว่า 0 นาที (ไม่งั้นอนุมัติแล้วถอนไม่ทัน)', () => {
    expect(CALL_BATCH_UNDO_MINUTES).toBeGreaterThan(0);
  });
});

describe('นับคนที่จะถูกโทรจริง', () => {
  it('ไม่นับคนที่ถูกถอนออก', () => {
    expect(activeItemCount(batch())).toBe(2);
    expect(
      activeItemCount(
        batch({
          items: [
            { id: 'i1', source: 'board', candidateRef: '1', candidateName: 'ก', removed: true },
            { id: 'i2', source: 'board', candidateRef: '2', candidateName: 'ข', removed: false },
          ],
        }),
      ),
    ).toBe(1);
  });

  it('ถอนออกหมด = 0 (ตัวปล่อยต้องไม่ส่งชุดเปล่า)', () => {
    expect(
      activeItemCount(
        batch({
          items: [{ id: 'i1', source: 'board', candidateRef: '1', candidateName: 'ก', removed: true }],
        }),
      ),
    ).toBe(0);
  });
});
