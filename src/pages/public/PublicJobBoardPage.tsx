import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import { apiFetch } from '@/lib/apiFetch';
import JobBoardView from '@/components/jobs/JobBoardView';

const PublicJobBoardPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch('/api/public/jobs?limit=200')
      .then(async (r) => {
        if (!r.ok) throw new Error('fail');
        return r.json() as Promise<JobRequest[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? enrichJobsWithUrgency(data) : [];
        setJobs(arr);
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <JobBoardView jobs={jobs} loading={loading} variant="public" />;
};

export default PublicJobBoardPage;
