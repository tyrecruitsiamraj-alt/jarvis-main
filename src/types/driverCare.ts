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

export type DriverCareSkillCategory = 'observation' | 'intervention' | 'communication' | 'other';
export type DriverCareKnowledgeCategory =
  | 'pre_resign_behavior'
  | 'intervention'
  | 'policy'
  | 'other';

export interface DriverCareSkill {
  id: string;
  title: string;
  category: DriverCareSkillCategory;
  description: string;
  fileUrl: string | null;
  sortOrder: number;
  createdByName: string | null;
  updatedAt: string;
}

export interface DriverCareKnowledge {
  id: string;
  title: string;
  category: DriverCareKnowledgeCategory;
  summary: string | null;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  sortOrder: number;
  createdByName: string | null;
  updatedAt: string;
}

export interface DriverCareSkillInput {
  id?: string;
  title: string;
  category: DriverCareSkillCategory;
  description: string;
  fileUrl?: string;
  sortOrder?: number;
}

export interface DriverCareKnowledgeInput {
  id?: string;
  title: string;
  category: DriverCareKnowledgeCategory;
  summary?: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  sortOrder?: number;
}

export const DRIVER_CARE_SKILL_CATEGORY_LABELS: Record<DriverCareSkillCategory, string> = {
  observation: 'สังเกตพฤติกรรม',
  intervention: 'ทักษะติดตาม',
  communication: 'การสื่อสาร',
  other: 'อื่นๆ',
};

export const DRIVER_CARE_KNOWLEDGE_CATEGORY_LABELS: Record<DriverCareKnowledgeCategory, string> = {
  pre_resign_behavior: 'พฤติกรรมก่อนลาออก',
  intervention: 'แนวทางติดตาม',
  policy: 'นโยบาย / ระเบียบ',
  other: 'อื่นๆ',
};
