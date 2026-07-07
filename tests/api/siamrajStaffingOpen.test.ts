import { describe, it, expect } from 'vitest';
import {
  isOpenStaffingRow,
  isOpenStaffingRowForRemaining,
  remainingOpenPositions,
} from '../../api/_lib/siamrajStaffingOpen.js';

describe('siamrajStaffingOpen feed filter', () => {
  it('keeps requests without inform open', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        request_qty: 4,
        inform_qty: 0,
      }),
    ).toBe(true);
  });

  it('hides requests as soon as any inform exists', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        request_qty: 4,
        inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(false);
  });
});

describe('siamrajStaffingOpen remaining throughput', () => {
  it('keeps partial informs open with remaining positions', () => {
    expect(
      isOpenStaffingRowForRemaining({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: 4,
        inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(true);
    expect(remainingOpenPositions(4, 3)).toBe(1);
  });

  it('hides fully informed requests', () => {
    expect(
      isOpenStaffingRowForRemaining({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'Y',
        request_qty: 4,
        inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(false);
  });

  it('hides stale informs with inform_qty still zero', () => {
    expect(
      isOpenStaffingRowForRemaining({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: 4,
        inform_qty: 0,
        has_inform: 1,
      }),
    ).toBe(false);
  });
});
