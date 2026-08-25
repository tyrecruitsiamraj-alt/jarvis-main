import type { UnitRequestWorkStatus } from '@/lib/unitRequestWorkStatus';

// ============ AUTH & USERS ============
export type UserRole = 'admin' | 'supervisor' | 'staff' | 'opl';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  /** แผนกที่ล็อกสิทธิ์เห็นใบขอ เช่น LBD — ไม่มี = เห็นทุกแผนก (admin มักว่าง) */
  department_code?: string;
}

// ============ EMPLOYEES (WL) ============
export type EmployeeStatus = 'active' | 'inactive' | 'suspended';

export interface Employee {
  id: string;
  employee_code: string;
  /** คำนำหน้า เช่น นาย นางสาว */
  title_prefix?: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  phone: string;
  /** ฐานเงินเดือน (บาท) — แสดงใน Monthly Planner */
  base_salary?: number;
  status: EmployeeStatus;
  position: string;
  /** แผนก / BU เช่น LBD, LBA */
  department_code?: string;
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
export type JobRequestSource = 'jarvis' | 'siamraj';

export interface JobRequest {
  id: string;
  source?: JobRequestSource;
  readOnly?: boolean;
  externalId?: string;
  submittedByName?: string;
  submittedByEmail?: string;
  submittedAt?: string;
  request_action_code?: string;
  request_action_name?: string;
  site_code?: string;
  department_code?: string;
  department_name?: string;
  /** ประเภทสัญญา Siamraj — C = Cls (รถอย่างเดียว) */
  contract_type_code?: string;
  contract_type_name?: string;
  /**
   * เงินล่าสุดของ **คนที่ลาออก** จากใบขอนี้ (เจ้าของสั่ง 25 ส.ค. 2569)
   * `draw` = เงินที่จ่ายพนักงาน · `fee` = ค่าที่เก็บลูกค้า — **คนละความหมาย ห้ามรวมกัน**
   * ⚠️ `undefined`/`null` = **ไม่รู้** (วัดจริงหาเจอ 76% ของใบขอ) ห้ามแสดงเป็น 0
   */
  resigned_wage_draw_rate?: number | null;
  resigned_wage_fee_rate?: number | null;
  resigned_wage_effective_date?: string | null;
  position_units?: number;
  /** จำนวนตำแหน่งที่ขอมา (Siamraj request_qty) */
  request_positions?: number;
  /** จำนวนที่หาได้แล้ว / แจ้งเข้า */
  filled_positions?: number;
  /** จำนวนที่ยกเลิก / ปิดค้าง */
  cancelled_positions?: number;
  /** วันที่แจ้งเข้า (YMD) — ยังไม่มี adapter ไหนส่งมา ledger จึง fallback เป็น closed_date */
  inform_date?: string;
  /** วันที่ยกเลิก (YMD) — ใบขอที่ปิดแล้วจาก SQL Server ส่งค่านี้มา */
  cancel_date?: string;
  /**
   * เหตุการณ์หาได้/ยกเลิกรายครั้งพร้อมวันที่ — ถ้ามีค่านี้ ledger จะใช้แทน snapshot
   * (`filled_positions`/`cancelled_positions`) ทำให้ยอดรายงวดแม่นขึ้นและเลิกเป็น snapshot_fallback
   * ยังไม่มี adapter ไหนส่งมา — โครงรอไว้ให้ตรงกับ `FulfillmentLedgerEvent`
   */
  fulfillment_events?: Array<{
    eventDate: string | null;
    eventType: 'informed' | 'cancelled';
    positionQty: number;
    sourceTable?: string;
    sourceId?: string;
    isDateReliable?: boolean;
    reliabilityNote?: string;
  }>;
  lastWorkingDay?: string;
  contact_phone?: string;
  contact_name?: string;
  siamraj_status?: string;
  need_staff?: boolean;
  staff_title_code?: string;
  staff_title_name?: string;
  job_description_code_1?: string;
  job_description_code_2?: string;
  gender_requirement?: string;
  request_no?: string;
  resigned_title_prefix?: string;
  resigned_first_name?: string;
  resigned_last_name?: string;
  resigned_age?: number;
  resigned_reason?: string;
  resigned_employee_name?: string;
  unit_name: string;
  request_date: string;
  required_date: string;
  urgency: JobUrgency;
  total_income: number;
  location_address: string;
  /**
   * สถานที่ปฏิบัติงาน — ชื่อสถานที่/บริษัทที่ไปประจำ (ERP `st_request_p2.work_place1`)
   * ต่างจาก `location_address` ที่รวม work_place1-3 (มีที่อยู่/ผู้ใช้บริการปนมา) และเป็นตัวที่
   * ตัวกรองจังหวัด-อำเภอใช้ — ช่องนี้ไว้อ่านอย่างเดียว ไม่เอาไปกรอง
   */
  work_place?: string;
  /** สัญชาติเจ้านาย (ERP `st_request_p2.boss_nationality`) — เป็นข้อความอิสระ ~40% ของใบขอเท่านั้นที่กรอก */
  boss_nationality?: string;
  lat?: number;
  lng?: number;
  job_type: JobType;
  job_category: JobCategory;
  recruiter_id?: string;
  recruiter_name?: string;
  screener_id?: string;
  screener_name?: string;
  /** เจ้าหน้าที่ OPL (แยกจากสรรหา/คัดสรร) */
  opl_name?: string;
  /** ทีม online ที่รับผิดชอบใบขอ (097) — คนละช่องกับสรรหา/คัดสรร/OPL */
  online_name?: string;
  age_range_min?: number;
  age_range_max?: number;
  vehicle_required?: string;
  work_schedule?: string;
  /**
   * สวัสดิการที่โชว์บนประกาศได้ เช่น ["โอที ~75 บาท/ชม.", "เบี้ยขยัน", "ค่าเดินทาง"]
   * (เจ้าของเคาะ 16 ส.ค. 2569 — กติกาเดียวกับที่ AI พูดตอนโทร)
   * ⚠️ ทุกตัวเลขเป็น **อัตราจ่าย** ไม่ใช่อัตราเบิก · undefined = ใบนี้ไม่มีข้อมูล/ERP อ่านไม่ได้
   */
  benefits?: string[];
  /**
   * รายได้ต่อเดือน = ค่าแรงหลัก + รายได้มั่นคง (เจ้าของนิยาม 16 ส.ค. 2569)
   * ⚠️ **ต่างจาก `total_income`** ซึ่งเป็นอัตราค่าแรงหลักดิบจาก ERP (บางใบเป็น**ต่อวัน**
   * เช่น 410 = ค่าแรงรายวัน วัดเจอ 20 จาก 200 ใบ) — ฟิลด์นี้แปลงเป็นต่อเดือนแล้วเสมอ
   * undefined = คิดไม่ได้/ERP อ่านไม่ได้ → ให้ถอยไปแสดง total_income เหมือนเดิม
   */
  monthly_income?: number;
  monthly_income_base?: number;
  monthly_income_items?: Array<{ label: string; monthly: number }>;
  /**
   * รายได้แบบแยกส่วนที่**เจ้าหน้าที่ตั้งเอง** (20 ส.ค. 2569) — มาก่อน breakdown
   * อัตโนมัติจาก ERP เสมอ · ผ่าน `buildIncomeDisplay` มาแล้ว = เลข balance เสมอ
   * (บรรทัด "อื่น ๆ" ถูกเติมให้แล้ว) · undefined = ไม่ได้ตั้ง ใช้การแสดงแบบเดิม
   */
  income_display?: {
    period: 'daily' | 'monthly';
    lines: Array<{ label: string; amount: number }>;
    total: number;
  };
  penalty_per_day: number;
  days_without_worker: number;
  total_penalty: number;
  status: JobStatus;
  closed_date?: string;
  created_at: string;
  /** หมายเหตุจากรายการงานทั้งหมด (เก็บใน PostgreSQL สำหรับใบขอ Siamraj) */
  list_note?: string;
  /** ส่งคนแทน (true) / ไม่ส่งคนแทน (false) — null = ยังไม่เลือก */
  send_replacement?: boolean | null;
  /** ข้อความ ERP ที่ override เพื่อใช้แตกสาขาแบบถาวร */
  parser_override_text?: string | null;
  /**
   * ค่าที่เจ้าหน้าที่แก้เองจากกล่องงาน เพื่อให้ประกาศสาธารณะถูกต้อง (17 ส.ค. 2569)
   * ⚠️ ที่อยู่จาก ERP เป็นข้อความก้อนเดียว ตัวถอดจังหวัด/อำเภอเดาผิดได้
   * ค่าพวกนี้จึงมาก่อนค่าที่เดาจากที่อยู่ดิบเสมอ
   */
  override_province?: string | null;
  override_district?: string | null;
  override_subdistrict?: string | null;
  /** สวัสดิการที่ติ๊กเพิ่มเอง (คีย์จาก `src/lib/extraBenefits.ts`) — คนละชุดกับ `benefits` จาก ERP */
  extra_benefits?: string[] | null;
  /**
   * ใบขอ**ล่วงหน้า** (`st_prequest_*` · 17 ส.ค. 2569) — ลูกค้าแจ้งไว้ก่อน
   * ยังไม่ถูกแปลงเป็นใบขอจริง · ทำงานเหมือนใบขอทุกอย่าง แค่ติดป้ายให้รู้
   */
  is_prequest?: boolean;
  /** วันสิ้นสุดที่ลูกค้าอยากได้ — มีเฉพาะใบขอล่วงหน้า */
  wanted_until_date?: string;
  /** หน่วยของอัตราค่าแรง: M ต่อเดือน · D ต่อวัน · H ต่อชั่วโมง */
  rate_unit?: string;
  work_status?: UnitRequestWorkStatus | null;
  work_person_first_name?: string | null;
  work_person_last_name?: string | null;
  /** วันที่ตามสถานะ (YMD) — แจ้งเข้า / นัดสัมภาษณ์ / เริ่มงาน */
  work_status_date?: string | null;
  /** รายชื่อคนในสถานะทำงาน (หลายคนต่อใบได้) */
  work_persons?: Array<{ first_name: string; last_name: string; status_date: string | null }> | null;
  /** สาขาที่ผู้ใช้แก้เอง (persist) — ใช้แทนผลแตกสาขาจาก ERP */
  branch_override?: Array<{
    branch_id?: string;
    branch_name_clean: string;
    address_raw?: string | null;
    road?: string | null;
    subdistrict?: string | null;
    requested_qty: number;
    district_hint: string | null;
    province_hint: string | null;
    postal_code?: string | null;
    lat?: number | null;
    lng?: number | null;
    geocode_status?: 'unverified' | 'estimated' | 'confirmed' | 'not_found';
  }> | null;
  /** override ฟิลด์ใบขอที่ผู้ใช้แก้เอง (อายุ/เพศ/สาขา) */
  field_overrides?: {
    age_min?: number | null;
    age_max?: number | null;
    gender?: string | null;
    branches?: Array<{
      branch_id?: string;
      branch_name_clean: string;
      address_raw?: string | null;
      road?: string | null;
      subdistrict?: string | null;
      requested_qty: number;
      district_hint: string | null;
      province_hint: string | null;
      postal_code?: string | null;
      lat?: number | null;
      lng?: number | null;
      geocode_status?: 'unverified' | 'estimated' | 'confirmed' | 'not_found';
    }> | null;
    /** รายได้รวมที่ตั้งเอง (ของเดิม) — ใช้เมื่อไม่ได้ตั้งรายได้แบบแยกส่วน */
    total_income?: number | null;
    /** สวัสดิการ (20 ส.ค. 2569 เป็น freetext · ค่าเก่าเป็นคีย์ยังอ่านได้) */
    benefits?: string[] | null;
    /** รายได้แบบแยกส่วนที่ตั้งเอง — โครงอยู่ที่ `src/lib/incomeBreakdown.ts` */
    income?: {
      period: 'daily' | 'monthly';
      lines: Array<{ label: string; amount: number }>;
      total: number | null;
    } | null;
  } | null;
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

export type CandidateStatus = 'inprocess' | 'drop' | 'done' | 'waiting_interview' | 'interviewed' | 'waiting_to_start' | 'no_job';
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
  interviewed: 'สัมภาษณ์แล้ว',
  waiting_to_start: 'รอเริ่มงาน',
  no_job: 'ไม่มีงาน',
};
