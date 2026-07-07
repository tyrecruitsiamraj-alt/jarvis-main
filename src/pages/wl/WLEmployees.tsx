import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import type { Candidate, Employee, EmployeeStatus } from '@/types';
import SearchField from '@/components/shared/SearchField';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { combineWlEmployeeList } from '@/lib/wlEmployeeList';
import { readJsonSafe } from '@/lib/api';
import { apiFetch } from '@/lib/apiFetch';
import WlBuSelector from '@/components/wl/WlBuSelector';
import { useWlBu } from '@/hooks/useWlBu';
import { countEmployeesByBu, filterEmployeesByBu } from '@/lib/wlBuFilters';

const statusFilters: { value: EmployeeStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ไม่ใช้งาน' },
  { value: 'suspended', label: 'ระงับ' },
];

const WLEmployees: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<EmployeeStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const { selectedBu, setSelectedBu, buLabel } = useWlBu();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([apiFetch('/api/employees?limit=500'), apiFetch('/api/candidates?limit=500')])
      .then(async ([er, cr]) => {
        const eData = er.ok ? await readJsonSafe<Employee[]>(er) : [];
        const cData = cr.ok ? ((await cr.json()) as Candidate[]) : [];
        if (cancelled) return;
        const cand = mergeCandidateSources(Array.isArray(cData) ? cData : []);
        setEmployees(combineWlEmployeeList(Array.isArray(eData) ? eData : [], cand));
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setEmployees([]);
        setError('โหลดรายชื่อพนักงานไม่สำเร็จ — ลองใหม่อีกครั้ง');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const buCounts = useMemo(() => countEmployeesByBu(employees), [employees]);

  const filtered = useMemo(() => {
    return filterEmployeesByBu(employees, selectedBu)
      .filter((e) => filter === 'all' || e.status === filter)
      .filter((e) =>
        `${e.first_name} ${e.last_name} ${e.employee_code} ${e.position}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
  }, [employees, selectedBu, filter, search]);

  return (
    <div>
      <PageHeader
        title="พนักงาน WL"
        subtitle={`${buLabel} · ${filtered.length} คน`}
        backPath="/wl"
        actions={
          hasPermission('supervisor') ? (
            <button
              onClick={() => navigate('/wl/employees/add')}
              className="flex items-center gap-1 px-3 py-2 jarvis-pill-btn text-sm"
            >
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {loading && <div className="text-sm text-muted-foreground">กำลังโหลดพนักงาน...</div>}
        {error && <div className="text-sm text-destructive">เกิดข้อผิดพลาด: {error}</div>}

        <WlBuSelector
          selected={selectedBu}
          onChange={setSelectedBu}
          counts={buCounts}
          variant="pills"
        />

        <div className="flex flex-col md:flex-row gap-3">
          <SearchField
            type="text"
            placeholder="ค้นหาพนักงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

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
                className="w-full glass-card rounded-[1.5rem] p-4 border border-white/70 text-left hover:border-blue-300/50 transition-all"
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
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">BU</th>
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
                    <td className="px-4 py-3 text-xs text-muted-foreground">{emp.department_code || '—'}</td>
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
