import { describe, expect, it } from 'vitest';
import {
  filterAvailableBoardMatches,
  isBoardCandidateAvailable,
  type BoardAvailabilityContext,
} from '../../src/lib/boardMatchAvailability';

const JOB = 'siamraj-sql:OPL01';
const OTHER = 'siamraj-sql:OPL99';

function ctx(over: Partial<{ available: number[]; active: Array<[number, string]> }> = {}): BoardAvailabilityContext {
  return {
    availableCardIds: new Set(over.available ?? [1, 2, 3, 4]),
    activeJobByCardId: new Map(over.active ?? []),
  };
}

describe('board match availability', () => {
  it('keeps a candidate who is in the pool and not reserved anywhere', () => {
    expect(isBoardCandidateAvailable(1, JOB, ctx())).toBe(true);
  });

  it('hides a candidate who has dropped out of the board-ready pool', () => {
    expect(isBoardCandidateAvailable(9, JOB, ctx({ available: [1, 2] }))).toBe(false);
  });

  it('hides a candidate reserved/placed on a different request', () => {
    expect(isBoardCandidateAvailable(2, JOB, ctx({ active: [[2, OTHER]] }))).toBe(false);
  });

  it('keeps a candidate who is active on THIS request (they are its pick)', () => {
    expect(isBoardCandidateAvailable(2, JOB, ctx({ active: [[2, JOB]] }))).toBe(true);
  });

  it('filters a match list down to only available people', () => {
    const matches = [
      { card_id: 1, tier: 'green' },
      { card_id: 2, tier: 'green' }, // taken elsewhere
      { card_id: 3, tier: 'yellow' }, // out of pool
      { card_id: 4, tier: 'yellow' }, // active here → keep
    ];
    const result = filterAvailableBoardMatches(matches, JOB, {
      availableCardIds: new Set([1, 2, 4]),
      activeJobByCardId: new Map<number, string>([
        [2, OTHER],
        [4, JOB],
      ]),
    });
    expect(result.map((m) => m.card_id)).toEqual([1, 4]);
  });

  it('returns [] for nullish input', () => {
    expect(filterAvailableBoardMatches(null, JOB, ctx())).toEqual([]);
    expect(filterAvailableBoardMatches(undefined, JOB, ctx())).toEqual([]);
  });
});
