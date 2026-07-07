import { describe, it, expect } from 'vitest';
import {
  isOpenStaffingRow,
  remainingOpenPositions,
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
      }),
    ).toBe(true);
    expect(remainingOpenPositions(4, 0)).toBe(4);
  });

  it('keeps partial informs like lm6905015 open with remaining only', () => {
    expect(
      isOpenStaffingRow({
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
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'Y',
        request_qty: 4,
        inform_qty: 4,
        has_inform: 1,
      }),
    ).toBe(false);
  });

  it('hides stale informs with inform_qty still zero', () => {
    expect(
      isOpenStaffingRow({
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
