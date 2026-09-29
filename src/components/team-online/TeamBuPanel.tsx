/**
 * แผง "BU ไหนงานเยอะ แล้วได้ผลแค่ไหน" — **แสดงทุก BU เสมอ** (ไม่ตามตัวกรอง)
 * รอบ 3 (เจ้าของเลือก 29 ก.ย. 2569 จากภาพอ้างอิง ลิงก์ 2 "Top Spending merchants"): **รายการจัดอันดับ**
 * BU ละแถว · อัตราที่ขอเข้า + % ของทั้งหมด · แถบสีประจำ BU ตามสัดส่วน · บรรทัดรอง = คนใช้งาน (%) · Success ประกาศ (%)
 *
 * กดแถว = ตั้งตัวกรอง BU ของทั้งหน้า (กดซ้ำ = ยกเลิก) · แถว "ไม่ระบุ BU" กดไม่ได้ (กรองไม่ได้จริง)
 * สีแถบ = `currentColor` + คลาส `TONE[...].value` (มีคู่ dark: — hex โทน 700 จมพื้นโหมดมืด)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtPct, ratio } from '@/lib/teamOnline';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { toneOfBu } from './teamOnlineTones';

const NUM = new Intl.NumberFormat('th-TH');
const PCT0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

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

function RowBody({ r, share }: { r: TeamBuPanelRow; share: number | null }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 text-left">
      <div className="flex w-full items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-current', r.bu ? TONE[toneOfBu(r.bu)].value : DASH.muted)} aria-hidden />
          <span className="truncate text-sm text-foreground">{r.label}</span>
        </span>
        <span className="shrink-0 text-sm tabular-nums text-foreground">
          {r.positionsIn === null ? '—' : `${NUM.format(r.positionsIn)} อัตรา`}
          {share !== null ? <span className={cn('ml-1 text-xs', DASH.muted)}>({PCT0.format(share * 100)}%)</span> : null}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full bg-current', r.bu ? TONE[toneOfBu(r.bu)].value : DASH.muted)}
          style={{ width: `${Math.max(0, Math.min(100, (share ?? 0) * 100))}%` }}
        />
      </div>
      <span className={cn('text-xs tabular-nums', DASH.muted)}>
        คนใช้งาน {r.usersPct === null ? 'ยังไม่มีบัญชี' : fmtPct(r.usersPct)} · Success ประกาศ {fmtPct(r.postSuccess)}
      </span>
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
  const total = (rows ?? []).reduce((s, r) => s + (r.positionsIn ?? 0), 0);
  return (
    <Card className="flex min-w-0 flex-col gap-3 rounded-2xl p-4">
      <div>
        <p className="text-sm font-medium text-foreground">BU ไหนงานเยอะ แล้วได้ผลแค่ไหน</p>
        <p className={cn('text-xs', DASH.muted)}>แสดงทุก BU เสมอ · เรียงตามอัตราที่ขอเข้า · กดเพื่อดูเฉพาะ BU</p>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error || !rows ? (
        <p className={cn('text-xs', TONE.danger.value)}>{error ?? 'อ่านข้อมูลต่อ BU ไม่ได้'}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => {
            const share = r.positionsIn === null ? null : ratio(r.positionsIn, total);
            const active = selected === r.bu;
            return r.bu && onSelect ? (
              <Button
                key={r.bu}
                type="button"
                variant="ghost"
                className={cn('h-auto w-full justify-start rounded-xl px-3 py-2', active && 'bg-muted')}
                aria-pressed={active}
                title={active ? 'กดอีกครั้งเพื่อดูทุก BU' : `ดูเฉพาะ ${r.label}`}
                onClick={() => onSelect(active ? null : r.bu)}
              >
                <RowBody r={r} share={share} />
              </Button>
            ) : (
              <div key={r.bu || 'unknown'} className="px-3 py-2">
                <RowBody r={r} share={share} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default TeamBuPanel;
