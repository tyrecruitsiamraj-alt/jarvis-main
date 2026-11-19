/**
 * กล่องสถานะทำงานบนภาพรวม = ใบชุดเดียวกับการ์ด "เหลือหา" (เจ้าของ 19 พ.ย. 2569 "ถ้าเอาตามช่วง 2 อันก็ต้องเท่ากัน")
 * ใบ = ใบที่ยังเปิด ณ วันสุดท้ายของช่วง (`stuckEquation(...).remaining`) · อัตรา = เหลือหาของใบนั้น ⇒ "ทั้งหมด" เท่าการ์ดเหลือหาเสมอ
 * สถานะ = สถานะทำงานปัจจุบันของใบ (ตัวแปลเดียวกับ Dashboard `resolveUnitRequestWorkStatus`)
 * ใบที่ไม่อยู่ในรายการใบขอตอนนี้ (ปิดไปหลังวันสุดท้ายของช่วง) = "ไม่มีสถานะ" แบบ Dashboard — ยอดรวมไม่ขาด
 */
import type { JobRequest } from '@/types';
import type { StuckRequest } from '@/lib/recruitStuck';
import { UNIT_REQUEST_WORK_STATUS_LABELS, UNIT_REQUEST_WORK_STATUS_OPTIONS, resolveUnitRequestWorkStatus } from '@/lib/unitRequestWorkStatus';

export type StatusBox = { id: string; label: string; positions: number; requests: number; rows: StuckRequest[] };

export const STATUS_TOTAL_ID = 'work_status_total';
export const STATUS_NONE_ID = 'work_status_none';

export function workStatusOfRemaining(rows: readonly StuckRequest[], jobs: readonly JobRequest[]): StatusBox[] {
  const statusOf = new Map(jobs.map((j) => [j.id, resolveUnitRequestWorkStatus(j.work_status)]));
  const box = (id: string, label: string, list: StuckRequest[]): StatusBox => ({
    id,
    label,
    positions: list.reduce((n, r) => n + (Number(r.remaining) || 0), 0),
    requests: list.length,
    rows: list,
  });
  const keyOf = (r: StuckRequest) => (r.jobId ? statusOf.get(r.jobId) : undefined);
  const out = [
    box(STATUS_TOTAL_ID, 'ทั้งหมด', [...rows]),
    ...UNIT_REQUEST_WORK_STATUS_OPTIONS.map((s) =>
      box(`work_status_${s}`, s === 'in_progress' ? 'กำลังดำเนินการสรรหา' : UNIT_REQUEST_WORK_STATUS_LABELS[s], rows.filter((r) => keyOf(r) === s)),
    ),
  ];
  const none = rows.filter((r) => keyOf(r) === undefined);
  return none.length ? [...out, box(STATUS_NONE_ID, 'ไม่มีสถานะ', none)] : out;
}
