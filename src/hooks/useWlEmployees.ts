import { useState, useEffect } from 'react';
import type { Candidate, Employee } from '@/types';
import { apiFetch } from '@/lib/apiFetch';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { combineWlEmployeeList } from '@/lib/wlEmployeeList';

export function useWlEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([apiFetch('/api/employees?limit=500'), apiFetch('/api/candidates?limit=500')])
      .then(async ([er, cr]) => {
        if (!er.ok || !cr.ok) {
          throw new Error('โหลดรายชื่อพนักงานไม่สำเร็จ');
        }
        const eData = (await er.json()) as Employee[];
        const cData = (await cr.json()) as Candidate[];
        if (cancelled) return;
        const cand = mergeCandidateSources(Array.isArray(cData) ? cData : []);
        setEmployees(combineWlEmployeeList(Array.isArray(eData) ? eData : [], cand));
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setEmployees([]);
          setLoadError('โหลดรายชื่อพนักงานไม่สำเร็จ — ลองใหม่อีกครั้ง');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { employees, loading, loadError };
}
