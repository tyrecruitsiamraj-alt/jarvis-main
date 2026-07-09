import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import type { JobRequest } from '@/types';

export type DemoAwareJobsResult = {
  jobs: JobRequest[];
  loading: boolean;
  refreshing: boolean;
  refetch: () => Promise<void>;
};

/** @deprecated use useUnitRequestsFeed */
export function useDemoAwareJobs(): DemoAwareJobsResult {
  const { jobs, loading, refetch, refreshing } = useUnitRequestsFeed();
  return { jobs, loading, refetch, refreshing };
}
