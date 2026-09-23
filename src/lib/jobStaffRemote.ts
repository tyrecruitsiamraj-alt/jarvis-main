import { apiFetch } from '@/lib/apiFetch';

export const JOB_STAFF_ROSTER_CHANGED_EVENT = 'jarvis-job-staff-roster-changed';

export type RosterBuMode = 'code' | 'all' | 'none';

/**
 * **สมุดรายชื่อเจ้าหน้าที่** จากหน้าผู้ใช้งาน (users: ชื่อเล่น + สายงาน + เบอร์)
 * เจ้าของเคาะ 23 ก.ย. 2569 ว่าหน้าผู้ใช้งานคือตัวจริง แล้วให้ย้ายมาที่เดียวแบบเป็นขั้น
 * — ใบขอใช้แค่ชื่อ (`phone` ว่างได้) · หน้า Follow ใช้ชื่อ+เบอร์ จึงกรองเอาเองที่ปลายทาง
 * ว่างทั้งลิสต์ = ยังไม่มีใครตั้งสายงานในหน้าผู้ใช้งาน (คนละเรื่องกับ "โหลดไม่ได้")
 */
export type StaffDirectoryEntry = { name: string; phone: string; lanes: string[] };

export type JobStaffApiState = {
  /** ชื่อ + สายงาน (+ เบอร์ ถ้ามี) ของคนที่ตั้งสายงานไว้ในหน้าผู้ใช้งาน */
  directory: StaffDirectoryEntry[];
  recruiters: string[];
  screeners: string[];
  opls: string[];
  /** ทีม online (097) */
  onlines: string[];
  pickerExcludedRecruiters: string[];
  pickerExcludedScreeners: string[];
  pickerExcludedOpls: string[];
  pickerExcludedOnlines: string[];
  /** BU (department) the roster is locked to, or null when 'all'/'none' */
  bu: string | null;
  /** how the roster is scoped for the current user */
  buMode: RosterBuMode;
};

let cache: JobStaffApiState | null = null;

export function getJobStaffApiCache(): JobStaffApiState | null {
  return cache;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** แถวที่ใช้ได้จริง — ไม่มีชื่อ = ทิ้ง · ไม่มีเบอร์ยังเก็บไว้ (ใบขอไม่ต้องใช้เบอร์) */
function parseDirectory(v: unknown): StaffDirectoryEntry[] {
  if (!Array.isArray(v)) return [];
  const out: StaffDirectoryEntry[] = [];
  for (const raw of v) {
    if (typeof raw !== 'object' || raw === null) continue;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const phone = typeof o.phone === 'string' ? o.phone.trim() : '';
    if (!name) continue;
    out.push({ name, phone, lanes: isStringArray(o.lanes) ? o.lanes : [] });
  }
  return out;
}

function parseState(data: unknown): JobStaffApiState | null {
  if (typeof data !== 'object' || data === null) return null;
  const o = data as Record<string, unknown>;
  if (
    !isStringArray(o.recruiters) ||
    !isStringArray(o.screeners) ||
    !isStringArray(o.pickerExcludedRecruiters) ||
    !isStringArray(o.pickerExcludedScreeners)
  ) {
    return null;
  }
  const buMode: RosterBuMode =
    o.buMode === 'code' || o.buMode === 'all' || o.buMode === 'none' ? o.buMode : 'all';
  return {
    directory: parseDirectory(o.directory),
    recruiters: o.recruiters,
    screeners: o.screeners,
    opls: isStringArray(o.opls) ? o.opls : [],
    onlines: isStringArray(o.onlines) ? o.onlines : [],
    pickerExcludedRecruiters: o.pickerExcludedRecruiters,
    pickerExcludedScreeners: o.pickerExcludedScreeners,
    pickerExcludedOpls: isStringArray(o.pickerExcludedOpls) ? o.pickerExcludedOpls : [],
    pickerExcludedOnlines: isStringArray(o.pickerExcludedOnlines) ? o.pickerExcludedOnlines : [],
    bu: typeof o.bu === 'string' ? o.bu : null,
    buMode,
  };
}

/** โหลดรายชื่อสรรหา/คัดสรรจาก API แล้วอัปเดตแคช + แจ้ง UI */
export async function refreshJobStaffFromApi(): Promise<void> {
  try {
    const r = await apiFetch('/api/job-staff');
    if (!r.ok) return;
    const data: unknown = await r.json();
    const next = parseState(data);
    if (next) {
      cache = next;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(JOB_STAFF_ROSTER_CHANGED_EVENT));
      }
    }
  } catch {
    /* ignore */
  }
}

export function clearJobStaffApiCache(): void {
  cache = null;
}

export type MutateOp =
  | { op: 'add'; role: 'recruiter' | 'screener' | 'opl' | 'online'; name: string }
  | { op: 'remove'; role: 'recruiter' | 'screener' | 'opl' | 'online'; name: string }
  | { op: 'rename'; role: 'recruiter' | 'screener' | 'opl' | 'online'; oldName: string; newName: string };

/** A roster name with the BU it is assigned to (null = ไม่ระบุ, visible in every BU). */
export type RosterEntry = { name: string; bu: string | null };

export type JobStaffManageState = {
  recruiters: RosterEntry[];
  screeners: RosterEntry[];
  opls: RosterEntry[];
  onlines: RosterEntry[];
  /** admin may assign any BU; other roles only their own department */
  canManageAllBu: boolean;
};

function toEntries(v: unknown): RosterEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((e): e is { name: unknown; bu: unknown } => typeof e === 'object' && e !== null)
    .map((e) => ({
      name: typeof e.name === 'string' ? e.name : '',
      bu: typeof e.bu === 'string' && e.bu ? e.bu : null,
    }))
    .filter((e) => e.name);
}

/**
 * Fetch every roster name with its BU, for the admin management tab. Does NOT
 * touch the shared picker cache used by job forms.
 */
export async function fetchJobStaffManage(): Promise<JobStaffManageState | null> {
  try {
    const r = await apiFetch('/api/job-staff?manage=1');
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    return {
      recruiters: toEntries(data.recruiters),
      screeners: toEntries(data.screeners),
      opls: toEntries(data.opls),
      onlines: toEntries(data.onlines),
      canManageAllBu: data.canManageAllBu === true,
    };
  } catch {
    return null;
  }
}

/** Post a roster mutation (add / remove / rename / set-bu); the tab refetches after. */
export async function rosterMutate(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string }> {
  const r = await apiFetch('/api/job-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.ok) return { ok: true };
  const data = (await r.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, message: data?.message ?? 'บันทึกไม่สำเร็จ' };
}

export async function mutateJobStaffRemote(
  payload: MutateOp,
): Promise<{ ok: boolean; message?: string; state?: JobStaffApiState }> {
  const r = await apiFetch('/api/job-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data: unknown = {};
  try {
    data = await r.json();
  } catch {
    /* ignore */
  }
  if (!r.ok) {
    const rec = data as { message?: string };
    const msg =
      typeof rec.message === 'string'
        ? rec.message
        : r.status === 403
          ? 'ไม่มีสิทธิ์แก้ไขรายชื่อ (เฉพาะผู้ดูแลระบบ)'
          : 'บันทึกไม่สำเร็จ';
    return { ok: false, message: msg };
  }
  const state = parseState(data);
  if (state) {
    cache = state;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(JOB_STAFF_ROSTER_CHANGED_EVENT));
    }
  }
  return { ok: true, state: state ?? undefined };
}
