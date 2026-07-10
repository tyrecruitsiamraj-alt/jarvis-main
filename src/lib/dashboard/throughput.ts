import type { JobRequest } from '@/types';
import { effectiveRequestDateYmd } from '@/lib/jobUrgency';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
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

export function jobsToThroughputRecords(jobs: JobRequest[], today = new Date()): ThroughputRecord[] {
  const out: ThroughputRecord[] = [];
  for (const j of jobs) {
    const requestDate = effectiveRequestDateYmd(j, today);
    if (!requestDate) continue;
    const isOpen = j.status !== 'closed' && j.status !== 'cancelled';
    const closureDate =
      !isOpen ? safeYmd(j.closed_date) || safeYmd(j.request_date) || requestDate : null;
    out.push({
      requestDate,
      closureDate,
      positionUnits: jobPositionUnits(j),
      isOpen,
    });
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
    const inRequestPeriod = inYmdRange(r.requestDate, from, to);
    if (inRequestPeriod) {
      requested += r.positionUnits;
      if (r.isOpen) remaining += r.positionUnits;
    }
    if (!r.isOpen && r.closureDate && inYmdRange(r.closureDate, from, to) && r.kind !== 'cancelled') {
      closed += r.positionUnits;
      if (inRequestPeriod) closedSamePeriod += r.positionUnits;
      else closedBacklog += r.positionUnits;
    }
  }

  return { requested, closed, remaining, closedSamePeriod, closedBacklog };
}

export function enrichActivityTrendWithThroughput(
  points: DashboardActivityTrendPoint[],
  records: ThroughputRecord[],
): DashboardActivityTrendPoint[] {
  const requestedMap = new Map<string, number>();
  const closedMap = new Map<string, number>();

  for (const r of records) {
    const reqMonth = r.requestDate.slice(0, 7);
    requestedMap.set(reqMonth, (requestedMap.get(reqMonth) ?? 0) + r.positionUnits);
    if (!r.isOpen && r.closureDate && r.kind !== 'cancelled') {
      const closeMonth = r.closureDate.slice(0, 7);
      closedMap.set(closeMonth, (closedMap.get(closeMonth) ?? 0) + r.positionUnits);
    }
  }

  return points.map((p) => {
    const month = p.date.slice(0, 7);
    const requested = requestedMap.get(month) ?? 0;
    const closed = closedMap.get(month) ?? 0;
    const closeRatePercent =
      requested > 0 ? Math.round((closed / requested) * 1000) / 10 : null;
    return {
      ...p,
      requestedPositions: requested,
      closedPositions: closed,
      filledPositions: closed,
      remainingPositions: requested - closed,
      closeRatePercent,
    };
  });
}
