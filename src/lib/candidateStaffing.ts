import type { Candidate, CandidateStaffingTrack } from '@/types';

/** ลำดับ: 1. พนักงานประจำ 2. WL 3. EX */
export const CANDIDATE_STAFFING_OPTIONS: { value: CandidateStaffingTrack; label: string }[] = [
  { value: 'regular', label: 'พนักงานประจำ' },
  { value: 'wl', label: 'WL' },
  { value: 'ex', label: 'EX' },
];

export function hydrateCandidateStaffing(c: Candidate): Candidate {
  const st = c.staffing_track;
  const track: CandidateStaffingTrack =
    st === 'wl' || st === 'ex' || st === 'regular' ? st : 'regular';
  return { ...c, staffing_track: track };
}

export function candidateStaffingLabel(track: CandidateStaffingTrack | undefined): string {
  switch (track ?? 'regular') {
    case 'wl':
      return 'WL';
    case 'ex':
      return 'EX';
    default:
      return 'พนักงานประจำ';
  }
}
