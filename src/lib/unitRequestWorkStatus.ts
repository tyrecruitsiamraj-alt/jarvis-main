/** สถานะทำงานใบขอ (Jarvis PG) — แยกจาก JobStatus / Siamraj ST */
export type UnitRequestWorkStatus =
  | 'in_progress'
  | 'evaluating'
  | 'waiting_inform'
  | 'waiting_interview'
  | 'waiting_start';

export const UNIT_REQUEST_WORK_STATUS_LABELS: Record<UnitRequestWorkStatus, string> = {
  in_progress: 'ดำเนินการ',
  evaluating: 'เริ่มประเมิน',
  waiting_inform: 'รอแจ้งเข้า',
  waiting_interview: 'รอสัมภาษณ์',
  waiting_start: 'รอเริ่มงาน/รอผลสัมภาษณ์',
};

export const UNIT_REQUEST_WORK_STATUS_DATE_LABELS: Record<UnitRequestWorkStatus, string> = {
  in_progress: 'วันที่',
  evaluating: 'วันที่เริ่มประเมิน',
  waiting_inform: 'วันที่แจ้งเข้า',
  waiting_interview: 'วันนัดสัมภาษณ์',
  waiting_start: 'วันที่เริ่มงาน',
};

export const UNIT_REQUEST_WORK_STATUS_OPTIONS: UnitRequestWorkStatus[] = [
  'in_progress',
  'evaluating',
  'waiting_inform',
  'waiting_interview',
  'waiting_start',
];

export function isUnitRequestWorkStatus(v: unknown): v is UnitRequestWorkStatus {
  return typeof v === 'string' && v in UNIT_REQUEST_WORK_STATUS_LABELS;
}

export function resolveUnitRequestWorkStatus(
  status: UnitRequestWorkStatus | null | undefined,
): UnitRequestWorkStatus {
  return status && isUnitRequestWorkStatus(status) ? status : 'in_progress';
}

export function formatWorkPersonName(
  first?: string | null,
  last?: string | null,
): string {
  return [first?.trim(), last?.trim()].filter(Boolean).join(' ');
}
