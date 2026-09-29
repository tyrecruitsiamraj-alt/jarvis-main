/**
 * แผง "BU ไหนงานเยอะ แล้วได้ผลแค่ไหน" ของหน้าทีม Online — **แสดงทุก BU เสมอ** (ไม่ตามตัวกรอง) ตามภาพต้นแบบ
 * แท่งซ้าย = ใบขอเข้าช่วงนี้ (ใบ · เทียบกับ BU ที่มากสุด) · แท่งขวา = Success ประกาศ (%)
 * กดชื่อ BU = ตั้งตัวกรอง BU ของทั้งหน้า · แถว "ไม่ระบุ BU" กดไม่ได้ (กรองไม่ได้จริง)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtPct, ratio, type TeamBuRow } from '@/lib/teamOnline';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

function Bar({ pct, dot }: { pct: number; dot: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full', dot)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const TeamBuPanel: React.FC<{
  rows: ReadonlyArray<TeamBuRow> | null;
  selected: string | null;
  onSelect: ((bu: string | null) => void) | null;
  loading?: boolean;
  error?: string | null;
}> = ({ rows, selected, onSelect, loading = false, error }) => {
  const maxIn = Math.max(1, ...(rows ?? []).map((r) => r.requestsIn ?? 0));
  return (
    <Card className="flex min-w-0 flex-col gap-3 rounded-2xl p-4">
      <div>
        <p className="text-sm font-medium text-foreground">BU ไหนงานเยอะ แล้วได้ผลแค่ไหน</p>
        <p className={cn('text-xs', DASH.muted)}>แสดงทุก BU เสมอ · กดชื่อเพื่อดูรายละเอียด</p>
      </div>
      <div className={cn('grid grid-cols-5 gap-3 text-xs', DASH.muted)}>
        <span className="col-span-1">BU</span>
        <span className="col-span-2">ใบขอเข้า (ใบ)</span>
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
            const rate = ratio(r.withApplicants, r.published);
            const active = selected === r.bu;
            return (
              <div key={r.bu || 'unknown'} className="grid grid-cols-5 items-center gap-3">
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
                  <Bar pct={((r.requestsIn ?? 0) / maxIn) * 100} dot={TONE.primary.dot} />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground">
                    {r.requestsIn === null ? '—' : NUM.format(r.requestsIn)}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Bar pct={(rate ?? 0) * 100} dot={TONE.success.dot} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground">{fmtPct(rate)}</span>
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
