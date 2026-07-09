import type { JobRequest } from '@/types';

/** จำนวนตำแหน่งที่ต้องการต่อใบขอ — ค่าเริ่มต้น 1 ถ้าไม่มีข้อมูล */
export function jobPositionUnits(job: JobRequest): number {
  const n = job.position_units;
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return Math.round(n);
  return 1;
}

export function sumJobPositionUnits(jobs: JobRequest[]): number {
  return jobs.reduce((sum, j) => sum + jobPositionUnits(j), 0);
}
