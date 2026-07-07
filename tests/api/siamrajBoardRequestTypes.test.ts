import { describe, it, expect } from 'vitest';
import {
  BOARD_STAFFING_REQUEST_CODES,
  boardStaffingRequestTypeWhereSql,
  isBoardStaffingRequestCode,
} from '../../api/_lib/siamrajBoardRequestTypes.js';

describe('siamrajBoardRequestTypes', () => {
  it('includes only resignation-style request codes', () => {
    expect(BOARD_STAFFING_REQUEST_CODES).toEqual(['005', '006', '013', '014']);
    expect(isBoardStaffingRequestCode('005')).toBe(true);
    expect(isBoardStaffingRequestCode('001')).toBe(false);
    expect(isBoardStaffingRequestCode('004')).toBe(false);
  });

  it('builds SQL filter on request_code', () => {
    expect(boardStaffingRequestTypeWhereSql('A')).toContain("RTRIM(A.request_code) IN ('005', '006', '013', '014')");
  });
});
