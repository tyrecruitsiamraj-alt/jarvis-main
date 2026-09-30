/**
 * ═══ ผลโทร — โทรไปแล้วผลเป็นไง (หน้าหลัก รอบ 18 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"มีอีก กราฟที่บอกผมว่าการโทรเนี่ยโทรไปแล้วผลเป็นไง โทรแล้วไป รับแล้ววาง รับแล้วไม่ไปไรงี้ แต่ทำเป็นแบบซ่อนไว้
 * เหมือน ใครอยู่ในระบบ แต่เอามาก่อน ใครอยู่ในระบบ"*
 * - **ปิดไว้เป็นค่าตั้งต้น** เหลือแถบหัว (ผลโทร · หัวข้อ · มีผลกี่รายชื่อ · ลูกศร) แบบเดียวกับ "ใครอยู่ในระบบ" · อยู่ก่อนแผงนั้น
 * - หนึ่งรายชื่อ = ผลล่าสุดผลเดียว (ทั้ง AI และคนโทร = นับฝั่งที่โทรทีหลัง) ⇒ รวมทุกแถว = เลขบนแถบหัว
 * - หัวข้อ/ช่วง/BU เดียวกับกล่องตัวเลขด้านบน (เปลี่ยน dropdown/ปฏิทินแล้วเปลี่ยนตาม)
 * - หนึ่งแถวต่อผล: ชื่อผล · แถบยาวเท่า % ของผลทั้งหมด แบ่งสีว่า AI โทรเท่าไหร่ คนโทรเท่าไหร่ (สีเดียวกับกราฟหลัก) · จำนวน · %
 * - ป้ายผลมาจากพจนานุกรมเมตริก (ติดตาม = บอกว่าไป/ไม่ไป · ผู้สมัคร/จับคู่งาน = ตอบว่าสนใจ/ไม่สนใจ) · จี้แถวเห็นความหมาย
 * นิยามอยู่ `src/lib/homeCallResults.ts` · ตัวเลขมาจาก `/api/home-ai-share?results=`
 * 🔴 ประกอบจาก shadcn (Card · Collapsible · Button · Skeleton) + Tailwind · สีจาก `segmentStyle` (TONE) · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { segmentDotClass, segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { TONE } from '@/lib/designTokens';
import { AI_SHARE_SEGMENT_LABEL, AI_SHARE_UNIT, type AiShareBlockKey, type AiShareWindow } from '@/lib/homeAiShare';
import { fetchHomeAiShareResults } from '@/lib/homeAiShareApi';
import { callResultRows, type AiShareResultsResponse } from '@/lib/homeCallResults';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

const HomeCallResultsPanel: React.FC<{
  block: AiShareBlockKey;
  /** ชื่อหัวข้อ เช่น "ติดตาม" — ขึ้นบนแถบหัว */
  blockTitle: string;
  win: AiShareWindow;
}> = ({ block, blockTitle, win }) => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AiShareResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchHomeAiShareResults(block, win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดผลโทรไม่ขึ้น ลองอีกครั้ง');
      });
    return () => {
      alive = false;
    };
  }, [block, win]);

  // เปลี่ยนหัวข้อ/ช่วงแล้วเลขเก่าห้ามค้าง — ใช้เฉพาะคำตอบที่ตรงกับที่เลือกอยู่
  const current = data && data.block === block && data.from === win.from && data.to === win.to ? data : null;
  const failed = error ?? current?.error ?? null;
  const table = current && !current.error ? callResultRows(current) : null;
  const headline = table ? `${blockTitle} · มีผล ${NUM.format(table.total)} ${AI_SHARE_UNIT}` : null;

  return (
    <Card variant="glass" className="p-5 sm:p-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <h2 className="-mx-2">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between gap-3 rounded-xl px-2 py-2 text-base font-medium text-foreground"
            >
              <span>ผลโทร</span>
              <span className="inline-flex items-center gap-3">
                {headline ? <span className="text-xs font-normal text-muted-foreground tabular-nums">{headline}</span> : null}
                <ChevronDown className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
              </span>
            </Button>
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent className="space-y-4 pt-4">
          {!table && !failed ? (
            <div className="space-y-2" aria-label="กำลังโหลดผลโทร">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded-lg" />
              ))}
            </div>
          ) : failed && !table ? (
            <p className={cn('text-sm', TONE.danger.value)}>{failed}</p>
          ) : table && table.total === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">ช่วงนี้ยังไม่มีผลโทร</p>
          ) : table ? (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground" aria-label="สีในแถบ">
                {(['ai', 'staff'] as const).map((k) => (
                  <span key={k} className="inline-flex items-center gap-2">
                    <span className={cn('inline-block h-3 w-3 rounded-sm', segmentDotClass(k))} aria-hidden />
                    {AI_SHARE_SEGMENT_LABEL[k]}
                  </span>
                ))}
              </div>
              <ul className="space-y-3" aria-label={`ผลโทร ${blockTitle}`}>
                {table.rows.map((r) => (
                  <li
                    key={r.key}
                    className="flex items-center gap-3"
                    title={`${r.hint}\n${AI_SHARE_SEGMENT_LABEL.ai} ${NUM.format(r.ai)} · ${AI_SHARE_SEGMENT_LABEL.staff} ${NUM.format(r.staff)}`}
                  >
                    <span className="w-32 shrink-0 truncate text-sm text-foreground sm:w-44">{r.label}</span>
                    {/* ยาวทั้งแถบ = % ของผลทั้งหมด · ในแถบแบ่งสี AI/คน (สีเดียวกับกราฟหลัก) */}
                    <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className={cn('h-full bg-current', segmentFillClass('ai'))}
                        style={{ width: `${(r.ai / table.total) * 100}%` }}
                      />
                      <span
                        className={cn('h-full bg-current', segmentFillClass('staff'))}
                        style={{ width: `${(r.staff / table.total) * 100}%` }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums text-foreground">{NUM.format(r.total)}</span>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{NUM.format(r.pct)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default HomeCallResultsPanel;
