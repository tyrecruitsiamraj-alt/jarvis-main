import type { JobRequest } from '@/types';

type FeedListener = (jobs: JobRequest[], meta: { loading: boolean }) => void;

const listeners = new Set<FeedListener>();

export function publishUnitRequestsFeed(jobs: JobRequest[], loading = false): void {
  for (const listener of listeners) {
    listener(jobs, { loading });
  }
}

export function subscribeUnitRequestsFeed(listener: FeedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
