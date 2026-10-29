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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  type ProportionStuck,
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
  /** AI ได้โทร (รวมทั้งสองทาง · Choice เจ้าของ) กับ คนอย่างเดียว — สองฝั่งรวมกัน = 100% ของที่ทำแล้ว */
  const aiCount = r.ai + r.both;
  const show = !loading && !r.unknown && pct !== null;
  const side = (label: string, value: string, count: number, tone: ToneKey, testId: string) => (
    <span className="min-w-[4.5rem] text-right" data-testid={testId}>
      <span className={cn('block text-2xl font-medium leading-tight', show ? TONE[tone].value : 'text-muted-foreground')}>{value}</span>
      <span className="block text-xs text-muted-foreground">
        {label} {show ? NUM.format(count) : ''}
      </span>
    </span>
  );
  const extra = [
    r.none ? `${r.noneLabel ?? 'ยังไม่มีใครทำ'} ${NUM.format(r.none)}` : null,
    // AI ยังไม่ได้ทำเลย = ไม่ต้องบอก 0% ซ้ำกับเลขด้านขวา
    coverage !== null && aiCount > 0 ? `${aiWord} ได้โทร ${coverage}% ของทั้งหมด` : null,
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
        className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 whitespace-normal rounded-xl px-3 py-4 text-left font-normal disabled:opacity-100 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto]"
      >
        <span className="min-w-0 space-y-1.5">
          <span className="block font-medium text-foreground">{r.name}</span>
          <span className="block text-xs tabular-nums text-muted-foreground">{r.note}</span>
          <Badge variant="outline" className={cn('font-normal', TONE[TAG_TONE[tag]].soft, TONE[TAG_TONE[tag]].value)}>
            {loading ? 'กำลังโหลด' : PROPORTION_TAG_LABEL[tag].replace('AI ', aiWord === 'AI' ? 'AI ' : aiWord)}
          </Badge>
        </span>
        {/* AI | คน — เจ้าของ 29 ต.ค. 2569 "ต้องแบ่งว่า คนเท่าไหร่ Ai เท่าไหร่ด้วย" */}
        <span className="flex items-start gap-5 tabular-nums md:order-3">
          {side(aiWord, show ? `${pct}%` : '—', aiCount, AI_SHARE_CALLED_TONE.ai, `proportion-ai-${r.key}`)}
          {side('คน', show ? `${100 - (pct ?? 0)}%` : '—', r.staff, AI_SHARE_CALLED_TONE.staff, `proportion-staff-${r.key}`)}
        </span>
        <span className="col-span-2 min-w-0 space-y-2 md:order-2 md:col-span-1">
          <span className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            {(['ai', 'both', 'staff'] as const).map((k) => (
              <span
                key={k}
                className={cn('block h-full transition-all duration-700 motion-reduce:transition-none', TONE[AI_SHARE_CALLED_TONE[k]].dot)}
                style={{ width: w(r[k]) }}
              />
            ))}
          </span>
          {!loading && extra.length ? (
            <span className="block text-xs tabular-nums text-muted-foreground" data-testid={`proportion-coverage-${r.key}`}>
              {extra.join(' · ')}
            </span>
          ) : null}
        </span>
      </Button>
    </li>
  );
}

/** งานที่ค้างอยู่ทีละเรื่อง — เลือกเรื่องจาก Dropdown แล้วเห็นแท่งของแต่ละช่องที่ค้าง (เจ้าของ 29 ต.ค. 2569) */
function StuckBoard({
  items,
  loading,
  onOpenRow,
}: {
  items: readonly ProportionStuck[];
  loading: boolean;
  onOpenRow: (rowKey: string) => void;
}) {
  const topics = useMemo(() => {
    const m = new Map<string, { rowKey: string; rowName: string; unit: string; total: number; items: ProportionStuck[] }>();
    for (const x of items) {
      const t = m.get(x.rowKey) ?? { rowKey: x.rowKey, rowName: x.rowName, unit: x.unit, total: 0, items: [] };
      t.total += x.value;
      t.items.push(x);
      m.set(x.rowKey, t);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [items]);
  const [picked, setPicked] = useState<string | null>(null);
  const topic = topics.find((t) => t.rowKey === picked) ?? topics[0] ?? null;
  const max = topic ? Math.max(1, ...topic.items.map((i) => i.value)) : 1;
  return (
    <OverviewSection
      title="งานที่ค้างอยู่"
      testId="proportion-stuck"
      right={
        topics.length ? (
          <Select value={topic?.rowKey} onValueChange={setPicked}>
            <SelectTrigger className="h-10 w-full bg-card sm:w-72" aria-label="เลือกเรื่อง" data-testid="proportion-stuck-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t.rowKey} value={t.rowKey}>
                  {t.rowName} · {NUM.format(t.total)} {t.unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด</p>
      ) : !topic ? (
        <p className="text-sm text-muted-foreground">ไม่มีงานค้าง</p>
      ) : (
        <div className="space-y-5" data-testid="proportion-stuck-topic">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="tabular-nums">
              <span className={cn('text-4xl font-medium', TONE.danger.value)}>{NUM.format(topic.total)}</span>
              <span className="ml-2 text-sm text-muted-foreground">{topic.unit} ค้างอยู่</span>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRow(topic.rowKey)}>
              ดูทั้งเรื่อง
            </Button>
          </div>
          <ul className="space-y-4">
            {topic.items.map((x) => (
              <li key={x.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-foreground">{x.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {NUM.format(x.value)} <span className="text-xs font-normal text-muted-foreground">{x.unit}</span>
                  </span>
                </div>
                <span className="block h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className={cn('block h-full rounded-full transition-all duration-700 motion-reduce:transition-none', TONE.danger.dot)}
                    style={{ width: `${(x.value / max) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </OverviewSection>
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
    <div className="space-y-5" data-testid="home-proportion">
      {/* งานที่ค้างอยู่ — เลือกเรื่องจาก Dropdown · ว่าง = ขึ้นว่าไม่มี (ไม่หาย) */}
      <StuckBoard
        items={stuck}
        loading={!allLoaded}
        onOpenRow={(k) => {
          const r = rowOf(k);
          if (r) setPanel(panelOf(r));
        }}
      />
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
