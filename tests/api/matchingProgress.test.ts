import { describe, expect, it } from 'vitest';
import {
  distantCandidateCount,
  officialRemainingCount,
  proposalCounts,
  recommendedCandidateCount,
  requestPositionCount,
} from '../../src/lib/matchingProgress';

describe('matching progress', () => {
  it('uses the authoritative requested-position quantity when available', () => {
    expect(requestPositionCount({ request_positions: 5, position_units: 2 })).toBe(5);
    expect(requestPositionCount({ position_units: 3 })).toBe(3);
  });

  it('keeps official remaining separate from matching workflow statuses', () => {
    expect(
      officialRemainingCount({
        request_positions: 5,
        filled_positions: 2,
        cancelled_positions: 1,
      }),
    ).toBe(2);
  });

  it('never returns a negative official remaining quantity', () => {
    expect(
      officialRemainingCount({
        request_positions: 2,
        filled_positions: 2,
        cancelled_positions: 2,
      }),
    ).toBe(0);
  });

  it('counts contact, reservation, and matching placement independently', () => {
    expect(
      proposalCounts([
        { status: 'contacted' },
        { status: 'reserved' },
        { status: 'reserved' },
        { status: 'placed' },
        { status: 'rejected' },
      ]),
    ).toEqual({ contacted: 1, reserved: 2, placed: 1 });
  });

  it('excludes red candidates from AI recommendation totals', () => {
    const matches = [{ tier: 'green' }, { tier: 'yellow' }, { tier: 'red' }] as const;
    expect(recommendedCandidateCount(matches)).toBe(2);
    expect(distantCandidateCount(matches)).toBe(1);
  });
});
