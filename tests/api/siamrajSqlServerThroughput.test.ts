import { describe, it, expect } from 'vitest';
import {
  isOpenStaffingRow,
  remainingOpenPositions,
} from '../../api/_lib/siamrajStaffingOpen.js';

describe('isOpenStaffingRow', () => {
  it('treats active requests without inform as open', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, request_qty: 4, inform_qty: 0 }),
    ).toBe(true);
  });

  it('keeps partially informed requests open', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, request_qty: 4, inform_qty: 3 }),
    ).toBe(true);
    expect(remainingOpenPositions(4, 3)).toBe(1);
  });

  it('treats fully informed requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, request_qty: 4, inform_qty: 4 }),
    ).toBe(false);
  });

  it('falls back to has_inform when qty fields are absent', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, has_inform: 1 }),
    ).toBe(false);
  });

  it('treats stopped requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'Y', stop_no: 'CLS001', request_qty: 4, inform_qty: 0 }),
    ).toBe(false);
  });

  it('treats cancelled status as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'C', is_stop: 'N', stop_no: null, request_qty: 4, inform_qty: 0 }),
    ).toBe(false);
  });
});
