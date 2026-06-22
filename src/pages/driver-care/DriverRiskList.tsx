import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import SearchField from '@/components/shared/SearchField';
import DriverActionDialog from '@/components/driver-care/DriverActionDialog';
import { fetchDriverRiskList, logDriverAction } from '@/lib/driverCareApi';
import type { DriverActionLogInput, DriverRiskListItem } from '@/types/driverCare';
import {
  DRIVER_ACTION_STATUS_LABELS,
  DRIVER_CARE_RISK_LABELS,
} from '@/types/driverCare';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const riskBadge = (level: string) => {
  if (level === 'high') return 'bg-red-500/15 text-red-700';
  if (level === 'medium') return 'bg-amber-500/15 text-amber-800';
  if (level === 'watch') return 'bg-sky-500/15 text-sky-800';
  return 'bg-emerald-500/15 text-emerald-700';
};

const DriverRiskList: React.FC = () => {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState(params.get('riskLevel') || '');
  const [site, setSite] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [dialogDriver, setDialogDriver] = useState<DriverRiskListItem | null>(null);
  const [saving, setSaving] = useState(false);

  const filters = useMemo(
    () => ({ riskLevel: riskLevel || undefined, site: site || undefined, actionStatus: actionStatus || undefined, search: search || undefined }),
    [riskLevel, site, actionStatus, search],
  );

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['driver-care', 'risk-list', filters],
    queryFn: () => fetchDriverRiskList(filters),
  });

  const sites = useMemo(
    () => Array.from(new Set(data.map((d) => d.siteName).filter((s) => s && s !== '—'))).sort(),
    [data],
  );

  const handleSave = async (input: DriverActionLogInput) => {
    setSaving(true);
    try {
      await logDriverAction(input);
      toast.success('บันทึก Action สำเร็จ');
      setDialogDriver(null);
      await queryClient.invalidateQueries({ queryKey: ['driver-care'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="รายชื่อคนขับเสี่ยง" subtitle="Driver Risk List" backPath="/driver-care" />
      <div className="px-4 md:px-6 space-y-4">
        <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchField placeholder="ค้นหาชื่อหรือรหัสพนักงาน..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} className="jarvis-soft-field">
            <option value="">ทุกระดับความเสี่ยง</option>
            {Object.entries(DRIVER_CARE_RISK_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={site} onChange={(e) => setSite(e.target.value)} className="jarvis-soft-field">
            <option value="">ทุกไซต์</option>
            {sites.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)} className="jarvis-soft-field">
            <option value="">ทุกสถานะ Action</option>
            {Object.entries(DRIVER_ACTION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>}

        <div className="overflow-x-auto glass-card rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-left">คนขับ</th>
                <th className="px-3 py-2 text-left">รหัส</th>
                <th className="px-3 py-2 text-left">ไซต์</th>
                <th className="px-3 py-2 text-center">คะแนน</th>
                <th className="px-3 py-2 text-center">ระดับ</th>
                <th className="px-3 py-2 text-left min-w-[160px]">เหตุผลหลัก</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-center">สถานะ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">ไม่พบข้อมูล — รัน seed และคำนวณความเสี่ยง</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.riskScoreId} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.driverName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.employeeCode}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row.siteName}</td>
                    <td className="px-3 py-2 text-center font-bold">{row.riskScore}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', riskBadge(row.riskLevel))}>
                        {DRIVER_CARE_RISK_LABELS[row.riskLevel]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.mainReason}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{row.recommendedAction}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(row.overdueFlag && 'text-destructive font-semibold')}>
                        {DRIVER_ACTION_STATUS_LABELS[row.actionStatus as keyof typeof DRIVER_ACTION_STATUS_LABELS] || row.actionStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setDialogDriver(row)} className="px-2 py-1 rounded-lg bg-orange-500/12 text-orange-700 text-[11px] font-medium whitespace-nowrap">
                        บันทึก Action
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DriverActionDialog
        open={!!dialogDriver}
        onOpenChange={(o) => !o && setDialogDriver(null)}
        driver={dialogDriver}
        saving={saving}
        onSubmit={(input) => void handleSave(input)}
      />
    </div>
  );
};

export default DriverRiskList;
