import { useState, useEffect } from 'react';
import type { Candidate, Employee } from '@/types';
import { getCandidates, getEmployees } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { combineWlEmployeeList } from '@/lib/wlEmployeeList';

export function useWlEmployees() {
  const [employees, setEmployees] = useState<Employee[]>(() =>
    combineWlEmployeeList([], getEmployees(), mergeCandidateSources([], getCandidates())),
  );
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      setEmployees(
        combineWlEmployeeList([], getEmployees(), mergeCandidateSources([], getCandidates())),
      );
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([apiFetch('/api/employees?limit=500'), apiFetch('/api/candidates?limit=500')])
      .then(async ([er, cr]) => {
        const eData = er.ok ? ((await er.json()) as Employee[]) : [];
        const cData = cr.ok ? ((await cr.json()) as Candidate[]) : [];
        if (cancelled) return;
        const cand = mergeCandidateSources(Array.isArray(cData) ? cData : [], getCandidates());
        setEmployees(
          combineWlEmployeeList(Array.isArray(eData) ? eData : [], getEmployees(), cand),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setEmployees(
            combineWlEmployeeList([], getEmployees(), mergeCandidateSources([], getCandidates())),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { employees, loading };
}
