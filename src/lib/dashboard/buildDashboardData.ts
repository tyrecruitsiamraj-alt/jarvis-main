import {
  addDays,
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
import { computeJobUrgency } from '@/lib/jobUrgency';
import { jobRequestDateYmd } from '@/components/shared/DateRangeCalendarPicker';
import { toYmdLocal } from '@/lib/dateTh';
import type {
  DashboardData,
  DashboardFilters,
  DashboardKpi,
  DashboardPeriodPreset,
  DashboardRecruiterOverview,
  DashboardResignationMonthly,
  DashboardSlaStatus,
  DashboardSortDir,
  DashboardSortKey,
  DashboardStatusBreakdown,
  DashboardTaskStatus,
  DashboardTrendPoint,
  DashboardWorkItem,
} from './types';

export const DASHBOARD_STATUS_LABELS: Record<DashboardTaskStatus, string> = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  completed: 'สำเร็จ',
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
  dateFrom: '',
  dateTo: '',
  status: 'all',
  ownerName: '',
  unitName: '',
  search: '',
  departmentCode: 'all',
  jobSubtype: 'all',
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

export function isResignationRequest(job: JobRequest): boolean {
  return Boolean(
    job.resigned_employee_name?.trim() ||
      job.resigned_first_name?.trim() ||
      job.lastWorkingDay ||
      /ลาออก|resign/i.test(job.request_action_name || ''),
  );
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

export type PeriodRange = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  label: string;
  previousLabel: string;
};

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

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export function filterJobsByRequestDate(jobs: JobRequest[], from: string, to: string): JobRequest[] {
  return jobs.filter((j) => {
    const ymd = jobRequestDateYmd(j);
    return ymd ? inYmdRange(ymd, from, to) : false;
  });
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
    counts[mapJobToTaskStatus(j, today)] += 1;
  }
  return counts;
}

function buildKpis(current: JobRequest[], previous: JobRequest[], today: Date): DashboardKpi[] {
  const cur = countByStatus(current, today);
  const prev = countByStatus(previous, today);
  const curTotal = current.length;
  const prevTotal = previous.length;
  const curOpen = cur.pending + cur.in_progress + cur.at_risk + cur.overdue;
  const prevOpen = prev.pending + prev.in_progress + prev.at_risk + prev.overdue;
  const successRate = curTotal ? Math.round((cur.completed / curTotal) * 1000) / 10 : 0;
  const prevSuccessRate = prevTotal ? Math.round((prev.completed / prevTotal) * 1000) / 10 : 0;

  return [
    {
      id: 'total',
      label: 'งานทั้งหมด',
      value: curTotal,
      description: 'ใบขอในช่วงที่เลือก',
      trendPercent: trendPercent(curTotal, prevTotal),
    },
    {
      id: 'open',
      label: 'รอดำเนินการ',
      value: curOpen,
      description: 'ยังไม่ปิด / ไม่ยกเลิก',
      trendPercent: trendPercent(curOpen, prevOpen),
    },
    {
      id: 'overdue',
      label: 'ล่าช้า',
      value: cur.overdue,
      description: 'เกินกำหนดหรือค้างนาน',
      trendPercent: trendPercent(cur.overdue, prev.overdue),
    },
    {
      id: 'completed',
      label: 'สำเร็จ',
      value: cur.completed,
      description: 'ปิดงานแล้ว',
      trendPercent: trendPercent(cur.completed, prev.completed),
    },
    {
      id: 'success_rate',
      label: 'อัตราสำเร็จ',
      value: successRate,
      description: '% ปิดงานจากทั้งหมด',
      trendPercent: trendPercent(successRate, prevSuccessRate),
      format: 'percent',
    },
  ];
}

function buildDailyTrend(
  current: JobRequest[],
  previous: JobRequest[],
  from: string,
  to: string,
  previousFrom: string,
): DashboardTrendPoint[] {
  const curMap = new Map<string, number>();
  const prevMap = new Map<string, number>();

  for (const j of current) {
    const ymd = jobRequestDateYmd(j);
    if (ymd) curMap.set(ymd, (curMap.get(ymd) ?? 0) + 1);
  }
  for (const j of previous) {
    const ymd = jobRequestDateYmd(j);
    if (ymd) prevMap.set(ymd, (prevMap.get(ymd) ?? 0) + 1);
  }

  const points: DashboardTrendPoint[] = [];
  let d = parseISO(from);
  const end = parseISO(to);
  const prevStart = parseISO(previousFrom);
  let i = 0;
  while (d <= end) {
    const ymd = toYmdLocal(d);
    const prevYmd = toYmdLocal(addDays(prevStart, i));
    points.push({
      date: ymd,
      current: curMap.get(ymd) ?? 0,
      previous: prevMap.get(prevYmd) ?? 0,
    });
    d = addDays(d, 1);
    i += 1;
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

function buildRecruiterOverview(jobs: JobRequest[], today: Date): DashboardRecruiterOverview[] {
  const map = new Map<string, { total: number; completed: number; overdue: number }>();
  for (const j of jobs) {
    const name = j.recruiter_name?.trim() || 'ยังไม่มอบหมาย';
    const row = map.get(name) ?? { total: 0, completed: 0, overdue: 0 };
    row.total += 1;
    const st = mapJobToTaskStatus(j, today);
    if (st === 'completed') row.completed += 1;
    if (st === 'overdue') row.overdue += 1;
    map.set(name, row);
  }
  const total = jobs.length || 1;
  return [...map.entries()]
    .map(([name, row]) => ({
      name,
      total: row.total,
      completed: row.completed,
      overdue: row.overdue,
      sharePercent: Math.round((row.total / total) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total);
}

function buildResignationTrend(jobs: JobRequest[]): DashboardResignationMonthly[] {
  const map = new Map<string, { resignations: number; replacements: number }>();
  for (const j of jobs) {
    const ymd = jobRequestDateYmd(j);
    if (!ymd) continue;
    const month = ymd.slice(0, 7);
    const row = map.get(month) ?? { resignations: 0, replacements: 0 };
    if (isResignationRequest(j)) row.resignations += 1;
    if (j.send_replacement === true) row.replacements += 1;
    map.set(month, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, row]) => ({
      month,
      label: format(parseISO(`${month}-01`), 'MMM yyyy', { locale: th }),
      resignations: row.resignations,
      replacements: row.replacements,
    }));
}

export function applyDashboardFilters(
  items: DashboardWorkItem[],
  filters: DashboardFilters,
): DashboardWorkItem[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.ownerName && item.ownerName !== filters.ownerName) return false;
    if (filters.unitName && item.unitName !== filters.unitName) return false;
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

export function buildDashboardData(
  allJobs: JobRequest[],
  filters: DashboardFilters,
  options?: { now?: Date; customRange?: { from: string; to: string } },
): DashboardData {
  const today = options?.now ?? new Date();
  const period = resolvePeriodRange(
    filters.periodPreset,
    filters.periodPreset === 'custom'
      ? { from: filters.dateFrom, to: filters.dateTo }
      : options?.customRange,
    today,
  );

  let scoped = filterJobsByRequestDate(allJobs, period.from, period.to);

  if (filters.departmentCode !== 'all') {
    scoped = scoped.filter((j) => (j.department_code || '') === filters.departmentCode);
  }
  if (filters.jobSubtype !== 'all') {
    scoped = scoped.filter((j) => (j.job_description_code_1 || '') === filters.jobSubtype);
  }

  const previousScoped = filterJobsByRequestDate(allJobs, period.previousFrom, period.previousTo);

  const workItems = scoped.map((j) => jobToWorkItem(j, today));
  const filteredQueue = applyDashboardFilters(workItems, filters);
  const sortedQueue = sortWorkQueue(filteredQueue, 'priority', 'asc');

  return {
    kpis: buildKpis(scoped, previousScoped, today),
    trend: buildDailyTrend(scoped, previousScoped, period.from, period.to, period.previousFrom),
    statusBreakdown: buildStatusBreakdown(scoped, today),
    recruiterOverview: buildRecruiterOverview(scoped, today),
    resignationTrend: buildResignationTrend(
      filterJobsByRequestDate(allJobs, period.previousFrom, period.to).concat(scoped),
    ),
    workQueue: sortedQueue,
    periodLabel: period.label,
    previousPeriodLabel: period.previousLabel,
  };
}

export function ownerOptionsFromJobs(jobs: JobRequest[]): { value: string; label: string; keywords?: string }[] {
  const names = new Set<string>();
  for (const j of jobs) {
    const n = j.recruiter_name?.trim();
    if (n) names.add(n);
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'th'))
    .map((name) => ({ value: name, label: name }));
}

export function unitOptionsFromJobs(jobs: JobRequest[]): { value: string; label: string }[] {
  const names = new Set<string>();
  for (const j of jobs) {
    const n = j.unit_name?.trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'th')).map((name) => ({ value: name, label: name }));
}
