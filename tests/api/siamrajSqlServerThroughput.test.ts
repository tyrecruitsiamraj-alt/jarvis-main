import { describe, it, expect } from 'vitest';
import { isOpenStaffingRow } from '../../api/_lib/siamrajSqlServerThroughput.js';

describe('isOpenStaffingRow (re-export)', () => {
  it('treats active requests without inform as open', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, request_qty: 2, inform_qty: 0 }),
    ).toBe(true);
  });

  it('treats fully informed flag as closed', () => {
    expect(
      isOpenStaffingRow({
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

  it('treats stopped requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'Y', stop_no: 'CLS001', request_qty: 1, inform_qty: 0 }),
    ).toBe(false);
  });

  it('treats cancelled status as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'C', is_stop: 'N', stop_no: null, request_qty: 1, inform_qty: 0 }),
    ).toBe(false);
  });
});
