import { describe, it, expect } from 'vitest';
import { isOpenStaffingRow } from '../../api/_lib/siamrajSqlServerThroughput.js';

describe('isOpenStaffingRow (feed)', () => {
  it('treats active requests without inform as open', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, request_qty: 2, effective_inform_qty: 0 }),
    ).toBe(true);
  });

  it('keeps partial informs open on the board', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: 4,
        inform_qty: 3,
        effective_inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(true);
  });

  it('keeps partial when effective count comes from inform_head', () => {
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
  });

  it('treats stopped requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'Y', stop_no: 'CLS001', request_qty: 1, effective_inform_qty: 0 }),
    ).toBe(false);
  });
});
