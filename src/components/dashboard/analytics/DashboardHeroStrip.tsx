import React, { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DashboardActivityTrendPoint, DashboardAgeDaysBreakdown } from '@/lib/dashboard/types';

type Props = {
  items: DashboardAgeDaysBreakdown[];
  requestTotal: number;
  positionTotal: number;
  /** ตัวเลขบนชิป "คงเหลือทั้งระบบ" — เท่าการ์ด KPI คงเหลือ */
  remainingPositions: number;
  siteCount: number;
  /** เลือกช่วงวัน = เหลือหาของใบที่ต้องการคนในช่วง ไม่ใช่ทั้งระบบ (9 พ.ย. 2569 ป้ายเดิมเขียน "ทั้งระบบ" ทั้งที่เป็นแค่ช่วง) */
  inRange?: boolean;
  trend: DashboardActivityTrendPoint[];
  trendLabel: string;
  onBucketClick?: (bucket: DashboardAgeDaysBreakdown['bucket'], label: string) => void;
  /** กดแท่งเดือน → กรองทั้งแดชบอร์ดเป็นเดือนนั้น (`date` = YYYY-MM-01 ของจุดนั้น) */
  onMonthClick?: (monthStartYmd: string, label: string) => void;
  /** เดือนที่กรองอยู่ (YYYY-MM-01 หรือ YYYY-MM) — ใช้ไฮไลต์แท่งที่เลือก */
  selectedMonth?: string | null;
};

/**
 * hero เข้มหัวหน้า Dashboard (mockup rev.3 ข้อ 02) — "ต้องลงมือตอนนี้"
 *
 * เดิมข้อมูลชุดนี้คือแผง "งานไหนด่วนแค่ไหน · ตามวันที่ผ่านมา" (DashboardAgeOverview)
 * mockup ยกขึ้นมาเป็น hero: เลขด่วนมากตัวใหญ่สุด อีก 4 ถังเรียงรอง + ชิปคงเหลือทั้งระบบ
 * ถังและ drill-down ตรงกับของเดิม 1:1 (กดเลข = เปิดลิสต์ใบขอถังนั้น เกณฑ์ถังไม่เปลี่ยน)
 * ฝั่งขวาเป็นแท่ง "เข้ามารายเดือน" ย่อจาก activityTrend — ดูแนวโน้มได้โดยไม่ต้องกางกราฟใหญ่
 */

/**
 * สีของตัวเลขตามความค้าง — **ความหมายเดิมทั้งหมด** (แดง = ค้างนานสุด ฯลฯ) · ชุดสำหรับพื้นเข้ม (แถบกรมท่า/การ์ดเข้มธีมมืด)
 */
const HERO_BUCKET: Record<
  DashboardAgeDaysBreakdown['bucket'],
  { urgency: string; num: string }
> = {
  // 31 ต.ค. 2569 เจ้าของ Choice "อายุใบใช้ ค้าง" — "ด่วน" สงวนไว้กับป้ายเตือน (ชนิดใบ ฉุกเฉิน/ล่วงหน้า เป็นอีกเรื่อง)
  '30+': { urgency: 'ค้าง 30 วันขึ้นไป', num: 'text-red-400' },
  '16-30': { urgency: 'ค้าง 16–30 วัน', num: 'text-orange-300' },
  '8-15': { urgency: 'ค้าง 8–15 วัน', num: 'text-amber-300' },
  '1-7': { urgency: 'ค้าง 1–7 วัน', num: 'text-emerald-300' },
  advance: { urgency: 'ยังไม่ถึงวันต้องการ', num: 'text-sky-300' },
};

/** ลำดับโชว์: ด่วนสุดซ้ายสุด (สลับจากถังข้อมูลที่เรียงเบา→หนัก) */
const HERO_ORDER: DashboardAgeDaysBreakdown['bucket'][] = ['30+', '16-30', '8-15', '1-7', 'advance'];

const DashboardHeroStrip: React.FC<Props> = ({
  items,
  requestTotal,
  positionTotal,
  remainingPositions,
  siteCount,
  inRange = false,
  trend,
  trendLabel,
  onBucketClick,
  onMonthClick,
  selectedMonth,
}) => {
  const ordered = useMemo(
    () =>
      HERO_ORDER.map((bucket) => items.find((i) => i.bucket === bucket)).filter(
        (i): i is DashboardAgeDaysBreakdown => i != null,
      ),
    [items],
  );
  const bucketTotal = ordered.reduce((sum, i) => sum + i.count, 0);

  /**
   * แท่งรายเดือน — เอา 12 จุดล่าสุดพอ (ช่วงยาวกว่านั้นไปดูกราฟใหญ่ในแผง Life Cycle)
   *
   * ⚠️ **ต้องจำชุดล่าสุดที่มีหลายเดือนไว้** — พอกดแท่งเพื่อกรองเป็นเดือนเดียว
   * `trend` ที่ส่งเข้ามาจะเหลือจุดเดียว แถบแท่งจะหายทั้งแถบ (เงื่อนไข >= 2 จุด)
   * แล้วผู้ใช้จะกดเดือนอื่นหรือกดปลดตัวกรองไม่ได้เลย — ตันอยู่ตรงนั้น (เจอตอนตรวจจริง)
   * จึงคงชุดเดิมไว้เป็น "ปฏิทิน" ให้กดต่อได้ ส่วนตัวเลขในหน้าเปลี่ยนตามเดือนที่เลือกแล้ว
   */
  const lastMultiRef = useRef<{ date: string; label: string; value: number }[]>([]);
  const bars = useMemo(() => {
    const pts = trend.slice(-12).map((p) => ({ date: p.date, label: p.label, value: p.requestedPositions ?? 0 }));
    if (pts.length >= 2) lastMultiRef.current = pts;
    const shown = pts.length >= 2 ? pts : lastMultiRef.current;
    const max = Math.max(...shown.map((p) => p.value), 0);
    return { pts: shown, max, truncated: trend.length > 12, frozen: pts.length < 2 && shown.length >= 2 };
  }, [trend]);
  const peak = bars.max > 0 ? bars.pts.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  /** มีเดือนที่ถูกเลือกอยู่จริงในแถบนี้ไหม — ถ้ามี เดือนที่เหลือจะถูกหรี่ลง */
  const hasSelection =
    !!selectedMonth && bars.pts.some((p) => p.date.slice(0, 7) === selectedMonth.slice(0, 7));

  /**
   * 🔴 แถบกรมท่าแบบหน้าหลัก (เจ้าของ 9 พ.ย. 2569 "ทำ Dashboard ให้สวยแบบเดียวกันด้วย") — ธีมมืดเป็นการ์ดเข้ม
   * ⚠️ **ตัวเลข/นิยาม/ปุ่มกดทุกตัวเหมือนเดิม** — Control Tower ห้ามแตะตรรกะ · สีตัวเลขตามความค้างเดิม (ชุดพื้นเข้ม)
   */
  const dim = 'text-background/70 dark:text-foreground/70';

  return (
    <div className="rounded-2xl bg-foreground p-4 text-background shadow-xl shadow-foreground/10 dark:bg-card dark:text-foreground sm:p-6" data-testid="dashboard-hero">
      {/* จอใหญ่มากถึงวางแท่งรายเดือนข้างกัน — จอทั่วไปวางใต้ ไม่ให้ป้ายถังบีบจนตัดบรรทัด */}
      <div className="grid gap-x-10 gap-y-6 2xl:grid-cols-5">
        <div className="min-w-0 2xl:col-span-3">
          <p className="text-lg font-medium">ค้างมานานแค่ไหน</p>
          <div className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
            {ordered.map((item, idx) => {
              const meta = HERO_BUCKET[item.bucket];
              const clickable = !!onBucketClick && item.count > 0;
              return (
                <Button
                  key={item.bucket}
                  type="button"
                  variant="ghost"
                  disabled={!clickable}
                  onClick={clickable ? () => onBucketClick(item.bucket, item.label) : undefined}
                  title={`${item.label} · ${item.count.toLocaleString('th-TH')} อัตรา`}
                  className={cn(
                    'h-auto min-w-0 flex-col items-start gap-1 whitespace-normal rounded-xl p-3 text-left font-normal text-inherit hover:bg-background/10 hover:text-inherit disabled:opacity-100 dark:hover:bg-foreground/10',
                    item.count === 0 && 'opacity-50 disabled:opacity-50',
                  )}
                >
                  <span className={cn('block font-medium leading-none tabular-nums', idx === 0 ? 'text-6xl' : 'text-4xl', meta.num)}>
                    {item.count.toLocaleString('th-TH')}
                  </span>
                  <span className={cn('block text-sm', dim)}>{meta.urgency}</span>
                </Button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-medium tabular-nums text-primary-foreground">
              {inRange ? 'เหลือหา (ใบที่ต้องการคนในช่วง)' : 'เหลือหาทั้งระบบ'} {remainingPositions.toLocaleString('th-TH')} อัตรา ·{' '}
              {siteCount.toLocaleString('th-TH')} ไซต์
            </span>
            <span className={cn('text-sm tabular-nums', dim)}>
              {/* 31 ต.ค. 2569 เลขอัตราซ้ำกับชิปเหลือหาข้าง ๆ — ขึ้นเฉพาะตอนไม่เท่ากัน */}
              {bucketTotal !== remainingPositions ? `รวม ${bucketTotal.toLocaleString('th-TH')} อัตรา · ` : ''}
              {requestTotal.toLocaleString('th-TH')} ใบขอ
              {positionTotal !== bucketTotal ? ` · สต็อก ${positionTotal.toLocaleString('th-TH')} อัตรา` : ''}
            </span>
          </div>
        </div>

        {/* จุดเดียว (เลือกเดือนเดียว) ไม่วาดแท่ง — แท่งเดี่ยวสูง 100% อ่านเป็นกราฟพัง ตัวเลขไปอยู่บรรทัดล่างแทน */}
        {bars.max > 0 && bars.pts.length >= 2 ? (
          <div className="min-w-0 2xl:col-span-2">
            {/* ช่วงยาวกว่า 12 เดือนโชว์แค่ท้ายสุด — ป้ายต้องบอกตามที่เห็นจริง ไม่ใช่ช่วงเต็มของตัวกรอง */}
            <p className="text-lg font-medium">
              เข้ามารายเดือน{' '}
              <span className={cn('text-sm font-normal', dim)}>
                · {bars.frozen ? 'กดเลือกเดือน' : bars.truncated ? '12 เดือนล่าสุด' : trendLabel}
              </span>
            </p>
            {/* กดแท่ง = กรองทั้งแดชบอร์ดเป็นเดือนนั้น (เจ้าของสั่ง 10 ส.ค. 2569: "กดแล้วข้อมูล
                เปลี่ยนตามเหมือนเป็น calendar") · กดแท่งเดิมซ้ำ = ปลดตัวกรองกลับช่วงเดิม
                เดือนที่เลือก = เบอร์กันดี + วงแหวน · เดือนอื่นหรี่ลง (เจ้าของสั่ง 10 ส.ค. 2569) */}
            <div className="mt-3 flex h-20 items-end gap-1.5">
              {bars.pts.map((p, i) => {
                const active = !!selectedMonth && p.date.slice(0, 7) === selectedMonth.slice(0, 7);
                const clickable = !!onMonthClick;
                return (
                  <Button
                    key={`${p.label}-${i}`}
                    type="button"
                    variant="ghost"
                    disabled={!clickable}
                    onClick={clickable ? () => onMonthClick(p.date, p.label) : undefined}
                    title={`${p.label} · ${p.value.toLocaleString('th-TH')} อัตรา${
                      clickable ? (active ? ' — กดอีกครั้งเพื่อเลิกกรอง' : ' — กดเพื่อกรองเฉพาะเดือนนี้') : ''
                    }`}
                    aria-pressed={active}
                    className={cn(
                      'block h-auto min-w-0 flex-1 self-end rounded-md p-0 transition-all disabled:opacity-100',
                      active
                        ? 'bg-primary ring-2 ring-background hover:bg-primary dark:ring-foreground'
                        : p === peak
                          ? 'bg-background/60 hover:bg-background/80 dark:bg-foreground/60 dark:hover:bg-foreground/80'
                          : 'bg-background/25 hover:bg-background/40 dark:bg-foreground/25 dark:hover:bg-foreground/40',
                      hasSelection && !active && 'opacity-40',
                    )}
                    style={{ height: `${Math.max(6, Math.round((p.value / bars.max) * 100))}%` }}
                  />
                );
              })}
            </div>
            <div className={cn('mt-2 flex justify-between gap-2 text-sm tabular-nums', dim)}>
              <span>{bars.pts[0]?.label}</span>
              {peak ? (
                <span className="font-medium text-background dark:text-foreground">
                  {peak.label} {peak.value.toLocaleString('th-TH')} อัตรา
                </span>
              ) : null}
              <span>{bars.pts[bars.pts.length - 1]?.label}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardHeroStrip;
