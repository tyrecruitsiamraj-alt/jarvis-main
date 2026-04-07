import { useEffect, useState } from 'react';
import { DEMO_CANDIDATES_CHANGED_EVENT, getCandidates } from '@/lib/demoStorage';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import type { Candidate } from '@/types';

export function useDemoAwareCandidates(): { candidates: Candidate[]; loading: boolean } {
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    isDemoMode() ? mergeCandidateSources([], getCandidates()) : [],
  );
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      const load = () => setCandidates(mergeCandidateSources([], getCandidates()));
      load();
      setLoading(false);
      window.addEventListener(DEMO_CANDIDATES_CHANGED_EVENT, load);
      return () => window.removeEventListener(DEMO_CANDIDATES_CHANGED_EVENT, load);
    }
    let cancelled = false;
    apiFetch('/api/candidates?limit=500')
      .then(async (r) => (r.ok ? r.json() : []))
      .then((data: Candidate[]) => {
        if (!cancelled) setCandidates(mergeCandidateSources(Array.isArray(data) ? data : [], getCandidates()));
      })
      .catch(() => {
        if (!cancelled) setCandidates(mergeCandidateSources([], getCandidates()));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { candidates, loading };
}
