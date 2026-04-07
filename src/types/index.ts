// ============ AUTH & USERS ============
export type UserRole = 'admin' | 'supervisor' | 'staff';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

// ============ EMPLOYEES (WL) ============
export type EmployeeStatus = 'active' | 'inactive' | 'suspended';

export interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  phone: string;
  status: EmployeeStatus;
  position: string;
  join_date: string;
  address?: string;
  lat?: number;
  lng?: number;
  reliability_score: number; // 0-100
  utilization_rate: number; // 0-100
  total_days_worked: number;
  total_income: number;
  total_cost: number;
  total_issues: number;
  avatar_url?: string;
  created_at: string;
}

export interface TrainingRecord {
  id: string;
  employee_id: string;
  training_name: string;
  training_date: string;
  result: 'passed' | 'failed' | 'pending';
  notes?: string;
}

// ============ WORK CALENDAR ============
export type WorkStatus = 'normal_work' | 'cancel_by_employee' | 'late' | 'cancel_by_client' | 'no_show' | 'day_off' | 'available';

export interface WorkCalendarEntry {
  id: string;
  employee_id: string;
  work_date: string;
  client_id?: string;
  client_name?: string;
  shift?: string;
  status: WorkStatus;
  income?: number;
  cost?: number;
  issue_reason_id?: string;
  issue_reason?: string;
  notes?: string;
  assigned_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IssueReason {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

// ============ CLIENTS / WORKPLACES ============
export interface ClientWorkplace {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  contact_person?: string;
  contact_phone?: string;
  default_income: number;
  default_cost: number;
  default_shift: string;
  job_type: JobType;
  job_category: JobCategory;
  is_active: boolean;
  created_at: string;
}

// ============ JOB MODULE ============
export type JobType = 'thai_executive' | 'foreign_executive' | 'central' | 'valet_parking';
export type JobCategory = 'private' | 'government' | 'bank';
export type JobUrgency = 'urgent' | 'advance';
export type JobStatus = 'open' | 'in_progress' | 'closed' | 'cancelled';

export interface JobRequest {
  id: string;
  unit_name: string;
  request_date: string;
  required_date: string;
  urgency: JobUrgency;
  total_income: number;
  location_address: string;
  lat?: number;
  lng?: number;
  job_type: JobType;
  job_category: JobCategory;
  recruiter_id?: string;
  recruiter_name?: string;
  screener_id?: string;
  screener_name?: string;
  age_range_min?: number;
  age_range_max?: number;
  vehicle_required?: string;
  work_schedule?: string;
  penalty_per_day: number;
  days_without_worker: number;
  total_penalty: number;
  status: JobStatus;
  closed_date?: string;
  created_at: string;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_name: string;
  assignment_type: 'start' | 'replacement' | 'trial';
  start_date: string;
  end_date?: string;
  status: 'sent' | 'passed' | 'failed' | 'started' | 'cancelled';
  trial_days?: number;
  created_at: string;
}

// ============ CANDIDATES ============
/** 1. พนักงานประจำ 2. WL (แสดงในเมนูพนักงาน WL) 3. EX */
export type CandidateStaffingTrack = 'regular' | 'wl' | 'ex';

export type CandidateStatus = 'inprocess' | 'drop' | 'done' | 'waiting_interview' | 'waiting_to_start' | 'no_job';
export type Gender = 'male' | 'female' | 'other';
export type YesNo = 'yes' | 'no';
export type DrivingResult = 'passed' | 'failed' | 'not_tested';

export interface Candidate {
  id: string;
  /** คำนำหน้า เช่น นาย นางสาว (ไม่บังคับ) */
  title_prefix?: string;
  first_name: string;
  last_name: string;
  phone: string;
  age: number;
  gender: Gender;
  drinking: YesNo;
  smoking: YesNo;
  tattoo: YesNo;
  van_driving: DrivingResult;
  sedan_driving: DrivingResult;
  address: string;
  lat?: number;
  lng?: number;
  application_date: string;
  first_contact_date?: string;
  first_work_date?: string;
  status: CandidateStatus;
  /** พนักงานประจำ (Ex) หรือ WL — ค่าเริ่มต้น ex */
  staffing_track?: CandidateStaffingTrack;
  responsible_recruiter?: string;
  risk_percentage: number;
  created_at: string;
}

export interface CandidateInterview {
  id: string;
  candidate_id: string;
  interview_date: string;
  location: string;
  client_name: string;
  attended: boolean;
  result?: 'passed' | 'failed' | 'pending';
  notes?: string;
}

export interface CandidateWorkHistory {
  id: string;
  candidate_id: string;
  client_name: string;
  work_type: 'replacement' | 'start';
  start_date: string;
  end_date?: string;
  status: 'completed' | 'ongoing' | 'cancelled';
}

// ============ AUDIT LOG ============
export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
}

// ============ REFERENCE DATA ============
export interface ReferenceData {
  id: string;
  category: string;
  value: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

// ============ HELPERS ============
export const WORK_STATUS_COLORS: Record<WorkStatus, string> = {
  normal_work: 'bg-status-normal',
  cancel_by_employee: 'bg-status-cancel-employee',
  late: 'bg-status-late',
  cancel_by_client: 'bg-status-cancel-client',
  no_show: 'bg-status-no-show',
  day_off: 'bg-muted',
  available: 'bg-secondary',
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  normal_work: 'ปกติ',
  cancel_by_employee: 'ยกเลิก (พนง.)',
  late: 'มาสาย',
  cancel_by_client: 'ยกเลิก (ลูกค้า)',
  no_show: 'No Show',
  day_off: 'วันหยุด',
  available: 'ว่าง',
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  thai_executive: 'ผู้บริหารคนไทย',
  foreign_executive: 'ผู้บริหารต่างชาติ',
  central: 'ส่วนกลาง',
  valet_parking: 'Valet Parking',
};

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  private: 'เอกชน',
  government: 'ราชการ',
  bank: 'ธนาคาร',
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  inprocess: 'In Process',
  drop: 'Drop',
  done: 'Done',
  waiting_interview: 'รอสัมภาษณ์',
  waiting_to_start: 'รอเริ่มงาน',
  no_job: 'ไม่มีงาน',
};
