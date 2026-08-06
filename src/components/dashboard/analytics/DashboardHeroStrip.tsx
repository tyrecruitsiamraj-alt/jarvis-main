import React, { useMemo } from 'react';
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
}) => {
  const ordered = useMemo(
    () =>
      HERO_ORDER.map((bucket) => items.find((i) => i.bucket === bucket)).filter(
        (i): i is DashboardAgeDaysBreakdown => i != null,
      ),
    [items],
  );
  const bucketTotal = ordered.reduce((sum, i) => sum + i.count, 0);

  // แท่งรายเดือน — เอา 12 จุดล่าสุดพอ (ช่วงยาวกว่านั้นไปดูกราฟใหญ่ในแผง Life Cycle)
  const bars = useMemo(() => {
    const pts = trend.slice(-12).map((p) => ({ label: p.label, value: p.requestedPositions ?? 0 }));
    const max = Math.max(...pts.map((p) => p.value), 0);
    return { pts, max, truncated: trend.length > 12 };
  }, [trend]);
  const peak = bars.max > 0 ? bars.pts.reduce((a, b) => (b.value > a.value ? b : a)) : null;

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
              เข้ามารายเดือน · {bars.truncated ? '12 เดือนล่าสุด' : trendLabel}
            </p>
            <div className="mt-2 flex h-14 items-end gap-1.5" aria-hidden>
              {bars.pts.map((p, i) => (
                <span
                  key={`${p.label}-${i}`}
                  title={`${p.label} · ${p.value.toLocaleString('th-TH')} อัตรา`}
                  className={cn(
                    'block flex-1 rounded-t-[5px] rounded-b-sm',
                    p === peak ? 'bg-[#5b8bff]' : 'bg-[#2b3a5e]',
                  )}
                  style={{ height: `${Math.max(6, Math.round((p.value / bars.max) * 100))}%` }}
                />
              ))}
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
