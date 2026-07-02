import type { JobRequest } from '@/types';

export function normalizeDepartmentCode(code?: string | null): string {
  const trimmed = (code || '').trim();
  return trimmed || '—';
}

/** รหัสแผนก — ใช้เป็นค่า filter */
export function extractDepartmentCode(job: JobRequest): string {
  return normalizeDepartmentCode(job.department_code);
}

/** แสดงรหัสสั้น เช่น LBD → Lbd */
export function formatDepartmentCodeDisplay(code: string): string {
  const c = code.trim();
  if (!c || c === '—') return 'ไม่ระบุ';
  if (c.length <= 3) {
    return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
  }
  return c;
}

/** ชื่อแสดงใน dropdown / การ์ด — ใช้เฉพาะรหัสแผนกสั้นๆ */
export function extractDepartmentLabel(job: JobRequest): string {
  return formatDepartmentCodeDisplay(extractDepartmentCode(job));
}

export function departmentLabelForCode(_jobs: JobRequest[], code: string): string {
  return formatDepartmentCodeDisplay(code);
}

export type SiamrajDepartmentFilter = 'all' | string;

export function filterUnitRequestsByDepartment(
  jobs: JobRequest[],
  filter: SiamrajDepartmentFilter,
): JobRequest[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => extractDepartmentCode(j) === filter);
}

export function departmentCounts(jobs: JobRequest[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const code = extractDepartmentCode(j);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

export function departmentFilterOptions(
  jobs: JobRequest[],
): { value: SiamrajDepartmentFilter; label: string }[] {
  const counts = departmentCounts(jobs);

  const options: { value: SiamrajDepartmentFilter; label: string }[] = [
    { value: 'all', label: `ทั้งหมด (${jobs.length})` },
  ];

  for (const [code, count] of [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'),
  )) {
    const label = departmentLabelForCode(jobs, code);
    options.push({ value: code, label: `${label} (${count})` });
  }

  return options;
}
