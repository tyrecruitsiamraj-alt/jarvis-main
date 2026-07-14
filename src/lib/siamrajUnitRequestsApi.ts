import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { JobRequest } from '@/types';

export type SiamrajFeedMeta = {
  enabled: boolean;
  dbSource?: 'postgres' | 'sqlserver' | null;
  schema: string | null;
  sqlServer?: { host: string; database: string } | null;
  readOnly: boolean;
  mode: string;
};

export async function fetchSiamrajFeedMeta(): Promise<SiamrajFeedMeta> {
  const r = await apiFetch('/api/siamraj/unit-requests?meta=1', { cache: 'no-store' });
  if (!r.ok) {
    return { enabled: false, schema: null, readOnly: true, mode: 'staffing_queue' };
  }
  return readJsonSafe<SiamrajFeedMeta>(r);
}

export async function fetchSiamrajUnitRequests(limit = 200): Promise<JobRequest[]> {
  const r = await apiFetch(`/api/siamraj/unit-requests?limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดใบขอจาก Siamraj ไม่สำเร็จ'));
  return readJsonSafe<JobRequest[]>(r);
}

export async function fetchSiamrajUnitRequest(id: string): Promise<JobRequest> {
  const r = await apiFetch(`/api/siamraj/unit-requests?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดรายละเอียดใบขอไม่สำเร็จ'));
  return readJsonSafe<JobRequest>(r);
}

export type SiamrajThroughputRecord = {
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
  kind?: 'filled' | 'cancelled' | 'remaining';
};

export async function fetchSiamrajThroughput(from: string, to: string): Promise<SiamrajThroughputRecord[]> {
  const params = new URLSearchParams({ throughput: '1', from, to });
  const r = await apiFetch(`/api/siamraj/unit-requests?${params}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดสถิติขอ/ปิดไม่สำเร็จ'));
  const data = await readJsonSafe<SiamrajThroughputRecord[]>(r);
  return Array.isArray(data) ? data : [];
}

/** รายการใบขอที่ปิด/แจ้งเข้าในช่วง — สำหรับ drill-down การ์ด "ปิดใบขอ" (position_units = จำนวนที่ปิด) */
export async function fetchSiamrajClosedRequests(from: string, to: string): Promise<JobRequest[]> {
  const params = new URLSearchParams({ closed: '1', from, to });
  const r = await apiFetch(`/api/siamraj/unit-requests?${params}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดรายการใบขอที่ปิดไม่สำเร็จ'));
  const data = await readJsonSafe<JobRequest[]>(r);
  return Array.isArray(data) ? data : [];
}

/** บันทึกผู้รับผิดชอบ (สรรหา/คัดสรร) ของใบขอ Siamraj — เก็บใน PostgreSQL ฝั่ง Jarvis */
export async function saveSiamrajUnitAssignment(
  requestNo: string,
  payload: { recruiter_name?: string | null; screener_name?: string | null; opl_name?: string | null },
): Promise<void> {
  const r = await apiFetch('/api/siamraj/unit-assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกผู้รับผิดชอบไม่สำเร็จ'));
}

export async function fetchUnitNoteHistory(limit = 50): Promise<string[]> {
  const r = await apiFetch(`/api/siamraj/unit-notes?history=1&limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await readJsonSafe<{ items?: string[] }>(r);
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveUnitRequestNote(requestNo: string, note: string): Promise<void> {
  await saveUnitRequestMeta(requestNo, { note: note.trim() || null });
}

export async function saveUnitRequestMeta(
  requestNo: string,
  payload: { note?: string | null; send_replacement?: boolean | null },
): Promise<void> {
  const r = await apiFetch('/api/siamraj/unit-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกข้อมูลใบขอไม่สำเร็จ'));
}

export type UnitWorkStatusPersonPayload = {
  first_name: string;
  last_name: string;
  status_date?: string | null;
};

export type UnitWorkStatusPayload = {
  status: string;
  persons?: UnitWorkStatusPersonPayload[];
  person_first_name?: string | null;
  person_last_name?: string | null;
  status_date?: string | null;
};

export type UnitWorkStatusRecord = UnitWorkStatusPayload & {
  request_no: string;
  persons?: UnitWorkStatusPersonPayload[];
  updated_at: string | null;
};

export async function saveUnitRequestWorkStatus(
  requestNo: string,
  payload: UnitWorkStatusPayload,
): Promise<UnitWorkStatusRecord> {
  const r = await apiFetch('/api/siamraj/unit-work-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกสถานะทำงานไม่สำเร็จ'));
  return readJsonSafe<UnitWorkStatusRecord>(r);
}

export function unitRequestNoteKey(job: JobRequest): string {
  return (job.externalId || job.request_no || job.id).trim();
}

export function isSiamrajJob(job: JobRequest): boolean {
  return job.source === 'siamraj' || job.id.startsWith('siamraj:') || job.id.startsWith('siamraj-sql:');
}

export function siamrajExternalId(job: JobRequest): string | null {
  if (job.externalId) return job.externalId;
  if (job.id.startsWith('siamraj-sql:')) return job.id.slice('siamraj-sql:'.length);
  if (job.id.startsWith('siamraj:')) return job.id.slice('siamraj:'.length);
  return null;
}
