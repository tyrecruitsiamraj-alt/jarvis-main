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

/** บันทึกผู้รับผิดชอบ (สรรหา/คัดสรร) ของใบขอ Siamraj — เก็บใน PostgreSQL ฝั่ง Jarvis */
export async function saveSiamrajUnitAssignment(
  requestNo: string,
  payload: { recruiter_name?: string | null; screener_name?: string | null },
): Promise<void> {
  const r = await apiFetch('/api/siamraj/unit-assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_no: requestNo, ...payload }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'บันทึกผู้รับผิดชอบไม่สำเร็จ'));
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
