import { mockJobRequests } from '@/data/mockData';
import { getJobs } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import type { JobRequest } from '@/types';

function sortJobsByCreatedDesc(items: JobRequest[]): JobRequest[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Production: เฉพาะ API. Demo: mock + localStorage + API (id ซ้ำ → API ชนะ) */
export function mergeJobSources(apiItems: JobRequest[], localItems: JobRequest[]): JobRequest[] {
  const map = new Map<string, JobRequest>();
  if (isDemoMode()) {
    /** mock → API → local: งานที่แก้ใน localStorage (เช่น Admin) ทับสำเนา id เดียวกันจาก API */
    [...mockJobRequests, ...apiItems, ...localItems].forEach((item) => {
      map.set(item.id, item);
    });
  } else {
    apiItems.forEach((item) => {
      map.set(item.id, item);
    });
  }
  return sortJobsByCreatedDesc([...map.values()]);
}

export function getMergedJobsInitial(): JobRequest[] {
  if (!isDemoMode()) return [];
  return mergeJobSources([], getJobs());
}
