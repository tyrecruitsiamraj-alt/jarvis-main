import type { NavigateFunction } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { isSiamrajJob, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';

export function unitRequestPath(job: JobRequest): string {
  const externalId = siamrajExternalId(job);
  if (isSiamrajJob(job) && externalId) {
    return `/jobs/siamraj/${externalId}`;
  }
  return `/jobs/${job.id}`;
}

export function navigateToUnitRequest(job: JobRequest, navigate: NavigateFunction): void {
  navigate(unitRequestPath(job));
}
