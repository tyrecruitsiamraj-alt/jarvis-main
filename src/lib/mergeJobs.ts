import type { JobRequest } from '@/types';

function sortJobsByCreatedDesc(items: JobRequest[]): JobRequest[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** รายการงานจาก API เท่านั้น */
export function mergeJobSources(apiItems: JobRequest[]): JobRequest[] {
  return sortJobsByCreatedDesc([...apiItems]);
}
