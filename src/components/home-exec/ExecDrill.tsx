/**
 * ═══ กดกล่องแล้วดูลึกลงไปเรื่อย ๆ (เจ้าของ 24 ต.ค. 2569 *"visual control กดเพื่อดูรายละเอียด หรือ scale ไปเรื่อยๆ"*) ═══
 * แผงเดียว (ไม่ซ้อน Dialog) ซ้อนชั้นได้: กล่อง → รายใบ → กางดูใบ → ใบอื่นของเจ้าหน้าที่/หน่วยงานเดียวกัน → … · ย้อนกลับทีละชั้น
 * รายใบในแต่ละชั้นบวกกันเท่าเลขในกล่องที่กดมา (ชุดเดียวกับตัวนับ `requestFlowRole` / `byOwner` / `costliest`)
 */
import React, { useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NO_REASON, perDayOf } from '@/lib/homeExec';
import type { MoneyRequest } from '@/lib/homeMoney';
import { thaiDate } from '@/lib/periodPick';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const MONTH = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export type DrillLevel = {
  title: string;
  sub?: string;
  rows?: MoneyRequest[];
  /** ลูกค้าหักเงินรายเดือน (กล่องลูกค้าหักจริง) */
  months?: Array<{ ym: string; amount: number; receipts: number }>;
  /** ใบที่กางไว้ตอนเปิดชั้นนี้ */
  expand?: string | null;
  /** แยกเหตุผล (กล่องยกเลิก) — กดเหตุผลแล้วลงไปดูเฉพาะใบของเหตุผลนั้น · `unit` = ใบ/คน */
  reasons?: { unit: string; items: Array<{ label: string; n: number }> };
};

export function useDrill() {
  const [stack, setStack] = useState<DrillLevel[]>([]);
  return {
    stack,
    open: (lv: DrillLevel) => setStack([lv]),
    push: (lv: DrillLevel) => setStack((s) => [...s, lv]),
    back: () => setStack((s) => s.slice(0, -1)),
    close: () => setStack([]),
  };
}

export default function ExecDrill({
  drill,
  all,
  today,
}: {
  drill: ReturnType<typeof useDrill>;
  /** ทุกใบของช่วง — ไว้กดลึกไปใบอื่นของเจ้าหน้าที่/หน่วยงานเดียวกัน */
  all: readonly MoneyRequest[];
  today: string;
}) {
  const lv = drill.stack[drill.stack.length - 1] ?? null;
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const levelKey = `${drill.stack.length}|${lv?.title ?? ''}`;
  const [seenKey, setSeenKey] = useState(levelKey);
  if (seenKey !== levelKey) {
    setSeenKey(levelKey);
    setOpenRow(lv?.expand ?? null);
    setLimit(50);
  }
  const rows = lv?.rows ?? [];
  const sumPerDay = rows.reduce((a, r) => a + (r.open && r.needYmd != null && r.needYmd <= today ? perDayOf(r) : 0), 0);
  const sameUnit = rows.length > 1 && rows.every((r) => r.unit === rows[0].unit);
  const sumMoney = rows.reduce((a, r) => a + r.amount.need.fine + r.amount.need.deduct, 0);

  return (
    <Sheet open={drill.stack.length > 0} onOpenChange={(o) => !o && drill.close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl" data-testid="exec-drill">
        <SheetHeader className="space-y-1 text-left">
          {drill.stack.length > 1 ? (
            <Button type="button" variant="ghost" size="sm" className="w-fit gap-1 px-0" onClick={drill.back} data-testid="exec-drill-back">
              <ArrowLeft aria-hidden /> ย้อนกลับ
            </Button>
          ) : null}
          <SheetTitle>{lv?.title}</SheetTitle>
          <SheetDescription className="tabular-nums">
            {lv?.months
              ? `${NUM.format(lv.months.length)} เดือน`
              : `${NUM.format(rows.length)} ใบ · เสียวันละ ${BAHT.format(sumPerDay)} บาท · ยอดในช่วง ${BAHT.format(sumMoney)} บาท`}
            {lv?.sub ? ` · ${lv.sub}` : ''}
          </SheetDescription>
        </SheetHeader>

        {lv?.reasons ? (
          <Table className="mt-4" data-testid="exec-drill-reasons">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">เหตุผล</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">{lv.reasons.unit}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lv.reasons.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                    0
                  </TableCell>
                </TableRow>
              ) : (
                lv.reasons.items.map((it) => (
                  <TableRow
                    key={it.label}
                    className="cursor-pointer"
                    onClick={() =>
                      drill.push({
                        title: `${lv.title} · ${it.label}`,
                        rows: rows.filter((r) => (r.stopReason?.trim() || NO_REASON) === it.label),
                        expand: null,
                      })
                    }
                    data-testid="exec-drill-reason"
                  >
                    <TableCell className="text-sm text-foreground">{it.label}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{NUM.format(it.n)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : null}

        {lv?.months ? (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">เดือน</TableHead>
                <TableHead className="text-right text-xs">ใบรับเงิน</TableHead>
                <TableHead className="text-right text-xs">ลูกค้าหัก (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lv.months.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    0 บาท
                  </TableCell>
                </TableRow>
              ) : (
                lv.months.map((m) => (
                  <TableRow key={m.ym}>
                    <TableCell>{MONTH.format(new Date(`${m.ym}-01T00:00:00Z`))}</TableCell>
                    <TableCell className="text-right tabular-nums">{NUM.format(m.receipts)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{BAHT.format(m.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ใบขอ</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">เจ้าหน้าที่</TableHead>
                  <TableHead className="whitespace-nowrap text-right text-xs">ขาด (คน)</TableHead>
                  <TableHead className="whitespace-nowrap text-right text-xs">เสียวันละ (บาท)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      ไม่มีใบ
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.slice(0, limit).flatMap((r) => {
                    const isOpen = openRow === r.requestNo;
                    const missing = Math.max(0, r.qty - r.filled);
                    const late = r.open && r.needYmd != null && r.needYmd <= today;
                    const out = [
                      <TableRow
                        key={r.requestNo}
                        className="cursor-pointer"
                        onClick={() => setOpenRow(isOpen ? null : r.requestNo)}
                        data-testid="exec-drill-row"
                      >
                        <TableCell className="min-w-[220px]">
                          <span className="flex items-start gap-2">
                            <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                            <span>
                              <span className="block text-sm text-foreground">{(sameUnit ? [r.position] : [r.unit, r.position]).filter(Boolean).join(' · ')}</span>
                              <span className="block text-xs tabular-nums text-muted-foreground">{r.requestNo}</span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{r.owner ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.open ? NUM.format(missing) : '0'}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', late ? TONE.danger.value : 'text-muted-foreground')}>
                          {late ? BAHT.format(perDayOf(r)) : '0'}
                        </TableCell>
                      </TableRow>,
                    ];
                    if (isOpen) {
                      const a = r.amount.need;
                      out.push(
                        <TableRow key={`${r.requestNo}-d`} data-testid="exec-drill-detail">
                          <TableCell colSpan={4} className="bg-muted/40">
                            <div className="space-y-3 p-1 text-xs text-muted-foreground">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums sm:grid-cols-3">
                                <span>วันคีย์ {thaiDate(r.keyYmd)}</span>
                                <span>วันที่ต้องการ {r.needYmd ? thaiDate(r.needYmd) : '—'}</span>
                                <span>{r.endYmd ? `จบ ${thaiDate(r.endYmd)}` : r.open ? 'ยังเปิด' : 'ได้คนครบ'}</span>
                                {r.stopReason ? <span>เหตุผล {r.stopReason}</span> : null}
                                <span>
                                  ได้คน {NUM.format(r.filled)}/{NUM.format(r.qty)}
                                </span>
                                <span>หาได้ใน {r.speedDays == null ? '—' : `${NUM.format(r.speedDays)} วัน`}</span>
                                <span>ช้ากว่าที่ต้องการ {r.lateDays == null ? '—' : `${NUM.format(r.lateDays)} วัน`}</span>
                                <span>
                                  อัตราต่อคน {BAHT.format(r.finePerDay)} / {BAHT.format(r.deductPerDay)} บาท
                                </span>
                                <span>โดนในช่วง {NUM.format(a.days)} วัน · {NUM.format(a.personDays)} คน-วัน</span>
                                <span>
                                  ค่าปรับ {BAHT.format(a.fine)} · ลดมูลค่า {BAHT.format(a.deduct)} บาท
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {r.owner ? (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      drill.push({ title: `ใบของ ${r.owner}`, rows: all.filter((x) => x.owner === r.owner), expand: null });
                                    }}
                                  >
                                    ใบอื่นของ {r.owner}
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    drill.push({ title: `ใบของ ${r.unit}`, rows: all.filter((x) => x.unit === r.unit), expand: null });
                                  }}
                                >
                                  ใบอื่นของหน่วยงานนี้
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>,
                      );
                    }
                    return out;
                  })
                )}
              </TableBody>
            </Table>
            {rows.length > limit ? (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLimit((n) => n + 50)}>
                ดูเพิ่ม ({NUM.format(rows.length - limit)} ใบ)
              </Button>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
