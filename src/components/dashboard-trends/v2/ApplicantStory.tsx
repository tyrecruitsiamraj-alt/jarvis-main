/**
 * ═══ รายชื่อที่เข้ามาเป็นยังไง — ตัวเลขรวมใต้กราฟ BU (เจ้าของ 17 พ.ย. 2569) ═══
 * > *"ยอดรวมของแต่ละ Bu เท่านี้นะเป็นกราฟ แต่ด้านล่างเป็นตัวเลขรวมเลย พอกด Bu ใด Bu หนึ่งตัวเลขก็เปลี่ยน
 * > ซึ่งดูได้ว่า เข้ามาเนี่ยเป็นอะไรยังไง พื้นที่จังหวัดอะไร อายุเท่าไหร่"*
 * 6 กล่องพร้อมกัน: ช่องทาง · ใครเอาเข้ามา · วิธีที่เข้ามา · จังหวัดที่อยู่ · ช่วงอายุ · เพศ
 * กดแท่ง BU / กดแถวในกล่อง = กรองทุกกล่องที่เหลือ (AND) · กดซ้ำ/กดกากบาทที่ป้าย = เอาออก
 * แต่ละกล่องนับจากรายชื่อที่ผ่านตัวกรองของกล่องอื่น (ไม่กรองตัวเอง) — แถวในกล่องรวมกันเท่ายอดของกล่อง
 * ตัวนับชุดเดียวกับตารางกลุ่มผู้สมัคร (`audienceRows` · `dimValueOf`) — ไม่คิดนิยามใหม่
 */
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { AGE_BUCKETS, AUDIENCE_DIM_LABEL, audienceRows, buOfFact, dimValueOf, pageOf, type AudienceDim, type OutcomeSets } from '@/lib/recruitAudience';
import { Pager, fmt, fmtPct } from './V2Parts';

/** ลำดับกล่องตามที่เจ้าของเล่า (อ่านซ้ายไปขวา บนลงล่าง) */
const PANELS: readonly AudienceDim[] = ['ch', 'bringer', 'method', 'home', 'age', 'gender'];
const PANEL_TITLE: Partial<Record<AudienceDim, string>> = { home: 'รายชื่อมาจากจังหวัดไหน' };
const PANEL_SIZE = 8;

export default function ApplicantStory({
  cohort,
  sets,
  bu,
  onBu,
  scopeLabel,
  onNames,
  resetKey,
}: {
  /** รายชื่อของยอดที่เลือก (ผ่านตัวกรองบนสุดแล้ว) */
  cohort: readonly RecruitAppFact[];
  sets: OutcomeSets;
  /** BU ที่กดแท่ง · null = ทุก BU */
  bu: string | null;
  onBu: (bu: string | null) => void;
  /** ชื่อยอดที่เลือก เช่น "รายการสมัครเข้าใหม่" */
  scopeLabel: string;
  onNames: (title: string, ids: readonly string[]) => void;
  /** เปลี่ยนวัน/ตัวกรอง/ยอด = ล้างตัวกรองกล่อง */
  resetKey: string;
}) {
  const [filter, setFilter] = React.useState<Partial<Record<AudienceDim, string>>>({});
  const [pages, setPages] = React.useState<Partial<Record<AudienceDim, number>>>({});
  React.useEffect(() => {
    setFilter({});
    setPages({});
  }, [resetKey]);
  React.useEffect(() => setPages({}), [bu, filter]);

  const base = bu ? cohort.filter((f) => buOfFact(f) === bu) : cohort;
  const chips = (Object.entries(filter) as Array<[AudienceDim, string | undefined]>).filter((e): e is [AudienceDim, string] => Boolean(e[1]));
  const passes = (f: RecruitAppFact, skip?: AudienceDim) => chips.every(([d, v]) => d === skip || dimValueOf(f, d) === v);
  const pop = base.filter((f) => passes(f));
  const crumbText = [bu ?? 'ทุก BU', ...chips.map(([, v]) => v)].join(' · ');
  const toggle = (dim: AudienceDim, value: string) => setFilter((cur) => ({ ...cur, [dim]: cur[dim] === value ? undefined : value }));

  return (
    <div className="space-y-3" data-testid="v2-story">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('text-xs', DASH.sub)}>{scopeLabel}</span>
        <Button type="button" size="xs" variant={bu ? 'default' : 'outline'} onClick={() => bu && onBu(null)} aria-label={bu ? `เอา ${bu} ออก` : 'ทุก BU'}>
          {bu ?? 'ทุก BU'}
          {bu ? <X aria-hidden /> : null}
        </Button>
        {chips.map(([d, v]) => (
          <Button key={d} type="button" size="xs" variant="default" onClick={() => toggle(d, v)} aria-label={`เอา ${v} ออก`}>
            {v}
            <X aria-hidden />
          </Button>
        ))}
        <span className="ml-auto text-sm font-medium tabular-nums">{fmt(pop.length)} รายการ</span>
        <Button type="button" size="xs" variant="outline" onClick={() => onNames(`รายชื่อ · ${crumbText}`, pop.map((f) => f.id ?? ''))}>
          ดูรายชื่อ
        </Button>
      </div>

      {/* อยู่ในแผงข้าง (กว้าง ~670px) — แบ่งตามจอแล้ว 3 คอลัมน์ชื่อโดนตัด (เจ้าของ 19 พ.ย. 2569 "ชื่อมันตกแล้วจะดูรู้เรื่องได้ไง") ⇒ 2 คอลัมน์ + ชื่อขึ้นบรรทัดใหม่ */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PANELS.map((dim) => {
          const own = base.filter((f) => passes(f, dim));
          // ช่วงอายุเรียงตามอายุ · กล่องอื่นเรียงตามจำนวน (ไม่ทราบอยู่ท้าย)
          const rows = audienceRows(own, dim, sets, 'apps', 'count').sort((x, y) =>
            dim === 'age' ? AGE_BUCKETS.indexOf(x.key as (typeof AGE_BUCKETS)[number]) - AGE_BUCKETS.indexOf(y.key as (typeof AGE_BUCKETS)[number]) : 0,
          );
          const pg = pageOf(rows, pages[dim] ?? 1, PANEL_SIZE);
          return (
            <section key={dim} className="min-w-0 space-y-1 rounded-xl border border-border bg-muted/20 p-3" data-testid={`v2-story-${dim}`}>
              <h3 className="flex items-baseline justify-between gap-2 text-sm font-medium">
                <span>{PANEL_TITLE[dim] ?? AUDIENCE_DIM_LABEL[dim]}</span>
                <span className={cn('text-xs font-normal tabular-nums', DASH.sub)}>{fmt(own.length)} รายการ</span>
              </h3>
              <ul>
                {pg.slice.length === 0 ? <li className={cn('py-2 text-sm', DASH.muted)}>ไม่มีรายการ</li> : null}
                {pg.slice.map((r) => {
                  const on = filter[dim] === r.key;
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(dim, r.key)}
                        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/60', on && 'bg-primary/10 font-medium text-primary')}
                      >
                        <span className="min-w-0 flex-1 break-words">{r.key}</span>
                        <span className="w-16 shrink-0 text-right font-medium tabular-nums">{fmt(r.apps)}</span>
                        <span className={cn('w-14 shrink-0 text-right text-xs tabular-nums', DASH.sub)}>{fmtPct(own.length ? (r.apps / own.length) * 100 : null)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {pg.pages > 1 ? <Pager {...pg} onPage={(p) => setPages((cur) => ({ ...cur, [dim]: p }))} /> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
