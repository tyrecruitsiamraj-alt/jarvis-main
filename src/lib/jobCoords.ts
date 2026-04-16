import type { JobRequest } from '@/types';

/** DB / JSON may send lat/lng as strings — parse before distance math */
export function jobLatLng(job: JobRequest): { lat: number; lng: number } | null {
  const lat = typeof job.lat === 'number' ? job.lat : Number(job.lat);
  const lng = typeof job.lng === 'number' ? job.lng : Number(job.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function parseJobsPayload(raw: unknown): JobRequest[] {
  if (Array.isArray(raw)) return raw as JobRequest[];
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  for (const k of ['jobs', 'data', 'items', 'results'] as const) {
    const v = o[k];
    if (Array.isArray(v)) return v as JobRequest[];
  }
  return [];
}

/** Merge mock/local jobs with API list (same id: API wins). Pre-Check never runs on an empty pool. */
export function mergeJobsForPrecheck(apiJobs: JobRequest[], localJobs: JobRequest[]): JobRequest[] {
  const map = new Map<string, JobRequest>();
  for (const j of localJobs) {
    if (j?.id) map.set(j.id, j);
  }
  for (const j of apiJobs) {
    if (j?.id) map.set(j.id, j);
  }
  return [...map.values()];
}
