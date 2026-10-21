import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatYmdTh } from '@/lib/dateTh';
import type { AppointmentPlaceSummary } from '@/lib/appointmentPlaces';

/**
 * ═══ ตารางนัดของวัน แยกสถานที่ — แบบ iRecruit "ติดตามนัด" (เจ้าของ 21 ต.ค. 2569) ═══
 * Choice "ตารางแบบ iRecruit บน + รายชื่อล่าง" — กดแถว = รายชื่อข้างล่างเหลือสถานที่นั้น · กดซ้ำ = ทุกสถานที่ของวัน
 * ตัวเลขจาก `buildAppointmentPlaces` (src/lib/appointmentPlaces.ts) · ว่าง = แถว "ไม่มีนัด" ตารางไม่หาย
 */
export default function AppointmentPlacesCard({
  ymd,
  isToday,
  total,
  places,
  picked,
  loading,
  failed,
  onShiftDay,
  onToday,
  onPick,
}: {
  ymd: string;
  isToday: boolean;
  total: number;
  places: readonly AppointmentPlaceSummary[];
  /** สถานที่ที่กดอยู่ (null = ทุกสถานที่ของวัน) */
  picked: string | null;
  loading: boolean;
  failed: boolean;
  onShiftDay: (days: number) => void;
  onToday: () => void;
  onPick: (place: string | null) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 p-3" data-testid="appointment-places">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="iconXs" variant="outline" aria-label="วันก่อน" onClick={() => onShiftDay(-1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium tabular-nums text-foreground" data-testid="appointment-places-day">
            {isToday ? 'วันนี้ ' : ''}
            {formatYmdTh(ymd)}
          </span>
          <Button type="button" size="iconXs" variant="outline" aria-label="วันถัดไป" onClick={() => onShiftDay(1)}>
            <ChevronRight aria-hidden />
          </Button>
          {!isToday ? (
            <Button type="button" size="xs" variant="ghost" onClick={onToday}>
              วันนี้
            </Button>
          ) : null}
        </div>
        <span className="text-sm tabular-nums text-foreground" data-testid="appointment-places-total">
          นัดทั้งหมด <span className="font-medium">{loading || failed ? '—' : total}</span> คน
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('text-left text-xs', DASH.tableHead)}>
              <th className="px-3 py-2 font-medium">สถานที่</th>
              <th className="px-3 py-2 text-center font-medium">นัด</th>
              <th className="px-3 py-2 font-medium">ใครนัด</th>
              <th className="px-3 py-2 text-center font-medium">มา</th>
              <th className="px-3 py-2 text-center font-medium">ไม่มา</th>
              <th className="px-3 py-2 text-center font-medium">รอผล</th>
            </tr>
          </thead>
          <tbody>
            {loading || failed || places.length === 0 ? (
              <tr className={cn('border-t', DASH.tableRow)}>
                <td colSpan={6} className={cn('px-3 py-3 text-center text-xs', DASH.cellMuted)}>
                  {loading ? 'กำลังโหลด…' : failed ? 'โหลดไม่สำเร็จ' : 'ไม่มีนัด'}
                </td>
              </tr>
            ) : (
              places.map((p) => {
                const active = picked === p.place;
                return (
                  <tr
                    key={p.place}
                    className={cn('cursor-pointer border-t', DASH.tableRow, active && 'bg-muted')}
                    onClick={() => onPick(active ? null : p.place)}
                    aria-selected={active}
                    data-testid="appointment-place-row"
                  >
                    <td className={cn('px-3 py-2', DASH.cellStrong)}>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto whitespace-normal p-0 text-left font-medium text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPick(active ? null : p.place);
                        }}
                      >
                        {p.place}
                      </Button>
                    </td>
                    <td className={cn('px-3 py-2 text-center font-medium tabular-nums', DASH.cell)}>{p.total}</td>
                    <td className={cn('px-3 py-2 text-xs', DASH.cell)}>{p.by.map((b) => `${b.name} ${b.count}`).join(' · ')}</td>
                    <td className={cn('px-3 py-2 text-center tabular-nums', TONE.success.value)}>{p.showed}</td>
                    <td className={cn('px-3 py-2 text-center tabular-nums', TONE.danger.value)}>{p.noShow}</td>
                    {/* เลื่อนนัดนับเป็นรอผล (ยังไม่รู้ว่ามาไหม) — มา + ไม่มา + รอผล = นัด */}
                    <td className={cn('px-3 py-2 text-center tabular-nums', DASH.cellMuted)}>{p.pending + p.rescheduled}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
