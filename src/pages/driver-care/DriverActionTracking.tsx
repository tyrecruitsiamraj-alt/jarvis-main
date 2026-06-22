import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import { fetchDriverActions } from '@/lib/driverCareApi';
import {
  DRIVER_ACTION_STATUS_LABELS,
  DRIVER_ACTION_TYPE_LABELS,
  DRIVER_CARE_RISK_LABELS,
} from '@/types/driverCare';
import { cn } from '@/lib/utils';

const DriverActionTracking: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || '');
  const [riskLevel, setRiskLevel] = useState('');
  const [actionBy, setActionBy] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(params.get('overdueOnly') === '1');

  const filters = useMemo(
    () => ({ status: status || undefined, riskLevel: riskLevel || undefined, actionBy: actionBy || undefined, overdueOnly }),
    [status, riskLevel, actionBy, overdueOnly],
  );

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['driver-care', 'actions', filters],
    queryFn: () => fetchDriverActions(filters),
  });

  return (
    <div>
      <PageHeader title="ติดตาม Action" subtitle="Action Tracking" backPath="/driver-care" />
      <div className="px-4 md:px-6 space-y-4">
        <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="jarvis-soft-field">
            <option value="">ทุกสถานะ</option>
            {Object.entries(DRIVER_ACTION_STATUS_LABELS).filter(([k]) => k !== 'overdue').map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} className="jarvis-soft-field">
            <option value="">ทุกระดับความเสี่ยง</option>
            {Object.entries(DRIVER_CARE_RISK_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="text"
            value={actionBy}
            onChange={(e) => setActionBy(e.target.value)}
            placeholder="ค้นหาผู้ดำเนินการ..."
            className="jarvis-soft-field"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer px-1">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="rounded border-border" />
            เฉพาะเลยกำหนด
          </label>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>}

        <div className="overflow-x-auto glass-card rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-left">คนขับ</th>
                <th className="px-3 py-2 text-left">รหัส</th>
                <th className="px-3 py-2 text-center">ระดับ</th>
                <th className="px-3 py-2 text-left">ผู้ดำเนินการ</th>
                <th className="px-3 py-2 text-left">ประเภท</th>
                <th className="px-3 py-2 text-left">ประเด็น</th>
                <th className="px-3 py-2 text-left min-w-[120px]">สิ่งที่ทำ</th>
                <th className="px-3 py-2 text-center">ผลลัพธ์</th>
                <th className="px-3 py-2 text-center">สถานะ</th>
                <th className="px-3 py-2 text-center">วันที่</th>
                <th className="px-3 py-2 text-center">นัดถัดไป</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">ยังไม่มี Action — บันทึกจากรายชื่อคนขับเสี่ยง</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.actionId} className={cn('border-b border-border/50', row.overdueFlag && 'bg-red-500/5')}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.driverName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.employeeCode}</td>
                    <td className="px-3 py-2 text-center">{DRIVER_CARE_RISK_LABELS[row.riskLevel]} ({row.riskScore})</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.actionByName || '—'}</td>
                    <td className="px-3 py-2">{DRIVER_ACTION_TYPE_LABELS[row.actionType as keyof typeof DRIVER_ACTION_TYPE_LABELS] || row.actionType}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.issueFound}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{row.actionTaken}</td>
                    <td className="px-3 py-2 text-center">{row.result}</td>
                    <td className="px-3 py-2 text-center">{DRIVER_ACTION_STATUS_LABELS[row.status]}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{row.actionDate}</td>
                    <td className={cn('px-3 py-2 text-center whitespace-nowrap', row.overdueFlag && 'text-destructive font-semibold')}>
                      {row.nextFollowUpDate || '—'}
                      {row.overdueFlag ? ' ⚠' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DriverActionTracking;
