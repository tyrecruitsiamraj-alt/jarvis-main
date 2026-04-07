import { isDemoMode } from '@/lib/demoMode';
import type {
  Candidate,
  CandidateStaffingTrack,
  CandidateStatus,
  DrivingResult,
  Employee,
  EmployeeStatus,
  Gender,
  JobAssignment,
  JobCategory,
  JobRequest,
  JobType,
  YesNo,
} from '@/types';

const CANDIDATES_KEY = 'jarvis_demo_candidates';
const JOBS_KEY = 'jarvis_demo_jobs';
const EMPLOYEES_KEY = 'jarvis_demo_employees';
const JOB_ASSIGNMENTS_KEY = 'jarvis_demo_job_assignments';
const CANDIDATE_STAFFING_KEY = 'jarvis_demo_candidate_staffing';
const STAFFING_TRACK_V2_FLAG = 'jarvis_demo_staffing_track_v2_migrated';

function ensureStaffingTrackV2Migration(): void {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(STAFFING_TRACK_V2_FLAG)) return;
  try {
    const items = readJsonArray<Candidate>(CANDIDATES_KEY);
    if (items.some((c) => c.staffing_track === 'ex')) {
      const next = items.map((c) =>
        c.staffing_track === 'ex' ? { ...c, staffing_track: 'regular' as const } : c,
      );
      writeJsonArray(CANDIDATES_KEY, sortNewestFirst(next));
    }
    const raw = window.localStorage.getItem(CANDIDATE_STAFFING_KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object') {
        const next: Record<string, CandidateStaffingTrack> = {};
        for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
          if (v === 'wl') next[k] = 'wl';
          else if (v === 'ex') next[k] = 'regular';
          else if (v === 'regular') next[k] = 'regular';
        }
        window.localStorage.setItem(CANDIDATE_STAFFING_KEY, JSON.stringify(next));
      }
    }
  } catch {
    /* ignore */
  }
  window.localStorage.setItem(STAFFING_TRACK_V2_FLAG, '1');
}

/** แจ้งให้ UI โหลดรายการงานจาก localStorage ใหม่ (โหมดสาธิต) */
export const DEMO_JOBS_CHANGED_EVENT = 'jarvis-demo-jobs-changed';

/** แจ้งให้ UI รีเฟรชผู้สมัคร / รายการ WL ที่ผูกกับผู้สมัคร */
export const DEMO_CANDIDATES_CHANGED_EVENT = 'jarvis-demo-candidates-changed';

function notifyDemoJobsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DEMO_JOBS_CHANGED_EVENT));
}

function notifyDemoCandidatesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DEMO_CANDIDATES_CHANGED_EVENT));
}

type CandidateInput = {
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
  application_date?: string;
  first_contact_date?: string;
  first_work_date?: string;
  status?: CandidateStatus;
  responsible_recruiter?: string;
  risk_percentage?: number;
  staffing_track?: CandidateStaffingTrack;
};

type JobInput = {
  unit_name: string;
  request_date: string;
  required_date: string;
  urgency: 'urgent' | 'advance';
  total_income: number;
  location_address: string;
  lat?: number;
  lng?: number;
  job_type: JobType;
  job_category: JobCategory;
  recruiter_name?: string;
  screener_name?: string;
  age_range_min?: number;
  age_range_max?: number;
  vehicle_required?: string;
  work_schedule?: string;
  penalty_per_day: number;
  days_without_worker?: number;
  google_maps_url?: string;
};

type EmployeeInput = {
  employee_code: string;
  title_prefix?: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  phone: string;
  status: EmployeeStatus;
  position: string;
  join_date: string;
  address?: string;
  address_line?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  google_maps_url?: string;
  lat?: number;
  lng?: number;
};

function readJsonArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function sortNewestFirst<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getCandidates(): Candidate[] {
  ensureStaffingTrackV2Migration();
  return sortNewestFirst(readJsonArray<Candidate>(CANDIDATES_KEY));
}

function readStaffingMap(): Record<string, CandidateStaffingTrack> {
  if (typeof window === 'undefined') return {};
  ensureStaffingTrackV2Migration();
  try {
    const raw = window.localStorage.getItem(CANDIDATE_STAFFING_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return {};
    const out: Record<string, CandidateStaffingTrack> = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (v === 'regular' || v === 'wl' || v === 'ex') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStaffingMap(m: Record<string, CandidateStaffingTrack>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CANDIDATE_STAFFING_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function resolveCandidateStaffingTrack(c: Candidate): CandidateStaffingTrack {
  const m = readStaffingMap();
  if (Object.prototype.hasOwnProperty.call(m, c.id)) return m[c.id];
  const st = c.staffing_track;
  if (st === 'wl' || st === 'ex' || st === 'regular') return st;
  return 'regular';
}

export function hydrateCandidateStaffing(c: Candidate): Candidate {
  return { ...c, staffing_track: resolveCandidateStaffingTrack(c) };
}

export function setDemoCandidateStaffingTrack(candidateId: string, track: CandidateStaffingTrack): void {
  const m = { ...readStaffingMap() };
  m[candidateId] = track;
  writeStaffingMap(m);
  notifyDemoCandidatesChanged();
}

export function createCandidate(input: CandidateInput): Candidate {
  const st: CandidateStaffingTrack =
    input.staffing_track === 'wl' || input.staffing_track === 'ex' || input.staffing_track === 'regular'
      ? input.staffing_track
      : 'regular';
  const candidate: Candidate = {
    id: crypto.randomUUID(),
    ...(input.title_prefix?.trim() ? { title_prefix: input.title_prefix.trim() } : {}),
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    age: input.age,
    gender: input.gender,
    drinking: input.drinking,
    smoking: input.smoking,
    tattoo: input.tattoo,
    van_driving: input.van_driving,
    sedan_driving: input.sedan_driving,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    application_date: input.application_date || new Date().toISOString().slice(0, 10),
    first_contact_date: input.first_contact_date,
    first_work_date: input.first_work_date,
    status: input.status || 'inprocess',
    staffing_track: st,
    responsible_recruiter: input.responsible_recruiter,
    risk_percentage: input.risk_percentage ?? 0,
    created_at: new Date().toISOString(),
  };

  const items = getCandidates();
  writeJsonArray(CANDIDATES_KEY, sortNewestFirst([candidate, ...items]));
  notifyDemoCandidatesChanged();
  return candidate;
}

/** บันทึกหรือแทนที่ผู้สมัครตาม id (รวม mock ที่ยังไม่อยู่ใน local) + ซิงก์ staffing map */
export function upsertCandidateInDemoStorage(next: Candidate): void {
  ensureStaffingTrackV2Migration();
  const items = getCandidates();
  const idx = items.findIndex((c) => c.id === next.id);
  const merged: Candidate[] =
    idx >= 0 ? items.map((c) => (c.id === next.id ? next : c)) : [next, ...items];
  writeJsonArray(CANDIDATES_KEY, sortNewestFirst(merged));
  const track: CandidateStaffingTrack =
    next.staffing_track === 'wl' || next.staffing_track === 'ex' || next.staffing_track === 'regular'
      ? next.staffing_track
      : 'regular';
  const m = { ...readStaffingMap() };
  m[next.id] = track;
  writeStaffingMap(m);
  notifyDemoCandidatesChanged();
}

const RECRUITERS_ROSTER_KEY = 'jarvis_demo_recruiters_roster';
const SCREENERS_ROSTER_KEY = 'jarvis_demo_screeners_roster';
/** ชื่อที่ Admin ลบออกจาก roster — ไม่ให้โผล่ใน dropdown แม้ยังอยู่ในข้อมูลงาน/mock */
const RECRUITERS_PICKER_EXCLUDED_KEY = 'jarvis_demo_recruiters_picker_excluded';
const SCREENERS_PICKER_EXCLUDED_KEY = 'jarvis_demo_screeners_picker_excluded';

export const JOB_STAFF_ROSTER_CHANGED_EVENT = 'jarvis-job-staff-roster-changed';

function notifyJobStaffRosterChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(JOB_STAFF_ROSTER_CHANGED_EVENT));
}

function readStringRoster(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim());
  } catch {
    return [];
  }
}

function writeStringRoster(key: string, names: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(names));
  } catch {
    /* ignore */
  }
}

function uniqueNamesSorted(names: string[]): string[] {
  const m = new Map<string, string>();
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!m.has(k)) m.set(k, t);
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'th'));
}

export function getRecruitersRoster(): string[] {
  return uniqueNamesSorted(readStringRoster(RECRUITERS_ROSTER_KEY));
}

export function getScreenersRoster(): string[] {
  return uniqueNamesSorted(readStringRoster(SCREENERS_ROSTER_KEY));
}

function readPickerExcludedLowercaseSet(key: string): Set<string> {
  return new Set(readStringRoster(key).map((s) => s.toLowerCase()));
}

function writePickerExcludedSet(key: string, set: Set<string>): void {
  writeStringRoster(key, [...set].sort((a, b) => a.localeCompare(b)));
}

function addRecruiterPickerExcluded(name: string): void {
  const k = name.trim().toLowerCase();
  if (!k) return;
  const s = readPickerExcludedLowercaseSet(RECRUITERS_PICKER_EXCLUDED_KEY);
  s.add(k);
  writePickerExcludedSet(RECRUITERS_PICKER_EXCLUDED_KEY, s);
}

function removeRecruiterPickerExcluded(name: string): void {
  const k = name.trim().toLowerCase();
  const s = readPickerExcludedLowercaseSet(RECRUITERS_PICKER_EXCLUDED_KEY);
  s.delete(k);
  writePickerExcludedSet(RECRUITERS_PICKER_EXCLUDED_KEY, s);
}

function addScreenerPickerExcluded(name: string): void {
  const k = name.trim().toLowerCase();
  if (!k) return;
  const s = readPickerExcludedLowercaseSet(SCREENERS_PICKER_EXCLUDED_KEY);
  s.add(k);
  writePickerExcludedSet(SCREENERS_PICKER_EXCLUDED_KEY, s);
}

function removeScreenerPickerExcluded(name: string): void {
  const k = name.trim().toLowerCase();
  const s = readPickerExcludedLowercaseSet(SCREENERS_PICKER_EXCLUDED_KEY);
  s.delete(k);
  writePickerExcludedSet(SCREENERS_PICKER_EXCLUDED_KEY, s);
}

/** กรองชื่อออกจาก dropdown สรรหา/คัดสรร หลังถูกลบจาก roster */
export function filterRecruiterNamesForStaffDropdown(names: string[]): string[] {
  const ex = readPickerExcludedLowercaseSet(RECRUITERS_PICKER_EXCLUDED_KEY);
  return names.filter((n) => !ex.has(n.trim().toLowerCase()));
}

export function filterScreenerNamesForStaffDropdown(names: string[]): string[] {
  const ex = readPickerExcludedLowercaseSet(SCREENERS_PICKER_EXCLUDED_KEY);
  return names.filter((n) => !ex.has(n.trim().toLowerCase()));
}

export function addRecruiterToRoster(name: string): void {
  const t = name.trim();
  if (!t) return;
  removeRecruiterPickerExcluded(t);
  const cur = readStringRoster(RECRUITERS_ROSTER_KEY);
  const next = uniqueNamesSorted([...cur, t]);
  writeStringRoster(RECRUITERS_ROSTER_KEY, next);
  notifyJobStaffRosterChanged();
}

export function addScreenerToRoster(name: string): void {
  const t = name.trim();
  if (!t) return;
  removeScreenerPickerExcluded(t);
  const cur = readStringRoster(SCREENERS_ROSTER_KEY);
  const next = uniqueNamesSorted([...cur, t]);
  writeStringRoster(SCREENERS_ROSTER_KEY, next);
  notifyJobStaffRosterChanged();
}

function sameStaffName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function removeRecruiterFromRoster(name: string): void {
  const t = name.trim();
  if (!t) return;
  const cur = readStringRoster(RECRUITERS_ROSTER_KEY);
  const next = cur.filter((n) => !sameStaffName(n, t));
  writeStringRoster(RECRUITERS_ROSTER_KEY, uniqueNamesSorted(next));
  addRecruiterPickerExcluded(t);
  notifyJobStaffRosterChanged();
}

export function removeScreenerFromRoster(name: string): void {
  const t = name.trim();
  if (!t) return;
  const cur = readStringRoster(SCREENERS_ROSTER_KEY);
  const next = cur.filter((n) => !sameStaffName(n, t));
  writeStringRoster(SCREENERS_ROSTER_KEY, uniqueNamesSorted(next));
  addScreenerPickerExcluded(t);
  notifyJobStaffRosterChanged();
}

/** เปลี่ยนชื่อใน roster และ (โหมดสาธิตเท่านั้น) อัปเดตงานที่มอบหมายเดิม */
export function renameRecruiterRoster(oldName: string, newName: string): void {
  const o = oldName.trim();
  const n = newName.trim();
  if (!o || !n || sameStaffName(o, n)) return;
  let cur = readStringRoster(RECRUITERS_ROSTER_KEY);
  cur = cur.filter((x) => !sameStaffName(x, o));
  writeStringRoster(RECRUITERS_ROSTER_KEY, uniqueNamesSorted([...cur, n]));
  if (isDemoMode()) {
    const jobs = getJobs();
    let changed = false;
    const patched = jobs.map((j) => {
      if (j.recruiter_name && sameStaffName(j.recruiter_name, o)) {
        changed = true;
        return { ...j, recruiter_name: n };
      }
      return j;
    });
    if (changed) {
      writeJsonArray(JOBS_KEY, sortNewestFirst(patched));
      notifyDemoJobsChanged();
    }
  }
  addRecruiterPickerExcluded(o);
  removeRecruiterPickerExcluded(n);
  notifyJobStaffRosterChanged();
}

/** เปลี่ยนชื่อใน roster และ (โหมดสาธิตเท่านั้น) อัปเดตงานที่มอบหมายเดิม */
export function renameScreenerRoster(oldName: string, newName: string): void {
  const o = oldName.trim();
  const n = newName.trim();
  if (!o || !n || sameStaffName(o, n)) return;
  let cur = readStringRoster(SCREENERS_ROSTER_KEY);
  cur = cur.filter((x) => !sameStaffName(x, o));
  writeStringRoster(SCREENERS_ROSTER_KEY, uniqueNamesSorted([...cur, n]));
  if (isDemoMode()) {
    const jobs = getJobs();
    let changed = false;
    const patched = jobs.map((j) => {
      if (j.screener_name && sameStaffName(j.screener_name, o)) {
        changed = true;
        return { ...j, screener_name: n };
      }
      return j;
    });
    if (changed) {
      writeJsonArray(JOBS_KEY, sortNewestFirst(patched));
      notifyDemoJobsChanged();
    }
  }
  addScreenerPickerExcluded(o);
  removeScreenerPickerExcluded(n);
  notifyJobStaffRosterChanged();
}

export function getJobs(): JobRequest[] {
  return sortNewestFirst(readJsonArray<JobRequest>(JOBS_KEY));
}

export function createJob(input: JobInput): JobRequest {
  const daysWithoutWorker = input.days_without_worker ?? 0;

  const job = {
    id: crypto.randomUUID(),
    unit_name: input.unit_name,
    request_date: input.request_date,
    required_date: input.required_date,
    urgency: input.urgency,
    total_income: input.total_income,
    location_address: input.location_address,
    lat: input.lat,
    lng: input.lng,
    job_type: input.job_type,
    job_category: input.job_category,
    recruiter_name: input.recruiter_name,
    screener_name: input.screener_name,
    age_range_min: input.age_range_min,
    age_range_max: input.age_range_max,
    vehicle_required: input.vehicle_required,
    work_schedule: input.work_schedule,
    penalty_per_day: input.penalty_per_day,
    days_without_worker: daysWithoutWorker,
    total_penalty: input.penalty_per_day * daysWithoutWorker,
    status: 'open',
    created_at: new Date().toISOString(),
    google_maps_url: input.google_maps_url,
  } as JobRequest & { google_maps_url?: string };

  const items = getJobs();
  writeJsonArray(JOBS_KEY, sortNewestFirst([job, ...items]));
  notifyDemoJobsChanged();
  return job;
}

/** บันทึกหรือแทนที่งานตาม id (แก้รายละเอียด / งานจาก mock ที่ยังไม่อยู่ใน local) */
export function upsertJobInDemoStorage(job: JobRequest): void {
  const items = getJobs();
  const idx = items.findIndex((j) => j.id === job.id);
  const next = idx >= 0 ? items.map((j) => (j.id === job.id ? job : j)) : [job, ...items];
  writeJsonArray(JOBS_KEY, sortNewestFirst(next));
  notifyDemoJobsChanged();
}

export function getEmployees(): Employee[] {
  return sortNewestFirst(readJsonArray<Employee>(EMPLOYEES_KEY));
}

export function getJobAssignments(): JobAssignment[] {
  const raw = readJsonArray<JobAssignment>(JOB_ASSIGNMENTS_KEY);
  return [...raw].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function appendJobAssignment(row: JobAssignment): void {
  const items = getJobAssignments();
  writeJsonArray(JOB_ASSIGNMENTS_KEY, [row, ...items]);
}

export function createEmployee(input: EmployeeInput): Employee {
  const employee = {
    id: crypto.randomUUID(),
    employee_code: input.employee_code,
    title_prefix: input.title_prefix,
    first_name: input.first_name,
    last_name: input.last_name,
    nickname: input.nickname,
    phone: input.phone,
    status: input.status,
    position: input.position,
    join_date: input.join_date,
    address: input.address,
    address_line: input.address_line,
    subdistrict: input.subdistrict,
    district: input.district,
    province: input.province,
    google_maps_url: input.google_maps_url,
    lat: input.lat,
    lng: input.lng,
    reliability_score: 0,
    utilization_rate: 0,
    total_days_worked: 0,
    total_income: 0,
    total_cost: 0,
    total_issues: 0,
    created_at: new Date().toISOString(),
  } as Employee;

  const items = getEmployees();
  writeJsonArray(EMPLOYEES_KEY, sortNewestFirst([employee, ...items]));
  return employee;
}
