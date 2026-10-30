import React, { useMemo, useState } from 'react';
import { ChevronDown, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { CONTACT_BUCKET_LABEL, buildContactRows, type ContactBucket, type ContactRow } from '@/lib/recruitContactTab';
import { OverviewCard } from './RecruitOverviewParts';

/**
 * แท็บการติดต่อ (เจ้าของ 29 ต.ค. 2569) — คนที่ตอบ AI ว่าสนใจ โทรแล้วเป็นไง ถึงนัด ถึงมา · แยกช่องทาง
 * ตัวคิดอยู่ `recruitContactTab.ts` ที่เดียว · ทุกเลขกดดูรายชื่อได้ (`onOpenNames` ป๊อปรายชื่อเดิมของหน้า)
 * `children` = ของเดิมในแท็บ (กดลงลึก · งานค้างตอนนี้ · ผลงานรายคน)
 */
type Key = ContactBucket | 'total' | 'ok' | 'booked';
const LABEL: Record<Key, string> = { ...CONTACT_BUCKET_LABEL, total: 'สนใจ', ok: 'ติดต่อได้', booked: 'นัดได้' };
const TONE_OF: Partial<Record<Key, ToneKey>> = { fail: 'danger', ok: 'success', apptFailed: 'danger', booked: 'info', showed: 'success', noShow: 'danger', overdue: 'warn' };

export default function ContactTab({
  apps,
  onOpenNames,
  children,
}: {
  /** ใบสมัครที่กรอกในช่วง (cohort) */
  apps: readonly RecruitAppFact[];
  onOpenNames: (title: string, ids: readonly string[]) => void;
  children?: React.ReactNode;
}) {
  const { total, groups } = useMemo(() => buildContactRows(apps, new Date()), [apps]);
  const open = (k: Key, row: ContactRow = total) => onOpenNames(row === total ? LABEL[k] : `${row.name} · ${LABEL[k]}`, row.ids[k]);
  const tile = (k: Key) => {
    const n = k === 'total' ? total.total : k === 'ok' ? total.ok : k === 'booked' ? total.booked : total.counts[k];
    const tone = TONE_OF[k];
    return (
      <Button
        key={k}
        type="button"
        variant="ghost"
        onClick={() => open(k)}
        className="h-auto min-w-0 flex-1 flex-col items-stretch justify-start gap-0 whitespace-normal rounded-xl bg-muted/50 p-3 text-left font-normal hover:bg-muted"
        data-testid={`contact-tab-${k}`}
      >
        <span className={cn('text-xs', DASH.sub)}>{LABEL[k]}</span>
        <span className={cn('text-2xl font-medium tabular-nums', tone ? TONE[tone].num : 'text-foreground')}>
          {fmt(n)}
          <span className={cn('ml-1 text-sm font-normal', DASH.sub)}>คน</span>
        </span>
      </Button>
    );
  };

  return (
    <div className="space-y-3">
      <OverviewCard icon={PhoneCall} title="คนที่สนใจ โทรแล้วเป็นไง">
        <div className="space-y-2" data-testid="contact-tab-funnel">
          <div className="flex">{tile('total')}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {tile('waiting')}
            {tile('fail')}
            {tile('ok')}
          </div>
          <div className="space-y-2 rounded-xl border border-border p-2 sm:ml-8">
            <p className={cn('px-1 text-xs', DASH.sub)}>ติดต่อได้ {fmt(total.ok)} คน</p>
            {/* ว่างแล้วห้ามหาย — "ยังไม่ลงนัด" ขึ้นแม้ 0 (QA 30 ต.ค. 2569) */}
            <div className="grid gap-2 sm:grid-cols-3">
              {tile('apptFailed')}
              {tile('apptNone')}
              {tile('booked')}
            </div>
            <div className="space-y-2 rounded-xl border border-border p-2 sm:ml-8">
              <p className={cn('px-1 text-xs', DASH.sub)}>นัดได้ {fmt(total.booked)} คน</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {tile('showed')}
                {tile('noShow')}
                {tile('upcoming')}
                {tile('overdue')}
              </div>
            </div>
          </div>
        </div>
      </OverviewCard>

      <ChannelCard total={total} groups={groups} open={open} />

      {children}
    </div>
  );
}

const COLS: ReadonlyArray<{ key: Key; divider?: boolean }> = [
  { key: 'total' },
  { key: 'waiting' },
  { key: 'fail' },
  { key: 'ok', divider: true },
  { key: 'apptFailed' },
  { key: 'booked', divider: true },
  { key: 'showed' },
  { key: 'noShow' },
  { key: 'upcoming' },
  { key: 'overdue' },
];
const valueOf = (r: ContactRow, k: Key) => (k === 'total' ? r.total : k === 'ok' ? r.ok : k === 'booked' ? r.booked : r.counts[k]);

function ChannelCard({ total, groups, open }: { total: ContactRow; groups: ContactRow[]; open: (k: Key, row: ContactRow) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const cols = [...COLS.slice(0, 5), { key: 'apptNone' as Key }, ...COLS.slice(5)];
  const toggle = (k: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const line = (r: ContactRow, level: 0 | 1 | 2) => (
    <TableRow key={r.key} className={cn(level === 0 && 'bg-muted/40 font-medium hover:bg-muted/40')} data-testid={`contact-tab-channel-${level}`}>
      <TableCell className={cn('whitespace-nowrap text-sm', level === 2 && 'pl-9')}>
        {level === 1 ? (
          <Button type="button" variant="ghost" size="xs" className="-ml-2 h-7 gap-1 px-2 font-medium" aria-expanded={expanded.has(r.key)} onClick={() => toggle(r.key)}>
            <ChevronDown className={cn('size-4 transition-transform', !expanded.has(r.key) && '-rotate-90')} aria-hidden />
            {r.name}
          </Button>
        ) : (
          r.name
        )}
      </TableCell>
      {cols.map((c) => {
        const n = valueOf(r, c.key);
        const tone = TONE_OF[c.key];
        return (
          <TableCell key={c.key} className={cn('p-1 text-right tabular-nums', c.divider && 'border-l border-border')}>
            {n > 0 ? (
              <Button type="button" variant="ghost" size="xs" className={cn('h-7 px-2 tabular-nums', tone && TONE[tone].value)} onClick={() => open(c.key, r)}>
                {fmt(n)}
              </Button>
            ) : (
              <span className={cn('px-2', DASH.sub)}>0</span>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
  return (
    <OverviewCard icon={PhoneCall} title="แยกช่องทาง">
      <div className="overflow-x-auto rounded-xl border border-border" data-testid="contact-tab-channels">
        <Table className="min-w-[64rem]">
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">ช่องทาง</TableHead>
              {cols.map((c) => (
                <TableHead key={c.key} className={cn('text-right text-xs', c.divider && 'border-l border-border', TONE_OF[c.key] && TONE[TONE_OF[c.key]!].value)}>
                  {LABEL[c.key]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {line(total, 0)}
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                {line(g, 1)}
                {expanded.has(g.key) ? (g.children ?? []).map((c) => line(c, 2)) : null}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </OverviewCard>
  );
}
