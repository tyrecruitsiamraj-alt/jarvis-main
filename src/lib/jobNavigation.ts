import type { NavigateFunction } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { isSiamrajJob, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';

export function navigateToUnitRequest(job: JobRequest, navigate: NavigateFunction): void {
  const externalId = siamrajExternalId(job);
  if (isSiamrajJob(job) && externalId) {
    navigate(`/jobs/siamraj/${externalId}`);
    return;
  }
  navigate(`/jobs/${job.id}`);
}
