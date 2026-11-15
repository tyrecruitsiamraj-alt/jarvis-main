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

/**
 * เหลือหาที่โชว์บนจอ — ใบปิดแล้ว = 0 (QA 15 พ.ย. 2569: ERP ส่งเหลือหา 0 มาเป็นค่าว่าง ⇒ `jobPositionUnits` ถอยไป 1
 * ใบปิดขึ้น "ขอ 1 · หาได้ 1 · เหลือหา 1") · ใบเปิดใช้ `jobPositionUnits` ตามเดิม
 */
export function remainingPositionsOf(job: JobRequest): number {
  return job.status === 'closed' ? 0 : jobPositionUnits(job);
}
