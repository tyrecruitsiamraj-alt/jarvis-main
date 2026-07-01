import { useEffect, useState } from 'react';
import { DEMO_CANDIDATES_CHANGED_EVENT, getCandidates } from '@/lib/demoStorage';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import type { Candidate } from '@/types';

export function useDemoAwareCandidates(): {
  candidates: Candidate[];
  loading: boolean;
  loadError: string | null;
} {
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    isDemoMode() ? mergeCandidateSources([], getCandidates()) : [],
  );
  const [loading, setLoading] = useState(!isDemoMode());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode()) {
      const load = () => setCandidates(mergeCandidateSources([], getCandidates()));
      load();
      setLoading(false);
      setLoadError(null);
      window.addEventListener(DEMO_CANDIDATES_CHANGED_EVENT, load);
      return () => window.removeEventListener(DEMO_CANDIDATES_CHANGED_EVENT, load);
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiFetch('/api/candidates?limit=500')
      .then(async (r) => {
        if (!r.ok) throw new Error('โหลดรายชื่อผู้สมัครไม่สำเร็จ');
        return r.json() as Promise<Candidate[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setCandidates(mergeCandidateSources(Array.isArray(data) ? data : [], []));
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
          setLoadError('โหลดรายชื่อผู้สมัครไม่สำเร็จ — ลองใหม่อีกครั้ง');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { candidates, loading, loadError };
}
