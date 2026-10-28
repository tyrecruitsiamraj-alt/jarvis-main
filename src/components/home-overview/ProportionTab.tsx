/**
 * แท็บ "สัดส่วน" หน้าหลัก (เจ้าของ 28 ต.ค. 2569) — แต่ละเรื่อง AI ทำกี่ % คนทำกี่ %
 * นิยาม/Choice อยู่หัว `src/lib/homeProportion.ts` · ไม่มีเลขรวมเลขเดียว · % = AI ได้โทร รวมที่คนตามต่อ
 * shadcn + utility ของ Tailwind เท่านั้น · สีจาก `TONE` (AI = กรมท่า · ทั้งสองทาง = เขียวหัวเป็ด · คน = ม่วง ชุดเดียวกับหน้า "ระบบไปกี่ %")
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { OverviewSection, NUM } from '@/components/home-overview/OverviewParts';
import { fetchHomeProportion } from '@/lib/homeAiShareApi';
import type { AiShareMatching, AiShareWindow } from '@/lib/homeAiShare';
import { AI_SHARE_CALLED_TONE } from '@/lib/homeAiShare';
import {
  buildProportionGroups,
  proportionPct,
  proportionTag,
  PROPORTION_TAG_LABEL,
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

function Row({ r, loading }: { r: ProportionRow; loading: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const pct = proportionPct(r);
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
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-border py-3 first:border-t-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_4rem_7rem]"
      data-testid={`proportion-row-${r.key}`}
    >
      <div className="min-w-0">
        <p className="font-medium text-foreground">{r.name}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{r.note}</p>
      </div>
      <p className="text-right text-2xl font-medium tabular-nums md:order-3">
        {loading ? '—' : r.unknown || pct === null ? '—' : `${pct}%`}
      </p>
      <div className="col-span-2 min-w-0 space-y-1 md:order-2 md:col-span-1">
        <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          {(['ai', 'both', 'staff'] as const).map((k) => (
            <span
              key={k}
              className={cn('block h-full transition-all duration-700 motion-reduce:transition-none', TONE[AI_SHARE_CALLED_TONE[k]].dot)}
              style={{ width: w(r[k]) }}
            />
          ))}
        </span>
        {parts.length ? <p className="text-xs tabular-nums text-muted-foreground">{parts.join(' · ')}</p> : null}
      </div>
      <Badge variant="outline" className={cn('col-span-2 justify-self-start md:order-4 md:col-span-1 md:justify-self-end', TONE[TAG_TONE[tag]].soft, TONE[TAG_TONE[tag]].value)}>
        {loading ? 'กำลังโหลด' : PROPORTION_TAG_LABEL[tag].replace('AI ', aiWord === 'AI' ? 'AI ' : aiWord)}
      </Badge>
    </li>
  );
}

export default function ProportionTab({
  win,
  bu,
  apps,
  matching,
  appsError,
}: {
  win: AiShareWindow;
  bu: string | null;
  apps: readonly RecruitAppFact[] | null;
  matching: AiShareMatching | null;
  appsError: string | null;
}) {
  const key = `${win.from ?? ''}|${win.to ?? ''}|${bu ?? ''}`;
  const [data, setData] = useState<{ key: string; d: ProportionPayload } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const groups = useMemo(() => buildProportionGroups({ apps, payload, matching }), [apps, payload, matching]);
  const errs = [error, appsError, payload?.errors.follow, payload?.errors.entry].filter(Boolean);
  const loadingOf = (g: string) => (g === 'recruit' || g === 'human' ? apps === null && !appsError : payload === null && !error);
  return (
    <div className="space-y-4" data-testid="home-proportion">
      <Legend />
      {errs.length ? <p className={cn('text-sm', TONE.danger.value)}>{errs.join(' · ')}</p> : null}
      {groups.map((g) => (
        <OverviewSection key={g.key} title={g.title} testId={`proportion-${g.key}`}>
          <ul>
            {g.rows.map((r) => (
              <Row key={r.key} r={r} loading={loadingOf(g.key)} />
            ))}
          </ul>
        </OverviewSection>
      ))}
    </div>
  );
}
