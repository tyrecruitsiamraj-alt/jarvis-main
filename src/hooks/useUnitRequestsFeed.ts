import { useEffect, useState } from 'react';
import { DEMO_JOBS_CHANGED_EVENT, getJobs } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import { mergeJobSources } from '@/lib/mergeJobs';
import { apiFetch } from '@/lib/apiFetch';
import { fetchSiamrajFeedMeta, fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import type { JobRequest } from '@/types';

function readMergedDemoJobs(): JobRequest[] {
  return mergeJobSources([], getJobs());
}

export function useUnitRequestsFeed(): {
  jobs: JobRequest[];
  loading: boolean;
  siamrajPrimary: boolean;
  readOnly: boolean;
} {
  const [jobs, setJobs] = useState<JobRequest[]>(() => (isDemoMode() ? readMergedDemoJobs() : []));
  const [loading, setLoading] = useState(!isDemoMode());
  const [siamrajPrimary, setSiamrajPrimary] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      const load = () => setJobs(readMergedDemoJobs());
      load();
      setLoading(false);
      setSiamrajPrimary(false);
      setReadOnly(false);
      window.addEventListener(DEMO_JOBS_CHANGED_EVENT, load);
      return () => window.removeEventListener(DEMO_JOBS_CHANGED_EVENT, load);
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const meta = await fetchSiamrajFeedMeta();
        if (cancelled) return;

        if (meta.enabled) {
          setSiamrajPrimary(true);
          setReadOnly(meta.readOnly);
          const siamrajJobs = await fetchSiamrajUnitRequests(500);
          if (!cancelled) setJobs(siamrajJobs);
          return;
        }

        setSiamrajPrimary(false);
        setReadOnly(false);
        const r = await apiFetch('/api/jobs?limit=500');
        const data = r.ok ? ((await r.json()) as JobRequest[]) : [];
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { jobs, loading, siamrajPrimary, readOnly };
}

/** @deprecated use useUnitRequestsFeed */
export function useDemoAwareJobs() {
  const { jobs, loading } = useUnitRequestsFeed();
  return { jobs, loading };
}
