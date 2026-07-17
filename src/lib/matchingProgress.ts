import type { CandidateProposal } from '@/lib/candidateProposalsApi';
import type { JobRequest } from '@/types';

export type CandidateMatchTier = 'green' | 'yellow' | 'red';

export function isRecommendedTier(tier: CandidateMatchTier): boolean {
  return tier === 'green' || tier === 'yellow';
}

export function recommendedCandidateCount(items: ReadonlyArray<{ tier: CandidateMatchTier }> | undefined): number {
  return (items ?? []).filter((item) => isRecommendedTier(item.tier)).length;
}

export function distantCandidateCount(items: ReadonlyArray<{ tier: CandidateMatchTier }> | undefined): number {
  return (items ?? []).filter((item) => item.tier === 'red').length;
}

type MatchingJobCounts = Pick<
  JobRequest,
  'request_positions' | 'position_units' | 'filled_positions' | 'cancelled_positions'
>;

export function requestPositionCount(job: MatchingJobCounts): number {
  return Math.max(1, Math.round(job.request_positions ?? job.position_units ?? 1));
}

/** เหลือหาทางการ: ขอมา - หาได้แล้ว - ยกเลิก (ไม่ใช้สถานะ Matching มาปน) */
export function officialRemainingCount(job: MatchingJobCounts): number {
  return Math.max(
    requestPositionCount(job) -
      Math.max(0, Math.round(job.filled_positions ?? 0)) -
      Math.max(0, Math.round(job.cancelled_positions ?? 0)),
    0,
  );
}

export function proposalCounts(items: Array<Pick<CandidateProposal, 'status'>> | undefined) {
  const list = items ?? [];
  return {
    contacted: list.filter((item) => item.status === 'contacted').length,
    reserved: list.filter((item) => item.status === 'reserved').length,
    placed: list.filter((item) => item.status === 'placed').length,
  };
}
