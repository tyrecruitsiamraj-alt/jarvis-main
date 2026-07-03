export type DashboardTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled'
  | 'at_risk';

export type DashboardSlaStatus = 'on_track' | 'at_risk' | 'breached';

export type DashboardPeriodPreset =
  | 'this_week'
  | 'this_month'
  | 'last_week'
  | 'last_month'
  | 'custom';

export type DashboardStatusFilter = 'all' | DashboardTaskStatus;

export type DashboardFilters = {
  periodPreset: DashboardPeriodPreset;
  dateFrom: string;
  dateTo: string;
  status: DashboardStatusFilter;
  /** recruiter name — empty = no filter */
  ownerName: string;
  /** unit name — empty = no filter */
  unitName: string;
  search: string;
  departmentCode: string;
  jobSubtype: string;
};

export type DashboardKpi = {
  id: string;
  label: string;
  value: number;
  description: string;
  trendPercent: number | null;
  format?: 'number' | 'percent';
};

export type DashboardWorkItem = {
  id: string;
  requestNo: string;
  unitName: string;
  destination: string;
  ownerName: string;
  screenerName: string;
  status: DashboardTaskStatus;
  slaStatus: DashboardSlaStatus;
  priority: number;
  requestDate: string;
  requiredDate: string;
  updatedAt: string;
  nextAction: string;
  requestAction: string;
  sendReplacement: boolean | null;
  resignedName: string;
  isResignation: boolean;
};

export type DashboardRecruiterOverview = {
  name: string;
  total: number;
  completed: number;
  overdue: number;
  sharePercent: number;
};

export type DashboardTrendPoint = {
  date: string;
  current: number;
  previous: number;
};

export type DashboardStatusBreakdown = {
  status: DashboardTaskStatus;
  label: string;
  count: number;
  color: string;
};

export type DashboardResignationMonthly = {
  month: string;
  label: string;
  resignations: number;
  replacements: number;
};

export type DashboardData = {
  kpis: DashboardKpi[];
  trend: DashboardTrendPoint[];
  statusBreakdown: DashboardStatusBreakdown[];
  recruiterOverview: DashboardRecruiterOverview[];
  resignationTrend: DashboardResignationMonthly[];
  workQueue: DashboardWorkItem[];
  periodLabel: string;
  previousPeriodLabel: string;
};

export type DashboardSortKey =
  | 'priority'
  | 'updatedAt'
  | 'createdAt'
  | 'ownerName'
  | 'status';

export type DashboardSortDir = 'asc' | 'desc';
