import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';

/**
 * หน้าตาปุ่มตัวกรอง — กรอบฟ้าเมื่อกำลังกรองอยู่ · กรอบเทาเมื่อยังไม่เลือก
 * ตัวเดียวของ `ChoiceDropdown` · หัวข้อกรองกล่องงาน/แท็บผู้สมัคร (`BoardFilterPanel`)
 * (ปุ่มช่วงวันที่แบบ `filter` ใช้ชุดสีเดียวกัน)
 */
export function filterTriggerClass(active: boolean): string {
  return cn('rounded-lg font-medium', active ? TONE.info.outline : TONE.neutral.outline);
}
