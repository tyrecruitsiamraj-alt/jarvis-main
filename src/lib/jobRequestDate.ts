/**
 * วันที่ของใบขอ (YYYY-MM-DD) — วันที่ขอ → วันที่ส่ง → วันที่สร้าง
 * ย้ายออกมาจาก `components/shared/DateRangeCalendarPicker.tsx` 29 ก.ย. 2569 (เนื้อเดิม) ให้ฝั่ง server ใช้ตัวเดียวกันได้
 * (หน้าทีม Online นับ "ใบยังไม่มีผู้สมัคร ค้างมานานแค่ไหน") — ไฟล์เดิม re-export ไว้ ผู้เรียกเดิมไม่ต้องแก้
 */
export function jobRequestDateYmd(job: { request_date?: string; submittedAt?: string; created_at?: string }): string | null {
  const raw = job.request_date || job.submittedAt || job.created_at;
  if (!raw || typeof raw !== 'string') return null;
  return raw.slice(0, 10);
}
