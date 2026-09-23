import type { JobRequest } from '@/types';
import { jobPositionUnits, sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { getJobStaffApiCache, type StaffDirectoryEntry } from '@/lib/jobStaffRemote';

/**
 * ═══ ชื่อในลิสต์ผู้รับผิดชอบมาจาก **สองที่** ระหว่างย้าย (เจ้าของสั่ง 23 ก.ย. 2569) ═══
 *
 * > *"แล้วต่อไปหน้าใบขอจะเอาชื่อจากไหนมาให้เขาเลือก"* → เคาะว่า **ย้ายมาหน้าผู้ใช้งาน
 * > ที่เดียว ทำเป็นขั้น**
 *
 * ขั้นที่ 1 (ตอนนี้): dropdown **รวม** ชื่อจากทั้งสองที่ — ของเดิมไม่หายระหว่างทยอยกรอก
 * - หน้าทีมสรรหา/คัดสรร/OPL/Online (`job_staff_roster`) — ที่เดิม
 * - หน้าผู้ใช้งาน (`users.nickname` + `users.job_lanes`) — ที่ใหม่
 * - ชื่อที่โผล่บนใบขอจริง (มีอยู่ก่อนแล้ว · วัด 23 ก.ย.: 3 ชื่อไม่อยู่ในหน้าทีม)
 *
 * ขั้นต่อไป (รอเจ้าของสั่ง): กรอกชื่อเล่น+สายงานครบ 41 ชื่อ แล้วค่อยปิดหน้าทีม
 *
 * 🔴 **ชื่อเล่นในหน้าผู้ใช้งานต้องสะกดตรงกับหน้าทีม** — จับคู่ด้วยชื่อ (ไม่สนตัวพิมพ์)
 * เท่านั้น ไม่มี id ผูกกัน · สะกดต่าง = คนเดียวโผล่สองชื่อในลิสต์
 * (migration 114 วัดไว้ 1 ก.ย.: จับคู่อัตโนมัติได้ 0 คู่ เพราะตอนนั้นยังไม่มีชื่อเล่น)
 * ⚠️ รายชื่อที่แอดมินซ่อนไว้ (`pickerExcluded*`) ต้องกรองชื่อจากหน้าผู้ใช้งานด้วย
 *    ไม่งั้นชื่อที่ตั้งใจซ่อนจะกลับมาทางประตูหลัง
 */

/** ชื่อคนที่ตั้งสายงานนี้ไว้ในหน้าผู้ใช้งาน */
function directoryNames(lane: 'recruiter' | 'screener' | 'opl' | 'online'): string[] {
  const dir: StaffDirectoryEntry[] = getJobStaffApiCache()?.directory ?? [];
  return dir.filter((d) => d.lanes.includes(lane)).map((d) => d.name);
}

/** ค่า filter สำหรับงานที่ยังไม่ได้กำหนดเจ้าหน้าที่ */
export const STAFF_ASSIGNEE_UNASSIGNED = '__unassigned__';

export const STAFF_ASSIGNEE_UNASSIGNED_LABEL = 'ยังไม่ถูก Assign';

function uniqueSorted(names: string[]): string[] {
  const m = new Map<string, string>();
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!m.has(k)) m.set(k, t);
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * @param extraJobs แนะนำส่งรายการงานจาก `/api/jobs` เพื่อดึงชื่อสรรหาจากงานจริง
 */
export function buildRecruiterNameOptions(extraJobs?: JobRequest[]): string[] {
  const fromJobs = (extraJobs ?? [])
    .map((j) => j.recruiter_name)
    .filter((n): n is string => Boolean(n?.trim()));
  const api = getJobStaffApiCache();
  const roster = api?.recruiters ?? [];
  const ex = new Set((api?.pickerExcludedRecruiters ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...directoryNames('recruiter'), ...fromJobs]).filter(
    (n) => !ex.has(n.trim().toLowerCase()),
  );
}

export function buildScreenerNameOptions(extraJobs?: JobRequest[]): string[] {
  const fromJobs = (extraJobs ?? [])
    .map((j) => j.screener_name)
    .filter((n): n is string => Boolean(n?.trim()));
  const api = getJobStaffApiCache();
  const roster = api?.screeners ?? [];
  const ex = new Set((api?.pickerExcludedScreeners ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...directoryNames('screener'), ...fromJobs]).filter(
    (n) => !ex.has(n.trim().toLowerCase()),
  );
}

/**
 * ชื่อทีม online (097 · เจ้าของสั่ง 17 ส.ค. 2569 — "ผู้รับผิดชอบจะต้องเป็นทีม online")
 * โครงเดียวกับสรรหา/คัดสรร/OPL ทุกอย่าง: รายชื่อจาก roster + ชื่อที่โผล่บนใบขอจริง
 */
export function buildOnlineNameOptions(extraJobs?: JobRequest[]): string[] {
  const fromJobs = (extraJobs ?? [])
    .map((j) => j.online_name)
    .filter((n): n is string => Boolean(n?.trim()));
  const api = getJobStaffApiCache();
  const roster = api?.onlines ?? [];
  const ex = new Set((api?.pickerExcludedOnlines ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...directoryNames('online'), ...fromJobs]).filter(
    (n) => !ex.has(n.trim().toLowerCase()),
  );
}

export function buildOplNameOptions(extraJobs?: JobRequest[]): string[] {
  const fromJobs = (extraJobs ?? [])
    .map((j) => j.opl_name)
    .filter((n): n is string => Boolean(n?.trim()));
  const api = getJobStaffApiCache();
  const roster = api?.opls ?? [];
  const ex = new Set((api?.pickerExcludedOpls ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...directoryNames('opl'), ...fromJobs]).filter(
    (n) => !ex.has(n.trim().toLowerCase()),
  );
}

export function nameListedInOptions(trimmed: string, options: string[]): boolean {
  const k = trimmed.toLowerCase();
  return options.some((o) => o.trim().toLowerCase() === k);
}

export function isRecruiterUnassigned(job: JobRequest): boolean {
  return !job.recruiter_name?.trim();
}

export function isScreenerUnassigned(job: JobRequest): boolean {
  return !job.screener_name?.trim();
}

export function isOplUnassigned(job: JobRequest): boolean {
  return !job.opl_name?.trim();
}

export function matchesRecruiterFilter(job: JobRequest, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === STAFF_ASSIGNEE_UNASSIGNED) return isRecruiterUnassigned(job);
  return job.recruiter_name === filter;
}

export function matchesScreenerFilter(job: JobRequest, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === STAFF_ASSIGNEE_UNASSIGNED) return isScreenerUnassigned(job);
  return job.screener_name === filter;
}

export function matchesOplFilter(job: JobRequest, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === STAFF_ASSIGNEE_UNASSIGNED) return isOplUnassigned(job);
  return job.opl_name === filter;
}

export function countUnassignedRecruiters(jobs: JobRequest[]): number {
  return jobs.filter(isRecruiterUnassigned).reduce((sum, j) => sum + jobPositionUnits(j), 0);
}

export function countUnassignedScreeners(jobs: JobRequest[]): number {
  return jobs.filter(isScreenerUnassigned).reduce((sum, j) => sum + jobPositionUnits(j), 0);
}

export function countUnassignedOpls(jobs: JobRequest[]): number {
  return jobs.filter(isOplUnassigned).reduce((sum, j) => sum + jobPositionUnits(j), 0);
}

type StaffNameField = 'recruiter_name' | 'screener_name' | 'opl_name';

export function countJobsByStaffName(jobs: JobRequest[], field: StaffNameField): Map<string, number> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const name = j[field]?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + jobPositionUnits(j));
  }
  return counts;
}

/** เวอร์ชันเลือกได้หลายค่า — [] = ทั้งหมด (ใช้กับฟิลเตอร์ multi-select) */
export function matchesAnyRecruiterFilter(job: JobRequest, filters: string[]): boolean {
  return filters.length === 0 || filters.some((f) => matchesRecruiterFilter(job, f));
}

export function matchesAnyScreenerFilter(job: JobRequest, filters: string[]): boolean {
  return filters.length === 0 || filters.some((f) => matchesScreenerFilter(job, f));
}

export function matchesAnyOplFilter(job: JobRequest, filters: string[]): boolean {
  return filters.length === 0 || filters.some((f) => matchesOplFilter(job, f));
}
