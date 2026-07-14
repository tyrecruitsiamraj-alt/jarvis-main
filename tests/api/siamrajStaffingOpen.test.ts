import { describe, it, expect } from 'vitest';
import {
  effectiveInformedCount,
  isOpenStaffingRow,
  remainingOpenPositionsFromRow,
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
