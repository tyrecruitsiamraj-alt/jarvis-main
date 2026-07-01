import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_JOBS_CHANGED_EVENT, getJobs } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import { mergeJobSources } from '@/lib/mergeJobs';
import { apiFetch } from '@/lib/apiFetch';
import { fetchSiamrajFeedMeta, fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import { publishUnitRequestsFeed } from '@/lib/jobFeedBroadcast';
import type { JobRequest } from '@/types';

const SIAMRAJ_POLL_MS = 60_000;

function readMergedDemoJobs(): JobRequest[] {
  return mergeJobSources([], getJobs());
}

async function loadLiveJobs(): Promise<{
  jobs: JobRequest[];
  siamrajPrimary: boolean;
  readOnly: boolean;
  dbSource: 'postgres' | 'sqlserver' | null;
}> {
  const meta = await fetchSiamrajFeedMeta();

  if (meta.enabled) {
    const siamrajJobs = await fetchSiamrajUnitRequests(200);
    return {
      jobs: enrichJobsWithUrgency(siamrajJobs),
      siamrajPrimary: true,
      readOnly: meta.readOnly,
      dbSource: meta.dbSource ?? null,
    };
  }

  const r = await apiFetch('/api/jobs?limit=500', { cache: 'no-store' });
  if (!r.ok) {
    throw new Error(
      r.status === 401
        ? 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่'
        : 'โหลดรายการงานไม่สำเร็จ',
    );
  }
  const data = (await r.json()) as JobRequest[];
  return {
    jobs: Array.isArray(data) ? data : [],
    siamrajPrimary: false,
    readOnly: false,
    dbSource: null,
  };
}

export function useUnitRequestsFeed(): {
  jobs: JobRequest[];
  loading: boolean;
  refreshing: boolean;
  siamrajPrimary: boolean;
  readOnly: boolean;
  dbSource: 'postgres' | 'sqlserver' | null;
  loadError: string | null;
  refetch: () => Promise<void>;
} {
  const [jobs, setJobs] = useState<JobRequest[]>(() => (isDemoMode() ? readMergedDemoJobs() : []));
  const [loading, setLoading] = useState(!isDemoMode());
  const [refreshing, setRefreshing] = useState(false);
  const [siamrajPrimary, setSiamrajPrimary] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [dbSource, setDbSource] = useState<'postgres' | 'sqlserver' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const siamrajPrimaryRef = useRef(false);

  const refetch = useCallback(async () => {
    if (isDemoMode()) {
      setJobs(readMergedDemoJobs());
      setLoadError(null);
      return;
    }

    setRefreshing(true);
    try {
      const result = await loadLiveJobs();
      setJobs(result.jobs);
      setSiamrajPrimary(result.siamrajPrimary);
      setReadOnly(result.readOnly);
      setDbSource(result.dbSource);
      siamrajPrimaryRef.current = result.siamrajPrimary;
      setLoadError(null);
    } catch (e) {
      setJobs([]);
      setLoadError(
        e instanceof Error && e.message
          ? e.message
          : 'โหลดข้อมูลหน่วยงานไม่สำเร็จ — ลองใหม่อีกครั้ง',
      );
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

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

    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (isDemoMode()) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

  useEffect(() => {
    if (isDemoMode()) return;

    const id = window.setInterval(() => {
      if (!siamrajPrimaryRef.current) return;
      void refetch();
    }, SIAMRAJ_POLL_MS);

    return () => window.clearInterval(id);
  }, [refetch]);

  useEffect(() => {
    siamrajPrimaryRef.current = siamrajPrimary;
  }, [siamrajPrimary]);

  useEffect(() => {
    publishUnitRequestsFeed(jobs, loading);
  }, [jobs, loading]);

  return { jobs, loading, refreshing, siamrajPrimary, readOnly, dbSource, loadError, refetch };
}
