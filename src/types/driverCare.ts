export type DriverCareRiskLevel = 'low' | 'watch' | 'medium' | 'high';
export type DriverActionStatus = 'pending' | 'in_progress' | 'closed';
export type DriverActionType =
  | 'call'
  | 'meeting'
  | 'income_check'
  | 'site_check'
  | 'supervisor_escalation'
  | 'other';
export type DriverContactStatus = 'contacted' | 'not_reached';
export type DriverIssueFound =
  | 'income_drop'
  | 'ot_drop'
  | 'leave_issue'
  | 'attendance_issue'
  | 'client_issue'
  | 'supervisor_issue'
  | 'personal_issue'
  | 'other'
  | 'none';
export type DriverActionResult = 'stay' | 'unsure' | 'confirmed_resign' | 'not_reached' | 'pending';

export interface DriverCareOverviewMetrics {
  activeDrivers: number;
  highRisk: number;
  mediumRisk: number;
  watchRisk: number;
  lowRisk: number;
  pendingAction: number;
  inProgressAction: number;
  overdueAction: number;
}

export interface DriverCareOverviewResponse {
  metrics: DriverCareOverviewMetrics;
  riskByLevel: { level: DriverCareRiskLevel; count: number }[];
  topSites: { siteName: string; count: number }[];
  topReasons: { reason: string; count: number }[];
  actionStatus: { status: DriverActionStatus; count: number }[];
}

export interface DriverRiskListItem {
  riskScoreId: string;
  employeeId: string;
  employeeCode: string;
  driverName: string;
  siteName: string;
  clientName: string;
  supervisorName: string;
  riskScore: number;
  riskLevel: DriverCareRiskLevel;
  mainReason: string;
  recommendedAction: string;
  actionStatus: DriverActionStatus | 'overdue';
  overdueFlag: boolean;
  lastActionDate: string | null;
  nextFollowUpDate: string | null;
}

export interface DriverActionTrackingItem {
  actionId: string;
  riskScoreId: string | null;
  employeeId: string;
  employeeCode: string;
  driverName: string;
  riskLevel: DriverCareRiskLevel;
  riskScore: number;
  actionByName: string | null;
  actionType: string;
  issueFound: string;
  actionTaken: string;
  result: string;
  status: DriverActionStatus;
  actionDate: string;
  nextFollowUpDate: string | null;
  overdueFlag: boolean;
}

export interface DriverActionLogInput {
  employeeId: string;
  riskScoreId?: string;
  actionType: DriverActionType;
  contactStatus: DriverContactStatus;
  issueFound: DriverIssueFound;
  actionTaken: string;
  result: DriverActionResult;
  nextFollowUpDate?: string;
  status: DriverActionStatus;
}

export interface DriverActionUpdateInput {
  id: string;
  status?: DriverActionStatus;
  result?: DriverActionResult;
  nextFollowUpDate?: string | null;
  actionTaken?: string;
}

export const DRIVER_CARE_RISK_LABELS: Record<DriverCareRiskLevel, string> = {
  high: 'เสี่ยงสูง',
  medium: 'เสี่ยงกลาง',
  watch: 'เฝ้าระวัง',
  low: 'ปกติ',
};

export const DRIVER_ACTION_STATUS_LABELS: Record<DriverActionStatus | 'overdue', string> = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังติดตาม',
  closed: 'ปิดเคส',
  overdue: 'เลยกำหนด',
};

export const DRIVER_ACTION_TYPE_LABELS: Record<DriverActionType, string> = {
  call: 'โทรติดตาม',
  meeting: 'นัดพบ',
  income_check: 'ตรวจสอบรายได้',
  site_check: 'ตรวจไซต์งาน',
  supervisor_escalation: 'ส่งต่อหัวหน้างาน',
  other: 'อื่นๆ',
};
