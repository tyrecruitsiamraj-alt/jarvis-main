import { hydrateCandidateStaffing } from '@/lib/candidateStaffing';
import type { Candidate } from '@/types';

/** รายการผู้สมัครจาก API + ค่า staffing_track เริ่มต้น */
export function mergeCandidateSources(apiItems: Candidate[]): Candidate[] {
  return [...apiItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(hydrateCandidateStaffing);
}
