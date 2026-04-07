import { mockCandidates } from '@/data/mockData';
import { getCandidates, hydrateCandidateStaffing } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import type { Candidate } from '@/types';

/** รวมแหล่งผู้สมัคร + ใส่ staffing_track จาก localStorage (โหมดสาธิต) */
export function mergeCandidateSources(apiItems: Candidate[], localItems: Candidate[]): Candidate[] {
  const map = new Map<string, Candidate>();
  if (isDemoMode()) {
    /** mock → API → local: การแก้ใน localStorage ทับ id เดียวกัน */
    [...mockCandidates, ...apiItems, ...localItems].forEach((item) => {
      map.set(item.id, item);
    });
  } else {
    apiItems.forEach((item) => {
      map.set(item.id, item);
    });
  }
  return [...map.values()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(hydrateCandidateStaffing);
}

export function getMergedCandidatesInitial(): Candidate[] {
  return mergeCandidateSources([], getCandidates());
}
