/**
 * เส้นข้อมูลของฉาก "ห้องทำงาน" บนหน้าแรก
 *
 * แยกคนละเส้นกับ `flow-summary` โดยตั้งใจ: เส้นนี้อ่านแต่ PostgreSQL (เร็ว)
 * ส่วนเลขฝั่งใบขอมาจาก ERP ผ่าน flow-summary ที่หน้าแรกโหลดอยู่แล้ว
 * → ประกอบกันด้วย `composeOfficeFloorRaw()` ไม่ยิง ERP ซ้ำ
 */
import { apiFetch } from '@/lib/apiFetch';
import type { OfficeFloorCounts } from '@/lib/officeFloor';

export type OfficeFloorResponse = {
  generated_at: string;
  /** BU กลางที่เส้นกรองให้ (ไม่มี/null = ไม่กรอง) */
  bu?: string | null;
  counts: OfficeFloorCounts;
};

/** `bu` = BU กลางชุดแผนก (หน้าหลักโฉม 3 ก้อน) · ไม่ส่ง = ผลเดิมทุกอย่าง */
export async function fetchOfficeFloor(bu?: string | null): Promise<OfficeFloorResponse> {
  const r = await apiFetch(bu ? `/api/office-floor?bu=${encodeURIComponent(bu)}` : '/api/office-floor');
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดสถานะห้องทำงานไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as OfficeFloorResponse;
}
