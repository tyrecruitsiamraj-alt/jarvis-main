import type { NavigateFunction } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { isSiamrajJob, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';
import { saveJobListLastUrl, sanitizeUnitReturnTo } from '@/lib/jobUnitSessionState';

export function unitRequestPath(job: JobRequest): string {
  const externalId = siamrajExternalId(job);
  if (isSiamrajJob(job) && externalId) {
    return `/jobs/siamraj/${externalId}`;
  }
  return `/jobs/${job.id}`;
}

export type OpenUnitRequestOptions = {
  returnTo?: string;
  /** เปิดใบขอในแท็บใหม่ของเบราว์เซอร์ */
  openInNewTab?: boolean;
};

/** true เมื่อกด Ctrl/Cmd หรือปุ่มกลางเมาส์ — เปิดแท็บใหม่ */
export function shouldOpenInNewTabFromEvent(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  button: number;
  altKey?: boolean;
}): boolean {
  return e.metaKey || e.ctrlKey || e.button === 1 || Boolean(e.altKey);
}

export function navigateToUnitRequest(
  job: JobRequest,
  navigate: NavigateFunction,
  options?: OpenUnitRequestOptions,
): void {
  const path = unitRequestPath(job);
  const returnTo = sanitizeUnitReturnTo(options?.returnTo);

  if (returnTo?.startsWith('/jobs/list')) {
    saveJobListLastUrl(returnTo);
  }

  if (options?.openInNewTab) {
    const url = new URL(path, window.location.origin);
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
    return;
  }

  navigate(path, returnTo ? { state: { returnTo } } : undefined);
}
