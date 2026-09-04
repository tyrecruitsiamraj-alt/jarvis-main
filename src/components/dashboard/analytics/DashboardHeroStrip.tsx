import React, { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { DashboardActivityTrendPoint, DashboardAgeDaysBreakdown } from '@/lib/dashboard/types';

type Props = {
  items: DashboardAgeDaysBreakdown[];
  requestTotal: number;
  positionTotal: number;
  /** ตัวเลขบนชิป "คงเหลือทั้งระบบ" — เท่าการ์ด KPI คงเหลือ */
  remainingPositions: number;
  siteCount: number;
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

/** สีตัวเลขบนพื้น hero เข้ม — โทนอ่อนของภาษาความด่วนเดิม (พื้นเข้มตลอดจึงไม่มีคู่ dark) */
const HERO_BUCKET: Record<DashboardAgeDaysBreakdown['bucket'], { urgency: string; num: string }> = {
  '30+': { urgency: 'ด่วนมาก', num: 'text-red-400' },
  '16-30': { urgency: 'เริ่มด่วน', num: 'text-orange-300' },
  '8-15': { urgency: 'เริ่มด่วน', num: 'text-amber-300' },
  '1-7': { urgency: 'ยังไม่ด่วน', num: 'text-emerald-300' },
  advance: { urgency: 'รอได้', num: 'text-sky-300' },
};

/** ลำดับโชว์: ด่วนสุดซ้ายสุด (สลับจากถังข้อมูลที่เรียงเบา→หนัก) */
const HERO_ORDER: DashboardAgeDaysBreakdown['bucket'][] = ['30+', '16-30', '8-15', '1-7', 'advance'];

const DashboardHeroStrip: React.FC<Props> = ({
  items,
  requestTotal,
  positionTotal,
  remainingPositions,
  siteCount,
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

  return (
    <div className={cn(DASH.hero, 'px-4 py-4 md:px-5')}>
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-4">
        <div className="min-w-[260px] flex-[1.2]">
          <p className={DASH.heroLabel}>ต้องลงมือตอนนี้</p>
          <div className="mt-1.5 flex flex-wrap items-end gap-x-5 gap-y-2">
            {ordered.map((item, idx) => {
              const meta = HERO_BUCKET[item.bucket];
              const clickable = !!onBucketClick && item.count > 0;
              return (
                <button
                  key={item.bucket}
                  type="button"
                  disabled={!clickable}
                  onClick={clickable ? () => onBucketClick(item.bucket, item.label) : undefined}
                  title={`${item.label} · ${item.count.toLocaleString('th-TH')} ตำแหน่ง`}
                  className={cn(
                    'text-left',
                    clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                    item.count === 0 && 'opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'block font-bold leading-none tracking-tight tabular-nums',
                      idx === 0 ? 'text-4xl' : 'text-[22px]',
                      meta.num,
                    )}
                  >
                    {item.count.toLocaleString('th-TH')}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    {meta.urgency} · {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-200">
              คงเหลือทั้งระบบ {remainingPositions.toLocaleString('th-TH')} อัตรา ·{' '}
              {siteCount.toLocaleString('th-TH')} ไซต์
            </span>
            <span className="text-[10px] text-slate-400">
              รวม {bucketTotal.toLocaleString('th-TH')} ตำแหน่ง · {requestTotal.toLocaleString('th-TH')} ใบขอ
              {positionTotal !== bucketTotal ? ` · สต็อก ${positionTotal.toLocaleString('th-TH')} ตำแหน่ง` : ''}
            </span>
          </div>
        </div>

        {/* จุดเดียว (เลือกเดือนเดียว) ไม่วาดแท่ง — แท่งเดี่ยวสูง 100% อ่านเป็นกราฟพัง ตัวเลขไปอยู่บรรทัดล่างแทน */}
        {bars.max > 0 && bars.pts.length >= 2 ? (
          <div className="min-w-[200px] flex-1">
            {/* ช่วงยาวกว่า 12 เดือนโชว์แค่ท้ายสุด — ป้ายต้องบอกตามที่เห็นจริง ไม่ใช่ช่วงเต็มของตัวกรอง */}
            <p className={DASH.heroLabel}>
              เข้ามารายเดือน ·{' '}
              {bars.frozen ? 'กดเลือกเดือน' : bars.truncated ? '12 เดือนล่าสุด' : trendLabel}
            </p>
            {/* กดแท่ง = กรองทั้งแดชบอร์ดเป็นเดือนนั้น (เจ้าของสั่ง 10 ส.ค. 2569: "กดแล้วข้อมูล
                เปลี่ยนตามเหมือนเป็น calendar") · กดแท่งเดิมซ้ำ = ปลดตัวกรองกลับช่วงเดิม
                แท่งที่เลือกอยู่เป็นสีสว่างและมีขอบ ให้รู้ว่ากำลังดูเดือนไหน */}
            <div className="mt-2 flex h-14 items-end gap-1.5">
              {bars.pts.map((p, i) => {
                // มีเดือนที่เลือกอยู่ไหม — ใช้ตัดสินว่าจะหรี่เดือนอื่นหรือไม่
                const active = !!selectedMonth && p.date.slice(0, 7) === selectedMonth.slice(0, 7);
                const clickable = !!onMonthClick;
                return (
                  <button
                    key={`${p.label}-${i}`}
                    type="button"
                    disabled={!clickable}
                    onClick={clickable ? () => onMonthClick(p.date, p.label) : undefined}
                    title={`${p.label} · ${p.value.toLocaleString('th-TH')} อัตรา${
                      clickable ? (active ? ' — กดอีกครั้งเพื่อเลิกกรอง' : ' — กดเพื่อกรองเฉพาะเดือนนี้') : ''
                    }`}
                    aria-pressed={active}
                    className={cn(
                      'block flex-1 self-end rounded-t-[5px] rounded-b-sm transition-all',
                      // เจ้าของสั่ง 10 ส.ค. 2569: "กดเดือนไหนเดือนนั้นเข้มกว่า เดือนอื่นจางกว่า"
                      // เลือกอยู่ = สว่างเต็ม + วงแหวน · เดือนที่เหลือหรี่ลงให้ตาไปหยุดที่เดือนที่เลือก
                      active
                        ? 'bg-hero-strong opacity-100 ring-1 ring-white/60'
                        : p === peak
                          ? 'bg-hero'
                          : 'bg-hero-dim',
                      hasSelection && !active && 'opacity-30',
                      clickable && !active && 'hover:bg-hero hover:opacity-70',
                      clickable ? 'cursor-pointer' : 'cursor-default',
                    )}
                    style={{ height: `${Math.max(6, Math.round((p.value / bars.max) * 100))}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{bars.pts[0]?.label}</span>
              {peak ? (
                <span className="text-slate-300">
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
