import { useState, useEffect } from 'react';
import type { Employee } from '@/types';
import { mockEmployees } from '@/data/mockData';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';

export function useWlEmployees() {
  const [employees, setEmployees] = useState<Employee[]>(() => (isDemoMode() ? mockEmployees : []));
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      setEmployees(mockEmployees);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch('/api/employees?limit=500')
      .then(async (r) => (r.ok ? ((await r.json()) as Employee[]) : []))
      .then((data) => {
        if (!cancelled) setEmployees(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
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
