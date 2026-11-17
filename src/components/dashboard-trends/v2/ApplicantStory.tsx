/**
 * ═══ เล่าเรื่องรายชื่อใต้กราฟ BU (เจ้าของ 17 พ.ย. 2569) ═══
 * "จากยอด 4970 มาจากช่องทางไหนบ้าง → กด facebook เจอว่าใครเอาเข้ามา → เอาเข้ามาด้วยวิธีไหน → อยู่จังหวัดไหน → อายุเท่าไหร่ เพศอะไร"
 * ชั้นละกราฟแท่งตั้งเทียบรายเดือน กดแท่ง = ลงชั้นถัดไป (ตัวกรองต่อกันแบบ AND) · ชั้นสุดท้ายกดแท่ง = รายชื่อ · เส้นทางด้านบนกดย้อนได้ทุกชั้น
 * ตัวนับชุดเดียวกับตารางกลุ่มผู้สมัคร (`audienceRows` · `dimValueOf`) — ไม่คิดนิยามใหม่
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { AGE_BUCKETS, AUDIENCE_DIM_LABEL, audienceRows, bkkDay, buOfFact, dimValueOf, pageOf, type AudienceDim, type OutcomeSets } from '@/lib/recruitAudience';
import { Pager, fmt } from './V2Parts';
import { MonthCompareBars } from './MonthCompareBars';

/** ลำดับเรื่องตามที่เจ้าของเล่า · ชั้นสุดท้ายเห็นอายุกับเพศคู่กัน */
const STORY_DIMS: readonly AudienceDim[] = ['ch', 'bringer', 'method', 'home'];
const FINAL_DIMS: readonly AudienceDim[] = ['age', 'gender'];

type Step = { dim: AudienceDim; value: string };

export default function ApplicantStory({
  cohort,
  sets,
  bu,
  onBu,
  scopeLabel,
  onNames,
  resetKey,
  months,
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
  /** เปลี่ยนวัน/BU/ตัวกรอง/ยอด = เริ่มเรื่องใหม่ */
  resetKey: string;
  /** เดือนในช่วงที่เลือก — หลายเดือน = แท่งเทียบรายเดือน */
  months: readonly string[];
}) {
  const [path, setPath] = React.useState<Step[]>([]);
  const [pages, setPages] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    setPath([]);
    setPages({});
  }, [resetKey, bu]);

  const base = bu ? cohort.filter((f) => buOfFact(f) === bu) : cohort;
  const pop = base.filter((f) => path.every((s) => dimValueOf(f, s.dim) === s.value));
  const level = path.length;
  const dims = level < STORY_DIMS.length ? [STORY_DIMS[level]] : FINAL_DIMS;
  const crumbs = [bu ?? 'ทุก BU', ...path.map((s) => s.value)];
  const crumbText = crumbs.join(' · ');
  const monthOf = React.useMemo(() => new Map(cohort.map((f) => [f.id ?? '', bkkDay(f.createdAt).slice(0, 7)])), [cohort]);
  const monthCounts = (ids: readonly string[]) => {
    const out: Record<string, number> = {};
    for (const id of ids) {
      const m = monthOf.get(id);
      if (m) out[m] = (out[m] ?? 0) + 1;
    }
    return out;
  };
  const pageKey = (dim: AudienceDim) => `${level}:${dim}`;

  return (
    <div className="space-y-3" data-testid="v2-story">
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="เส้นทางที่กด">
        <span className={cn('mr-1 text-xs', DASH.sub)}>{scopeLabel}</span>
        {crumbs.map((c, i) => (
          <React.Fragment key={`${i}:${c}`}>
            {i > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden /> : null}
            <Button
              type="button"
              size="xs"
              variant={i === crumbs.length - 1 ? 'default' : 'ghost'}
              onClick={() => {
                if (i === 0) {
                  if (bu) onBu(null);
                  setPath([]);
                } else setPath(path.slice(0, i));
              }}
            >
              {c}
            </Button>
          </React.Fragment>
        ))}
        <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={() => onNames(`รายชื่อ · ${crumbText}`, pop.map((f) => f.id ?? ''))}>
          ดูรายชื่อ {fmt(pop.length)}
        </Button>
      </nav>

      <div className={cn('grid gap-4', dims.length > 1 && 'xl:grid-cols-2')}>
        {dims.map((dim) => {
          // ช่วงอายุเรียงตามอายุ (อ่านซ้ายไปขวา) · มิติอื่นเรียงตามจำนวน
          const rows = audienceRows(pop, dim, sets, 'apps', 'count').sort((x, y) =>
            dim === 'age' ? AGE_BUCKETS.indexOf(x.key as (typeof AGE_BUCKETS)[number]) - AGE_BUCKETS.indexOf(y.key as (typeof AGE_BUCKETS)[number]) : 0,
          );
          const pg = pageOf(rows, pages[pageKey(dim)] ?? 1);
          const drill = level < STORY_DIMS.length;
          const groups = pg.slice.map((r) => ({ key: r.key, byMonth: monthCounts(r.ids) }));
          return (
            <section key={dim} className="min-w-0 space-y-2" data-testid={`v2-story-${dim}`}>
              <h3 className="text-sm font-medium">
                {AUDIENCE_DIM_LABEL[dim]} <span className={cn('font-normal', DASH.sub)}>· {fmt(pop.length)} รายการ</span>
              </h3>
              <MonthCompareBars
                groups={groups}
                months={months}
                testId={`v2-story-chart-${dim}`}
                onPick={(key) => {
                  if (drill) setPath([...path, { dim, value: key }]);
                  else {
                    const r = rows.find((x) => x.key === key);
                    if (r) onNames(`${crumbText} · ${key}`, r.ids);
                  }
                }}
              />
              <Pager {...pg} onPage={(p) => setPages((cur) => ({ ...cur, [pageKey(dim)]: p }))} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
