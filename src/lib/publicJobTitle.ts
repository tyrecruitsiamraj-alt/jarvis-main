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
  valet: 'Valet',
};

export function publicJobTitle(job: JobRequest): string {
  if (!isDrivingJobPosition(job)) return publicJobPositionLabel(job);
  const kind = DRIVER_KIND[drivingSubtypeOf(job)];
  return kind ? `พนักงานขับรถ ${kind}` : 'พนักงานขับรถ';
}
