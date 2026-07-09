import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { fetchDriverCareOverview, recalculateDriverCareRisk } from '@/lib/driverCareApi';
import DriverCareScoringGuide from '@/components/driver-care/DriverCareScoringGuide';
import { DRIVER_CARE_RISK_LABELS } from '@/types/driverCare';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, BookOpen, ClipboardList, HeartPulse, ListChecks, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DriverCareOverview: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canRecalculate = hasPermission('supervisor');
  const [recalculating, setRecalculating] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver-care', 'overview'],
    queryFn: fetchDriverCareOverview,
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { recalculated, scoreDate } = await recalculateDriverCareRisk();
      toast.success(`คำนวณความเสี่ยงวันที่ ${scoreDate} แล้ว ${recalculated} คน`);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRecalculating(false);
    }
  };

  const m = data?.metrics;
  const showEmptyScores = data && !data.hasScores;

  return (
    <div>
      <PageHeader
        title="Driver Care"
        subtitle="ระบบเตือนความเสี่ยงคนขับลาออก"
        actions={
          canRecalculate ? (
            <button
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={recalculating}
              className="flex items-center gap-1.5 px-3 py-2 jarvis-pill-btn text-sm disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', recalculating && 'animate-spin')} />
              คำนวณใหม่
            </button>
          ) : undefined
        }
      />
      <div className="px-4 md:px-6 space-y-6">
        {isLoading && (
          <p className="text-sm text-muted-foreground rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
            กำลังโหลดภาพรวม…
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}

        {data && data.needsRecalculation && (
          <p className="text-sm text-amber-800 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {showEmptyScores
              ? 'ยังไม่มีคะแนนความเสี่ยง — หัวหน้างานสามารถกด "คำนวณใหม่" เพื่อสร้างคะแนนวันนี้ (วันที่ธุรกิจ Asia/Bangkok)'
              : `คะแนนล่าสุดวันที่ ${data.scoreDate} — ยังไม่มีคะแนนวันนี้ (${data.businessDate})`}
          </p>
        )}

        {showEmptyScores && !isLoading && (
          <div className="glass-card rounded-[1.5rem] p-6 border border-white/70 text-center space-y-2">
            <p className="font-semibold text-foreground">ยังไม่มีข้อมูลคะแนนความเสี่ยง</p>
            <p className="text-sm text-muted-foreground">
              การอ่าน Dashboard ไม่คำนวณคะแนนอัตโนมัติ — ต้องรันคำนวณแยกต่างหาก
            </p>
            {canRecalculate && (
              <button
                type="button"
                onClick={() => void handleRecalculate()}
                disabled={recalculating}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 jarvis-pill-btn text-sm disabled:opacity-50"
              >
                <RefreshCw className={cn('w-4 h-4', recalculating && 'animate-spin')} />
                คำนวณความเสี่ยงวันนี้
              </button>
            )}
          </div>
        )}

        {m && data.hasScores && (
          <>
            {data.scoreDate && (
              <p className="text-xs text-muted-foreground">
                คะแนนวันที่ {data.scoreDate}
                {data.businessDate !== data.scoreDate ? ` (วันธุรกิจปัจจุบัน ${data.businessDate})` : ''}
              </p>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="คนขับ Active" value={m.activeDrivers} icon={Users} variant="primary" />
              <StatCard title="เสี่ยงสูง" value={m.highRisk} icon={AlertTriangle} variant="destructive" onClick={() => navigate('/driver-care/risk-list?riskLevel=high')} />
              <StatCard title="เสี่ยงกลาง" value={m.mediumRisk} icon={AlertTriangle} variant="warning" onClick={() => navigate('/driver-care/risk-list?riskLevel=medium')} />
              <StatCard title="เฝ้าระวัง" value={m.watchRisk} icon={HeartPulse} variant="info" onClick={() => navigate('/driver-care/risk-list?riskLevel=watch')} />
              <StatCard title="ปกติ" value={m.lowRisk} icon={HeartPulse} variant="success" onClick={() => navigate('/driver-care/risk-list?riskLevel=low')} />
              <StatCard title="รอดำเนินการ" value={m.pendingAction} icon={ClipboardList} variant="default" onClick={() => navigate('/driver-care/actions?status=pending')} />
              <StatCard title="กำลังติดตาม" value={m.inProgressAction} icon={ListChecks} variant="primary" onClick={() => navigate('/driver-care/actions?status=in_progress')} />
              <StatCard title="เลยกำหนด" value={m.overdueAction} icon={AlertTriangle} variant="destructive" onClick={() => navigate('/driver-care/actions?overdueOnly=1')} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => navigate('/driver-care/risk-list')} className="flex-1 jarvis-menu-card rounded-[1.5rem] p-4 border border-white/70 text-left">
                <div className="font-semibold text-foreground">รายชื่อคนขับเสี่ยง</div>
                <div className="text-xs text-muted-foreground mt-1">ดูคะแนนความเสี่ยงและบันทึก Action</div>
              </button>
              <button type="button" onClick={() => navigate('/driver-care/actions')} className="flex-1 jarvis-menu-card rounded-[1.5rem] p-4 border border-white/70 text-left">
                <div className="font-semibold text-foreground">ติดตาม Action</div>
                <div className="text-xs text-muted-foreground mt-1">ประวัติการติดตามและสถานะเคส</div>
              </button>
              <button type="button" onClick={() => navigate('/driver-care/resources')} className="flex-1 jarvis-menu-card rounded-[1.5rem] p-4 border border-white/70 text-left">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Skills & Knowledge
                </div>
                <div className="text-xs text-muted-foreground mt-1">จัดการทักษะและความรู้ Driver Care</div>
              </button>
            </div>

            <DriverCareScoringGuide />

            <div className="grid md:grid-cols-2 gap-4">
              <section className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                <h3 className="text-sm font-semibold mb-3">ความเสี่ยงตามระดับ</h3>
                <div className="space-y-2">
                  {data.riskByLevel.map((r) => (
                    <div key={r.level} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{DRIVER_CARE_RISK_LABELS[r.level as keyof typeof DRIVER_CARE_RISK_LABELS]}</span>
                      <span className="font-semibold">{r.count}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                <h3 className="text-sm font-semibold mb-3">สถานะ Action</h3>
                <div className="space-y-2">
                  {data.actionStatus.map((a) => (
                    <div key={a.status} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{a.status}</span>
                      <span className="font-semibold">{a.count}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                <h3 className="text-sm font-semibold mb-3">Top Risk Sites</h3>
                <div className="space-y-2">
                  {data.topSites.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
                  ) : (
                    data.topSites.map((s) => (
                      <div key={s.siteName} className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground truncate">{s.siteName}</span>
                        <span className="font-semibold shrink-0">{s.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                <h3 className="text-sm font-semibold mb-3">Top Risk Reasons</h3>
                <div className="space-y-2">
                  {data.topReasons.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
                  ) : (
                    data.topReasons.map((r) => (
                      <div key={r.reason} className="text-sm">
                        <div className="text-muted-foreground line-clamp-2">{r.reason}</div>
                        <div className="font-semibold text-right">{r.count}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DriverCareOverview;
