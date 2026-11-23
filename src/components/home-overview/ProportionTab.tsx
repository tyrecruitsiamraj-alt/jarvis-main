/**
 * แท็บ "สัดส่วน" หน้าหลัก (เจ้าของ 28 ต.ค. 2569) — แต่ละเรื่อง AI ทำกี่ % คนทำกี่ %
 * นิยาม/Choice อยู่หัว `src/lib/homeProportion.ts` · ไม่มีเลขรวมเลขเดียว · % = AI ได้โทร รวมที่คนตามต่อ
 * กดแถว = แผงข้าง: รายชื่อ = โทรแล้ว + รอโทร + ไม่โทร · ผลของที่โทรแล้ว · รอโทรแยกใครรอ · ไม่โทรเพราะอะไร
 * 23 พ.ย. 2569 เจ้าของ "กราฟมันดูยาก" + เปลี่ยนชื่อแท็บเป็น "แนวโน้มการโทร": แถวเป็นแถบเดียว เลขอยู่ในแถบ + เทียบช่วงก่อนท้ายแถว
 * (Choice เจ้าของ "แท็บสัดส่วนอย่างเดียว" — แท็บภาพรวมคงเดิม)
 * shadcn + utility ของ Tailwind เท่านั้น · สีจาก `TONE` (AI = กรมท่า รวมทั้งสองทาง · คน = ม่วง ชุดเดียวกับหน้า "ระบบไปกี่ %")
 */
import React, { useEffect, useMemo, useState } from 'react';
import { appsInWindow } from '@/lib/homeOverviewFunnel';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import { RANGE_MAX_DAYS } from '@/lib/recruitOverviewWindow';
import { daysBetween } from '@/lib/trends/timeBuckets';
import TimeDrillSheet from '@/components/home-overview/TimeDrillSheet';
import JourneyNamesDialog from '@/components/dashboard-trends/JourneyNamesDialog';
import type { DrillBoxKey } from '@/lib/homeDrill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OverviewSection, OverviewSheet, NUM, type OverviewPanel } from '@/components/home-overview/OverviewParts';
import { fetchHomeProportion, fetchTopicReport } from '@/lib/homeAiShareApi';
import type { TopicReport } from '@/lib/homeTopicReport';
import type { AiShareWindow } from '@/lib/homeAiShare';
import { AI_SHARE_CALLED_TONE } from '@/lib/homeAiShare';
import {
  buildProportionGroups,
  ladderAddsUp,
  proportionBar,
  proportionPrevWindow,
  proportionStuck,
  proportionTag,
  proportionTrend,
  PROPORTION_TAG_LABEL,
  type Ladder,
  type LadderPart,
  type ProportionBarPart,
  type ProportionPayload,
  type ProportionRow,
  type ProportionStuck,
  type ProportionTag,
  type ProportionTrend,
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
  apps: { label: 'งานสรรหา › ผู้สมัคร', to: '/jobs/board?view=list' },
};

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

/** แผงของแถวงานโทร — สมการบนสุด แล้วไล่ทีละข้อ (ข้อย่อยเยื้องเข้า) */
function LadderView({ l }: { l: Ladder }) {
  const ok = ladderAddsUp(l);
  return (
    <div className="space-y-5" data-testid="proportion-ladder">
      <div className="space-y-1">
        <p
          className={cn('rounded-xl px-4 py-3 text-sm tabular-nums', ok ? 'bg-muted/60 text-foreground' : cn(TONE.danger.soft, TONE.danger.value))}
          data-testid="proportion-equation"
        >
          {l.totalLabel} {NUM.format(l.total)} = {l.equation.map((e) => `${e.label} ${NUM.format(e.value)}`).join(' + ')} {l.unit}
          {ok ? '' : ' · ไม่ลงตัว'}
        </p>
        {l.excluded ? (
          <p className="px-1 text-xs tabular-nums text-muted-foreground">
            {l.excluded.label} {NUM.format(l.excluded.value)} {l.unit}
          </p>
        ) : null}
      </div>
      <ol className="space-y-4">
        {l.steps.map((st, i) => (
          <li
            key={st.key}
            className={cn('space-y-2', st.indent && 'ml-3 border-l-2 border-border pl-4', st.deep && 'ml-7')}
            data-testid={`proportion-step-${st.key}`}
          >
            <h3 className="flex items-baseline justify-between gap-3 text-sm font-medium text-foreground">
              <span className="min-w-0">
                <span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</span>
                {st.title}
              </span>
              <span className="shrink-0 tabular-nums">
                {NUM.format(st.value)} <span className="text-xs font-normal text-muted-foreground">{l.unit}</span>
              </span>
            </h3>
            {st.sub ? <p className="text-xs tabular-nums text-muted-foreground">{st.sub}</p> : null}
            {st.parts.length ? (
              <Parts parts={st.parts} unit={l.unit} empty="" />
            ) : st.value === 0 && (st.key === 'waiting' || st.key === 'notCalled') ? (
              <Parts parts={[]} unit={l.unit} empty="ไม่มี" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function panelOf(r: ProportionRow): OverviewPanel {
  return {
    title: r.name,
    sub: r.note,
    go: GO[r.key],
    body: r.ladder ? <LadderView l={r.ladder} /> : <Parts parts={r.parts ?? []} unit="" empty="ไม่มีข้อมูล" />,
  };
}

/** สีของช่องในแถบ — AI กรมท่า · คน ม่วง (ชุดเดียวกับหน้า "ระบบไปกี่ %") · ยังไม่มีใครทำ = เทา · ช่องที่เป็น 0 ไม่ลงสี */
const BAR_FILL: Record<ProportionBarPart['key'], string> = {
  ai: cn(TONE[AI_SHARE_CALLED_TONE.ai].dot, 'text-white'),
  staff: cn(TONE[AI_SHARE_CALLED_TONE.staff].dot, 'text-white'),
  none: 'bg-muted text-foreground',
};
const DIR_WORD: Record<ProportionTrend['dir'], string> = { up: 'เพิ่มขึ้น', down: 'ลดลง', flat: 'ทรงตัว' };

/** ช่วงก่อนของแถว — `row` ยังไม่มา = กำลังโหลด · `label` null = ช่วงที่เลือกไม่มีช่วงก่อน */
type PrevOfRow = { label: string | null; loading: boolean; failed: boolean; row: ProportionRow | null };

function trendText(r: ProportionRow, prev: PrevOfRow, aiWord: string): string {
  if (!prev.label || r.noPeriod) return 'เทียบไม่ได้';
  if (prev.loading) return `${prev.label} · กำลังโหลด`;
  if (prev.failed) return `${prev.label} · โหลดไม่ขึ้น`;
  const t = proportionTrend(r, prev.row);
  if (!t) return `${prev.label} · เทียบไม่ได้`;
  const who = t.side === 'ai' ? aiWord : 'คน';
  return `${who} ${prev.label} ${t.prevPct}% · ${DIR_WORD[t.dir]}${t.dir === 'flat' ? '' : ` ${t.diff}`}`;
}

/**
 * แถวของเรื่อง (เจ้าของ 23 พ.ย. 2569 "กราฟมันดูยาก" → Choice "แถบเดียว เลขอยู่ในแถบ" + "เทียบเดือนก่อนท้ายแถว")
 * แถบเดียว 3 ช่อง ชื่อ + เลข + % อยู่ในช่อง · ช่องกว้างตามเลข แต่ไม่แคบกว่าตัวหนังสือ (ช่องเล็กยังอ่านได้) · ช่องอยู่ที่เดิมแม้เป็น 0
 */
function Row({ r, prev, loading, onOpen }: { r: ProportionRow; prev: PrevOfRow; loading: boolean; onOpen: (r: ProportionRow) => void }) {
  const tag = proportionTag(r);
  const bar = proportionBar(r);
  const aiWord = r.aiLabel ?? 'AI';
  const unit = r.ladder?.unit ?? '';
  const labelOf = (k: ProportionBarPart['key']) => (k === 'ai' ? aiWord : k === 'staff' ? 'คน' : (r.noneLabel ?? 'ยังไม่มีใครทำ'));
  // หน่วยอยู่ข้างเลข "ทั้งหมด" แล้ว — บรรทัดใต้ชื่อไม่ขึ้นหน่วยซ้ำ
  const note = r.note === unit ? '' : unit && r.note.startsWith(`${unit} · `) ? r.note.slice(unit.length + 3) : r.note;
  // มีงานแต่ยังไม่มีใครทำเลย = ป้ายใช้คำเดียวกับช่องในแถบ (ไม่ขึ้น "ยังไม่มีงาน" ข้างเลขทั้งหมดที่ไม่ใช่ 0)
  const tagLabel = tag === 'empty' && bar.total > 0 ? labelOf('none') : PROPORTION_TAG_LABEL[tag].replace('AI ', aiWord === 'AI' ? 'AI ' : aiWord);
  return (
    <li className="border-t border-border first:border-t-0">
      {/* ปุ่มของ shadcn (ห้ามปั้นปุ่มเอง) — ghost ทั้งแถว กดแล้วเปิดแผงแตกตัวเลข */}
      <Button
        type="button"
        variant="ghost"
        disabled={loading}
        onClick={() => onOpen(r)}
        data-testid={`proportion-row-${r.key}`}
        className="flex h-auto w-full flex-col items-stretch gap-2 whitespace-normal rounded-xl px-3 py-4 text-left font-normal disabled:opacity-100"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">{r.name}</span>
            <Badge variant="outline" className={cn('font-normal', TONE[TAG_TONE[tag]].soft, TONE[TAG_TONE[tag]].value)}>
              {loading ? 'กำลังโหลด' : tagLabel}
            </Badge>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground" data-testid={`proportion-total-${r.key}`}>
            ทั้งหมด <span className="text-lg font-medium text-foreground">{loading ? '—' : NUM.format(bar.total)}</span>
            {unit ? ` ${unit}` : ''}
          </span>
        </span>
        {note ? <span className="block text-xs tabular-nums text-muted-foreground">{note}</span> : null}
        <span
          className="grid h-12 w-full gap-0.5 overflow-hidden rounded-lg"
          style={{
            // กว้างตามเลข · ไม่แคบกว่าตัวหนังสือในช่อง · ยังไม่มีงานเลย = แบ่งเท่ากัน
            gridTemplateColumns: bar.parts.map((p) => `minmax(max-content, ${loading || bar.total <= 0 ? 1 : p.value}fr)`).join(' '),
          }}
          data-testid={`proportion-bar-${r.key}`}
        >
          {bar.parts.map((p) => (
            <span
              key={p.key}
              className={cn(
                'flex min-w-0 flex-col justify-center whitespace-nowrap px-3 leading-tight',
                !loading && p.value > 0 ? BAR_FILL[p.key] : 'bg-muted/50 text-muted-foreground',
              )}
              data-testid={`proportion-${p.key}-${r.key}`}
            >
              <span className="text-xs">{labelOf(p.key)}</span>
              <span className="text-sm font-medium tabular-nums">{loading ? '—' : `${NUM.format(p.value)} · ${p.pct}%`}</span>
            </span>
          ))}
        </span>
        <span className="block text-xs tabular-nums text-muted-foreground" data-testid={`proportion-trend-${r.key}`}>
          {loading ? 'กำลังโหลด' : trendText(r, prev, aiWord)}
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

/** แถวของแท็บสัดส่วนที่ไล่ 12 เดือนได้ → กล่องของแผง (`homeDrill`) · แถวอื่นเปิดแผงเดิม */
const DRILL_OF_ROW: Partial<Record<string, DrillBoxKey>> = { prescreen: 'prescreen', afterPrescreen: 'afterPrescreen', appointment: 'appointment', apps: 'entry' };

export default function ProportionTab({
  win,
  bu,
  apps,
  appsError,
  openJobIds,
}: {
  win: AiShareWindow;
  bu: string | null;
  apps: readonly RecruitAppFact[] | null;
  appsError: string | null;
  /** ใบขอที่เปิดอยู่ (ใช้บอกเหตุ "ใบขอปิดแล้ว") · null = อ่านไม่ได้ ไม่เดา */
  openJobIds: ReadonlySet<string> | null;
}) {
  const key = `${win.from ?? ''}|${win.to ?? ''}|${bu ?? ''}`;
  const [data, setData] = useState<{ key: string; d: ProportionPayload } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<OverviewPanel | null>(null);
  /** แถวที่ไล่ 12 เดือนได้ (22 พ.ย. 2569) — กดแล้วเปิดแผงไล่เดือนก่อน สรุปแบบเดิมอยู่ปุ่มในแผง */
  const [drill, setDrill] = useState<{ box: DrillBoxKey; rowKey: string } | null>(null);
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);
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
  // จับคู่งาน = รายงานผลโทรของหัวข้อจับคู่งาน (ช่วง/BU เดียวกัน) — แบบเดียวกับ Prescreen (Choice เจ้าของ 29 ต.ค. 2569)
  const [match, setMatch] = useState<{ key: string; r: TopicReport | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTopicReport('matching', { ...win, bu })
      .then((d) => {
        if (alive) setMatch({ key, r: d.report });
      })
      .catch(() => {
        if (alive) setMatch({ key, r: null });
      });
    return () => {
      alive = false;
    };
  }, [key, win, bu]);
  const payload = data?.key === key ? data.d : null;
  const matchingReport = match?.key === key ? match.r : null;
  const groups = useMemo(
    () => buildProportionGroups({ apps, payload, matchingReport, openJobIds }),
    [apps, payload, matchingReport, openJobIds],
  );
  const stuck = useMemo(() => proportionStuck(groups), [groups]);
  // ── ช่วงก่อน (เทียบท้ายแถว · 23 พ.ย. 2569) — โหลดชุดเดียวกับช่วงที่เลือก 3 เส้น อ่านอย่างเดียว · ล้ม = บอกว่าโหลดไม่ขึ้น ไม่เดาเลข ──
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key = ช่วง/BU ที่เลือก
  const prevWin = useMemo(() => proportionPrevWindow(win, new Date()), [key]);
  const [prevData, setPrevData] = useState<{ key: string; apps: RecruitAppFact[]; payload: ProportionPayload; match: TopicReport | null } | null>(null);
  const [prevFailed, setPrevFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!prevWin) return;
    let alive = true;
    const q = { from: prevWin.from, to: prevWin.to, bu };
    Promise.all([
      fetchRecruitOverview(null, { from: q.from, to: q.to, all: daysBetween(q.from, q.to) + 1 > RANGE_MAX_DAYS }, bu),
      fetchHomeProportion(q),
      fetchTopicReport('matching', q)
        .then((d) => d.report)
        .catch(() => null),
    ])
      .then(([ro, p, m]) => {
        if (alive) setPrevData({ key, apps: appsInWindow(ro.apps ?? [], q.from, q.to), payload: p, match: m });
      })
      .catch(() => {
        if (alive) setPrevFailed(key);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key = ช่วง/BU ที่เลือก
  }, [key]);
  const prevNow = prevData?.key === key ? prevData : null;
  const prevRows = useMemo(() => {
    if (!prevNow) return null;
    const g = buildProportionGroups({ apps: prevNow.apps, payload: prevNow.payload, matchingReport: prevNow.match, openJobIds });
    return new Map(g.flatMap((x) => x.rows).map((r) => [r.key, r]));
  }, [prevNow, openJobIds]);
  const prevOf = (rowKey: string): PrevOfRow => ({
    label: prevWin?.label ?? null,
    loading: Boolean(prevWin) && !prevNow && prevFailed !== key,
    failed: prevFailed === key,
    row: prevRows?.get(rowKey) ?? null,
  });
  const rowOf = (key: string) => groups.flatMap((g) => g.rows).find((r) => r.key === key);
  const allLoaded = !loadingAny(apps, appsError, payload, error);
  const errs = [error, appsError, payload?.errors.follow, payload?.errors.entry, payload?.errors.apps, payload?.errors.aftercare].filter(Boolean);
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
      {errs.length ? <p className={cn('text-sm', TONE.danger.value)}>{errs.join(' · ')}</p> : null}
      {groups.map((g) => (
        <OverviewSection key={g.key} title={g.title} testId={`proportion-${g.key}`}>
          <ul>
            {g.rows.map((r) => (
              <Row key={r.key} r={r} prev={prevOf(r.key)} loading={loadingOf(g.key)} onOpen={(x) => (DRILL_OF_ROW[x.key] ? setDrill({ box: DRILL_OF_ROW[x.key]!, rowKey: x.key }) : setPanel(panelOf(x)))} />
            ))}
          </ul>
        </OverviewSection>
      ))}
      <OverviewSheet panel={panel} onClose={() => setPanel(null)} />
      <TimeDrillSheet
        box={drill?.box ?? null}
        bu={bu}
        onClose={() => setDrill(null)}
        onNames={(title, ids) => {
          setDrill(null);
          setNames({ title, ids });
        }}
        summary={
          drill && rowOf(drill.rowKey)
            ? {
                label: 'สรุปช่วงวันที่บนหน้า',
                onOpen: () => {
                  const r = rowOf(drill.rowKey);
                  setDrill(null);
                  if (r) setPanel(panelOf(r));
                },
              }
            : null
        }
      />
      <JourneyNamesDialog open={names !== null} onOpenChange={(o) => !o && setNames(null)} title={names?.title ?? ''} ids={names?.ids ?? []} />
    </div>
  );
}
