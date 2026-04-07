import { apiFetch } from '@/lib/apiFetch';
import { isDemoMode } from '@/lib/demoMode';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/demoStorage';

export type JobStaffApiState = {
  recruiters: string[];
  screeners: string[];
  pickerExcludedRecruiters: string[];
  pickerExcludedScreeners: string[];
};

let cache: JobStaffApiState | null = null;

export function getJobStaffApiCache(): JobStaffApiState | null {
  return cache;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
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
  return {
    recruiters: o.recruiters,
    screeners: o.screeners,
    pickerExcludedRecruiters: o.pickerExcludedRecruiters,
    pickerExcludedScreeners: o.pickerExcludedScreeners,
  };
}

/** โหลดรายชื่อสรรหา/คัดสรรจาก API (โหมดไม่สาธิต) แล้วอัปเดตแคช + แจ้ง UI */
export async function refreshJobStaffFromApi(): Promise<void> {
  if (isDemoMode()) return;
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

type MutateOp =
  | { op: 'add'; role: 'recruiter' | 'screener'; name: string }
  | { op: 'remove'; role: 'recruiter' | 'screener'; name: string }
  | { op: 'rename'; role: 'recruiter' | 'screener'; oldName: string; newName: string };

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
