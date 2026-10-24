/**
 * ═══ หน้าหลักผู้บริหาร · ก้อนเงิน (เจ้าของ 24 ต.ค. 2569) ═══
 * > *"โดนค่าปรับ ลดมูลค่าเท่าไหร่ · โดนใบไหนบ้าง · ใบละกี่วัน วันละกี่คน"* · *"ยอดที่ระบบคำนวณว่าควรเสีย, ยอดที่ลูกค้าหักจริง ทั้งสองเทียบกัน"* ·
 * > *"นับทั้งหมด แยกเป็นเดือน ดูรายวัน รายสัปดาห์"* · *"ต้องมี visual control · Interactive graph เวลาเปลี่ยนกราฟวิ่งตาม"*
 * ข้อมูล `/api/home-money` · สูตร `src/lib/requestPenaltyLedger.ts` (ต่อคนต่อวันทำงาน · หักวันที่มีคนแทน)
 * 🔴 ลูกค้าหักเงิน (ใบรับเงิน) = ทุกเรื่องที่ลูกค้าหัก ไม่ใช่เฉพาะใบขอ — กล่องแยก ห้ามเอาไปลบกัน
 */
import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, CalendarClock, Receipt, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiTile } from '@/components/home-ai-share/HomeKpis';
import { HomeSection } from '@/components/home-ai-share/HomeSections';
import { CHART, TONE } from '@/lib/designTokens';
import { countPill } from '@/lib/teamOnline';
import { groupDaily, type LedgerMode } from '@/lib/requestPenaltyLedger';
import { thaiDate } from '@/lib/periodPick';
import type { HomeMoneyPayload } from '@/lib/homeMoneyApi';
import { cn } from '@/lib/utils';

const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('th-TH');
const MONTH = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const MODE_LABEL: Record<LedgerMode, string> = { need: 'นับจากวันที่ต้องการ', key: 'นับจากวันคีย์' };
type Unit = 'day' | 'week' | 'month';
const UNIT_LABEL: Record<Unit, string> = { day: 'รายวัน', week: 'รายสัปดาห์', month: 'รายเดือน' };

const monthsKey = (m: HomeMoneyPayload) => `${m.window.from.slice(0, 7)}|${m.window.to.slice(0, 7)}`;
function monthsText(m: HomeMoneyPayload): string {
  const a = MONTH.format(new Date(`${m.window.from.slice(0, 7)}-01T00:00:00Z`));
  const b = MONTH.format(new Date(`${m.window.to.slice(0, 7)}-01T00:00:00Z`));
  return a === b ? a : `${a} – ${b}`;
}

function bucketLabel(key: string, unit: Unit): string {
  if (unit === 'month') return MONTH.format(new Date(`${key}-01T00:00:00Z`));
  return DAY.format(new Date(`${key}T00:00:00Z`));
}

export default function HomeMoneySection({
  money,
  prev,
  error,
}: {
  money: HomeMoneyPayload | null;
  prev: HomeMoneyPayload | null;
  error: string | null;
}) {
  const [mode, setMode] = useState<LedgerMode>('need');
  const [unit, setUnit] = useState<Unit>('day');
  const [limit, setLimit] = useState(20);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const t = money?.totals[mode] ?? null;
  const p = prev?.totals[mode] ?? null;
  const pill = (cur: number, before: number | undefined) => (p && before !== undefined ? countPill(cur, before, false) : null);
  const prevFoot = (v: number | undefined) => (p && v !== undefined ? `ช่วงก่อนหน้า ${BAHT.format(v)}` : null);
  const series = useMemo(() => {
    if (!money) return [];
    return groupDaily(money.daily[mode], unit).map((b) => ({ ...b, label: bucketLabel(b.key, unit) }));
  }, [money, mode, unit]);
  const rows = useMemo(
    () =>
      (money?.requests ?? [])
        .filter((r) => r.amount[mode].fine + r.amount[mode].deduct > 0)
        .sort((a, b) => b.amount[mode].fine + b.amount[mode].deduct - (a.amount[mode].fine + a.amount[mode].deduct)),
    [money, mode],
  );
  const liveKey = `${money?.window.from}|${money?.window.to}|${money?.bu}|${mode}`;
  const sub = money ? `${thaiDate(money.window.from)} – ${thaiDate(money.window.to)}` : null;

  return (
    <HomeSection
      title="เงิน"
      sub={sub}
      testId="exec-money"
      right={
        <div className="flex flex-wrap gap-1" role="group" aria-label="เริ่มนับ">
          {(['need', 'key'] as const).map((m) => (
            <Button key={m} type="button" size="sm" variant={mode === m ? 'default' : 'outline'} onClick={() => setMode(m)} data-testid={`money-mode-${m}`}>
              {MODE_LABEL[m]}
            </Button>
          ))}
        </div>
      }
    >
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {money?.errors?.replacement ? <p className={cn('text-xs', TONE.warn.value)}>{money.errors.replacement}</p> : null}

      {/* Visual control — ตามเงื่อนไขในใบขอ เทียบช่วงก่อนหน้า (ขึ้น = แย่) · กล่องสุดท้ายคือยอดที่ลูกค้าหักจริง */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="money-tiles">
        <KpiTile
          emphasis
          icon={Banknote}
          label="รวมตามเงื่อนไขในใบขอ"
          unit="บาท"
          value={t ? Math.round(t.fine + t.deduct) : 0}
          loading={!t}
          liveKey={liveKey}
          pill={t ? pill(t.fine + t.deduct, p ? p.fine + p.deduct : undefined) : null}
          foot={prevFoot(p ? p.fine + p.deduct : undefined)}
        />
        <KpiTile
          tone="danger"
          icon={TrendingDown}
          label="ค่าปรับ"
          unit="บาท"
          value={t ? Math.round(t.fine) : 0}
          loading={!t}
          liveKey={liveKey}
          pill={t ? pill(t.fine, p?.fine) : null}
          foot={prevFoot(p?.fine)}
        />
        <KpiTile
          tone="warn"
          icon={CalendarClock}
          label="ลดมูลค่า"
          unit="บาท"
          value={t ? Math.round(t.deduct) : 0}
          loading={!t}
          liveKey={liveKey}
          pill={t ? pill(t.deduct, p?.deduct) : null}
          foot={prevFoot(p?.deduct)}
        />
        <KpiTile
          icon={Receipt}
          label="ลูกค้าหักจริง (ใบรับเงิน · ทุกเรื่อง)"
          unit="บาท"
          value={money ? Math.round(money.customerFines.total) : 0}
          loading={!money}
          liveKey={liveKey}
          // ใบรับเงินนับเป็นเดือน — ช่วงสั้นกว่าเดือนเทียบเดือนเดียวกัน = ไม่มีความหมาย ⇒ ไม่ขึ้นป้ายเทียบ
          pill={money && prev && monthsKey(money) !== monthsKey(prev) ? countPill(money.customerFines.total, prev.customerFines.total, false) : null}
          foot={money ? `ทั้งเดือน ${monthsText(money)} · ${NUM.format(money.customerFines.receipts)} ใบรับเงิน` : null}
        />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground" data-testid="money-sum">
        {t
          ? `${BAHT.format(t.fine)} + ${BAHT.format(t.deduct)} = ${BAHT.format(t.fine + t.deduct)} บาท · ${NUM.format(t.requests)} ใบ · ขาด ${NUM.format(t.personDays)} คน-วัน`
          : '—'}
      </p>

      {/* กราฟ Interactive — เปลี่ยนช่วง/หน่วยแล้วแท่งวิ่งตาม (CHART.animationDuration) */}
      <Card variant="solid" className="space-y-3 p-4" data-testid="money-chart">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', TONE.danger.dot)} aria-hidden />
              ค่าปรับ
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', TONE.warn.dot)} aria-hidden />
              ลดมูลค่า
            </span>
          </span>
          <div className="flex gap-1" role="group" aria-label="หน่วยเวลา">
            {(['day', 'week', 'month'] as const).map((u) => (
              <Button key={u} type="button" size="xs" variant={unit === u ? 'default' : 'outline'} onClick={() => setUnit(u)} data-testid={`money-unit-${u}`}>
                {UNIT_LABEL[u]}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-64 w-full">
          {money ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART.axisFill }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => BAHT.format(v)}
                />
                <Tooltip
                  cursor={CHART.cursorBar}
                  wrapperStyle={{ pointerEvents: 'none' }}
                  {...CHART.tooltipLight}
                  formatter={(v: number, name: string) => [`${BAHT.format(v)} บาท`, name === 'fine' ? 'ค่าปรับ' : 'ลดมูลค่า']}
                />
                <Bar dataKey="fine" stackId="m" fill="currentColor" className={TONE.danger.value} animationDuration={CHART.animationDuration} />
                <Bar
                  dataKey="deduct"
                  stackId="m"
                  fill="currentColor"
                  className={TONE.warn.value}
                  radius={[4, 4, 0, 0]}
                  animationDuration={CHART.animationDuration}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-full w-full rounded-xl" />
          )}
        </div>
      </Card>

      {/* ลูกค้าหักเงินจริงรายเดือน */}
      <div className="space-y-2" data-testid="money-customer">
        <p className="text-xs font-medium text-muted-foreground">ลูกค้าหักเงิน (ใบรับเงิน · ทุกเรื่อง) รายเดือน</p>
        <div className="flex flex-wrap gap-2">
          {(money?.customerFines.months ?? []).length === 0 ? (
            <span className="text-sm text-muted-foreground">0 บาท</span>
          ) : (
            money!.customerFines.months.map((m) => (
              <Card key={m.ym} variant="solid" className="space-y-0.5 rounded-xl px-3 py-2">
                <span className="block text-xs text-muted-foreground">{MONTH.format(new Date(`${m.ym}-01T00:00:00Z`))}</span>
                <span className="block text-sm font-medium tabular-nums text-foreground">{BAHT.format(m.amount)}</span>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* รายใบ — ใบละกี่วัน วันละกี่คน */}
      <div className="space-y-2" data-testid="money-requests">
        <p className="text-xs font-medium text-muted-foreground">รายใบขอ ({NUM.format(rows.length)} ใบ)</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ใบขอ</TableHead>
                <TableHead className="text-right">วันที่โดน (วัน)</TableHead>
                <TableHead className="text-right">วันละ (คน)</TableHead>
                <TableHead className="text-right">อัตราต่อคน (บาท/วัน)</TableHead>
                <TableHead className="text-right">ค่าปรับ (บาท)</TableHead>
                <TableHead className="text-right">ลดมูลค่า (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    ไม่มีใบที่โดนในช่วงนี้
                  </TableCell>
                </TableRow>
              ) : (
                rows.slice(0, limit).flatMap((r) => {
                  const a = r.amount[mode];
                  const open = openRow === r.requestNo;
                  const out = [
                    <TableRow
                      key={r.requestNo}
                      className="cursor-pointer"
                      onClick={() => setOpenRow(open ? null : r.requestNo)}
                      data-testid="money-row"
                    >
                      <TableCell className="min-w-[220px]">
                        <span className="block font-medium tabular-nums">{r.requestNo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[r.unit, r.position].filter(Boolean).join(' · ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{NUM.format(a.days)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.days > 0 ? (a.personDays / a.days).toFixed(1) : '0'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {BAHT.format(r.finePerDay)} / {BAHT.format(r.deductPerDay)}
                      </TableCell>
                      <TableCell className={cn('text-right tabular-nums', TONE.danger.value)}>{BAHT.format(a.fine)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', TONE.warn.value)}>{BAHT.format(a.deduct)}</TableCell>
                    </TableRow>,
                  ];
                  if (open) {
                    out.push(
                      <TableRow key={`${r.requestNo}-d`} data-testid="money-row-detail">
                        <TableCell colSpan={6} className="bg-muted/40 text-xs text-muted-foreground">
                          <span className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
                            <span>วันคีย์ {thaiDate(r.keyYmd)}</span>
                            <span>วันที่ต้องการ {r.needYmd ? thaiDate(r.needYmd) : '—'}</span>
                            <span>{r.endYmd ? `จบ ${thaiDate(r.endYmd)}` : 'ยังเปิด'}</span>
                            <span>
                              ได้คน {NUM.format(r.filled)}/{NUM.format(r.qty)}
                            </span>
                            <span>ขาดรวม {NUM.format(a.personDays)} คน-วัน</span>
                            {a.coveredPersonDays > 0 ? <span>คนแทนช่วย {NUM.format(a.coveredPersonDays)} คน-วัน</span> : null}
                            <span>หาได้ใน {r.speedDays == null ? '—' : `${NUM.format(r.speedDays)} วัน`}</span>
                            <span>ช้ากว่าที่ต้องการ {r.lateDays == null ? '—' : `${NUM.format(r.lateDays)} วัน`}</span>
                          </span>
                        </TableCell>
                      </TableRow>,
                    );
                  }
                  return out;
                })
              )}
            </TableBody>
          </Table>
        </div>
        {rows.length > limit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + 20)} data-testid="money-more">
            ดูเพิ่ม ({NUM.format(rows.length - limit)} ใบ)
          </Button>
        ) : null}
      </div>
    </HomeSection>
  );
}
