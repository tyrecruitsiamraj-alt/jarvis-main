import { describe, it, expect } from 'vitest';
import {
  BOARD_STAFFING_REQUEST_CODES,
  boardStaffingRequestTypeWhereSql,
  excludeInternalReplacementRoleWhereSql,
  isBoardStaffingRequestCode,
  isInternalReplacementRoleName,
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

  it('flags internal replacement role names', () => {
    expect(isInternalReplacementRoleName('ทดแทนงาน')).toBe(true);
    expect(isInternalReplacementRoleName('สรรหาทดแทนงาน')).toBe(true);
    expect(isInternalReplacementRoleName('ขับรถ')).toBe(false);
  });

  it('builds SQL to exclude internal replacement roles', () => {
    const sql = excludeInternalReplacementRoleWhereSql('A');
    expect(sql).toContain('hr_ms_job_description_1');
    expect(sql).toContain("LIKE N'%ทดแทน%'");
  });
});
