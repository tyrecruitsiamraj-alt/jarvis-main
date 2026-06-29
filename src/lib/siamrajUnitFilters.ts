import type { JobRequest } from '@/types';

/** ลักษณะงานจาก Siamraj (ชื่อตำแหน่ง/งาน) */
export function extractJobRole(job: JobRequest): string | null {
  const role = job.job_description_code_1?.trim();
  return role || null;
}

export type SiamrajJobRoleFilter = 'all' | string;

export function filterUnitRequestsByJobRole(
  jobs: JobRequest[],
  filter: SiamrajJobRoleFilter,
): JobRequest[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => extractJobRole(j) === filter);
}

export function jobRoleFilterOptions(jobs: JobRequest[]): { value: SiamrajJobRoleFilter; label: string }[] {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const role = extractJobRole(j);
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  const options: { value: SiamrajJobRoleFilter; label: string }[] = [
    { value: 'all', label: `ทั้งหมด (${jobs.length})` },
  ];

  for (const [role, count] of [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'),
  )) {
    options.push({ value: role, label: `${role} (${count})` });
  }

  return options;
}
