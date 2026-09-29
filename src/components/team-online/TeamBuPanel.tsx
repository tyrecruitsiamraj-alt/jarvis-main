/**
 * แผง "BU ไหนงานเยอะ แล้วได้ผลแค่ไหน" ของหน้าทีม Online — **แสดงทุก BU เสมอ** (ไม่ตามตัวกรอง) ตามภาพต้นแบบ
 * รอบ 2 (เจ้าของสั่ง 29 ก.ย. 2569): คนใช้งานเป็น % ของบัญชีใน BU · ใบขอเข้าเป็นอัตรา
 * แท่ง = คนใช้งาน (%) · อัตราที่ขอเข้า (เทียบ BU ที่มากสุด) · Success ประกาศ (%)
 * กดชื่อ BU = ตั้งตัวกรอง BU ของทั้งหน้า · แถว "ไม่ระบุ BU" กดไม่ได้ (กรองไม่ได้จริง)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtPct } from '@/lib/teamOnline';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

export type TeamBuPanelRow = {
  bu: string;
  label: string;
  /** 0–1 · null = ยังไม่มีบัญชี */
  usersPct: number | null;
  /** อัตราที่ขอเข้าช่วงนี้ · null = อ่าน ERP ไม่ได้ */
  positionsIn: number | null;
  /** 0–1 · null = ยังไม่มีใบที่ Gen link ในช่วงนี้ */
  postSuccess: number | null;
};

function Bar({ pct, dot }: { pct: number; dot: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full', dot)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const TeamBuPanel: React.FC<{
  rows: ReadonlyArray<TeamBuPanelRow> | null;
  selected: string | null;
  onSelect: ((bu: string | null) => void) | null;
  loading?: boolean;
  error?: string | null;
}> = ({ rows, selected, onSelect, loading = false, error }) => {
  const maxIn = Math.max(1, ...(rows ?? []).map((r) => r.positionsIn ?? 0));
  return (
    <Card className="flex min-w-0 flex-col gap-3 rounded-2xl p-4">
      <div>
        <p className="text-sm font-medium text-foreground">BU ไหนงานเยอะ แล้วได้ผลแค่ไหน</p>
        <p className={cn('text-xs', DASH.muted)}>แสดงทุก BU เสมอ · กดชื่อเพื่อดูรายละเอียด</p>
      </div>
      <div className={cn('grid grid-cols-7 gap-3 text-xs', DASH.muted)}>
        <span className="col-span-1">BU</span>
        <span className="col-span-2">คนใช้งาน (%)</span>
        <span className="col-span-2">อัตราที่ขอเข้า</span>
        <span className="col-span-2">Success ประกาศ (%)</span>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : error || !rows ? (
        <p className={cn('text-xs', TONE.danger.value)}>{error ?? 'อ่านข้อมูลต่อ BU ไม่ได้'}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const active = selected === r.bu;
            return (
              <div key={r.bu || 'unknown'} className="grid grid-cols-7 items-center gap-3">
                <div className="col-span-1 min-w-0">
                  {r.bu && onSelect ? (
                    <Button
                      type="button"
                      size="xs"
                      variant={active ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      title={r.label}
                      aria-pressed={active}
                      onClick={() => onSelect(active ? null : r.bu)}
                    >
                      {r.bu}
                    </Button>
                  ) : (
                    <span className={cn('block truncate px-2 text-xs', DASH.muted)} title={r.label}>
                      {r.bu || r.label}
                    </span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Bar pct={(r.usersPct ?? 0) * 100} dot={TONE.primary.dot} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground">{fmtPct(r.usersPct)}</span>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Bar pct={((r.positionsIn ?? 0) / maxIn) * 100} dot={TONE.info.dot} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground">
                    {r.positionsIn === null ? '—' : NUM.format(r.positionsIn)}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Bar pct={(r.postSuccess ?? 0) * 100} dot={TONE.success.dot} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground">{fmtPct(r.postSuccess)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default TeamBuPanel;
