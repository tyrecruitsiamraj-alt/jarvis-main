export type DashboardTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled'
  | 'at_risk';

export type DashboardSlaStatus =
  | 'on_track'
  | 'at_risk'
  | 'breached'
  | 'closed_on_time'
  | 'closed_late';

export type DashboardPeriodPreset =
  | 'this_week'
  | 'this_month'
  | 'last_week'
  | 'last_month'
  | 'custom';

export type DashboardStatusFilter = 'all' | DashboardTaskStatus;

export type DashboardActivityTrendPoint = {
  /** anchor date YYYY-MM-01 */
  date: string;
  label: string;
  resignations: number;
  replacements: number;
  newOpenings: number;
  increaseHeadcount?: number;
  newSite?: number;
  /** ตำแหน่งที่ขอ (ตามเดือนที่กรอกใบขอ) */
  requestedPositions?: number;
  /** ตำแหน่งที่ปิดได้/หาได้แล้ว (ตามเดือนที่ปิด) */
  closedPositions?: number;
  /** ตำแหน่งที่ปิดได้/หาได้แล้ว */
  filledPositions?: number;
  /** ใบขอที่ปิดครบ */
  fullyClosedRequests?: number;
  /** ตำแหน่งที่ยกเลิก */
  cancelledPositions?: number;
  /** คงเหลือต่อเดือน */
  remainingPositions?: number;
  /** อัตราสำเร็จรายเดือน = ปิดได้ / ขอ (%) */
  closeRatePercent?: number | null;
};

export type DashboardFilters = {
  periodPreset: DashboardPeriodPreset;
  search: string;
  /** filter work queue table by analytics status */
  queueStatus: DashboardStatusFilter;
};

export type DashboardKpi = {
  id: string;
  label: string;
  value: number;
  description: string;
  trendPercent: number | null;
  format?: 'number' | 'percent';
  /** จำนวนใบขอรอง — แสดงคู่กับตำแหน่งหลัก */
  secondaryCount?: number;
  secondaryLabel?: string;
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
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
  effectiveRequestDate: string;
  slaDueDate: string;
  daysOverdue: number;
  lifecycleKind: string;
  requestKind: string;
  controlStatus: string;
};

export type DashboardResponsibleRole = 'recruiter' | 'screener';

export type DashboardRecruiterOverview = {
  name: string;
  role: DashboardResponsibleRole;
  total: number;
  completed: number;
  overdue: number;
  sharePercent: number;
};

/** ภาระงานรวมตามชื่อหน่วยงาน/ลูกค้า (unit_name) */
export type DashboardUnitOverview = {
  name: string;
  total: number;
  open: number;
  overdue: number;
  sharePercent: number;
};

export type DashboardStatusBreakdown = {
  status: DashboardTaskStatus;
  label: string;
  count: number;
  color: string;
};

export type DashboardTrendPoint = DashboardActivityTrendPoint;

export type DashboardResignationMonthly = {
  month: string;
  label: string;
  resignations: number;
  replacements: number;
  newOpenings: number;
};

export type DashboardAgeDaysBreakdown = {
  bucket: '1-7' | '8-14' | '15-30' | '30+' | 'advance';
  label: string;
  count: number;
};

export type DashboardClosedBreakdown = {
  samePeriod: number;
  backlog: number;
};

export type DashboardFulfillmentBreakdown = {
  filledSamePeriod: number;
  filledBacklog: number;
  fullyClosedSamePeriod: number;
  fullyClosedBacklog: number;
};

export type DashboardRequestControlSummary = {
  carriedOverPositions: number;
  carriedOverRequests: number;
  newRequestPositions: number;
  newRequestRequests: number;
  totalWorkloadPositions: number;
  totalWorkloadRequests: number;
  filledPositionsThisPeriod: number;
  filledPositionsFromOldRequests: number;
  filledPositionsFromCurrentMonthRequests: number;
  fullyClosedPositionsThisPeriod: number;
  fullyClosedRequestsThisPeriod: number;
  partialRequests: number;
  partialPositions: number;
  cancelledPositionsThisPeriod: number;
  cancelledRequestsThisPeriod: number;
  remainingPositions: number;
  remainingRequests: number;
  startingBacklogPositions: number;
  endingBacklogPositions: number;
  netBacklogChange: number;
  resignationRequestPositions: number;
  fillRatePercent: number;
  fullCloseRatePercent: number;
  /** alias — fullClosureRatePercent = fullyClosedRequests / totalWorkloadRequests */
  fullClosureRatePercent: number;
  backlogBurnRatePercent: number;
  newDemandAbsorptionRatePercent: number;
  resignationPressureRatio: number;
  cancellationRatePercent: number;
};

export type DashboardFlowView = {
  startingBacklogPositions: number;
  newRequestPositions: number;
  totalWorkloadPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  endingBacklogPositions: number;
  netBacklogChange: number;
};

export type DashboardSlaHighlight = {
  kind: 'unit' | 'owner';
  name: string;
  breachCount: number;
};

export type DashboardExecutiveInsights = {
  sentences: string[];
  slaHighlights: DashboardSlaHighlight[];
};

export type DashboardCohortRow = {
  id: 'backlog_from_previous_period' | 'new_this_period' | 'total';
  label: string;
  requestPositions: number;
  requestCount: number;
  filledPositions: number;
  remainingPositions: number;
  fullyClosedRequests: number;
  partialRequests: number;
  cancelledRequests: number;
};

export type DashboardRequestCohortSummary = {
  rows: DashboardCohortRow[];
};

export type DashboardFulfillmentCohortRow = {
  id:
    | 'requested_this_period_filled_this_period'
    | 'requested_before_period_filled_this_period'
    | 'total_filled_this_period';
  label: string;
  filledPositions: number;
  requestCount: number;
};

export type DashboardFulfillmentCohortSummary = {
  rows: DashboardFulfillmentCohortRow[];
};

export type DashboardFullyClosedCohortRow = {
  id:
    | 'requested_this_period_fully_closed_this_period'
    | 'requested_before_period_fully_closed_this_period'
    | 'total_fully_closed_this_period';
  label: string;
  requestCount: number;
  positionCount: number;
};

export type DashboardFullyClosedCohortSummary = {
  rows: DashboardFullyClosedCohortRow[];
};

export type DashboardSlaSummary = {
  onTrack: number;
  atRisk: number;
  breached: number;
  closedOnTime: number;
  closedLate: number;
  breachRatePercent: number;
};

export type DashboardLifecycleTrendPoint = {
  date: string;
  label: string;
  resignation: number;
  replacement: number;
  increaseHeadcount: number;
  newSite: number;
  other: number;
  requestedPositions: number;
  filledPositions: number;
  fullyClosedRequests: number;
  cancelledPositions: number;
  remainingPositions: number;
};

export type DashboardData = {
  kpis: DashboardKpi[];
  activityTrend: DashboardActivityTrendPoint[];
  unitOverview: DashboardUnitOverview[];
  ageDaysBreakdown: DashboardAgeDaysBreakdown[];
  ageDaysRequestTotal: number;
  ageDaysPositionTotal: number;
  closedBreakdown?: DashboardClosedBreakdown;
  fulfillmentBreakdown?: DashboardFulfillmentBreakdown;
  requestControlSummary?: DashboardRequestControlSummary;
  requestCohortSummary?: DashboardRequestCohortSummary;
  fulfillmentCohortSummary?: DashboardFulfillmentCohortSummary;
  fullyClosedCohortSummary?: DashboardFullyClosedCohortSummary;
  slaSummary?: DashboardSlaSummary;
  lifecycleTrend?: DashboardLifecycleTrendPoint[];
  lifecycleInsights?: string[];
  flowView?: DashboardFlowView;
  executiveInsights?: DashboardExecutiveInsights;
  priorityWorkQueue: DashboardWorkItem[];
  recruiterOverview: DashboardRecruiterOverview[];
  workQueue: DashboardWorkItem[];
  periodLabel: string;
  previousPeriodLabel: string;
  activityTrendLabel: string;
};

export type DashboardSortKey =
  | 'priority'
  | 'updatedAt'
  | 'createdAt'
  | 'ownerName'
  | 'status';

export type DashboardSortDir = 'asc' | 'desc';
