import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { JobRequest } from '@/types';

export type SiamrajFeedMeta = {
  enabled: boolean;
  schema: string | null;
  readOnly: boolean;
  mode: string;
};

export async function fetchSiamrajFeedMeta(): Promise<SiamrajFeedMeta> {
  const r = await apiFetch('/api/siamraj/unit-requests?meta=1');
  if (!r.ok) {
    return { enabled: false, schema: null, readOnly: true, mode: 'staffing_queue' };
  }
  return readJsonSafe<SiamrajFeedMeta>(r);
}

export async function fetchSiamrajUnitRequests(limit = 200): Promise<JobRequest[]> {
  const r = await apiFetch(`/api/siamraj/unit-requests?limit=${limit}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดใบขอจาก Siamraj ไม่สำเร็จ'));
  return readJsonSafe<JobRequest[]>(r);
}

export async function fetchSiamrajUnitRequest(id: string): Promise<JobRequest> {
  const r = await apiFetch(`/api/siamraj/unit-requests?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดรายละเอียดใบขอไม่สำเร็จ'));
  return readJsonSafe<JobRequest>(r);
}

export function isSiamrajJob(job: JobRequest): boolean {
  return job.source === 'siamraj' || job.id.startsWith('siamraj:');
}

export function siamrajExternalId(job: JobRequest): string | null {
  if (job.externalId) return job.externalId;
  if (job.id.startsWith('siamraj:')) return job.id.slice('siamraj:'.length);
  return null;
}
