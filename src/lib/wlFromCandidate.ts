import type { Candidate, Employee } from '@/types';

/** รหัสพนักงานใน WL ที่มาจากผู้สมัคร (ใช้ใน URL /wl/employees/:id) */
export const WL_FROM_CANDIDATE_PREFIX = 'wl-cand-';

export function wlEmployeeIdFromCandidateId(candidateId: string): string {
  return `${WL_FROM_CANDIDATE_PREFIX}${candidateId}`;
}

export function parseWlEmployeeCandidateId(employeeRouteId: string): string | null {
  if (!employeeRouteId.startsWith(WL_FROM_CANDIDATE_PREFIX)) return null;
  const rest = employeeRouteId.slice(WL_FROM_CANDIDATE_PREFIX.length);
  return rest.length > 0 ? rest : null;
}

export function isWlStaffingTrack(c: Pick<Candidate, 'staffing_track'>): boolean {
  return (c.staffing_track ?? 'regular') === 'wl';
}

/** แปลงผู้สมัครที่เป็น WL เป็นแถวพนักงานสำหรับหน้ารายชื่อ WL */
export function candidateToWlEmployeeRow(c: Candidate): Employee {
  const id = wlEmployeeIdFromCandidateId(c.id);
  return {
    id,
    employee_code: `WL-${c.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone,
    status: 'active',
    position: 'พนักงาน WL (จากผู้สมัคร)',
    join_date: c.application_date,
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    reliability_score: 0,
    utilization_rate: 0,
    total_days_worked: 0,
    total_income: 0,
    total_cost: 0,
    total_issues: 0,
    created_at: c.created_at,
  };
}
