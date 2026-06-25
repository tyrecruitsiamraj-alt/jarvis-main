import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';

/** @deprecated use useUnitRequestsFeed */
export function useDemoAwareJobs() {
  const { jobs, loading } = useUnitRequestsFeed();
  return { jobs, loading };
}
