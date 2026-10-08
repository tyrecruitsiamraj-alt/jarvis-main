/**
 * ═══ ชิ้นส่วนหน้าหลักโฉมใหม่ (แบบ Codex · เจ้าของ 8 ต.ค. 2569) ═══
 * เจ้าของ: *"ลองให้ Codex ออกแบบความสวยงามมาให้ แต่ยังคง Concept ต้องตอบได้หมด ไม่เอาแค่ไปเท่าไหร่
 * แต่ต้องบอกได้ว่าไปเนี่ย Ai โทร คนโทรเท่าไหร่ Bu ไหนใช้เยอะ"*
 * - `HomeSection` = การ์ดหัวข้อ (ชื่อ · ช่วง/BU · ช่องขวา)
 * - `SplitBars` = แท่งนอน หนึ่งแถว = หนึ่งผล/หนึ่ง BU แบ่งชิ้นตามใครโทร · เลขของทุกชิ้นเขียนไว้ใต้แท่ง (ไม่ต้องเดาจากความยาว)
 * - `StatStrip` = แถวตัวเลขคั่นเส้น (ขั้นมีลูกศรได้) · ตัวแยกในขั้นรวม = เลขของขั้น
 * 🔴 shadcn Card + Tailwind · สีจาก TONE ชุดเดียวกับกล่อง/กราฟ (`AI_SHARE_CALLED_TONE`) · ไม่มีประโยคอธิบายบนจอ
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { segmentDotClass } from '@/components/home-ai-share/segmentStyle';
import { TONE } from '@/lib/designTokens';
import { AI_SHARE_CALLED_TONE, AI_SHARE_SEGMENT_LABEL, type AiShareSegment } from '@/lib/homeAiShare';
import type { ReportItem } from '@/lib/homeTopicReport';
import type { SplitRow } from '@/lib/homeSplit';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

export function HomeSection({
  title,
  sub,
  right,
  children,
  className,
  testId,
}: {
  title: string;
  sub?: string | null;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <Card variant="solid" className={cn('min-w-0 space-y-4 p-5 sm:p-6', className)} data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
          {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

/** สีชิ้นในแท่ง — ยังไม่โทร = เทาจาง (จุดกลวงของกล่องใช้ในแท่งไม่ได้) */
export function segBarClass(seg: AiShareSegment): string {
  return seg === 'notCalled' ? 'bg-muted-foreground/25' : TONE[AI_SHARE_CALLED_TONE[seg]].dot;
}

export function SegLegend({ segs }: { segs: readonly AiShareSegment[] }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {segs.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-full', segmentDotClass(s))} aria-hidden />
          {AI_SHARE_SEGMENT_LABEL[s]}
        </span>
      ))}
    </p>
  );
}

/**
 * แท่งนอนแบ่ง AI/คน — ความยาวเทียบแถวที่มากสุด · ชิ้นกว้างพอขึ้นเลขในแท่ง · ใต้แท่งเขียนทุกชิ้นที่ไม่ใช่ 0
 * `dotOf` = จุดสีหน้าชื่อแถว (ผล) · ไม่ส่ง = ไม่มีจุด (BU)
 */
export function SplitBars({
  rows,
  segs,
  loading = false,
  emptyText,
  dotOf,
  testId,
}: {
  rows: readonly SplitRow[];
  segs: readonly AiShareSegment[];
  loading?: boolean;
  emptyText: string;
  dotOf?: (key: string) => string | null;
  testId?: string;
}) {
  if (loading) return <Skeleton className="h-48 w-full rounded-xl" />;
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-3" data-testid={testId}>
      {rows.map((r) => {
        const parts = segs.map((s) => ({ s, n: r.parts[s] ?? 0 })).filter((p) => p.n > 0);
        const dot = dotOf?.(r.key) ?? null;
        return (
          <li
            key={r.key}
            className={cn(
              'grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-x-3 gap-y-1',
              // ก้อน: เส้นคั่นก่อนก้อนใหม่ · ผลย่อยของโทรแล้วย่อหน้ามีเส้นนำด้านซ้าย
              r.divider && 'border-t border-foreground/10 pt-3',
              r.child && 'ml-2 border-l-2 border-foreground/15 pl-3',
            )}
            data-testid={testId ? `${testId}-${r.key}` : undefined}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
              {dot ? <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} aria-hidden /> : null}
              <span className={cn('truncate', (r.key === 'all' || r.key === 'called') && 'font-medium')}>{r.label}</span>
            </span>
            <span className="flex h-6 overflow-hidden rounded-md bg-muted" aria-hidden>
              {parts.map((p) => {
                const w = (p.n / max) * 100;
                return (
                  <span
                    key={p.s}
                    className={cn(
                      'flex h-full items-center justify-center text-xs font-medium tabular-nums',
                      segBarClass(p.s),
                      p.s === 'notCalled' ? 'text-foreground' : 'text-white',
                    )}
                    style={{ width: `${w}%` }}
                  >
                    {w >= 9 ? NUM.format(p.n) : null}
                  </span>
                );
              })}
            </span>
            <span className="text-right text-base font-medium tabular-nums text-foreground">{NUM.format(r.total)}</span>
            {/* ใครโทรเท่าไหร่ — เขียนเลขทุกชิ้น (เจ้าของ "ไปเนี่ย AI โทร คนโทรเท่าไหร่") · คำขยายของแถว (ล้มเหลวคืออะไร) อยู่บรรทัดถัดไป */}
            <span className="col-start-2 col-end-4 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
              {segs.map((s) => (
                <span key={s} className={cn((r.parts[s] ?? 0) === 0 && 'opacity-60')}>
                  {AI_SHARE_SEGMENT_LABEL[s]} {NUM.format(r.parts[s] ?? 0)}
                </span>
              ))}
            </span>
            {r.note ? <span className="col-start-2 col-end-4 text-xs text-muted-foreground">{r.note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

export type StatItem = ReportItem & { unit?: string };

/** แถวตัวเลขคั่นเส้น · `arrows` = ขั้นต่อกัน (ลูกศรระหว่างช่อง) · ตัวแยก (`parts`) เขียนใต้เลข */
export function StatStrip({ items, arrows = false, testId }: { items: readonly StatItem[]; arrows?: boolean; testId?: string }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-y-3 rounded-xl border border-foreground/10" data-testid={testId}>
      {items.map((it, i) => (
        <li key={it.key} className="flex min-w-36 flex-1 items-center" data-testid={testId ? `${testId}-${it.key}` : undefined}>
          {i > 0 ? (
            arrows ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <span className="h-full w-px bg-foreground/10" aria-hidden />
            )
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
            <span className="text-xs text-muted-foreground">{it.label}</span>
            <span className="text-2xl font-medium tabular-nums text-foreground">
              {NUM.format(it.value)}
              {it.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{it.unit}</span> : null}
            </span>
            {it.parts?.length ? (
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                {it.parts.map((p) => (
                  <span key={p.key} className="inline-flex items-center gap-1.5">
                    <span
                      className={cn('h-2 w-2 rounded-full', p.seg ? segmentDotClass(p.seg) : TONE[p.tone ?? 'neutral'].dot)}
                      aria-hidden
                    />
                    {p.label} <span className="font-medium text-foreground">{NUM.format(p.value)}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
