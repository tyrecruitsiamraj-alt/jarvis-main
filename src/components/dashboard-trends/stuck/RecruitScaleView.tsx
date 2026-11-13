import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { SCALE_MORE, SCALE_STRIP, SCALE_TITLES, type ScaleSectionKey, type ScaleStripKey, type TrendSense } from '@/lib/recruitScale';
import TrendDelta from './TrendDelta';

/** ช่องบนแถบ: เลขช่วงนี้ · หน่วย · เลขช่วงก่อน (null = เทียบไม่ได้) */
export type ScaleStripCell = { n: number | null; unit: string; prev: number | null; sense?: TrendSense };

/**
 * ═══ ภาพรวมงานสรรหา แบบ Scale ลง (เจ้าของ 13 พ.ย. 2569 · แบบร่างรอบ 2 แล้ว "ทำมาก่อนเลย") ═══
 * แถบบนสุด 6 ช่อง = ภาพใหญ่ของข้อ 1–6 พร้อมเพิ่มขึ้น/ลดลงจากช่วงก่อน · ปุ่มใต้แถบ = พื้นที่ · เทียบเดือน · เหตุผล
 * กดช่อง = ข้อนั้นขึ้นโซนเดียวใต้แถบ (ค่าเริ่ม = ข้อ 1) · ในโซนกดลงต่อด้วยตารางเดิมของข้อนั้น
 * แถบกับปุ่มอยู่ที่เดิมเสมอ · โซนจองความสูงไว้ กดสลับแล้วของบนจอไม่กระโดด
 */
export default function RecruitScaleView({
  value,
  onChange,
  strip,
  children,
}: {
  value: ScaleSectionKey;
  onChange: (k: ScaleSectionKey) => void;
  strip: Record<ScaleStripKey, ScaleStripCell>;
  /** เนื้อหาของข้อที่เลือก */
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4" data-testid="recruit-scale">
      <Card variant="solid" className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 xl:grid-cols-6" role="group" aria-label="ภาพรวม">
          {SCALE_STRIP.map((k) => {
            const c = strip[k];
            const on = value === k;
            return (
              <Button
                key={k}
                type="button"
                variant="ghost"
                aria-pressed={on}
                onClick={() => onChange(k)}
                className={cn(
                  'h-full min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-none px-4 py-3 text-left font-normal',
                  on ? 'bg-muted hover:bg-muted' : 'bg-card',
                )}
                data-testid={`scale-cell-${k}`}
              >
                {/* หัวจองไว้ 2 บรรทัด — หัวยาว (ข้อ 5) ขึ้นบรรทัดสองแล้วเลขทุกช่องยังอยู่แนวเดียวกัน */}
                <span className={cn('min-h-10 text-sm leading-5', on ? 'font-medium text-foreground' : 'text-muted-foreground')}>{SCALE_TITLES[k]}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-medium tabular-nums text-foreground">{c.n === null ? '—' : fmt(c.n)}</span>
                  <span className="text-xs text-muted-foreground">{c.unit}</span>
                </span>
                <span className="flex min-h-4 items-center">{c.n === null ? null : <TrendDelta cur={c.n} prev={c.prev} sense={c.sense} from />}</span>
              </Button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {SCALE_MORE.map((k) => (
          <Button key={k} type="button" size="sm" variant={value === k ? 'default' : 'outline'} aria-pressed={value === k} onClick={() => onChange(k)} data-testid={`scale-more-${k}`}>
            {SCALE_TITLES[k]}
          </Button>
        ))}
      </div>

      <div className="min-h-96" data-testid={`scale-zone-${value}`}>
        {children}
      </div>
    </div>
  );
}
