import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import type { Candidate, Employee, EmployeeStatus } from '@/types';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { mockEmployees } from '@/data/mockData';
import { DEMO_CANDIDATES_CHANGED_EVENT, getCandidates, getEmployees } from '@/lib/demoStorage';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { candidateToWlEmployeeRow, isWlStaffingTrack } from '@/lib/wlFromCandidate';
import { readJsonSafe } from '@/lib/api';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';

const statusFilters: { value: EmployeeStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ไม่ใช้งาน' },
  { value: 'suspended', label: 'ระงับ' },
];

const mergeEmployees = (apiItems: Employee[], localItems: Employee[]) => {
  const map = new Map<string, Employee>();
  if (isDemoMode()) {
    [...mockEmployees, ...localItems, ...apiItems].forEach((item) => {
      map.set(item.id, item);
    });
  } else {
    apiItems.forEach((item) => {
      map.set(item.id, item);
    });
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

function combineWlEmployeeList(
  apiEmps: Employee[],
  localEmps: Employee[],
  mergedCandidates: Candidate[],
): Employee[] {
  const base = mergeEmployees(apiEmps, localEmps);
  const wlRows = mergedCandidates.filter(isWlStaffingTrack).map(candidateToWlEmployeeRow);
  return [...base, ...wlRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

const WLEmployees: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<EmployeeStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const [employees, setEmployees] = useState<Employee[]>(() =>
    combineWlEmployeeList([], getEmployees(), mergeCandidateSources([], getCandidates())),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiEmpRef = useRef<Employee[]>([]);
  const apiCandRef = useRef<Candidate[]>([]);

  useEffect(() => {
    if (isDemoMode()) {
      const cand = mergeCandidateSources([], getCandidates());
      setEmployees(combineWlEmployeeList([], getEmployees(), cand));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([apiFetch('/api/employees?limit=500'), apiFetch('/api/candidates?limit=500')])
      .then(async ([er, cr]) => {
        const eData = er.ok ? await readJsonSafe<Employee[]>(er) : [];
        const cData = cr.ok ? ((await cr.json()) as Candidate[]) : [];
        if (cancelled) return;
        apiEmpRef.current = Array.isArray(eData) ? eData : [];
        apiCandRef.current = Array.isArray(cData) ? cData : [];
        const cand = mergeCandidateSources(apiCandRef.current, getCandidates());
        setEmployees(combineWlEmployeeList(apiEmpRef.current, getEmployees(), cand));
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        apiEmpRef.current = [];
        apiCandRef.current = [];
        setEmployees(
          combineWlEmployeeList([], getEmployees(), mergeCandidateSources([], getCandidates())),
        );
        setError(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDemoMode()) return;
    const onCand = () => {
      const cand = mergeCandidateSources([], getCandidates());
      setEmployees(combineWlEmployeeList([], getEmployees(), cand));
    };
    window.addEventListener(DEMO_CANDIDATES_CHANGED_EVENT, onCand);
    return () => window.removeEventListener(DEMO_CANDIDATES_CHANGED_EVENT, onCand);
  }, []);

  const filtered = useMemo(() => {
    return employees
      .filter((e) => filter === 'all' || e.status === filter)
      .filter((e) =>
        `${e.first_name} ${e.last_name} ${e.employee_code} ${e.position}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
  }, [employees, filter, search]);

  return (
    <div>
      <PageHeader
        title="พนักงาน WL"
        subtitle={`${filtered.length} คน`}
        backPath="/wl"
        actions={
          hasPermission('supervisor') ? (
            <button
              onClick={() => navigate('/wl/employees/add')}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดพนักงาน...</div>}
        {error && <div className="text-sm text-destructive">เกิดข้อผิดพลาด: {error}</div>}

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาพนักงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isMobile ? (
          <div className="space-y-2">
            {filtered.map((emp) => (
              <button
                key={emp.id}
                onClick={() => navigate(`/wl/employees/${emp.id}`)}
                className="w-full glass-card rounded-xl p-4 border border-border text-left hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    {emp.first_name} {emp.last_name}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      emp.status === 'active'
                        ? 'bg-success/15 text-success'
                        : emp.status === 'suspended'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {emp.status === 'active'
                      ? 'ใช้งาน'
                      : emp.status === 'suspended'
                        ? 'ระงับ'
                        : 'ไม่ใช้งาน'}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  {emp.employee_code} • {emp.position}
                </div>

                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-primary">Reliability: {emp.reliability_score}%</span>
                  <span className="text-muted-foreground">Util: {emp.utilization_rate}%</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">รหัส</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ชื่อ-สกุล</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">ตำแหน่ง</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">Reliability</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">Utilization</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => navigate(`/wl/employees/${emp.id}`)}
                    className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.employee_code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.position}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'font-semibold',
                          emp.reliability_score >= 80
                            ? 'text-success'
                            : emp.reliability_score >= 60
                              ? 'text-warning'
                              : 'text-destructive',
                        )}
                      >
                        {emp.reliability_score}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-foreground">{emp.utilization_rate}%</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          emp.status === 'active'
                            ? 'bg-success/15 text-success'
                            : emp.status === 'suspended'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {emp.status === 'active'
                          ? 'ใช้งาน'
                          : emp.status === 'suspended'
                            ? 'ระงับ'
                            : 'ไม่ใช้งาน'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WLEmployees;