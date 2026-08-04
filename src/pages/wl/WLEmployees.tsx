import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import type { Candidate, Employee, EmployeeStatus } from '@/types';
import SearchField from '@/components/shared/SearchField';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WL_BU_CODES, WL_BU_UNASSIGNED, type WlBuCode } from '@/lib/wlBuState';
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
  /** id ที่กำลังบันทึก BU อยู่ — กันกดรัวและบอกผู้ใช้ว่ากำลังบันทึก */
  const [buSavingId, setBuSavingId] = useState<string | null>(null);
  const [buSaveError, setBuSaveError] = useState<string | null>(null);
  const canEditBu = hasPermission('supervisor');

  /** ตั้งรหัส BU ให้พนักงาน — พนักงานที่ไม่มีรหัสจะไม่ถูกกรองตาม BU ที่ไหนเลย ต้องเติมให้ครบ */
  const assignBu = async (emp: Employee, bu: WlBuCode) => {
    if (!canEditBu || buSavingId) return;
    setBuSavingId(emp.id);
    setBuSaveError(null);
    try {
      // PATCH /api/employees อ่าน id จาก body (ไม่ใช่ query string)
      const r = await apiFetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, department_code: bu }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string; detail?: string };
        throw new Error(body.message || body.detail || `บันทึกไม่สำเร็จ (HTTP ${r.status})`);
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, department_code: bu } : e)),
      );
    } catch (e) {
      setBuSaveError(e instanceof Error ? e.message : 'บันทึก BU ไม่สำเร็จ');
    } finally {
      setBuSavingId(null);
    }
  };

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
          showUnassigned
        />

        {selectedBu === WL_BU_UNASSIGNED ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
            {canEditBu
              ? 'คนกลุ่มนี้ยังไม่มีรหัส BU — กด LBD หรือ LBA ในคอลัมน์ BU เพื่อตั้งค่า จนกว่าจะตั้งครบ ระบบจะยังให้ทุกแผนกเห็นคนกลุ่มนี้'
              : 'คนกลุ่มนี้ยังไม่มีรหัส BU — ให้หัวหน้างานตั้งค่าให้ จนกว่าจะตั้งครบ ระบบจะยังให้ทุกแผนกเห็นคนกลุ่มนี้'}
          </p>
        ) : null}
        {buSaveError ? <p className="text-xs text-destructive">{buSaveError}</p> : null}

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
              // การ์ดเป็น div (ไม่ใช่ button) เพราะมีปุ่มตั้ง BU ซ้อนอยู่ข้างใน — ปุ่มซ้อนปุ่มกดไม่ติดบนมือถือ
              <div
                key={emp.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/wl/employees/${emp.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/wl/employees/${emp.id}`);
                  }
                }}
                className="w-full glass-card rounded-[1.5rem] p-4 border border-white/70 text-left cursor-pointer hover:border-blue-300/50 transition-all"
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
                  {emp.department_code ? ` • ${emp.department_code}` : ''}
                </div>
                {!emp.department_code && canEditBu ? (
                  <div
                    className="mt-2 flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <span className="text-[11px] text-amber-800">ตั้ง BU:</span>
                    {WL_BU_CODES.map((bu) => (
                      <button
                        key={bu}
                        type="button"
                        disabled={buSavingId === emp.id}
                        onClick={() => void assignBu(emp, bu)}
                        className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        {buSavingId === emp.id ? '…' : bu}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-primary">Reliability: {emp.reliability_score}%</span>
                  <span className="text-muted-foreground">Util: {emp.utilization_rate}%</span>
                </div>
              </div>
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
                    {/* BU: ตั้งค่าได้ตรงนี้เลย (หัวหน้างานขึ้นไป) — คลิกไม่ทะลุไปหน้าโปรไฟล์ */}
                    <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                      {emp.department_code ? (
                        <span className="jarvis-chip-violet">{emp.department_code}</span>
                      ) : canEditBu ? (
                        <span className="inline-flex items-center gap-1">
                          {WL_BU_CODES.map((bu) => (
                            <button
                              key={bu}
                              type="button"
                              disabled={buSavingId === emp.id}
                              onClick={() => void assignBu(emp, bu)}
                              className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                            >
                              {buSavingId === emp.id ? '…' : bu}
                            </button>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
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
