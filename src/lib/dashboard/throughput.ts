import type { JobRequest } from '@/types';
import { effectiveRequestDateYmd } from '@/lib/jobUrgency';
import { positionBreakdownFromJob } from '@/lib/requestControl';
import type { DashboardActivityTrendPoint } from '@/lib/dashboard/types';

export type ThroughputRecord = {
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
  kind?: 'filled' | 'cancelled' | 'remaining';
};

export type ThroughputSummary = {
  /** ตำแหน่งที่ขอในช่วง (รวมทุกส่วนของใบขอ) */
  requested: number;
  /** ตำแหน่งที่ปิดในช่วง */
  closed: number;
  /** ตำแหน่งคงเหลือจากใบขอในช่วง */
  remaining: number;
  /** ปิดในช่วง + ขอในช่วง */
  closedSamePeriod: number;
  /** ปิดในช่วง + ขอก่อนช่วง (backlog) */
  closedBacklog: number;
};

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

function resolveKind(r: ThroughputRecord): 'filled' | 'cancelled' | 'remaining' {
  if (r.kind === 'filled' || r.kind === 'cancelled' || r.kind === 'remaining') return r.kind;
  return r.isOpen ? 'remaining' : 'filled';
}

/** แยกอัตรา ขอ/ปิด/ยกเลิก/คงเหลือ ตามสถานะปัจจุบันของใบ */
export function jobsToThroughputRecords(jobs: JobRequest[], today = new Date()): ThroughputRecord[] {
  const out: ThroughputRecord[] = [];
  for (const j of jobs) {
    const requestDate = effectiveRequestDateYmd(j, today);
    if (!requestDate) continue;
    const b = positionBreakdownFromJob(j);
    const closureDate =
      b.remainingPositions === 0
        ? safeYmd(j.closed_date) || safeYmd(j.request_date) || requestDate
        : null;

    const closedYmd = closureDate ?? safeYmd(j.closed_date) ?? requestDate;

    if (b.filledPositions > 0) {
      out.push({
        requestDate,
        closureDate: closedYmd,
        positionUnits: b.filledPositions,
        isOpen: false,
        kind: 'filled',
      });
    }
    if (b.cancelledPositions > 0) {
      out.push({
        requestDate,
        closureDate: closedYmd,
        positionUnits: b.cancelledPositions,
        isOpen: false,
        kind: 'cancelled',
      });
    }
    if (b.remainingPositions > 0) {
      out.push({
        requestDate,
        closureDate: null,
        positionUnits: b.remainingPositions,
        isOpen: true,
        kind: 'remaining',
      });
    }
  }
  return out;
}

export function filterJobsForThroughput(
  jobs: JobRequest[],
  from: string,
  to: string,
  today = new Date(),
): JobRequest[] {
  return jobs.filter((j) => {
    const rd = effectiveRequestDateYmd(j, today);
    const cd =
      j.status === 'closed' || j.status === 'cancelled'
        ? safeYmd(j.closed_date) || rd
        : null;
    if (rd && inYmdRange(rd, from, to)) return true;
    if (cd && inYmdRange(cd, from, to)) return true;
    return false;
  });
}

export function sumThroughputInRange(
  records: ThroughputRecord[],
  from: string,
  to: string,
): ThroughputSummary {
  let requested = 0;
  let closed = 0;
  let remaining = 0;
  let closedSamePeriod = 0;
  let closedBacklog = 0;

  for (const r of records) {
    const kind = resolveKind(r);
    const inRequestPeriod = inYmdRange(r.requestDate, from, to);
    if (inRequestPeriod) {
      requested += r.positionUnits;
      if (kind === 'remaining') remaining += r.positionUnits;
    }
    if (kind === 'filled' && r.closureDate && inYmdRange(r.closureDate, from, to)) {
      closed += r.positionUnits;
      if (inRequestPeriod) closedSamePeriod += r.positionUnits;
      else closedBacklog += r.positionUnits;
    }
  }

  return { requested, closed, remaining, closedSamePeriod, closedBacklog };
}

/**
 * กราฟรายเดือนแบบ cohort ตามเดือนที่เปิดใบ:
 * เข้ามาคงที่ · ปิด/ยกเลิก/คงเหลืออัปเดตตามสถานะปัจจุบัน
 */
export function enrichActivityTrendWithThroughput(
  points: DashboardActivityTrendPoint[],
  records: ThroughputRecord[],
): DashboardActivityTrendPoint[] {
  const requestedMap = new Map<string, number>();
  const filledMap = new Map<string, number>();
  const cancelledMap = new Map<string, number>();
  const remainingMap = new Map<string, number>();

  for (const r of records) {
    const reqMonth = r.requestDate.slice(0, 7);
    requestedMap.set(reqMonth, (requestedMap.get(reqMonth) ?? 0) + r.positionUnits);
    const kind = resolveKind(r);
    if (kind === 'filled') {
      filledMap.set(reqMonth, (filledMap.get(reqMonth) ?? 0) + r.positionUnits);
    } else if (kind === 'cancelled') {
      cancelledMap.set(reqMonth, (cancelledMap.get(reqMonth) ?? 0) + r.positionUnits);
    } else {
      remainingMap.set(reqMonth, (remainingMap.get(reqMonth) ?? 0) + r.positionUnits);
    }
  }

  return points.map((p) => {
    const month = p.date.slice(0, 7);
    const requested = requestedMap.get(month) ?? 0;
    const filled = filledMap.get(month) ?? 0;
    const cancelled = cancelledMap.get(month) ?? 0;
    const remaining =
      remainingMap.get(month) ?? Math.max(0, requested - filled - cancelled);
    const closeRatePercent =
      requested > 0 ? Math.round((filled / requested) * 1000) / 10 : null;
    return {
      ...p,
      requestedPositions: requested,
      closedPositions: filled,
      filledPositions: filled,
      cancelledPositions: cancelled,
      remainingPositions: remaining,
      closeRatePercent,
    };
  });
}
