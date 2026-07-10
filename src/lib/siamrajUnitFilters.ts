import type { JobRequest } from '@/types';
import { jobPositionUnits, sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { getJobRequestSubmittedDate } from '@/lib/jobUrgency';

export function normalizeDepartmentCode(code?: string | null): string {
  const trimmed = (code || '').trim();
  return trimmed || '—';
}

export type SiamrajYearFilter = 'all' | string;

/** ปีที่กรอกใบขอ (ค.ศ.) เป็น string เช่น "2026" — ไม่มีวันที่คืน '' */
export function extractRequestYear(job: JobRequest): string {
  const d = getJobRequestSubmittedDate(job);
  return d ? String(d.getFullYear()) : '';
}

/** ค.ศ. → พ.ศ. สำหรับแสดงผล */
export function formatYearLabelBe(gregorianYear: string): string {
  const n = Number(gregorianYear);
  if (!Number.isFinite(n) || n <= 0) return 'ไม่ระบุ';
  return String(n + 543);
}

export function filterUnitRequestsByYear(
  jobs: JobRequest[],
  filter: SiamrajYearFilter,
): JobRequest[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => extractRequestYear(j) === filter);
}

export function yearFilterOptions(
  jobs: JobRequest[],
): { value: SiamrajYearFilter; label: string }[] {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const year = extractRequestYear(j);
    if (!year) continue;
    counts.set(year, (counts.get(year) ?? 0) + jobPositionUnits(j));
  }

  const options: { value: SiamrajYearFilter; label: string }[] = [
    { value: 'all', label: `ทุกปี (${sumJobPositionUnits(jobs)})` },
  ];

  for (const [year, count] of [...counts.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))) {
    options.push({ value: year, label: `${formatYearLabelBe(year)} (${count})` });
  }

  return options;
}

/** รหัสแผนก — ใช้เป็นค่า filter */
export function extractDepartmentCode(job: JobRequest): string {
  return normalizeDepartmentCode(job.department_code);
}

/** แสดงรหัสแผนก — ตัวพิมพ์ใหญ่ เช่น LBD */
export function formatDepartmentCodeDisplay(code: string): string {
  const c = code.trim();
  if (!c || c === '—') return 'ไม่ระบุ';
  if (c.length <= 3) return c.toUpperCase();
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
    counts.set(code, (counts.get(code) ?? 0) + jobPositionUnits(j));
  }
  return counts;
}

export function departmentFilterOptions(
  jobs: JobRequest[],
): { value: SiamrajDepartmentFilter; label: string }[] {
  const counts = departmentCounts(jobs);

  const options: { value: SiamrajDepartmentFilter; label: string }[] = [
    { value: 'all', label: `ทั้งหมด (${sumJobPositionUnits(jobs)})` },
  ];

  for (const [code, count] of [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'),
  )) {
    const label = departmentLabelForCode(jobs, code);
    options.push({ value: code, label: `${label} (${count})` });
  }

  return options;
}

/** ค่า filter สำหรับใบขอที่ไม่มีลักษณะงานย่อย */
export const JOB_SUBTYPE_UNSET = '__unset__';

export type SiamrajJobSubtypeFilter = 'all' | string;

export function extractJobSubtypeKey(job: JobRequest): string {
  const v = job.job_description_code_2?.trim();
  return v || JOB_SUBTYPE_UNSET;
}

export function formatJobSubtypeLabel(key: string): string {
  if (key === JOB_SUBTYPE_UNSET) return 'ไม่ระบุ';
  return key;
}

export function extractJobSubtypeLabel(job: JobRequest): string {
  return formatJobSubtypeLabel(extractJobSubtypeKey(job));
}

export function filterUnitRequestsByJobSubtype(
  jobs: JobRequest[],
  filter: SiamrajJobSubtypeFilter,
): JobRequest[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => extractJobSubtypeKey(j) === filter);
}

export function jobSubtypeCounts(jobs: JobRequest[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const key = extractJobSubtypeKey(j);
    counts.set(key, (counts.get(key) ?? 0) + jobPositionUnits(j));
  }
  return counts;
}

export function jobSubtypeFilterOptions(
  jobs: JobRequest[],
): { value: SiamrajJobSubtypeFilter; label: string }[] {
  const counts = jobSubtypeCounts(jobs);

  const options: { value: SiamrajJobSubtypeFilter; label: string }[] = [
    { value: 'all', label: `ทั้งหมด (${sumJobPositionUnits(jobs)})` },
  ];

  for (const [key, count] of [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || formatJobSubtypeLabel(a[0]).localeCompare(formatJobSubtypeLabel(b[0]), 'th'),
  )) {
    options.push({
      value: key,
      label: `${formatJobSubtypeLabel(key)} (${count})`,
    });
  }

  return options;
}
