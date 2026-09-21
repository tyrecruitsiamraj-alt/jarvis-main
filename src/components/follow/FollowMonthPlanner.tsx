/**
 * ═══ Planning ทั้งเดือน — แถวคือคน คอลัมน์คือวันที่ 1 ถึงสิ้นเดือน ═══
 *
 * เจ้าของสั่ง 21 ก.ย. 2569: *"ปฏิทินเอาเป็นกดแล้วเห็นแบบยาว ๆ ดิ นี่เห็นเป็นไรก็ไม่รู้
 * แบบเห็นเลยว่า เดือนนี้วันที่ 1-สิ้นเดือน นาย ก โทรวันไหนบ้าง วันละกี่รอบ รอบไหนกี่โมง
 * คือให้ขึ้นเป็น Planning อะ"*
 *
 * ในช่องหนึ่งช่องบอกครบสามอย่าง: **ใครโทร · กี่รอบ · รอบไหนกี่โมง**
 *
 * 🔴 กติกา UI: ประกอบจาก `@/components/ui/*` + utility ของ Tailwind เท่านั้น
 * ไม่มี CSS ใหม่ ไม่มี primitive ใหม่ (เจ้าของสั่ง 21 ก.ย. 2569)
 */
import * as React from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { FollowEntry } from '@/lib/followApi';
import {
  buildMonthPlan,
  currentMonth,
  shiftMonth,
  type MonthPlanCell,
} from '@/lib/followMonthPlan';

const MONTH_TH = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
const WEEKDAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/**
 * ชื่อเดือนแบบไทย + **พ.ศ.**
 * ⚠️ ปีในฐาน/ISO เป็น ค.ศ. เสมอ — ทั้งระบบโชว์ พ.ศ. ต้องบวก 543 ที่จุดแสดงผล
 */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return `${MONTH_TH[m - 1]} ${y + 543}`;
}

const dayNum = (ymd: string): string => String(Number(ymd.slice(8, 10)));
const weekdayOf = (ymd: string): string =>
  WEEKDAY_TH[new Date(`${ymd}T00:00:00+07:00`).getDay()];
const isWeekend = (ymd: string): boolean => {
  const d = new Date(`${ymd}T00:00:00+07:00`).getDay();
  return d === 0 || d === 6;
};

/** สีของช่อง — ตามคนที่โทร · จางลงเมื่อยกเลิก */
function cellTone(cell: MonthPlanCell): ToneKey {
  if (cell.state === 'cancelled') return 'neutral';
  if (cell.mode === 'manual') return 'info';
  if (cell.mode === 'mixed') return 'violet';
  return 'success';
}

const MODE_TEXT: Record<MonthPlanCell['mode'], string> = {
  ai: 'AI โทร',
  manual: 'เราโทรเอง',
  mixed: 'AI + เราโทร',
};

export type FollowMonthPlannerProps = {
  entries: FollowEntry[];
  /** กดที่ช่อง = เปิดรอบแรกของวันนั้นไปแก้ไข */
  onOpenDay: (entry: FollowEntry) => void;
};

export const FollowMonthPlanner: React.FC<FollowMonthPlannerProps> = ({ entries, onOpenDay }) => {
  const [month, setMonth] = React.useState(() => currentMonth());
  const plan = React.useMemo(() => buildMonthPlan(entries, month), [entries, month]);
  const today = React.useMemo(() => currentMonth() === month ? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : null, [month]);

  /**
   * ⚠️ `min-w-0` ทั้งสองชั้นสำคัญมาก — `DialogContent` ของ shadcn เป็น grid
   * ลูกของ grid มี `min-width: auto` โดยดีฟอลต์ ⇒ ตารางที่กว้างกว่าจอจะ **ดันกล่องทั้งใบ
   * ให้กว้างตาม** แถบสรุปด้านบนเลยถูกผลักออกไปนอกจอ (เจอจริงตอนวัดบนเครื่อง 21 ก.ย. 2569)
   */
  return (
    <div className="min-w-0 space-y-3">
      {/* ── เลื่อนเดือน + สรุปหัวตาราง ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="เดือนก่อนหน้า"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>
            เดือนนี้
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="เดือนถัดไป"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
          <span className="ml-2 text-sm font-medium text-foreground">{monthLabel(month)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Badge variant="outline" className="font-medium">
            คนในแผน <span className="tabular-nums">{plan.summary.people}</span>
          </Badge>
          <Badge variant="outline" className={cn('font-medium', TONE.success.chip)}>
            รอบที่ AI โทร <span className="tabular-nums">{plan.summary.aiRounds}</span>
          </Badge>
          <Badge variant="outline" className={cn('font-medium', TONE.info.chip)}>
            รอบที่เราโทรเอง <span className="tabular-nums">{plan.summary.manualRounds}</span>
          </Badge>
          <Badge variant="outline" className="font-medium">
            วันที่มีสาย <span className="tabular-nums">{plan.summary.activeDays}</span>
          </Badge>
        </div>
      </div>

      {plan.rows.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-foreground">เดือนนี้ยังไม่มีแผนโทร</p>
            <p className="mt-1 text-xs text-muted-foreground">
              กด “เพิ่มคนที่ต้องติดตาม” แล้วเลือกโหมดตารางหลายวัน เพื่อวางแผนทั้งช่วง
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0 overflow-hidden">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              {/* หัวคอลัมน์ = วันที่ 1 ถึงสิ้นเดือน */}
              <div className="flex border-b bg-muted/40">
                <div className="sticky left-0 z-10 w-56 shrink-0 border-r bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  คน / ช่วงที่ตาม
                </div>
                {plan.days.map((d) => (
                  <div
                    key={d}
                    className={cn(
                      'w-20 shrink-0 border-r px-1 py-2 text-center',
                      isWeekend(d) && 'bg-muted',
                      today === d && 'bg-primary/10',
                    )}
                  >
                    <p
                      className={cn(
                        'text-xs tabular-nums',
                        today === d ? 'font-medium text-primary' : 'text-foreground',
                      )}
                    >
                      {dayNum(d)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{weekdayOf(d)}</p>
                  </div>
                ))}
              </div>

              {/* หนึ่งแถว = หนึ่งคน */}
              {plan.rows.map((row) => (
                <div key={row.key} className="flex border-b last:border-b-0">
                  <div className="sticky left-0 z-10 w-56 shrink-0 border-r bg-card px-3 py-2">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.unitName ?? 'ไม่ได้ระบุหน่วยงาน'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.totals.days} วัน · {row.totals.rounds} รอบ
                    </p>
                  </div>

                  {plan.days.map((d) => {
                    const cell = row.cells[d];
                    if (!cell) {
                      return (
                        <div
                          key={d}
                          className={cn(
                            'w-20 shrink-0 border-r',
                            isWeekend(d) && 'bg-muted/50',
                            today === d && 'bg-primary/5',
                          )}
                        />
                      );
                    }
                    const tone = cellTone(cell);
                    const first = cell.entries[0];
                    return (
                      <div
                        key={d}
                        className={cn(
                          'w-20 shrink-0 border-r p-1',
                          isWeekend(d) && 'bg-muted/50',
                          today === d && 'bg-primary/5',
                        )}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => first && onOpenDay(first)}
                                aria-label={`${row.name} · ${dayNum(d)} ${monthLabel(month)} · ${MODE_TEXT[cell.mode]} ${cell.rounds} รอบ`}
                                className={cn(
                                  'w-full rounded-lg px-1 py-1 text-center transition-opacity hover:opacity-80',
                                  TONE[tone].chip,
                                  cell.state === 'cancelled' && 'line-through opacity-60',
                                )}
                              >
                                <span className="block text-[11px] font-medium">
                                  {cell.mode === 'manual' ? 'เรา' : cell.mode === 'mixed' ? 'ผสม' : 'AI'}
                                  {cell.rounds > 0 ? ` ${cell.rounds}` : ''}
                                </span>
                                {cell.times.slice(0, 3).map((t) => (
                                  <span key={t} className="block text-[10px] tabular-nums">
                                    {t}
                                  </span>
                                ))}
                                {cell.times.length > 3 ? (
                                  <span className="block text-[10px]">+{cell.times.length - 3}</span>
                                ) : null}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                {row.name} · {dayNum(d)} {monthLabel(month)}
                              </p>
                              <p>
                                {MODE_TEXT[cell.mode]} · {cell.rounds} รอบ
                                {cell.state === 'done' ? ' · มีผลกลับแล้ว' : ''}
                                {cell.state === 'cancelled' ? ' · ยกเลิกแล้ว' : ''}
                              </p>
                              <p className="tabular-nums">{cell.times.join(' · ') || 'ไม่ได้ตั้งเวลา'}</p>
                              <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                                <Pencil className="h-3 w-3" aria-hidden /> กดเพื่อแก้รอบของวันนี้
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className={cn('rounded-full px-2 py-0.5', TONE.success.chip)}>AI โทร</span>
        <span className={cn('rounded-full px-2 py-0.5', TONE.info.chip)}>เราโทรเอง</span>
        <span className={cn('rounded-full px-2 py-0.5', TONE.violet.chip)}>วันผสมสองแบบ</span>
        <span className={cn('rounded-full px-2 py-0.5 line-through', TONE.neutral.chip)}>ยกเลิกแล้ว</span>
        <span>· ตัวเลขหลังคำ = จำนวนรอบของวันนั้น · ข้างล่างคือเวลาโทรแต่ละรอบ</span>
      </div>
    </div>
  );
};

export default FollowMonthPlanner;
