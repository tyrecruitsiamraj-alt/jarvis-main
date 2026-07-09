import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { th } from 'date-fns/locale';
import type { JobRequest } from '@/types';
import {
  AGE_DAYS_DISPLAY_BUCKETS,
  computeJobUrgency,
  countAgeDaysBreakdown,
} from '@/lib/jobUrgency';
import { sumJobPositionUnits, jobPositionUnits } from '@/lib/jobPositionUnits';
import { pickUnitOrganizationDisplayName, buildOrganizationKeyResolver } from '@/lib/unitGroupName';
import { jobRequestDateYmd } from '@/components/shared/DateRangeCalendarPicker';
import { toYmdLocal } from '@/lib/dateTh';
import { effectiveRequestDateYmd } from '@/lib/jobUrgency';
import type {
  DashboardActivityTrendPoint,
  DashboardData,
  DashboardFilters,
  DashboardKpi,
  DashboardPeriodPreset,
  DashboardRecruiterOverview,
  DashboardResponsibleRole,
  DashboardUnitOverview,
  DashboardSlaStatus,
  DashboardSortDir,
  DashboardSortKey,
  DashboardStatusBreakdown,
  DashboardTaskStatus,
  DashboardWorkItem,
} from './types';
import {
  enrichActivityTrendWithThroughput,
  filterJobsForThroughput,
  jobsToThroughputRecords,
  sumThroughputInRange,
  type ThroughputRecord,
} from './throughput';

export type PeriodRange = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  label: string;
  previousLabel: string;
};

export const DASHBOARD_STATUS_LABELS: Record<DashboardTaskStatus, string> = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  completed: 'ปิดใบขอ',
  overdue: 'ล่าช้า',
  cancelled: 'ยกเลิก',
  at_risk: 'เสี่ยงล่าช้า',
};

export const DASHBOARD_STATUS_COLORS: Record<DashboardTaskStatus, string> = {
  pending: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  overdue: '#ef4444',
  cancelled: '#64748b',
  at_risk: '#f59e0b',
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  periodPreset: 'this_month',
  search: '',
  queueStatus: 'all',
};

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function ageDays(job: JobRequest, today = new Date()): number {
  const ymd = jobRequestDateYmd(job);
  if (!ymd) return 0;
  const d = parseISO(ymd);
  return Number.isNaN(d.getTime()) ? 0 : differenceInCalendarDays(today, d);
}

function actionText(job: JobRequest): string {
  return (job.request_action_name || '').trim();
}

function actionCode(job: JobRequest): string {
  return (job.request_action_code || '').trim().toUpperCase();
}

export function isResignationRequest(job: JobRequest): boolean {
  const action = actionText(job);
  if (/ลาออก|resign/i.test(action) || actionCode(job) === 'RESIGN') return true;
  // Jarvis manual entries — ไม่ใช้ resigned_employee_name จาก Siamraj (map จาก staff_fullname ทุกใบ)
  if (!job.readOnly) {
    return Boolean(job.resigned_first_name?.trim() || job.resigned_last_name?.trim());
  }
  return false;
}

/** เปลี่ยนตัว / ส่งคนแทน */
export function isReplacementRequest(job: JobRequest): boolean {
  if (isResignationRequest(job)) return false;
  const action = actionText(job);
  return (
    job.send_replacement === true ||
    /เปลี่ยน|ส่งคนแทน|replacement/i.test(action)
  );
}

/** เปิดงานใหม่ — งานที่ไม่ใช่ลาออกหรือเปลี่ยนตัว */
export function isNewOpeningRequest(job: JobRequest): boolean {
  return !isResignationRequest(job) && !isReplacementRequest(job);
}

export type RequestActivityKind = 'resignation' | 'replacement' | 'new_opening';

/** จำแนกแต่ละใบขอเป็นหนึ่งหมวด — ผลรวม 3 หมวด = งานทั้งหมด */
export function classifyRequestActivity(job: JobRequest): RequestActivityKind {
  if (isResignationRequest(job)) return 'resignation';
  if (isReplacementRequest(job)) return 'replacement';
  return 'new_opening';
}

export function mapJobToTaskStatus(job: JobRequest, today = new Date()): DashboardTaskStatus {
  if (job.status === 'closed') return 'completed';
  if (job.status === 'cancelled') return 'cancelled';

  const age = ageDays(job, today);
  const required = safeYmd(job.required_date);
  const pastRequired =
    required && differenceInCalendarDays(today, parseISO(required)) > 0;

  if (pastRequired || age > 14) return 'overdue';

  const urgency = computeJobUrgency(job).kind;
  if (urgency === 'urgent' || urgency === 'retroactive' || (age >= 7 && age <= 14)) {
    return 'at_risk';
  }

  if (job.status === 'in_progress' || job.recruiter_name?.trim()) return 'in_progress';
  return 'pending';
}

export function mapJobToSlaStatus(job: JobRequest, today = new Date()): DashboardSlaStatus {
  if (job.status === 'closed' || job.status === 'cancelled') return 'on_track';

  const required = safeYmd(job.required_date);
  if (!required) return 'on_track';

  const daysToRequired = differenceInCalendarDays(parseISO(required), today);
  if (daysToRequired < 0) return 'breached';
  if (daysToRequired <= 3 || computeJobUrgency(job).kind === 'urgent') return 'at_risk';
  return 'on_track';
}

function priorityScore(status: DashboardTaskStatus): number {
  switch (status) {
    case 'overdue':
      return 0;
    case 'at_risk':
      return 1;
    case 'pending':
      return 2;
    case 'in_progress':
      return 3;
    case 'completed':
      return 4;
    case 'cancelled':
      return 5;
    default:
      return 9;
  }
}

function nextActionFor(job: JobRequest, status: DashboardTaskStatus): string {
  if (status === 'completed') return 'ปิดงานแล้ว';
  if (status === 'cancelled') return 'ยกเลิกแล้ว';
  if (!job.recruiter_name?.trim()) return 'มอบหมายสรรหา';
  if (!job.screener_name?.trim()) return 'มอบหมายคัดสรร';
  if (job.send_replacement == null && isResignationRequest(job)) return 'ระบุส่งคนแทน';
  if (status === 'overdue') return 'ติดตามด่วน';
  if (status === 'at_risk') return 'ติดตามความคืบหน้า';
  return 'ดูรายละเอียด';
}

export function jobToWorkItem(job: JobRequest, today = new Date()): DashboardWorkItem {
  const status = mapJobToTaskStatus(job, today);
  return {
    id: job.id,
    requestNo: job.request_no?.trim() || job.externalId || job.id,
    unitName: job.unit_name || '—',
    destination: job.location_address || '—',
    ownerName: job.recruiter_name?.trim() || '—',
    screenerName: job.screener_name?.trim() || '—',
    status,
    slaStatus: mapJobToSlaStatus(job, today),
    priority: priorityScore(status),
    requestDate: jobRequestDateYmd(job) || job.created_at?.slice(0, 10) || '',
    requiredDate: safeYmd(job.required_date) || '',
    updatedAt: safeYmd(job.closed_date) || jobRequestDateYmd(job) || job.created_at?.slice(0, 10) || '',
    nextAction: nextActionFor(job, status),
    requestAction: job.request_action_name || '',
    sendReplacement: job.send_replacement ?? null,
    resignedName: job.resigned_employee_name?.trim() || '',
    isResignation: isResignationRequest(job),
  };
}

export function resolvePeriodRange(
  preset: DashboardPeriodPreset,
  custom?: { from: string; to: string },
  now = new Date(),
): PeriodRange {
  const weekOpts = { weekStartsOn: 1 as const };

  let fromDate: Date;
  let toDate: Date;

  switch (preset) {
    case 'this_week':
      fromDate = startOfWeek(now, weekOpts);
      toDate = endOfWeek(now, weekOpts);
      break;
    case 'last_week': {
      const lw = subWeeks(now, 1);
      fromDate = startOfWeek(lw, weekOpts);
      toDate = endOfWeek(lw, weekOpts);
      break;
    }
    case 'last_month': {
      const lm = subMonths(now, 1);
      fromDate = startOfMonth(lm);
      toDate = endOfMonth(lm);
      break;
    }
    case 'custom':
      if (custom?.from && custom?.to) {
        fromDate = parseISO(custom.from);
        toDate = parseISO(custom.to);
      } else {
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
      }
      break;
    case 'this_month':
    default:
      fromDate = startOfMonth(now);
      toDate = endOfMonth(now);
  }

  const from = toYmdLocal(fromDate);
  const to = toYmdLocal(toDate);
  const span = differenceInCalendarDays(toDate, fromDate) + 1;
  const previousToDate = subDays(fromDate, 1);
  const previousFromDate = subDays(previousToDate, span - 1);

  const label = `${format(fromDate, 'd MMM yyyy', { locale: th })} – ${format(toDate, 'd MMM yyyy', { locale: th })}`;
  const previousLabel = `${format(previousFromDate, 'd MMM yyyy', { locale: th })} – ${format(previousToDate, 'd MMM yyyy', { locale: th })}`;

  return {
    from,
    to,
    previousFrom: toYmdLocal(previousFromDate),
    previousTo: toYmdLocal(previousToDate),
    label,
    previousLabel,
  };
}

/** ช่วงแนวโน้มรายเดือน: ม.ค. ถึงสิ้นเดือนปัจจุบัน (เปรียบเทียบข้ามเดือน) */
export function resolveYearToDateTrendRange(now = new Date()): {
  from: string;
  to: string;
  label: string;
} {
  const fromDate = startOfMonth(new Date(now.getFullYear(), 0, 1));
  const toDate = endOfMonth(now);
  const from = toYmdLocal(fromDate);
  const to = toYmdLocal(toDate);
  const label = `${format(fromDate, 'MMM yyyy', { locale: th })} – ${format(toDate, 'MMM yyyy', { locale: th })}`;
  return { from, to, label };
}

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export function filterJobsByRequestDate(jobs: JobRequest[], from: string, to: string, today = new Date()): JobRequest[] {
  return jobs.filter((j) => {
    const ymd = effectiveRequestDateYmd(j, today);
    return ymd ? inYmdRange(ymd, from, to) : false;
  });
}

/** ช่วงวันที่เริ่มต้นสำหรับ Dashboard — เดือนนี้ */
export function defaultDashboardDateRange(now = new Date()): { from: string; to: string } {
  const p = resolvePeriodRange('this_month', undefined, now);
  return { from: p.from, to: p.to };
}

function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function countByStatus(jobs: JobRequest[], today: Date): Record<DashboardTaskStatus, number> {
  const counts: Record<DashboardTaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    at_risk: 0,
  };
  for (const j of jobs) {
    const units = jobPositionUnits(j);
    counts[mapJobToTaskStatus(j, today)] += units;
  }
  return counts;
}

function buildKpis(
  current: JobRequest[],
  previous: JobRequest[],
  today: Date,
  throughput?: {
    records: ThroughputRecord[];
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  },
): DashboardKpi[] {
  const curTotal = sumJobPositionUnits(current);
  const prevTotal = sumJobPositionUnits(previous);
  const curRemaining = current
    .filter((j) => j.status !== 'closed' && j.status !== 'cancelled')
    .reduce((sum, j) => sum + jobPositionUnits(j), 0);
  const prevRemaining = previous
    .filter((j) => j.status !== 'closed' && j.status !== 'cancelled')
    .reduce((sum, j) => sum + jobPositionUnits(j), 0);

  const throughputCur = throughput
    ? sumThroughputInRange(throughput.records, throughput.from, throughput.to)
    : null;
  const throughputPrev = throughput
    ? sumThroughputInRange(throughput.records, throughput.previousFrom, throughput.previousTo)
    : null;

  const requestedTotal = throughputCur?.requested ?? curTotal;
  const prevRequestedTotal = throughputPrev?.requested ?? prevTotal;
  const closedTotal = throughputCur?.closed ?? 0;
  const prevClosedTotal = throughputPrev?.closed ?? 0;
  const remainingTotal = throughputCur?.remaining ?? curRemaining;
  const prevRemainingTotal = throughputPrev?.remaining ?? prevRemaining;
  const closeRate = requestedTotal
    ? Math.round((closedTotal / requestedTotal) * 1000) / 10
    : 0;
  const prevCloseRate = prevRequestedTotal
    ? Math.round((prevClosedTotal / prevRequestedTotal) * 1000) / 10
    : 0;
  const closedBacklog = throughputCur?.closedBacklog ?? 0;

  return [
    {
      id: 'total',
      label: 'งานทั้งหมด',
      value: requestedTotal,
      description: throughputCur
        ? 'ตำแหน่งที่ขอในช่วง (ย้อนหลัง=วันที่กรอก · ฉุกเฉิน/ล่วงหน้า=วันที่ต้องการ)'
        : 'ตำแหน่งคงเหลือตามตัวกรอง',
      trendPercent: trendPercent(requestedTotal, prevRequestedTotal),
    },
    {
      id: 'completed',
      label: 'ปิดได้',
      value: closedTotal,
      description: throughputCur
        ? closedBacklog > 0
          ? `รวม backlog เก่าที่ปิดในช่วงนี้ ${closedBacklog.toLocaleString('th-TH')} ตำแหน่ง`
          : 'ตำแหน่งที่ปิดแล้วในช่วงที่เลือก'
        : 'ตำแหน่งที่ปิดงานแล้ว',
      trendPercent: trendPercent(closedTotal, prevClosedTotal),
    },
    {
      id: 'remaining',
      label: 'เหลือหาอีก',
      value: remainingTotal,
      description: 'ตำแหน่งคงเหลือจากใบขอในช่วงที่ยังเปิดอยู่',
      trendPercent: trendPercent(remainingTotal, prevRemainingTotal),
    },
    {
      id: 'success_rate',
      label: 'อัตราสำเร็จ',
      value: closeRate,
      description: '% ปิดได้เทียบขอมาในช่วงเดียวกัน',
      trendPercent: trendPercent(closeRate, prevCloseRate),
      format: 'percent',
    },
  ];
}

function monthTrendLabel(d: Date, from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return sameYear
    ? format(d, 'MMM', { locale: th })
    : format(d, 'MMM yyyy', { locale: th });
}

function buildActivityTrend(jobs: JobRequest[], from: string, to: string, today = new Date()): DashboardActivityTrendPoint[] {
  const resignMap = new Map<string, number>();
  const replaceMap = new Map<string, number>();
  const newMap = new Map<string, number>();

  for (const j of jobs) {
    const ymd = effectiveRequestDateYmd(j, today);
    if (!ymd || !inYmdRange(ymd, from, to)) continue;
    const month = ymd.slice(0, 7);
    const kind = classifyRequestActivity(j);
    if (kind === 'resignation') resignMap.set(month, (resignMap.get(month) ?? 0) + 1);
    else if (kind === 'replacement') replaceMap.set(month, (replaceMap.get(month) ?? 0) + 1);
    else newMap.set(month, (newMap.get(month) ?? 0) + 1);
  }

  const points: DashboardActivityTrendPoint[] = [];
  let d = parseISO(`${from.slice(0, 7)}-01`);
  const endMonth = parseISO(`${to.slice(0, 7)}-01`);
  while (d <= endMonth) {
    const month = toYmdLocal(d).slice(0, 7);
    points.push({
      date: `${month}-01`,
      label: monthTrendLabel(d, from, to),
      resignations: resignMap.get(month) ?? 0,
      replacements: replaceMap.get(month) ?? 0,
      newOpenings: newMap.get(month) ?? 0,
    });
    d = addMonths(d, 1);
  }
  return points;
}

function buildStatusBreakdown(jobs: JobRequest[], today: Date): DashboardStatusBreakdown[] {
  const counts = countByStatus(jobs, today);
  return (Object.keys(counts) as DashboardTaskStatus[])
    .map((status) => ({
      status,
      label: DASHBOARD_STATUS_LABELS[status],
      count: counts[status],
      color: DASHBOARD_STATUS_COLORS[status],
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

function buildUnitOverview(jobs: JobRequest[], today: Date): DashboardUnitOverview[] {
  const resolve = buildOrganizationKeyResolver(jobs.map((j) => j.unit_name));
  const map = new Map<string, { names: string[]; total: number; open: number; overdue: number }>();
  for (const j of jobs) {
    const rawName = j.unit_name?.trim() || '—';
    const key = resolve(rawName);
    const units = jobPositionUnits(j);
    const row = map.get(key) ?? { names: [], total: 0, open: 0, overdue: 0 };
    row.names.push(rawName);
    row.total += units;
    const st = mapJobToTaskStatus(j, today);
    if (st !== 'completed' && st !== 'cancelled') row.open += units;
    if (st === 'overdue') row.overdue += units;
    map.set(key, row);
  }
  const totalAll = sumJobPositionUnits(jobs) || 1;
  return [...map.entries()]
    .map(([, row]) => ({
      name: pickUnitOrganizationDisplayName(row.names),
      total: row.total,
      open: row.open,
      overdue: row.overdue,
      sharePercent: Math.round((row.total / totalAll) * 1000) / 10,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name, 'th'));
}

export function buildRecruiterOverview(
  jobs: JobRequest[],
  today: Date,
  closedJobs: JobRequest[] = [],
): DashboardRecruiterOverview[] {
  type Row = {
    name: string;
    role: DashboardResponsibleRole;
    total: number;
    completed: number;
    overdue: number;
  };
  const map = new Map<string, Row>();

  const add = (
    role: DashboardResponsibleRole,
    rawName: string | undefined,
    units: number,
    flags: { completed?: boolean; overdue?: boolean },
  ) => {
    const name = rawName?.trim() || 'ยังไม่มอบหมาย';
    const key = `${role}:${name}`;
    const row = map.get(key) ?? { name, role, total: 0, completed: 0, overdue: 0 };
    row.total += units;
    if (flags.completed) row.completed += units;
    if (flags.overdue) row.overdue += units;
    map.set(key, row);
  };

  for (const j of jobs) {
    const units = jobPositionUnits(j);
    const st = mapJobToTaskStatus(j, today);
    const flags = { completed: st === 'completed', overdue: st === 'overdue' };
    add('recruiter', j.recruiter_name, units, flags);
    add('screener', j.screener_name, units, flags);
  }
  // ใบขอที่ปิดแล้วอยู่คนละ feed จาก open — รวมยอดปิดต่อผู้รับผิดชอบเข้ามาด้วย
  for (const j of closedJobs) {
    const units = jobPositionUnits(j);
    add('recruiter', j.recruiter_name, units, { completed: true });
    add('screener', j.screener_name, units, { completed: true });
  }

  const roleTotals: Record<DashboardResponsibleRole, number> = { recruiter: 0, screener: 0 };
  for (const row of map.values()) roleTotals[row.role] += row.total;

  return [...map.values()]
    .map((row) => ({
      name: row.name,
      role: row.role,
      total: row.total,
      completed: row.completed,
      overdue: row.overdue,
      sharePercent: Math.round((row.total / (roleTotals[row.role] || 1)) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total);
}

export function applyDashboardFilters(
  items: DashboardWorkItem[],
  filters: DashboardFilters,
): DashboardWorkItem[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.queueStatus !== 'all' && item.status !== filters.queueStatus) return false;
    if (!q) return true;
    const blob = [
      item.requestNo,
      item.unitName,
      item.destination,
      item.ownerName,
      item.screenerName,
      item.requestAction,
      item.resignedName,
      item.nextAction,
    ]
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}

export function sortWorkQueue(
  items: DashboardWorkItem[],
  key: DashboardSortKey,
  dir: DashboardSortDir,
): DashboardWorkItem[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (key) {
      case 'priority':
        return (a.priority - b.priority) * mul;
      case 'ownerName':
        return a.ownerName.localeCompare(b.ownerName, 'th') * mul;
      case 'status':
        return a.status.localeCompare(b.status) * mul;
      case 'updatedAt':
        return a.updatedAt.localeCompare(b.updatedAt) * mul;
      case 'createdAt':
      default:
        return a.requestDate.localeCompare(b.requestDate) * mul;
    }
  });
}

export type BuildDashboardTrendInput = {
  jobs: JobRequest[];
  from: string;
  to: string;
  label: string;
  throughputRecords?: ThroughputRecord[];
};

function buildAgeDaysBreakdown(jobs: JobRequest[], today: Date) {
  const counts = countAgeDaysBreakdown(jobs, today);
  return AGE_DAYS_DISPLAY_BUCKETS.map((b) => ({
    bucket: b.id,
    label: b.label,
    count: counts[b.id],
  }));
}

export function buildDashboardData(
  scopedJobs: JobRequest[],
  previousScopedJobs: JobRequest[],
  period: PeriodRange | null,
  uiFilters: DashboardFilters,
  today = new Date(),
  trend?: BuildDashboardTrendInput,
  closedJobs: JobRequest[] = [],
): DashboardData {
  const workItems = scopedJobs.map((j) => jobToWorkItem(j, today));
  const filteredQueue = applyDashboardFilters(workItems, uiFilters);
  const sortedQueue = sortWorkQueue(filteredQueue, 'priority', 'asc');

  const periodLabel = period?.label ?? 'ทั้งหมดที่โหลด';
  const previousPeriodLabel = period?.previousLabel ?? '—';
  const trendJobs = trend?.jobs ?? scopedJobs;
  const trendFrom = trend?.from ?? period?.from ?? '1970-01-01';
  const trendTo = trend?.to ?? period?.to ?? toYmdLocal(today);
  const activityTrendLabel = trend?.label ?? periodLabel;
  const throughputRecords =
    trend?.throughputRecords ??
    jobsToThroughputRecords(filterJobsForThroughput(trendJobs, trendFrom, trendTo));
  const activityTrend = enrichActivityTrendWithThroughput(
    buildActivityTrend(trendJobs, trendFrom, trendTo, today),
    throughputRecords,
  );

  const kpiThroughput =
    throughputRecords.length > 0 && period
      ? {
          records: throughputRecords,
          from: period.from,
          to: period.to,
          previousFrom: period.previousFrom,
          previousTo: period.previousTo,
        }
      : undefined;

  const closedBreakdown =
    kpiThroughput != null
      ? (() => {
          const s = sumThroughputInRange(kpiThroughput.records, kpiThroughput.from, kpiThroughput.to);
          return { samePeriod: s.closedSamePeriod, backlog: s.closedBacklog };
        })()
      : undefined;

  return {
    kpis: buildKpis(scopedJobs, previousScopedJobs, today, kpiThroughput),
    activityTrend,
    unitOverview: buildUnitOverview(scopedJobs, today),
    ageDaysBreakdown: buildAgeDaysBreakdown(scopedJobs, today),
    ageDaysRequestTotal: scopedJobs.length,
    ageDaysPositionTotal: sumJobPositionUnits(scopedJobs),
    closedBreakdown,
    recruiterOverview: buildRecruiterOverview(scopedJobs, today, closedJobs),
    workQueue: sortedQueue,
    periodLabel,
    previousPeriodLabel,
    activityTrendLabel,
  };
}
