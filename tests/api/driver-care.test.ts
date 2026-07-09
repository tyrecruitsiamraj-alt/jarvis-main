// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { bangkokBusinessDateYmd, bangkokNoonDate, isValidYmd } from '../../api/_lib/businessDate';
import {
  parseActionLogInput,
  parseActionUpdateInput,
} from '../../api/_lib/driverCareActionValidation';
import { DomainError } from '../../api/_lib/domainErrors';

const EMPLOYEE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ACTION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

describe('businessDate', () => {
  it('formats Bangkok YYYY-MM-DD', () => {
    const ymd = bangkokBusinessDateYmd(new Date('2026-06-08T20:00:00Z'));
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('anchors scoring at Bangkok noon', () => {
    const d = bangkokNoonDate('2026-06-08');
    expect(d.getUTCHours()).toBe(5);
  });

  it('validates YMD strings', () => {
    expect(isValidYmd('2026-06-08')).toBe(true);
    expect(isValidYmd('2026-13-01')).toBe(false);
    expect(isValidYmd('bad')).toBe(false);
  });
});

describe('driverCareActionValidation', () => {
  it('accepts valid log input', () => {
    const parsed = parseActionLogInput({
      employeeId: EMPLOYEE_ID,
      actionType: 'call',
      issueFound: 'income_drop',
      actionTaken: 'โทรสอบถามรายได้',
      result: 'stay',
      status: 'pending',
      nextFollowUpDate: '2026-06-15',
    });
    expect(parsed.employeeId).toBe(EMPLOYEE_ID);
    expect(parsed.actionType).toBe('call');
    expect(parsed.nextFollowUpDate).toBe('2026-06-15');
  });

  it('rejects invalid action type', () => {
    expect(() =>
      parseActionLogInput({
        employeeId: EMPLOYEE_ID,
        actionType: 'invalid',
        issueFound: 'none',
        actionTaken: 'test',
        result: 'stay',
      }),
    ).toThrow(DomainError);
  });

  it('rejects note that is too long', () => {
    expect(() =>
      parseActionLogInput({
        employeeId: EMPLOYEE_ID,
        actionType: 'call',
        issueFound: 'none',
        actionTaken: 'x'.repeat(2001),
        result: 'stay',
      }),
    ).toThrow(DomainError);
  });

  it('accepts partial action update', () => {
    const parsed = parseActionUpdateInput({
      id: ACTION_ID,
      status: 'closed',
      nextFollowUpDate: null,
    });
    expect(parsed.status).toBe('closed');
    expect(parsed.nextFollowUpDate).toBeNull();
  });
});
