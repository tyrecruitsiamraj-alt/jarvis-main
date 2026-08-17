import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest } from '@/types';
import { computeJobUrgency, effectiveRequestDateYmd, type RequestStatusKind } from '@/lib/jobUrgency';
import { toYmdBangkok } from '@/lib/dateTh';
import type { RequestControlStatus } from '@/lib/requestControl';

export type SlaStatus =
  | 'on_track'
  | 'at_risk'
  | 'breached'
  | 'closed_on_time'
  | 'closed_late';

export type JobSlaMeta = {
  requestKind: RequestStatusKind | 'unknown';
  slaStartDate: string | null;
  slaDueDate: string | null;
  slaDays: number;
  daysUsed: number | null;
  daysOverdue: number;
  slaStatus: SlaStatus;
};

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function submittedYmd(job: JobRequest): string | null {
  return safeYmd(job.submittedAt) || safeYmd(job.request_date) || safeYmd(job.created_at);
}

function slaDaysForKind(kind: RequestStatusKind | 'unknown'): number {
  switch (kind) {
    case 'retroactive':
      return 7;
    case 'urgent':
    case 'advance':
      return 15;
    default:
      return 15;
  }
}

/**
 * บวกวันปฏิทินบน YYYY-MM-DD โดยคิดเป็นเวลาท้องถิ่นล้วน
 *
 * ⚠️ **ห้ามใช้ `parseISO(ymd).toISOString().slice(0,10)`** — parseISO คืนเที่ยงคืน
 * เวลาท้องถิ่น พอ toISOString (UTC) ในเขต UTC+7 จะถอยไปวันก่อนหน้า → SLA พลาด 1 วันทุกใบ
 * (นิยามที่ถูกอยู่ที่ requestControlLedger.ts:164 มีเทสต์ล็อกค่าไว้ — ตัวนี้ต้องตรงกัน)
 */
function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** SLA เริ่มนับและครบกำหนดตามประเภทใบขอ */
export function computeJobSla(
  job: JobRequest,
  controlStatus: RequestControlStatus,
  today = new Date(),
): JobSlaMeta {
  const urgency = computeJobUrgency(job, today);
  const kind = urgency.kind;
  const slaDays = slaDaysForKind(kind);

  const slaStartDate =
    kind === 'retroactive' ? submittedYmd(job) : safeYmd(job.required_date) || submittedYmd(job);
  const slaDueDate = slaStartDate ? addCalendarDays(slaStartDate, slaDays) : null;

  // วันนี้ตามปฏิทินกรุงเทพ — ห้าม toISOZ (ช่วงเที่ยงคืน–07:00 น. ไทยจะกลายเป็นเมื่อวาน)
  const todayYmd = toYmdBangkok(today);
  const closedYmd = safeYmd(job.closed_date);

  if (controlStatus === 'fully_closed' && closedYmd && slaDueDate) {
    const daysUsed = differenceInCalendarDays(parseISO(closedYmd), parseISO(slaStartDate!));
    const daysOverdue = Math.max(differenceInCalendarDays(parseISO(closedYmd), parseISO(slaDueDate)), 0);
    return {
      requestKind: kind,
      slaStartDate,
      slaDueDate,
      slaDays,
      daysUsed,
      daysOverdue,
      slaStatus: daysOverdue > 0 ? 'closed_late' : 'closed_on_time',
    };
  }

  if (controlStatus === 'fully_closed') {
    return {
      requestKind: kind,
      slaStartDate,
      slaDueDate,
      slaDays,
      daysUsed: slaStartDate && closedYmd
        ? differenceInCalendarDays(parseISO(closedYmd), parseISO(slaStartDate))
        : null,
      daysOverdue: 0,
      slaStatus: 'closed_on_time',
    };
  }

  if (!slaDueDate) {
    return {
      requestKind: kind,
      slaStartDate,
      slaDueDate,
      slaDays,
      daysUsed: null,
      daysOverdue: 0,
      slaStatus: 'on_track',
    };
  }

  const daysToDue = differenceInCalendarDays(parseISO(slaDueDate), parseISO(todayYmd));
  const daysOverdue = daysToDue < 0 ? -daysToDue : 0;
  const daysUsed = slaStartDate
    ? differenceInCalendarDays(parseISO(todayYmd), parseISO(slaStartDate))
    : null;

  let slaStatus: SlaStatus = 'on_track';
  if (daysOverdue > 0) slaStatus = 'breached';
  else if (daysToDue <= 3) slaStatus = 'at_risk';

  return {
    requestKind: kind,
    slaStartDate,
    slaDueDate,
    slaDays,
    daysUsed,
    daysOverdue,
    slaStatus,
  };
}

export function effectiveRequestKind(job: JobRequest, today = new Date()): RequestStatusKind | 'unknown' {
  const ymd = effectiveRequestDateYmd(job, today);
  if (!ymd) return 'unknown';
  return computeJobUrgency(job, today).kind;
}
