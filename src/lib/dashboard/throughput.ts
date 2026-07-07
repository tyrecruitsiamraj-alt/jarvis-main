import type { JobRequest } from '@/types';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { jobRequestDateYmd } from '@/components/shared/DateRangeCalendarPicker';
import type { DashboardActivityTrendPoint } from '@/lib/dashboard/types';

export type ThroughputRecord = {
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
};

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export function jobsToThroughputRecords(jobs: JobRequest[]): ThroughputRecord[] {
  const out: ThroughputRecord[] = [];
  for (const j of jobs) {
    const requestDate = jobRequestDateYmd(j);
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

export function filterJobsForThroughput(jobs: JobRequest[], from: string, to: string): JobRequest[] {
  return jobs.filter((j) => {
    const rd = jobRequestDateYmd(j);
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
): { requested: number; closed: number } {
  let requested = 0;
  let closed = 0;
  for (const r of records) {
    if (inYmdRange(r.requestDate, from, to)) requested += r.positionUnits;
    if (!r.isOpen && r.closureDate && inYmdRange(r.closureDate, from, to)) {
      closed += r.positionUnits;
    }
  }
  return { requested, closed };
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
    if (!r.isOpen && r.closureDate) {
      const closeMonth = r.closureDate.slice(0, 7);
      closedMap.set(closeMonth, (closedMap.get(closeMonth) ?? 0) + r.positionUnits);
    }
  }

  return points.map((p) => {
    const month = p.date.slice(0, 7);
    const requested = requestedMap.get(month) ?? 0;
    const closed = closedMap.get(month) ?? 0;
    return {
      ...p,
      requestedPositions: requested,
      closedPositions: closed,
      remainingPositions: requested - closed,
    };
  });
}
