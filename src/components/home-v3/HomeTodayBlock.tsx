/**
 * ═══ ก้อน 3 — วันนี้ท่อเดินแค่ไหน (เทียบเมื่อวาน · นับเป็นคน) · หน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569) ═══
 *
 * ผู้สมัครใหม่ → โทรแล้ว → คุยได้ → สนใจ → ได้นัด → ไปถึงงาน · นิยามอยู่ `src/lib/homeOverview.ts` ที่เดียว
 * 🔴 **ไม่มี % ระหว่างขั้น** — แต่ละขั้นคือ "วันนี้มีกี่คนอยู่ขั้นนี้" คนละกลุ่มคนกัน (ไม่ใช่ cohort) คิด % แล้วโกหก
 * ป้าย/คำอธิบายมาจาก `metricDictionary` (`today.*`) — ห้ามพิมพ์ป้ายในไฟล์นี้
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import HomeSection from '@/components/home/HomeSection';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import type { HomeTodayFunnel } from '@/lib/homeOverview';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const fmt = (n: number) => NUM.format(n);

function deltaText(today: number, yesterday: number): { text: string; className: string } {
  const d = today - yesterday;
  if (d === 0) return { text: 'เท่าเมื่อวาน', className: DASH.muted };
  return d > 0
    ? { text: `▲ ${fmt(d)}`, className: TONE.success.value }
    : { text: `▼ ${fmt(-d)}`, className: TONE.danger.value };
}

const HomeTodayBlock: React.FC<{
  today: HomeTodayFunnel | null;
  loading: boolean;
  error?: string;
  buLabel?: string | null;
}> = ({ today, loading, error, buLabel }) => (
  <HomeSection title={`วันนี้ท่อเดินแค่ไหน${buLabel ? ` · ${buLabel}` : ''}`} subtitle="เทียบเมื่อวาน · นับเป็นคน">
    {error ? (
      <p className={cn('text-sm', TONE.warn.value)}>อ่านไม่ได้ — {error}</p>
    ) : !today ? (
      <p className={cn('text-sm', DASH.muted)}>{loading ? 'กำลังอ่านตัวเลข…' : 'ยังไม่มีข้อมูล'}</p>
    ) : (
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {today.steps.map((s, i) => {
          const key = `today.${s.key}` as MetricKey;
          const d = deltaText(s.today, s.yesterday);
          return (
            <li key={s.key} className="relative rounded-xl border border-border/60 p-3" title={metricHelp(key)}>
              {i > 0 ? (
                <ChevronRight
                  className={cn('absolute -left-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 lg:block', DASH.muted)}
                  aria-hidden
                />
              ) : null}
              <p className={cn('text-xs', DASH.muted)}>{METRICS[key].label}</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                {fmt(s.today)}
                <span className={cn('ml-1 text-xs font-normal', DASH.muted)}>{METRICS[key].unit}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className={DASH.muted}>เมื่อวาน {fmt(s.yesterday)}</span>
                <span className={d.className}>{d.text}</span>
              </p>
            </li>
          );
        })}
      </ol>
    )}
  </HomeSection>
);

export default HomeTodayBlock;
