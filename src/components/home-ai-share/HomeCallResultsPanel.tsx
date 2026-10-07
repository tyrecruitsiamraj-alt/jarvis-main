/**
 * ═══ ผลโทร — โทรไปแล้วผลเป็นไง (หน้าหลัก รอบ 18 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"มีอีก กราฟที่บอกผมว่าการโทรเนี่ยโทรไปแล้วผลเป็นไง โทรแล้วไป รับแล้ววาง รับแล้วไม่ไปไรงี้ แต่ทำเป็นแบบซ่อนไว้
 * เหมือน ใครอยู่ในระบบ แต่เอามาก่อน ใครอยู่ในระบบ"*
 * - **ปิดไว้เป็นค่าตั้งต้น** เหลือแถบหัว (ผลโทร · หัวข้อ · มีผลกี่รายชื่อ · ลูกศร) แบบเดียวกับแผง "ใครอยู่ในระบบ" เดิม
 *   (แผงนั้นย้ายไป ตั้งค่า › ผู้ใช้งาน แล้ว 30 ก.ย. 2569 · แผงนี้เลยเป็นแผงสุดท้ายของหน้าหลัก)
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { segmentDotClass, segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { TONE } from '@/lib/designTokens';
import { AI_SHARE_SEGMENT_LABEL, AI_SHARE_UNIT, type AiShareBlockKey, type AiShareWindow } from '@/lib/homeAiShare';
import { fetchHomeAiShareResults } from '@/lib/homeAiShareApi';
import { FOLLOW_MATRIX_COL_LABEL, FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import {
  callResultRows,
  followResultRows,
  type AiShareResultsResponse,
  type FollowResultScope,
  type FollowResultsSplit,
} from '@/lib/homeCallResults';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/** หัวคอลัมน์แท็บ — คำเดียวกับแท็บบนหน้าติดตาม */
const TEAM_COLS = [
  ['main', 'ติดตามคนเริ่มงาน'],
  ['replacement', 'ติดตามส่งคนแทน'],
] as const;

/** แท็บของตาราง — รวม 2 แท็บ หรือดูทีละแท็บ (คำเดียวกับแท็บบนหน้าติดตาม) */
const SCOPES: ReadonlyArray<readonly [FollowResultScope, string]> = [['all', 'รวม 2 แท็บ'], ...TEAM_COLS];

/**
 * ผลโทรของหัวข้อติดตาม — ตาราง ผล × AI โทร / คนโทร / รวม (เจ้าของ 7 ต.ค. 2569: *"ตอบว่าไป 651 แล้ว 651 คือ คนเท่าไหร่
 * Ai เท่าไหร่"* → *"เอาเป็นตารางเลย"*) · แท็บ รวม / แยกแท็บ · แถบ = % ของทั้งหมด แบ่งสี AI/คนโทร ·
 * แถวล่าง = ทั้งหมด (แท็บรวม = กล่องด้านบน) · ทุกแถว AI + คนโทร = รวม
 */
function FollowResultsTable({ split, blockTitle }: { split: FollowResultsSplit; blockTitle: string }) {
  const [scope, setScope] = useState<FollowResultScope>('all');
  const t = followResultRows(split, scope);
  const cell = 'w-16 shrink-0 text-right text-sm tabular-nums sm:w-24';
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as FollowResultScope)}>
          <TabsList>
            {SCOPES.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {/* จอแคบไม่มีแถบ ⇒ ไม่มีป้ายสีของแถบ */}
        <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground sm:flex" aria-label="สีในแถบ">
          {(['ai', 'staff'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span className={cn('inline-block h-3 w-3 rounded-sm', segmentDotClass(k))} aria-hidden />
              {AI_SHARE_SEGMENT_LABEL[k]}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3" role="table" aria-label={`ผลโทร ${blockTitle}`} data-testid="home-follow-results">
        <div role="row" className="flex items-end gap-3 text-xs text-muted-foreground">
          <span role="columnheader" className="w-24 shrink-0 sm:w-32">
            ผล
          </span>
          <span role="columnheader" className="hidden flex-1 sm:block" />
          {(['ai', 'staff'] as const).map((k) => (
            <span key={k} role="columnheader" className={cn(cell, 'text-xs')}>
              {AI_SHARE_SEGMENT_LABEL[k]}
            </span>
          ))}
          <span role="columnheader" className={cn(cell, 'text-xs')}>
            รวม
          </span>
        </div>
        {t.rows.map((r) => (
          <div key={r.key} role="row" className="flex items-center gap-3" title={`${NUM.format(r.pct)}% ของทั้งหมด`}>
            <span role="cell" className="inline-flex w-24 shrink-0 items-center gap-2 text-sm text-foreground sm:w-32">
              <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TONE[FOLLOW_MATRIX_COL_TONE[r.key]].dot)} aria-hidden />
              <span className="truncate">{FOLLOW_MATRIX_COL_LABEL[r.key]}</span>
            </span>
            <span role="cell" className="hidden h-2.5 flex-1 overflow-hidden rounded-full bg-muted sm:flex" aria-hidden>
              <span
                className={cn('h-full bg-current', segmentFillClass('ai'))}
                style={{ width: `${t.total > 0 ? (r.ai / t.total) * 100 : 0}%` }}
              />
              <span
                className={cn('h-full bg-current', segmentFillClass('staff'))}
                style={{ width: `${t.total > 0 ? (r.staff / t.total) * 100 : 0}%` }}
              />
            </span>
            <span role="cell" className={cn(cell, 'text-muted-foreground')}>
              {NUM.format(r.ai)}
            </span>
            <span role="cell" className={cn(cell, 'text-muted-foreground')}>
              {NUM.format(r.staff)}
            </span>
            <span role="cell" className={cn(cell, 'font-medium text-foreground')}>
              {NUM.format(r.total)}
            </span>
          </div>
        ))}
        <div role="row" className="flex items-center gap-3 border-t border-foreground/10 pt-3">
          <span role="cell" className="w-24 shrink-0 text-sm font-medium text-foreground sm:w-32">
            {FOLLOW_MATRIX_COL_LABEL.total}
          </span>
          <span role="cell" className="hidden flex-1 sm:block" aria-hidden />
          <span role="cell" className={cn(cell, 'text-muted-foreground')}>
            {NUM.format(t.byCaller.ai)}
          </span>
          <span role="cell" className={cn(cell, 'text-muted-foreground')}>
            {NUM.format(t.byCaller.staff)}
          </span>
          <span role="cell" className={cn(cell, 'font-medium text-foreground')}>
            {NUM.format(t.total)}
          </span>
        </div>
      </div>
    </>
  );
}

const HomeCallResultsPanel: React.FC<{
  block: AiShareBlockKey;
  /** ชื่อหัวข้อ เช่น "ติดตาม" — ขึ้นบนแถบหัว */
  blockTitle: string;
  win: AiShareWindow;
  /** เลขรอบอัปเดตสดของหน้า (6 ต.ค. 2569) — เปลี่ยนแล้วโหลดใหม่เงียบ ๆ เฉพาะตอนแผงกางอยู่ */
  tick?: number;
}> = ({ block, blockTitle, win, tick = 0 }) => {
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

  // อัปเดตสด — แผงพับอยู่ไม่โหลด (ไม่มีใครดู) · ล้มก็เงียบ เลขเดิมค้างไว้
  const openRef = React.useRef(open);
  openRef.current = open;
  const keyRef = React.useRef({ block, win });
  keyRef.current = { block, win };
  useEffect(() => {
    if (tick === 0 || !openRef.current) return;
    let alive = true;
    const { block: b, win: w } = keyRef.current;
    fetchHomeAiShareResults(b, w)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  // เปลี่ยนหัวข้อ/ช่วงแล้วเลขเก่าห้ามค้าง — ใช้เฉพาะคำตอบที่ตรงกับที่เลือกอยู่
  const current = data && data.block === block && data.from === win.from && data.to === win.to ? data : null;
  const failed = error ?? current?.error ?? null;
  const followSplit = current && !current.error && block === 'follow' ? current.follow ?? null : null;
  const followTable = followSplit ? followResultRows(followSplit) : null;
  const table = current && !current.error && !followTable ? callResultRows(current) : null;
  const headline = followTable
    ? `${blockTitle} · ทั้งหมด ${NUM.format(followTable.total)} ${AI_SHARE_UNIT}`
    : table
      ? `${blockTitle} · มีผล ${NUM.format(table.total)} ${AI_SHARE_UNIT}`
      : null;
  const ready = !!table || !!followTable;

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
          {!ready && !failed ? (
            <div className="space-y-2" aria-label="กำลังโหลดผลโทร">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded-lg" />
              ))}
            </div>
          ) : failed && !ready ? (
            <p className={cn('text-sm', TONE.danger.value)}>{failed}</p>
          ) : followSplit ? (
            <FollowResultsTable split={followSplit} blockTitle={blockTitle} />
          ) : table ? (
            /* 🔴 ไม่มีผลโทรในช่วงนี้ = แถวครบทุกผลเป็น 0 ไม่สลับไปเป็นข้อความ (เจ้าของสั่ง 1 ต.ค. 2569 —
               สลับช่วงวัน/หัวข้อแล้วแผงห้ามย่อ/ขยายเอง "ถ้าไม่มีข้อมูลก็เป็น 0 ไป") */
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
                        style={{ width: `${table.total > 0 ? (r.ai / table.total) * 100 : 0}%` }}
                      />
                      <span
                        className={cn('h-full bg-current', segmentFillClass('staff'))}
                        style={{ width: `${table.total > 0 ? (r.staff / table.total) * 100 : 0}%` }}
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
