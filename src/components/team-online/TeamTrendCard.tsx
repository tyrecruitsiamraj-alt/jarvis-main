/**
 * กราฟ "ช่วงนี้ (เส้นทึบ) เทียบช่วงก่อน (เส้นประ)" ของหน้าทีม Online — เลือกเส้นได้จาก "ดูเส้น"
 * ใช้ `TrendChart` ตัวเดียวกับแท็บ Dashboard (ไม่ปั้นกราฟใหม่)
 *
 * 🔴 ค่ารายช่วงย่อยของเมตริกที่นับคน/ของไม่ซ้ำ **บวกกันไม่ได้** (คนเดียวใช้ทั้งเช้าและบ่าย = 1 ในยอดทั้งช่วง
 *    แต่ขึ้นทั้งสองชั่วโมง) — เขียนกำกับใต้กราฟทุกครั้งตามภาพต้นแบบ
 */
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { TrendChart } from '@/components/dashboard-trends/TrendParts';
import type { TeamCount, TeamGrain, TeamWindow } from '@/lib/teamOnline';
import { DASH } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type TeamTrendOption = {
  key: string;
  label: string;
  count: TeamCount | null;
  /** นับของไม่ซ้ำต่อช่วงย่อย (บวกกันไม่ได้) */
  distinct: boolean;
  /** เลือกไม่ได้ เพราะอะไร (เช่น ERP มีแต่วันที่ ทำรายชั่วโมงไม่ได้) */
  unavailable?: string | null;
  note?: string | null;
  /** ช่วงก่อนยังไม่มีข้อมูล — ไม่วาดเส้นประ (เส้นศูนย์ปลอมอ่านเป็น "เพิ่มขึ้น") */
  hidePrev?: boolean;
};

const GRAIN_TEXT: Record<TeamGrain, string> = { hour: 'รายชั่วโมง', day: 'รายวัน', month: 'รายเดือน' };

const TeamTrendCard: React.FC<{
  window: TeamWindow | null;
  options: ReadonlyArray<TeamTrendOption>;
  value: string;
  onChange: (key: string) => void;
  loading?: boolean;
}> = ({ window: w, options, value, onChange, loading = false }) => {
  const picked = options.find((o) => o.key === value) ?? options[0];
  const count = picked?.count ?? null;
  const data =
    w && count
      ? w.buckets.map((b, i) => ({ label: b.label, cur: count.series[i] ?? 0, prev: count.prevSeries[i] ?? 0 }))
      : [];
  return (
    <Card className="flex min-w-0 flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{picked?.label ?? ''}</p>
        {/* ช่องเลือกของธีมบังคับกว้างเต็มกล่อง (`jarvis-soft-field`) ⇒ คุมความกว้างที่กล่องครอบ */}
        <div className="w-32 shrink-0">
          <Select value={picked?.key} onValueChange={onChange}>
            <SelectTrigger className="text-xs" aria-label="ดูเส้น">
              <span>ดูเส้น</span>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.key} value={o.key} disabled={!!o.unavailable} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : !w || !picked ? null : picked.unavailable ? (
        <p className={cn('py-12 text-center text-sm', DASH.muted)}>{picked.unavailable}</p>
      ) : !count ? (
        <p className={cn('py-12 text-center text-sm', DASH.muted)}>—</p>
      ) : (
        <div className={DASH.sub}>
          <TrendChart
            ariaLabel={`${picked.label} ${GRAIN_TEXT[w.grain]} ช่วงนี้เทียบช่วงก่อน`}
            data={data}
            series={[
              { key: 'cur', label: 'ช่วงนี้', kind: 'line', tone: 'primary' },
              ...(picked.hidePrev ? [] : [{ key: 'prev', label: 'ช่วงก่อน', kind: 'line' as const, tone: 'neutral' as const, dashed: true }]),
            ]}
            height={240}
            kindInLegend={false}
          />
        </div>
      )}
      {w && picked && !picked.unavailable ? (
        <p className={cn('text-xs', DASH.muted)}>
          {GRAIN_TEXT[w.grain]}
          {picked.distinct ? ' · คนไม่ซ้ำในแต่ละช่วงย่อย ห้ามบวกเป็นยอดทั้งช่วง' : ''}
        </p>
      ) : null}
      {picked?.note ? <p className={cn('text-xs', DASH.muted)}>{picked.note}</p> : null}
    </Card>
  );
};

export default TeamTrendCard;
