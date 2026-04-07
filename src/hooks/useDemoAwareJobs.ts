import { useEffect, useState } from 'react';
import { DEMO_JOBS_CHANGED_EVENT, getJobs } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import { mergeJobSources } from '@/lib/mergeJobs';
import { apiFetch } from '@/lib/apiFetch';
import type { JobRequest } from '@/types';

function readMergedDemoJobs(): JobRequest[] {
  return mergeJobSources([], getJobs());
}

export function useDemoAwareJobs(): { jobs: JobRequest[]; loading: boolean } {
  const [jobs, setJobs] = useState<JobRequest[]>(() =>
    isDemoMode() ? readMergedDemoJobs() : [],
  );
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      const load = () => setJobs(readMergedDemoJobs());
      load();
      setLoading(false);
      window.addEventListener(DEMO_JOBS_CHANGED_EVENT, load);
      return () => window.removeEventListener(DEMO_JOBS_CHANGED_EVENT, load);
    }
    let cancelled = false;
    apiFetch('/api/jobs?limit=500')
      .then(async (r) => (r.ok ? r.json() : []))
      .then((data: JobRequest[]) => {
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { jobs, loading };
}
