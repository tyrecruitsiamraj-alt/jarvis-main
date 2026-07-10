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
  if (options?.openInNewTab) {
    const url = `${window.location.origin}${path}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  navigate(path, options?.returnTo ? { state: { returnTo: options.returnTo } } : undefined);
}
