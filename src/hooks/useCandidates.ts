import { useEffect, useState } from 'react';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { apiFetch } from '@/lib/apiFetch';
import type { Candidate } from '@/types';

export function useCandidates(): {
  candidates: Candidate[];
  loading: boolean;
  loadError: string | null;
} {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
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
          setCandidates(mergeCandidateSources(Array.isArray(data) ? data : []));
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
