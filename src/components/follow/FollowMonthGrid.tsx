import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  FOLLOW_STATUS_CLASS,
  FOLLOW_STATUS_LABEL,
  type FollowEntry,
} from '@/lib/followApi';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcomeAny } from '@/lib/followOutcome';
import {
  buildFollowMonthGrid,
  monthDayColumns,
  type FollowMonthCell,
} from '@/lib/followMonthGrid';
import { toYmdBangkok, formatYmdDmyBe } from '@/lib/dateTh';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shiftMonth } from '@/lib/followCallCalendar';
import FollowDispatchBadge from '@/components/follow/FollowDispatchBadge';

/**
 * **ตารางสรุปรายเดือน** ของหน้า Follow — คน × วัน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-5
 * ส่ง HTML ตารางมอบหมายงานของอีกหน้ามาเป็นตัวอย่าง: sticky คอลัมน์ชื่อซ้าย ·
 * หัวคอลัมน์เป็นตัวย่อวัน+เลขวัน · คอลัมน์อาทิตย์ tint · ช่องเป็นสี่เหลี่ยมกดได้)
 *
 * ปรับให้เข้ากับงาน Follow: ช่อง = รอบโทรของคนนั้นในวันนั้น สีตามผล
 * (แดง=หลุด · เหลือง=ต้องตามต่อ · เขียว=จบดี/โทรติด · ฟ้า=สายกำลังเดิน · เทา=รอโทร)
 * กดช่องแล้วเห็นรายละเอียดทุกรอบของวันนั้น · ตรรกะล้วนอยู่ที่ `followMonthGrid.ts`
 */

/** รายละเอียดใน dialog ของช่องที่กด — บอกเวลา สถานะ และผลปิดงานของแต่ละรอบ */
function CellEntryRow({ e }: { e: FollowEntry }) {
  const time = e.scheduled_at
    ? new Date(e.scheduled_at).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  return (
    <li className={cn('rounded-lg border px-2.5 py-2', TONE.neutral.soft, e.cancelled && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-semibold text-foreground">{time} น.</span>
        {/* null = ไม่มีแถวในคิว (ไม่เคยส่งให้ AI) — ป้ายสถานะโทรไม่มีคำสำหรับกรณีนี้
            ⇒ ปล่อยว่างแล้วให้ป้าย "ไม่ได้ส่ง" ข้างล่างเป็นคนบอกแทน */}
        {e.call_status ? (
          <span className={FOLLOW_STATUS_CLASS[e.call_status]}>{FOLLOW_STATUS_LABEL[e.call_status]}</span>
        ) : null}
        <FollowDispatchBadge entry={e} />
        {e.completed_at && e.outcome_code ? (
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE.success.chip)}>
            ปิดงาน: {FOLLOW_OUTCOME_LABEL[e.outcome_code as FollowOutcomeAny] ?? e.outcome_code}
          </span>
        ) : null}
        {e.staff_phone ? <span className={DASH.muted}>โทรกลับ {e.staff_phone}</span> : null}
      </div>
      {e.call_outcome || e.call_summary ? (
        <p className={cn('mt-1 rounded bg-background/60 px-1.5 py-1 text-[10px]', DASH.muted)}>
          ผล{e.call_outcome ? ` (${e.call_outcome})` : ''}
          {e.call_summary ? `: ${e.call_summary}` : ''}
        </p>
      ) : null}
    </li>
  );
}

export default function FollowMonthGrid({ entries }: { entries: FollowEntry[] }) {
  const [month, setMonth] = useState(() => toYmdBangkok(new Date()).slice(0, 7));
  /** ช่องที่กดดูอยู่ — null = ปิด */
  const [detail, setDetail] = useState<{ name: string; ymd: string; cell: FollowMonthCell } | null>(
    null,
  );

  const rows = useMemo(() => buildFollowMonthGrid(entries, month), [entries, month]);
  const cols = useMemo(() => monthDayColumns(month), [month]);
  const todayYmd = toYmdBangkok(new Date());

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('th-TH', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="เดือนก่อนหน้า"
            className="rounded-full border border-border p-1.5 hover:bg-secondary"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className={cn('text-xs font-bold', DASH.cellStrong)}>{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="เดือนถัดไป"
            className="rounded-full border border-border p-1.5 hover:bg-secondary"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {/* คำอธิบายสี — ไม่มีคือเดาไม่ได้ว่าช่องสีหมายถึงอะไร */}
        <div className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]', DASH.muted)}>
          {(
            [
              ['danger', 'หลุด/ยกเลิก'],
              ['warn', 'ต้องตามต่อ'],
              ['success', 'จบดี/โทรติด'],
              ['info', 'สายกำลังเดิน'],
              ['neutral', 'รอโทร'],
            ] as const
          ).map(([tone, label]) => (
            <span key={tone} className="inline-flex items-center gap-1">
              <span className={cn('h-2.5 w-2.5 rounded-sm', TONE[tone].dot)} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={cn('rounded-xl border px-3 py-4 text-center text-xs', TONE.neutral.soft, DASH.muted)}>
          เดือนนี้ไม่มีนัดโทรของใครเลย
        </p>
      ) : (
        <div className="glass-card overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 min-w-[220px] max-w-[320px] bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  คนที่ติดตาม
                </th>
                {cols.map((c) => (
                  <th
                    key={c.ymd}
                    className={cn(
                      'min-w-[32px] px-1 py-1.5 text-center font-medium',
                      c.isSunday
                        ? 'bg-slate-100/70 text-rose-800 dark:bg-slate-800/60 dark:text-red-300'
                        : 'text-muted-foreground',
                      c.ymd === todayYmd && 'underline underline-offset-4',
                    )}
                  >
                    <div className="text-[9px] leading-none opacity-80">{c.weekday}</div>
                    <div>{c.day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="sticky left-0 z-10 max-w-[320px] bg-card px-3 py-2 align-top text-[11px] font-medium leading-snug text-foreground">
                    <span className="block truncate">{r.name}</span>
                    <span className={cn('block truncate font-normal', DASH.muted)}>
                      {r.phone} · {r.topic}
                    </span>
                  </td>
                  {cols.map((c) => {
                    const cell = r.cells.get(c.ymd);
                    return (
                      <td
                        key={c.ymd}
                        className={cn(
                          'px-1 py-2 text-center',
                          c.isSunday && 'bg-slate-100/70 dark:bg-slate-800/60',
                        )}
                      >
                        {cell ? (
                          <button
                            type="button"
                            onClick={() => setDetail({ name: r.name, ymd: c.ymd, cell })}
                            title={`${formatYmdDmyBe(c.ymd)} · ${cell.count > 0 ? `${cell.count} รอบ` : 'ยกเลิกหมด'} — กดเพื่อดูรายละเอียด`}
                            className={cn(
                              'mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white transition-transform hover:scale-110',
                              TONE[cell.tone].dot,
                              cell.muted && 'opacity-35',
                            )}
                          >
                            {cell.count > 1 ? cell.count : ''}
                          </button>
                        ) : (
                          <div className="mx-auto h-6 w-6 rounded-md bg-secondary/30" aria-hidden />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* รายละเอียดของช่องที่กด — ทุกรอบของคนนั้นในวันนั้น (รวมที่ยกเลิก โชว์จาง ๆ) */}
      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {detail?.name} · {detail ? formatYmdDmyBe(detail.ymd) : ''}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              รอบโทรของวันนี้ทั้งหมด — รอบที่ยกเลิกโชว์จาง ๆ
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <ul className="space-y-1.5">
              {detail.cell.entries.map((e) => (
                <CellEntryRow key={e.id} e={e} />
              ))}
            </ul>
          ) : null}
          {detail?.cell.entries[0] ? (
            <a
              href={`tel:${detail.cell.entries[0].recipient_phone}`}
              className={cn(
                'inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium',
                TONE.info.outline,
              )}
            >
              <Phone className="h-3 w-3" aria-hidden />
              {detail.cell.entries[0].recipient_phone}
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
