import { mockEmployees } from '@/data/mockData';
import type { Candidate, Employee } from '@/types';
import { candidateToWlEmployeeRow, isWlStaffingTrack } from '@/lib/wlFromCandidate';
import { isDemoMode } from '@/lib/demoMode';

const mergeEmployees = (apiItems: Employee[], localItems: Employee[]) => {
  const map = new Map<string, Employee>();
  if (isDemoMode()) {
    [...mockEmployees, ...localItems, ...apiItems].forEach((item) => {
      map.set(item.id, item);
    });
  } else {
    apiItems.forEach((item) => {
      map.set(item.id, item);
    });
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

/** รวมพนักงานจาก API/local กับผู้สมัครกลุ่ม WL สำหรับหน้า WL */
export function combineWlEmployeeList(
  apiEmps: Employee[],
  localEmps: Employee[],
  mergedCandidates: Candidate[],
): Employee[] {
  const base = mergeEmployees(apiEmps, localEmps);
  const wlRows = mergedCandidates.filter(isWlStaffingTrack).map(candidateToWlEmployeeRow);
  return [...base, ...wlRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
