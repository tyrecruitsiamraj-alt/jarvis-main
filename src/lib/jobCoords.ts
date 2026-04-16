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
  if (raw && typeof raw === 'object' && Array.isArray((raw as { jobs?: unknown }).jobs)) {
    return (raw as { jobs: JobRequest[] }).jobs;
  }
  return [];
}
