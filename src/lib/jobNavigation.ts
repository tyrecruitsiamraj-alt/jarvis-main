import type { NavigateFunction } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { isSiamrajJob, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';

export function unitRequestPath(job: JobRequest): string {
  const externalId = siamrajExternalId(job);
  if (isSiamrajJob(job) && externalId) {
    return `/jobs/siamraj/${encodeURIComponent(externalId)}`;
  }
  return `/jobs/${encodeURIComponent(job.id)}`;
}

export function navigateToUnitRequest(
  job: JobRequest,
  navigate: NavigateFunction,
  options?: { returnTo?: string },
): void {
  navigate(unitRequestPath(job), options?.returnTo ? { state: { returnTo: options.returnTo } } : undefined);
}
