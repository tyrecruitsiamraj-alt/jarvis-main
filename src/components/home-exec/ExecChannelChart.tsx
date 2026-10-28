import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HomeSection } from '@/components/home-ai-share/HomeSections';
import { fourMainRows, type FourMain } from '@/lib/channelFourMain';
import { cn } from '@/lib/utils';

/**
 * ═══ ช่องทางไหนได้ผล — กราฟเทียบ 4 ช่องทางหลัก (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"เอาเป็นช่องทางหลักเลย แบบเป็นกราฟเชิงเปรียบเทียบ … กด facebook ก็โชว์ว่า ช่องทางรองของ facebook อย่างละเท่าไหร่ ·
 * > 4 ก้อนนี้เอาเป็น Dropdown"*
 * เดิม = 4 กล่อง 3 อันดับต่อขั้น · ตอนนี้เลือกขั้นจาก Dropdown · กดแท่ง = กางช่องทางรอง · บรรทัดล่างบวกให้เห็นยอดรวม
 */
export type ChannelStage = 'registered' | 'appointed' | 'showed' | 'placed';
export type ChannelItem = { name: string; value: number };

const STAGES: ReadonlyArray<{ key: ChannelStage; label: string }> = [
  { key: 'registered', label: 'กรอกมา' },
  { key: 'appointed', label: 'นัดได้' },
  { key: 'showed', label: 'มาตามนัด' },
  { key: 'placed', label: 'ลงงาน' },
];

const NUM = new Intl.NumberFormat('th-TH');

function Bar({ value, max, strong, className }: { value: number; max: number; strong?: boolean; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className={cn('block h-3 flex-1 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <span className={cn('block h-full rounded-full', strong ? 'bg-primary' : 'bg-primary/60')} style={{ width: `${pct}%` }} />
    </span>
  );
}

export default function ExecChannelChart({
  stages,
  onSeeAll,
}: {
  /** null = ยังโหลดไม่เสร็จ */
  stages: Record<ChannelStage, ChannelItem[]> | null;
  onSeeAll: () => void;
}) {
  const [stage, setStage] = useState<ChannelStage>('registered');
  const [open, setOpen] = useState<FourMain | null>(null);
  const rows = useMemo(() => fourMainRows(stages?.[stage] ?? []), [stages, stage]);
  const max = Math.max(0, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);

  return (
    <HomeSection
      title="ช่องทางไหนได้ผล"
      sub="ในช่วงที่เลือก · หน่วย: คน"
      testId="exec-channels"
      right={
        <div className="flex flex-wrap items-center gap-3">
          <Select value={stage} onValueChange={(v) => setStage(v as ChannelStage)}>
            <SelectTrigger className="h-9 w-36 bg-card" aria-label="เลือกขั้น" data-testid="exec-channels-stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onSeeAll}>
            ดูทุกช่องทาง
          </Button>
        </div>
      }
    >
      <ul className="space-y-1" data-testid="exec-channels-bars">
        {rows.map((r) => {
          const expanded = open === r.main;
          return (
            <li key={r.main}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => setOpen(expanded ? null : r.main)}
                aria-expanded={expanded}
                data-testid={`exec-channel-${r.main}`}
              >
                <span className="flex w-24 shrink-0 items-center gap-1 font-medium text-foreground">
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden />
                  {r.main}
                </span>
                <Bar value={r.value} max={max} strong />
                <span className="w-16 shrink-0 text-right font-medium tabular-nums text-foreground">{stages ? NUM.format(r.value) : '—'}</span>
              </button>
              {expanded ? (
                <ul className="mb-2 ml-2 space-y-1 rounded-xl bg-muted/40 p-3 sm:ml-8" data-testid={`exec-channel-subs-${r.main}`}>
                  {r.subs.length === 0 ? (
                    <li className="text-sm text-muted-foreground">0 คน</li>
                  ) : (
                    r.subs.map((s) => (
                      <li key={s.name} className="flex items-center gap-3 text-sm">
                        {/* มือถือ: ชื่อกินที่เหลือ ซ่อนแท่ง (จอแคบแท่งเหลือ 0) */}
                        <span className="min-w-0 flex-1 truncate text-foreground sm:w-40 sm:flex-none" title={s.name}>
                          {s.name}
                        </span>
                        <Bar value={s.value} max={r.value} className="hidden sm:block" />
                        <span className="shrink-0 text-right tabular-nums text-foreground sm:w-14">{NUM.format(s.value)}</span>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs tabular-nums text-muted-foreground" data-testid="exec-channels-sum">
        {stages ? `${rows.map((r) => `${r.main} ${NUM.format(r.value)}`).join(' + ')} = ${NUM.format(total)} คน` : '—'}
      </p>
    </HomeSection>
  );
}
