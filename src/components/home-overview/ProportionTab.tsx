/**
 * แท็บ "สัดส่วน" หน้าหลัก (เจ้าของ 28 ต.ค. 2569) — แต่ละเรื่อง AI ทำกี่ % คนทำกี่ %
 * นิยาม/Choice อยู่หัว `src/lib/homeProportion.ts` · ไม่มีเลขรวมเลขเดียว · % = AI ได้โทร รวมที่คนตามต่อ
 * กดแถว = แผงข้าง: รายชื่อ = โทรแล้ว + รอโทร + ไม่โทร · ผลของที่โทรแล้ว · รอโทรแยกใครรอ · ไม่โทรเพราะอะไร
 * (Choice เจ้าของ "แท็บสัดส่วนอย่างเดียว" — แท็บภาพรวมคงเดิม)
 * shadcn + utility ของ Tailwind เท่านั้น · สีจาก `TONE` (AI = กรมท่า · ทั้งสองทาง = เขียวหัวเป็ด · คน = ม่วง ชุดเดียวกับหน้า "ระบบไปกี่ %")
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OverviewSection, OverviewSheet, NUM, type OverviewPanel } from '@/components/home-overview/OverviewParts';
import { fetchHomeProportion } from '@/lib/homeAiShareApi';
import type { AiShareMatching, AiShareWindow } from '@/lib/homeAiShare';
import { AI_SHARE_CALLED_TONE } from '@/lib/homeAiShare';
import {
  buildProportionGroups,
  ladderAddsUp,
  proportionCoverage,
  proportionPct,
  proportionStuck,
  proportionTag,
  PROPORTION_TAG_LABEL,
  type Ladder,
  type LadderPart,
  type ProportionPayload,
  type ProportionRow,
  type ProportionTag,
} from '@/lib/homeProportion';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const TAG_TONE: Record<ProportionTag, ToneKey> = {
  ai: 'success',
  mix: 'warn',
  staff: 'danger',
  noAi: 'danger',
  empty: 'neutral',
  unknown: 'neutral',
};

/** หน้าเต็มของแต่ละแถว (ปุ่มท้ายแผง) */
const GO: Record<string, OverviewPanel['go']> = {
  prescreen: { label: 'งานสรรหา › ผู้สมัคร', to: '/jobs/board?view=list' },
  afterPrescreen: { label: 'งานสรรหา › การติดต่อ', to: '/jobs/board?view=contact' },
  appointment: { label: 'งานสรรหา › ติดตามนัดหมาย', to: '/jobs/board?view=appointments' },
  attendance: { label: 'งานสรรหา › ติดตามนัดหมาย', to: '/jobs/board?view=appointments' },
  starter: { label: 'ติดตามคนเริ่มงาน', to: '/follow' },
  replacement: { label: 'ติดตามส่งคนแทน', to: '/follow?view=replace' },
  aftercare: { label: 'ดูแลหลังเริ่มงาน', to: '/aftercare' },
  replaceSheets: { label: 'ติดตามส่งคนแทน', to: '/follow?view=replace' },
  apps: { label: 'งานสรรหา › ผู้สมัคร', to: '/jobs/board?view=list' },
};

function Legend() {
  const item = (tone: ToneKey, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-sm', TONE[tone].dot)} aria-hidden />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="proportion-legend">
      {item(AI_SHARE_CALLED_TONE.ai, 'AI')}
      {item(AI_SHARE_CALLED_TONE.both, 'ทั้งสองทาง')}
      {item(AI_SHARE_CALLED_TONE.staff, 'คน')}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-muted" aria-hidden />
        ยังไม่มีใครทำ
      </span>
    </div>
  );
}

/** ช่องของขั้น — ชื่อ · เลข (ไม่มีช่อง = ขึ้นคำ ไม่หาย) */
function Parts({ parts, unit, empty }: { parts: readonly LadderPart[]; unit: string; empty: string }) {
  if (!parts.length) {
    return <p className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {parts.map((p) => (
        <li key={p.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE[p.tone].dot)} aria-hidden />
            <span className="min-w-0">{p.label}</span>
          </span>
          <span className="shrink-0 font-medium tabular-nums">
            {NUM.format(p.value)}
            {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const sumOf = (parts: readonly LadderPart[]) => parts.reduce((n, p) => n + p.value, 0);

/** แผงของแถวงานโทร — สมการบนสุด แล้วแตกทีละก้อน */
function LadderView({ l, aiWord }: { l: Ladder; aiWord: string }) {
  const waiting = sumOf(l.waiting);
  const notCalled = sumOf(l.notCalled);
  const ok = ladderAddsUp(l);
  const head = (title: string, value: number) => (
    <h3 className="flex items-baseline justify-between text-sm font-medium text-foreground">
      <span>{title}</span>
      <span className="tabular-nums">
        {NUM.format(value)} <span className="text-xs font-normal text-muted-foreground">{l.unit}</span>
      </span>
    </h3>
  );
  return (
    <div className="space-y-4" data-testid="proportion-ladder">
      <p
        className={cn('rounded-xl px-3 py-2 text-sm tabular-nums', ok ? 'bg-muted/60 text-foreground' : cn(TONE.danger.soft, TONE.danger.value))}
        data-testid="proportion-equation"
      >
        รายชื่อ {NUM.format(l.total)} = โทรแล้ว {NUM.format(l.called.total)} + รอโทร {NUM.format(waiting)} + ไม่โทร {NUM.format(notCalled)} {l.unit}
        {ok ? '' : ' · ไม่ลงตัว'}
      </p>
      {l.excluded ? (
        <p className="-mt-2 text-xs tabular-nums text-muted-foreground">
          {l.excluded.label} {NUM.format(l.excluded.value)} {l.unit}
        </p>
      ) : null}
      <section className="space-y-2">
        {head('โทรแล้ว', l.called.total)}
        <p className="text-xs tabular-nums text-muted-foreground">
          {aiWord} {NUM.format(l.called.ai)} · ทั้งสองทาง {NUM.format(l.called.both)} · คน {NUM.format(l.called.staff)}
        </p>
        {l.results.length ? <Parts parts={l.results} unit={l.unit} empty="ยังไม่มีผล" /> : null}
      </section>
      <section className="space-y-2">
        {head('รอโทร', waiting)}
        <Parts parts={l.waiting} unit={l.unit} empty="ไม่มีรอโทร" />
      </section>
      <section className="space-y-2">
        {head('ไม่โทร', notCalled)}
        <Parts parts={l.notCalled} unit={l.unit} empty="ไม่มี" />
      </section>
    </div>
  );
}

function panelOf(r: ProportionRow): OverviewPanel {
  return {
    title: r.name,
    sub: r.note,
    go: GO[r.key],
    body: r.ladder ? <LadderView l={r.ladder} aiWord={r.aiLabel ?? 'AI'} /> : <Parts parts={r.parts ?? []} unit="" empty="ไม่มีข้อมูล" />,
  };
}

function Row({ r, loading, onOpen }: { r: ProportionRow; loading: boolean; onOpen: (r: ProportionRow) => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const pct = proportionPct(r);
  const coverage = proportionCoverage(r);
  const tag = proportionTag(r);
  const all = r.ai + r.both + r.staff + r.none;
  const w = (v: number) => (shown && all > 0 ? `${(v / all) * 100}%` : '0%');
  const aiWord = r.aiLabel ?? 'AI';
  const parts = r.unknown
    ? []
    : [
        `${aiWord} ${NUM.format(r.ai)}`,
        r.both ? `ทั้งสองทาง ${NUM.format(r.both)}` : null,
        `คน ${NUM.format(r.staff)}`,
        r.none ? `${r.noneLabel ?? 'ยังไม่มีใครทำ'} ${NUM.format(r.none)}` : null,
      ].filter(Boolean);
  return (
    <li className="border-t border-border first:border-t-0">
      {/* ปุ่มของ shadcn (ห้ามปั้นปุ่มเอง) — ghost ทั้งแถว กดแล้วเปิดแผงแตกตัวเลข */}
      <Button
        type="button"
        variant="ghost"
        disabled={loading}
        onClick={() => onOpen(r)}
        data-testid={`proportion-row-${r.key}`}
        className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 whitespace-normal rounded-xl px-2 py-3 text-left font-normal disabled:opacity-100 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_4rem_7rem]"
      >
        <span className="min-w-0">
          <span className="block font-medium text-foreground">{r.name}</span>
          <span className="block text-xs tabular-nums text-muted-foreground">{r.note}</span>
        </span>
        <span className="text-right tabular-nums md:order-3">
          <span className="block text-2xl font-medium">{loading ? '—' : r.unknown || pct === null ? '—' : `${pct}%`}</span>
          {/* เลขใหญ่นับแค่ที่โทรแล้ว — บรรทัดนี้บอกเทียบของทั้งหมด (เจ้าของ 28 ต.ค. 2569 "ทำหมดเลย") */}
          {!loading && coverage !== null ? (
            <span className="block text-xs text-muted-foreground" data-testid={`proportion-coverage-${r.key}`}>
              ทั้งหมด {coverage}%
            </span>
          ) : null}
        </span>
        <span className="col-span-2 min-w-0 space-y-1 md:order-2 md:col-span-1">
          <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            {(['ai', 'both', 'staff'] as const).map((k) => (
              <span
                key={k}
                className={cn('block h-full transition-all duration-700 motion-reduce:transition-none', TONE[AI_SHARE_CALLED_TONE[k]].dot)}
                style={{ width: w(r[k]) }}
              />
            ))}
          </span>
          {parts.length ? <span className="block text-xs tabular-nums text-muted-foreground">{parts.join(' · ')}</span> : null}
        </span>
        <Badge
          variant="outline"
          className={cn('col-span-2 justify-self-start md:order-4 md:col-span-1 md:justify-self-end', TONE[TAG_TONE[tag]].soft, TONE[TAG_TONE[tag]].value)}
        >
          {loading ? 'กำลังโหลด' : PROPORTION_TAG_LABEL[tag].replace('AI ', aiWord === 'AI' ? 'AI ' : aiWord)}
        </Badge>
      </Button>
    </li>
  );
}

const loadingAny = (apps: unknown, appsError: unknown, payload: unknown, error: unknown) =>
  (apps === null && !appsError) || (payload === null && !error);

export default function ProportionTab({
  win,
  bu,
  apps,
  matching,
  appsError,
  openJobIds,
}: {
  win: AiShareWindow;
  bu: string | null;
  apps: readonly RecruitAppFact[] | null;
  matching: AiShareMatching | null;
  appsError: string | null;
  /** ใบขอที่เปิดอยู่ (ใช้บอกเหตุ "ใบขอปิดแล้ว") · null = อ่านไม่ได้ ไม่เดา */
  openJobIds: ReadonlySet<string> | null;
}) {
  const key = `${win.from ?? ''}|${win.to ?? ''}|${bu ?? ''}`;
  const [data, setData] = useState<{ key: string; d: ProportionPayload } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<OverviewPanel | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    fetchHomeProportion({ ...win, bu })
      .then((d) => {
        if (alive) setData({ key, d });
      })
      .catch((e: unknown) => {
        if (alive) setError(friendlyErrorText(e, 'โหลดสัดส่วนไม่ขึ้น'));
      });
    return () => {
      alive = false;
    };
  }, [key, win, bu]);
  const payload = data?.key === key ? data.d : null;
  const groups = useMemo(() => buildProportionGroups({ apps, payload, matching, openJobIds }), [apps, payload, matching, openJobIds]);
  const stuck = useMemo(() => proportionStuck(groups), [groups]);
  const rowOf = (key: string) => groups.flatMap((g) => g.rows).find((r) => r.key === key);
  const allLoaded = !loadingAny(apps, appsError, payload, error);
  const errs = [error, appsError, payload?.errors.follow, payload?.errors.entry, payload?.errors.apps].filter(Boolean);
  // สรรหาต้องรอทั้งใบสมัครและเหตุ (เหตุมาจากเส้นสัดส่วน) — ไม่งั้นช่อง "ยังไม่รู้เหตุ" บวมชั่วคราว
  const loadingOf = (g: string) =>
    g === 'recruit' || g === 'human' ? (apps === null && !appsError) || (payload === null && !error) : payload === null && !error;
  return (
    <div className="space-y-4" data-testid="home-proportion">
      {/* งานที่ค้างอยู่ — ช่องที่ต้องมีคนทำของทุกแถว · ว่าง = ขึ้นว่าไม่มี (ไม่หาย) */}
      <OverviewSection title="งานที่ค้างอยู่" testId="proportion-stuck">
        {!allLoaded ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด</p>
        ) : stuck.length ? (
          <ul className="flex flex-wrap gap-2">
            {stuck.map((x) => (
              <li key={`${x.rowKey}-${x.label}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal py-1.5 text-left"
                  onClick={() => {
                    const r = rowOf(x.rowKey);
                    if (r) setPanel(panelOf(r));
                  }}
                >
                  <span className="text-muted-foreground">{x.rowName} ·</span> {x.label}{' '}
                  <span className={cn('font-medium tabular-nums', TONE.danger.value)}>
                    {NUM.format(x.value)} {x.unit}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">ไม่มีงานค้าง</p>
        )}
      </OverviewSection>
      <Legend />
      {errs.length ? <p className={cn('text-sm', TONE.danger.value)}>{errs.join(' · ')}</p> : null}
      {groups.map((g) => (
        <OverviewSection key={g.key} title={g.title} testId={`proportion-${g.key}`}>
          <ul>
            {g.rows.map((r) => (
              <Row key={r.key} r={r} loading={loadingOf(g.key)} onOpen={(x) => setPanel(panelOf(x))} />
            ))}
          </ul>
        </OverviewSection>
      ))}
      <OverviewSheet panel={panel} onClose={() => setPanel(null)} />
    </div>
  );
}
