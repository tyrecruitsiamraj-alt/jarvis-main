import { describe, it, expect } from 'vitest';
import { isOpenStaffingRow } from '../../api/_lib/siamrajSqlServerThroughput.js';

describe('isOpenStaffingRow', () => {
  it('treats active requests without inform as open', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, has_inform: 0 }),
    ).toBe(true);
  });

  it('treats informed requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, has_inform: 1 }),
    ).toBe(false);
  });

  it('treats stopped requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'Y', stop_no: 'CLS001', has_inform: 0 }),
    ).toBe(false);
  });

  it('treats cancelled status as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'C', is_stop: 'N', stop_no: null, has_inform: 0 }),
    ).toBe(false);
  });
});
