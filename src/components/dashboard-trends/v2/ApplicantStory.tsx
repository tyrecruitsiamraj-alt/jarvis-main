/**
 * ═══ เล่าเรื่องรายชื่อใต้กราฟ BU (เจ้าของ 17 พ.ย. 2569) ═══
 * "จากยอด 4970 มาจากช่องทางไหนบ้าง → กด facebook เจอว่าใครเอาเข้ามา → เอาเข้ามาด้วยวิธีไหน → อยู่จังหวัดไหน → อายุเท่าไหร่ เพศอะไร"
 * ชั้นละตาราง กดชื่อแถว = ลงชั้นถัดไป (ตัวกรองต่อกันแบบ AND) · กดตัวเลข = รายชื่อในแผงข้าง · เส้นทางด้านบนกดย้อนได้ทุกชั้น
 * ตัวนับชุดเดียวกับตารางกลุ่มผู้สมัคร (`audienceRows` · `dimValueOf`) — ไม่คิดนิยามใหม่
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { AUDIENCE_DIM_LABEL, AUDIENCE_MEASURES, AUDIENCE_MEASURE_LABEL, audienceRows, buOfFact, dimValueOf, pageOf, type AudienceDim, type AudienceMeasure, type OutcomeSets } from '@/lib/recruitAudience';
import { Pager, fmt, fmtPct } from './V2Parts';

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
  const idsOf = (ids: readonly string[], m: AudienceMeasure) => (m === 'apps' ? ids : ids.filter((id) => sets[m].has(id)));
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
          const rows = audienceRows(pop, dim, sets, 'apps', 'count');
          const pg = pageOf(rows, pages[pageKey(dim)] ?? 1);
          const drill = level < STORY_DIMS.length;
          return (
            <section key={dim} className="min-w-0 space-y-2" data-testid={`v2-story-${dim}`}>
              <h3 className="text-sm font-medium">
                {AUDIENCE_DIM_LABEL[dim]} <span className={cn('font-normal', DASH.sub)}>· {fmt(pop.length)} รายการ</span>
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{AUDIENCE_DIM_LABEL[dim]}</TableHead>
                      {AUDIENCE_MEASURES.map((m) => (
                        <TableHead key={m} className="text-right">
                          {AUDIENCE_MEASURE_LABEL[m]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pg.slice.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={AUDIENCE_MEASURES.length + 1} className={DASH.muted}>
                          ไม่มีรายการ
                        </TableCell>
                      </TableRow>
                    ) : (
                      pg.slice.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell>
                            {drill ? (
                              <button type="button" className="text-left text-sm font-medium text-primary hover:underline" onClick={() => setPath([...path, { dim, value: r.key }])}>
                                {r.key} ›
                              </button>
                            ) : (
                              <span className="text-sm font-medium">{r.key}</span>
                            )}
                          </TableCell>
                          {AUDIENCE_MEASURES.map((m) => (
                            <TableCell key={m} className="text-right">
                              <button
                                type="button"
                                disabled={r.counts[m] === null || !r.counts[m]}
                                className="ml-auto flex flex-col items-end rounded-md px-1 hover:bg-muted/60 disabled:cursor-default"
                                onClick={() => onNames(`${crumbText} · ${r.key} · ${AUDIENCE_MEASURE_LABEL[m]}`, idsOf(r.ids, m))}
                              >
                                <span className="text-sm font-medium tabular-nums">{fmt(r.counts[m])}</span>
                                <span className={cn('text-xs tabular-nums', DASH.sub)}>{m === 'apps' ? fmtPct(pop.length ? (r.apps / pop.length) * 100 : null) : fmtPct(r.rates[m])}</span>
                              </button>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <Pager {...pg} onPage={(p) => setPages((cur) => ({ ...cur, [pageKey(dim)]: p }))} />
            </section>
          );
        })}
      </div>
      <p className={cn('text-xs', DASH.sub)}>% ใต้รายการสมัคร = สัดส่วนในชั้นนี้ · % ใต้ผลอื่น = ผลนั้น / รายการสมัครของแถว · ERP = เบอร์ที่ถูกแจ้งเข้าปีนี้</p>
    </div>
  );
}
