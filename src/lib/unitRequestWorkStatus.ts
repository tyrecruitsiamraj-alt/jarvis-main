/** สถานะทำงานใบขอ (Jarvis PG) — แยกจาก JobStatus / Siamraj ST */
export type UnitRequestWorkStatus =
  | 'in_progress'
  | 'evaluating'
  | 'waiting_inform'
  | 'waiting_interview'
  | 'waiting_result'
  | 'waiting_start';

export const UNIT_REQUEST_WORK_STATUS_LABELS: Record<UnitRequestWorkStatus, string> = {
  in_progress: 'ดำเนินการ',
  evaluating: 'เริ่มประเมิน',
  waiting_inform: 'รอแจ้งเข้า',
  waiting_interview: 'รอสัมภาษณ์',
  waiting_result: 'รอผลสัมภาษณ์',
  waiting_start: 'รอเริ่มงาน',
};

export const UNIT_REQUEST_WORK_STATUS_DATE_LABELS: Record<UnitRequestWorkStatus, string> = {
  in_progress: 'วันที่',
  evaluating: 'วันที่เริ่มประเมิน',
  waiting_inform: 'วันที่แจ้งเข้า',
  waiting_interview: 'วันนัดสัมภาษณ์',
  waiting_result: 'วันที่สัมภาษณ์',
  waiting_start: 'วันที่เริ่มงาน',
};

export const UNIT_REQUEST_WORK_STATUS_OPTIONS: UnitRequestWorkStatus[] = [
  'in_progress',
  'evaluating',
  'waiting_inform',
  'waiting_interview',
  'waiting_result',
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

export function formatWorkPersonsSummary(
  persons?: Array<{ first_name?: string | null; last_name?: string | null }> | null,
  firstName?: string | null,
  lastName?: string | null,
): string {
  const list =
    persons && persons.length > 0
      ? persons
      : firstName || lastName
        ? [{ first_name: firstName, last_name: lastName }]
        : [];
  if (list.length === 0) return '';
  const first = formatWorkPersonName(list[0]?.first_name, list[0]?.last_name);
  if (list.length === 1) return first;
  return `${first} และอีก ${list.length - 1} คน`;
}
