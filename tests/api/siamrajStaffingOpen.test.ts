import { describe, it, expect } from 'vitest';
import {
  effectiveInformedCount,
  isOpenStaffingRow,
  remainingOpenPositionsFromRow,
  requestPositionTotal,
  staffingPositionBreakdown,
} from '../../api/_lib/siamrajStaffingOpen.js';

describe('siamrajStaffingOpen feed', () => {
  it('keeps requests without inform open with full remaining', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        request_qty: 4,
        inform_qty: 0,
        effective_inform_qty: 0,
      }),
    ).toBe(true);
    expect(remainingOpenPositionsFromRow({ request_qty: 4, effective_inform_qty: 0 })).toBe(4);
  });

  it('keeps partial informs like LBM6905015 when inform_qty is synced', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'P',
        request_qty: 4,
        inform_qty: 3,
        effective_inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(true);
    expect(remainingOpenPositionsFromRow({ request_qty: 4, effective_inform_qty: 3 })).toBe(1);
  });

  it('keeps partial when inform_qty is zero but effective count from inform_head', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: 4,
        inform_qty: 0,
        effective_inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(true);
    expect(effectiveInformedCount({ inform_qty: 0, effective_inform_qty: 3 })).toBe(3);
  });

  it('hides fully informed requests', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'Y',
        request_qty: 4,
        effective_inform_qty: 4,
        has_inform: 1,
      }),
    ).toBe(false);
  });

  it('treats SQL Server string counts like "0" as numeric open remaining', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: '1',
        inform_qty: '0',
        effective_inform_qty: '0',
        has_inform: 0,
      }),
    ).toBe(true);
    const breakdown = staffingPositionBreakdown({
      status: 'A',
      is_stop: 'N',
      stop_no: null,
      is_inform_all: 'N',
      request_qty: '1',
      inform_qty: '0',
      effective_inform_qty: '0',
      has_inform: '0',
    });
    expect(breakdown.cancelledPositions).toBe(0);
    expect(breakdown.remainingPositions).toBe(1);
    expect(effectiveInformedCount({ inform_qty: 0, effective_inform_qty: '0' })).toBe(0);
  });

  it('keeps remaining for partial fill like LBM6903001 (38 request, 35 informed)', () => {
    const breakdown = staffingPositionBreakdown({
      status: 'A',
      is_stop: 'N',
      stop_no: null,
      is_inform_all: 'P',
      request_qty: 38,
      inform_qty: 35,
      effective_inform_qty: 35,
      has_inform: 1,
    });
    expect(breakdown.requestPositions).toBe(38);
    expect(breakdown.filledPositions).toBe(35);
    expect(breakdown.cancelledPositions).toBe(0);
    expect(breakdown.remainingPositions).toBe(3);
  });

  it('does not treat open partial fill as cancelled when is_stop is missing', () => {
    const breakdown = staffingPositionBreakdown({
      status: 'A',
      is_stop: null,
      stop_no: null,
      is_inform_all: 'P',
      request_qty: 38,
      inform_qty: 35,
      effective_inform_qty: 35,
      has_inform: 1,
    });
    expect(breakdown.requestPositions).toBe(38);
    expect(breakdown.filledPositions).toBe(35);
    expect(breakdown.cancelledPositions).toBe(0);
    expect(breakdown.remainingPositions).toBe(3);
  });

  it('splits partial fill vs cancelled remaining on stopped row', () => {
    const breakdown = staffingPositionBreakdown({
      status: 'S',
      is_stop: 'Y',
      stop_no: '1',
      request_qty: 5,
      inform_qty: 2,
      effective_inform_qty: 2,
    });
    expect(breakdown.requestPositions).toBe(5);
    expect(breakdown.filledPositions).toBe(2);
    expect(breakdown.cancelledPositions).toBe(3);
    expect(breakdown.remainingPositions).toBe(0);
  });
});

/**
 * invariant ที่ทำให้ "ทางเดา" ใน `src/lib/requestControl.ts` ไปไม่ถึงสำหรับใบขอจาก ERP
 *
 * `positionBreakdownFromJob()` จะเข้าทางเดา (ซึ่งแปลง "ปิดใบขอ" เป็น "หาได้ครบ")
 * ก็ต่อเมื่อ `request_positions` เป็น null หรือ <= 0 เท่านั้น
 * ตราบใดที่ `requestPositionTotal()` คืนค่าอย่างน้อย 1 เสมอ ใบขอจาก ERP จะไม่มีทางตกไปทางนั้น
 *
 * เทสต์ชุดนี้พังเมื่อไหร่ = มีคนเปิดประตูให้ตัวเลขเดาไหลเข้าแดชบอร์ดโดยไม่รู้ตัว
 */
describe('invariant: request_qty เท่าไหร่ก็ต้องได้อย่างน้อย 1 อัตรา', () => {
  const emptyish = [null, undefined, 0, '0', '', '   ', -5, 'ไม่ใช่ตัวเลข', NaN];

  it('requestPositionTotal ไม่มีทางคืน 0 หรือติดลบ', () => {
    for (const qty of emptyish) {
      expect(requestPositionTotal(qty as never)).toBeGreaterThanOrEqual(1);
    }
  });

  it('staffingPositionBreakdown คืน requestPositions >= 1 และ filled/cancelled เป็นตัวเลขเสมอ', () => {
    for (const qty of emptyish) {
      const b = staffingPositionBreakdown({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        request_qty: qty as never,
        inform_qty: null,
        effective_inform_qty: null,
      });
      expect(b.requestPositions).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(b.filledPositions)).toBe(true);
      expect(Number.isFinite(b.cancelledPositions)).toBe(true);
      // ครบสมการ: ขอมา = หาได้ + ยกเลิก + เหลือหา
      expect(b.filledPositions + b.cancelledPositions + b.remainingPositions).toBe(b.requestPositions);
    }
  });
});
