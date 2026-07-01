import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS } from '@/types';

/** ลักษณะงาน — ชื่อจาก Siamraj หรือ fallback เป็นประเภทมาตรฐาน */
export function extractJobRole(job: JobRequest): string {
  const role = job.job_description_code_1?.trim();
  if (role) return role;
  if (job.job_type && JOB_TYPE_LABELS[job.job_type]) return JOB_TYPE_LABELS[job.job_type];
  return 'ไม่ระบุ';
}

export type SiamrajJobRoleFilter = 'all' | string;

export function filterUnitRequestsByJobRole(
  jobs: JobRequest[],
  filter: SiamrajJobRoleFilter,
): JobRequest[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => extractJobRole(j) === filter);
}

export function jobRoleCounts(jobs: JobRequest[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const role = extractJobRole(j);
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return counts;
}

export function jobRoleFilterOptions(jobs: JobRequest[]): { value: SiamrajJobRoleFilter; label: string }[] {
  const counts = jobRoleCounts(jobs);

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
