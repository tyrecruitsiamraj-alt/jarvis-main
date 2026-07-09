import type { Candidate, Employee } from '@/types';
import { candidateToWlEmployeeRow, isWlStaffingTrack } from '@/lib/wlFromCandidate';

/** รวมพนักงานจาก API กับผู้สมัครกลุ่ม WL สำหรับหน้า WL */
export function combineWlEmployeeList(apiEmps: Employee[], mergedCandidates: Candidate[]): Employee[] {
  const base = [...apiEmps].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const wlRows = mergedCandidates.filter(isWlStaffingTrack).map(candidateToWlEmployeeRow);
  return [...base, ...wlRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
