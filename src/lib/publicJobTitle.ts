/**
 * ชื่อตำแหน่งที่คนนอกเห็นบนหน้าประกาศ (เจ้าของ 4 ต.ค. 2569: *"ส่วนกลางเอาไปรวมตรง ขับรถ ต้องเป็น
 * พนักงานขับรถ ส่วนกลาง นายไทย นายต่างชาติไรงี้"* → Choice "พนักงานขับรถ + ชนิด")
 *
 * งานขับรถ = "พนักงานขับรถ" + ชนิด (ตัวเดียวกับหัวข้องานย่อยของตัวกรอง `drivingSubtypeOf`) ·
 * ชนิดอ่านไม่ออก = "พนักงานขับรถ" เฉย ๆ (ห้ามเดา) · ตำแหน่งอื่น = ชื่อเดิม
 * ⚠️ ใช้**แค่วาดบนจอ** — ตัวกรอง/การเรียง/งานหลังบ้านยังใช้ `publicJobPositionLabel` (ห้ามเปลี่ยนค่าที่จับคู่กัน)
 */
import type { JobRequest } from '@/types';
import { drivingSubtypeOf } from '@/lib/boardFilters';
import { isDrivingJobPosition } from '@/lib/jobBoardPositionPreset';
import { publicJobPositionLabel } from '@/lib/unitRequestDisplay';

const DRIVER_KIND: Record<string, string> = {
  central: 'ส่วนกลาง',
  boss_th: 'นายไทย',
  boss_foreign: 'นายต่างชาติ',
  boss: 'นาย',
  valet: 'Valet parking',
};

export function publicJobTitle(job: JobRequest): string {
  if (!isDrivingJobPosition(job)) return publicJobPositionLabel(job);
  const kind = DRIVER_KIND[drivingSubtypeOf(job)];
  return kind ? `พนักงานขับรถ ${kind}` : 'พนักงานขับรถ';
}

/**
 * ตำแหน่งบนหน้า 4 "สรุปก่อนส่ง" (เจ้าของ 5 ต.ค. 2569: *"ตรงคำว่าตำแหน่ง มันต้องไม่ใช่แค่ ขับรถ ต้องบอกด้วยว่าขับรถอะไร
 * ขับส่วนกลาง นายไทย นายต่างชาติ ฯลฯ valet"*) — ชื่อเดียวกับหน้าประกาศ (`publicJobTitle`)
 * ชนิดอ่านไม่ออก = ต่อรายละเอียดตำแหน่งจากใบขอ (เช่น "ชนิดที่ 2" "รถกอล์ฟ") หรือบอกตรง ๆ ว่าใบขอไม่ระบุ — ห้ามเดาชนิด
 * (วัด 5 ต.ค.: ขับรถ 183 ใบ — แยกชนิดได้ 147 · "นาย" ไม่รู้สัญชาติ 14 · ไม่รู้ชนิด 22)
 */
export function postingPositionText(job: JobRequest): string {
  const title = publicJobTitle(job);
  if (!isDrivingJobPosition(job)) return title;
  const kind = drivingSubtypeOf(job);
  if (kind === 'boss') return `${title} (ใบขอไม่ระบุสัญชาตินาย)`;
  if (DRIVER_KIND[kind]) return title;
  const detail = (job.job_description_code_2 ?? '').trim();
  return detail && detail !== 'ไม่ระบุ' ? `${title} · ${detail}` : `${title} (ใบขอไม่ระบุชนิด)`;
}
