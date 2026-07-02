import type { JobRequest } from '@/types';

export function normalizeDepartmentCode(code?: string | null): string {
  const trimmed = (code || '').trim();
  return trimmed || '—';
}

/** รหัสแผนก — ใช้เป็นค่า filter */
export function extractDepartmentCode(job: JobRequest): string {
  return normalizeDepartmentCode(job.department_code);
}

/** ชื่อแสดงใน dropdown / การ์ด */
export function extractDepartmentLabel(job: JobRequest): string {
  const code = extractDepartmentCode(job);
  const name = job.department_name?.trim();
  if (code !== '—' && name) return `${code} — ${name}`;
  if (name) return name;
  if (code !== '—') return code;
  return 'ไม่ระบุ';
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

export function departmentLabelForCode(jobs: JobRequest[], code: string): string {
  const sample = jobs.find((j) => extractDepartmentCode(j) === code);
  return sample ? extractDepartmentLabel(sample) : code === '—' ? 'ไม่ระบุ' : code;
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
