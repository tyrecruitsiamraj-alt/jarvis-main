import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { mockEmployees, mockTrainingRecords } from '@/data/mockData';
import { User, BarChart3, Award, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Candidate, Employee, TrainingRecord } from '@/types';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { useWorkCalendarEntries } from '@/lib/workCalendarStore';
import { getCandidates, hydrateCandidateStaffing } from '@/lib/demoStorage';
import { mergeCandidateSources } from '@/lib/mergeCandidates';
import { formatCandidateDisplayName } from '@/lib/formatCandidateName';
import { isWlStaffingTrack, parseWlEmployeeCandidateId } from '@/lib/wlFromCandidate';

const EmployeeProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workCalendar = useWorkCalendarEntries();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [wlCandidate, setWlCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiTrainings, setApiTrainings] = useState<TrainingRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmployee(null);
    setWlCandidate(null);

    const candId = parseWlEmployeeCandidateId(id);

    if (candId) {
      if (isDemoMode()) {
        const list = mergeCandidateSources([], getCandidates());
        const c = list.find((x) => x.id === candId);
        if (!cancelled) {
          if (c && isWlStaffingTrack(c)) {
            setWlCandidate(c);
            setError(null);
          } else {
            setError('ไม่พบผู้สมัครในกลุ่ม WL หรือถูกเปลี่ยนประเภทแล้ว');
          }
          setLoading(false);
        }
        return () => {
          cancelled = true;
        };
      }

      apiFetch(`/api/candidates?id=${encodeURIComponent(candId)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('ไม่พบข้อมูลผู้สมัคร');
          return r.json() as Promise<Candidate>;
        })
        .then((c) => {
          if (cancelled) return;
          const h = hydrateCandidateStaffing(c);
          if (isWlStaffingTrack(h)) {
            setWlCandidate(h);
            setError(null);
          } else {
            setError('ผู้สมัครนี้ไม่ได้อยู่ในกลุ่ม WL');
          }
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (isDemoMode()) {
      const found = mockEmployees.find((e) => e.id === id) ?? null;
      if (!cancelled) {
        setEmployee(found);
        setError(found ? null : 'ไม่พบข้อมูลพนักงาน');
        setLoading(false);
      }
      return () => {
        cancelled = true;
      };
    }

    apiFetch(`/api/employees?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${r.status}`);
        }
        return r.json() as Promise<Employee>;
      })
      .then((data) => {
        if (cancelled) return;
        setEmployee(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || parseWlEmployeeCandidateId(id) || isDemoMode()) {
      setApiTrainings([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/api/training-records?employee_id=${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as TrainingRecord[]) : []))
      .then((data) => {
        if (!cancelled) setApiTrainings(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setApiTrainings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const workHistory = useMemo(() => {
    if (!id || parseWlEmployeeCandidateId(id)) return [];
    return workCalendar.filter((w) => w.employee_id === id);
  }, [id, workCalendar]);

  const trainings =
    id && !parseWlEmployeeCandidateId(id)
      ? isDemoMode()
        ? mockTrainingRecords.filter((t) => t.employee_id === id)
        : apiTrainings
      : [];

  if (loading) return <div className="p-6 text-muted-foreground">กำลังโหลดข้อมูลพนักงาน...</div>;

  if (wlCandidate) {
    return (
      <div>
        <PageHeader
          title={formatCandidateDisplayName(wlCandidate)}
          subtitle="พนักงาน WL (จากผู้สมัคร)"
          backPath="/wl/employees"
        />
        <div className="px-4 md:px-6 space-y-6">
          <div className="glass-card rounded-xl p-4 border border-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center">
                <User className="w-6 h-6 text-info" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-foreground">{formatCandidateDisplayName(wlCandidate)}</div>
                <div className="text-sm text-muted-foreground">{wlCandidate.phone}</div>
                <div className="text-xs text-muted-foreground mt-1">{wlCandidate.address}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-info/15 text-info shrink-0">WL</span>
            </div>
            <p className="text-xs text-muted-foreground">
              รายชื่อนี้มาจากผู้สมัครที่กำหนดประเภทเป็น WL ในหน้า &quot;ผู้สมัครทั้งหมด&quot; ดูประวัติเต็มได้ที่โปรไฟล์ผู้สมัคร
            </p>
            <button
              type="button"
              onClick={() => navigate(`/matching/candidates/${wlCandidate.id}`)}
              className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              <ExternalLink className="w-4 h-4" />
              เปิดโปรไฟล์ผู้สมัคร
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="p-6 text-destructive">{error}</div>;
  if (!employee) return <div className="p-6 text-muted-foreground">ไม่พบข้อมูลพนักงาน</div>;

  const profit = employee.total_income - employee.total_cost;
  const displayNick = employee.nickname ? ` (${employee.nickname})` : '';

  return (
    <div>
      <PageHeader
        title={`${employee.first_name} ${employee.last_name}`}
        subtitle={employee.employee_code}
        backPath="/wl/employees"
      />
      <div className="px-4 md:px-6 space-y-6">
        {/* Info card */}
        <div className="glass-card rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="font-bold text-foreground">
                {employee.first_name} {employee.last_name}
                {displayNick}
              </div>
              <div className="text-sm text-muted-foreground">
                {employee.position} • {employee.phone}
              </div>
            </div>
            <span
              className={cn(
                'ml-auto text-xs px-2 py-0.5 rounded-full',
                employee.status === 'active' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
              )}
            >
              {employee.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">เริ่มงาน: {employee.join_date}</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Reliability"
            value={`${employee.reliability_score}%`}
            icon={Award}
            variant={employee.reliability_score >= 80 ? 'success' : 'warning'}
          />
          <StatCard title="Utilization" value={`${employee.utilization_rate}%`} icon={BarChart3} variant="info" />
          <StatCard title="วันทำงาน" value={employee.total_days_worked} variant="primary" />
          <StatCard
            title="ปัญหา"
            value={employee.total_issues}
            icon={AlertTriangle}
            variant={employee.total_issues > 10 ? 'destructive' : 'default'}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard title="รายได้รวม" value={`฿${employee.total_income.toLocaleString()}`} variant="success" />
          <StatCard title="ต้นทุนรวม" value={`฿${employee.total_cost.toLocaleString()}`} variant="warning" />
          <StatCard
            title="กำไร/ขาดทุน"
            value={`฿${profit.toLocaleString()}`}
            variant={profit >= 0 ? 'success' : 'destructive'}
          />
        </div>

        {/* Work history */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">ประวัติการทำงาน (ล่าสุด)</h3>
          <div className="space-y-2">
            {workHistory.slice(0, 5).map((w) => (
              <div
                key={w.id}
                className="glass-card rounded-lg p-3 border border-border flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{w.work_date}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.client_name || 'ว่าง'} {w.shift && `• ${w.shift}`}
                  </div>
                </div>
                <StatusBadge status={w.status} type="work" />
              </div>
            ))}
          </div>
        </div>

        {/* Training */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">ประวัติการอบรม</h3>
          <div className="space-y-2">
            {trainings.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูลการอบรม</p>
            ) : (
              trainings.map((t) => (
                <div
                  key={t.id}
                  className="glass-card rounded-lg p-3 border border-border flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{t.training_name}</div>
                    <div className="text-xs text-muted-foreground">{t.training_date}</div>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      t.result === 'passed'
                        ? 'bg-success/15 text-success'
                        : t.result === 'failed'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-warning/15 text-warning',
                    )}
                  >
                    {t.result === 'passed' ? 'ผ่าน' : t.result === 'failed' ? 'ไม่ผ่าน' : 'รอผล'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;
