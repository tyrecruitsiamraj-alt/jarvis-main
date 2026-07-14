import type { JobRequest } from '@/types';
import { effectiveRequestDateYmd } from '@/lib/jobUrgency';
import { positionBreakdownFromJob } from '@/lib/requestControl';
import type { DashboardActivityTrendPoint, DashboardKpi } from '@/lib/dashboard/types';

export type ThroughputRecord = {
  requestNo?: string;
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
  kind?: 'filled' | 'cancelled' | 'remaining';
  requestActionName?: string;
  requestActionCode?: string;
  /** ค่าจาก classifyLifecycleKind / classifyLifecycleKindFromAction */
  lifecycleKind?: 'resignation' | 'replacement' | 'increase_headcount' | 'new_site' | 'other';
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

export type CohortStockSummary = {
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
  requestCount: number;
  filledRequestCount: number;
  cancelledRequestCount: number;
  remainingRequestCount: number;
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
    // เดือนที่เข้ามา = วันที่กรอก/เปิดใบ ไม่ใช่ effective/want date
    const requestDate =
      safeYmd(j.request_date) ||
      safeYmd(j.submittedAt) ||
      effectiveRequestDateYmd(j, today);
    if (!requestDate) continue;
    const requestNo = (j.request_no || j.externalId || j.id || '').trim() || undefined;
    const b = positionBreakdownFromJob(j);
    const closureDate =
      b.remainingPositions === 0
        ? safeYmd(j.closed_date) || safeYmd(j.request_date) || requestDate
        : null;

    const closedYmd = closureDate ?? safeYmd(j.closed_date) ?? requestDate;

    if (b.filledPositions > 0) {
      out.push({
        requestNo,
        requestDate,
        closureDate: closedYmd,
        positionUnits: b.filledPositions,
        isOpen: false,
        kind: 'filled',
        requestActionName: j.request_action_name,
        requestActionCode: j.request_action_code,
        lifecycleKind: resolveLifecycleKind({
          requestDate,
          closureDate: closedYmd,
          positionUnits: b.filledPositions,
          isOpen: false,
          requestActionName: j.request_action_name,
          requestActionCode: j.request_action_code,
        }),
      });
    }
    if (b.cancelledPositions > 0) {
      out.push({
        requestNo,
        requestDate,
        closureDate: closedYmd,
        positionUnits: b.cancelledPositions,
        isOpen: false,
        kind: 'cancelled',
        requestActionName: j.request_action_name,
        requestActionCode: j.request_action_code,
        lifecycleKind: resolveLifecycleKind({
          requestDate,
          closureDate: closedYmd,
          positionUnits: b.cancelledPositions,
          isOpen: false,
          requestActionName: j.request_action_name,
          requestActionCode: j.request_action_code,
        }),
      });
    }
    if (b.remainingPositions > 0) {
      out.push({
        requestNo,
        requestDate,
        closureDate: null,
        positionUnits: b.remainingPositions,
        isOpen: true,
        kind: 'remaining',
        requestActionName: j.request_action_name,
        requestActionCode: j.request_action_code,
        lifecycleKind: resolveLifecycleKind({
          requestDate,
          closureDate: null,
          positionUnits: b.remainingPositions,
          isOpen: true,
          requestActionName: j.request_action_name,
          requestActionCode: j.request_action_code,
        }),
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

/** cohort ตามเดือน/ช่วงที่เปิดใบ — รวมปิดแล้ว (ไม่ใช่แค่ใบเปิดใน feed) */
export function sumCohortStockByRequestDate(
  records: ThroughputRecord[],
  from: string,
  to: string,
): CohortStockSummary {
  let requestPositions = 0;
  let filledPositions = 0;
  let cancelledPositions = 0;
  let remainingPositions = 0;
  const all = new Set<string>();
  const filledIds = new Set<string>();
  const cancelledIds = new Set<string>();
  const remainingIds = new Set<string>();

  for (const r of records) {
    if (!inYmdRange(r.requestDate, from, to)) continue;
    const kind = resolveKind(r);
    requestPositions += r.positionUnits;
    const id = r.requestNo?.trim();
    if (id) all.add(id);

    if (kind === 'filled') {
      filledPositions += r.positionUnits;
      if (id) filledIds.add(id);
    } else if (kind === 'cancelled') {
      cancelledPositions += r.positionUnits;
      if (id) cancelledIds.add(id);
    } else {
      remainingPositions += r.positionUnits;
      if (id) remainingIds.add(id);
    }
  }

  return {
    requestPositions,
    filledPositions,
    cancelledPositions,
    remainingPositions,
    requestCount: all.size,
    filledRequestCount: filledIds.size,
    cancelledRequestCount: cancelledIds.size,
    remainingRequestCount: remainingIds.size,
  };
}

export function buildStockKpisFromCohort(
  summary: CohortStockSummary,
  _scopeHint: string,
): DashboardKpi[] {
  const posReq = (positions: number, requests: number) =>
    `${positions.toLocaleString('th-TH')} อัตรา · ${requests.toLocaleString('th-TH')} ใบขอ`;

  return [
    {
      id: 'total_requests',
      label: 'เข้ามา',
      value: summary.requestPositions,
      secondaryCount: summary.requestCount,
      secondaryLabel: 'ใบขอ',
      description: `อัตราที่ขอในช่วง · ${posReq(summary.requestPositions, summary.requestCount)} · ไม่หายเมื่อปิด/ยกเลิก`,
      trendPercent: null,
    },
    {
      id: 'closed',
      label: 'ปิดแล้ว',
      value: summary.filledPositions,
      secondaryCount: summary.filledRequestCount,
      secondaryLabel: 'ใบขอที่มีการหาได้',
      description: `หาได้แล้ว · ${posReq(summary.filledPositions, summary.filledRequestCount)}`,
      trendPercent: null,
    },
    {
      id: 'cancelled',
      label: 'ยกเลิก',
      value: summary.cancelledPositions,
      secondaryCount: summary.cancelledRequestCount,
      secondaryLabel: 'ใบขอ',
      description: posReq(summary.cancelledPositions, summary.cancelledRequestCount),
      trendPercent: null,
    },
    {
      id: 'remaining',
      label: 'คงเหลือ',
      value: summary.remainingPositions,
      secondaryCount: summary.remainingRequestCount,
      secondaryLabel: 'ใบขอ',
      description: `ยังต้องหา · ${posReq(summary.remainingPositions, summary.remainingRequestCount)} · เข้ามา − ปิดแล้ว − ยกเลิก`,
      trendPercent: null,
    },
  ];
}

/**
 * กราฟรายเดือนแบบ cohort ตามเดือนที่เปิดใบ:
 * เข้ามาคงที่ · ปิด/ยกเลิก/คงเหลืออัปเดตตามสถานะปัจจุบัน
 * resignations/replacements/... = แตกยอด「เข้ามา」ตามประเภท (= รวมต้องเท่า requestedPositions)
 */
export function enrichActivityTrendWithThroughput(
  points: DashboardActivityTrendPoint[],
  records: ThroughputRecord[],
): DashboardActivityTrendPoint[] {
  const requestedMap = new Map<string, number>();
  const filledMap = new Map<string, number>();
  const cancelledMap = new Map<string, number>();
  const remainingMap = new Map<string, number>();
  const intakeByType = new Map<
    string,
    {
      resignation: number;
      replacement: number;
      increase_headcount: number;
      new_site: number;
      other: number;
    }
  >();

  const ensureType = (month: string) => {
    const cur = intakeByType.get(month) ?? {
      resignation: 0,
      replacement: 0,
      increase_headcount: 0,
      new_site: 0,
      other: 0,
    };
    intakeByType.set(month, cur);
    return cur;
  };

  for (const r of records) {
    const reqMonth = r.requestDate.slice(0, 7);
    requestedMap.set(reqMonth, (requestedMap.get(reqMonth) ?? 0) + r.positionUnits);
    const life = resolveLifecycleKind(r);
    const typed = ensureType(reqMonth);
    typed[life] += r.positionUnits;

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
    const typed = intakeByType.get(month) ?? {
      resignation: 0,
      replacement: 0,
      increase_headcount: 0,
      new_site: 0,
      other: 0,
    };
    const closeRatePercent =
      requested > 0 ? Math.round((filled / requested) * 1000) / 10 : null;
    return {
      ...p,
      resignations: typed.resignation,
      replacements: typed.replacement,
      increaseHeadcount: typed.increase_headcount,
      newSite: typed.new_site,
      other: typed.other,
      newOpenings: typed.increase_headcount + typed.new_site + typed.other,
      requestedPositions: requested,
      closedPositions: filled,
      filledPositions: filled,
      cancelledPositions: cancelled,
      remainingPositions: remaining,
      closeRatePercent,
    };
  });
}

function resolveLifecycleKind(
  r: ThroughputRecord,
): 'resignation' | 'replacement' | 'increase_headcount' | 'new_site' | 'other' {
  const raw = (r.lifecycleKind || '').trim();
  if (
    raw === 'resignation' ||
    raw === 'replacement' ||
    raw === 'increase_headcount' ||
    raw === 'new_site' ||
    raw === 'other'
  ) {
    return raw;
  }
  /** กันค่าไทย/ชื่อคอลัมน์ที่ส่งมาผิดรูปแบบ — ไม่ให้ typed[unknown] หลุดจากยอด */
  if (raw === 'ลาออก' || raw === 'resignations') return 'resignation';
  if (raw === 'เปลี่ยนตัว' || raw === 'replacements') return 'replacement';
  if (raw === 'เพิ่มอัตรา' || raw === 'increaseHeadcount') return 'increase_headcount';
  if (raw === 'เปิดไซต์' || raw === 'newSite') return 'new_site';
  if (raw === 'อื่นๆ') return 'other';

  const action = (r.requestActionName || '').trim();
  const code = (r.requestActionCode || '').trim().toUpperCase();
  if (/ลาออก|resign/i.test(action) || code === 'RESIGN') return 'resignation';
  if (/เปลี่ยนตัว|replacement|ทดแทน/i.test(action) || code === 'REPLACE') return 'replacement';
  if (/เพิ่มอัตรา|เพิ่มคน/i.test(action) || code === 'ADD' || code === 'INCREASE') return 'increase_headcount';
  if (/เปิดไซต์|เปิดไซท์|newsites?/i.test(action) || code === 'SITE' || code === 'NEWSITE') return 'new_site';
  return 'other';
}

/**
 * ทับเส้นคงเหลือด้วยอัตราจากคิวเปิด (เท่าการ์ดคงเหลือ)
 * — ไม่ใช้ remaining จาก throughput ที่รวมใบนอก staffing queue
 */
export function applyOpenQueueRemainingToActivityTrend(
  points: DashboardActivityTrendPoint[],
  openRemainingJobs: JobRequest[],
): DashboardActivityTrendPoint[] {
  const remainingMap = new Map<string, number>();
  for (const j of openRemainingJobs) {
    if (j.status === 'closed' || j.status === 'cancelled') continue;
    const rem = positionBreakdownFromJob(j).remainingPositions;
    if (rem <= 0) continue;
    const ymd = safeYmd(j.request_date) || safeYmd(j.submittedAt) || effectiveRequestDateYmd(j);
    if (!ymd) continue;
    const month = ymd.slice(0, 7);
    remainingMap.set(month, (remainingMap.get(month) ?? 0) + rem);
  }

  return points.map((p) => ({
    ...p,
    remainingPositions: remainingMap.get(p.date.slice(0, 7)) ?? 0,
  }));
}
