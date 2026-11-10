import React from 'react';
import { ArrowDown, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { buildFollowCallers, buildPersonJourney, informedOf } from '@/lib/recruitPersonJourney';
import { OverviewCard } from '../RecruitOverviewParts';
import { GrowStack } from './GrowBar';

/**
 * ═══ รายชื่อหลุดตรงไหน · ใครโทรต่อ (เจ้าของ 4 พ.ย. 2569 "มีแต่ปิดไม่ได้ หรือ เพราะแบงค์ไม่ทำงาน") ═══
 * ขั้นละแถว: ยอดของขั้น → แถบแยกทาง → ทางที่ไปต่อ (ตัวหนา) + ทางที่หลุด · กดเลขเปิดรายชื่อ
 * ล่าง: ใครโทรต่อรายชื่อที่สนใจ · ภายใน 1 วันไหม (`buildFollowCallers`)
 */
export default function PersonJourneyCard({
  list,
  sub,
  onOpenNames,
}: {
  list: readonly RecruitAppFact[];
  sub: string;
  onOpenNames: (title: string, ids: readonly string[]) => void;
}) {
  const stages = React.useMemo(() => buildPersonJourney(list), [list]);
  const callers = React.useMemo(() => buildFollowCallers(list), [list]);
  const informed = React.useMemo(() => informedOf(list), [list]);
  const num = (ids: readonly string[], title: string, strong = false) =>
    ids.length ? (
      <Button type="button" variant="ghost" size="xs" className={cn('-mr-2 h-7 px-2 tabular-nums', strong && 'font-medium')} onClick={() => onOpenNames(title, ids)}>
        {fmt(ids.length)}
      </Button>
    ) : (
      <span className={cn('-mr-2 px-2 tabular-nums', DASH.sub)}>0</span>
    );

  return (
    <OverviewCard icon={Route} title="จุดที่รายชื่อหลุด" sub={sub}>
      <div className="space-y-1" data-testid="person-journey">
        {stages.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 ? <ArrowDown className={cn('mx-auto size-4', DASH.sub)} aria-hidden /> : null}
            <div className="space-y-2 rounded-xl border border-border p-3" data-testid={`person-stage-${s.key}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{s.label}</span>
                <span className="text-lg font-medium tabular-nums text-foreground">{num(s.ids, s.label, true)}</span>
              </div>
              <GrowStack className="h-2" parts={s.parts.map((p) => ({ label: p.label, tone: p.tone, pct: s.total ? (p.ids.length / s.total) * 100 : 0 }))} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
                {s.parts.map((p) => (
                  <div key={p.key} className="min-w-0" data-testid={`person-part-${s.key}-${p.key}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn('flex min-w-0 items-center gap-1.5 text-xs', p.next ? 'font-medium text-foreground' : DASH.sub)}>
                        <span className={cn('size-2 shrink-0 rounded-full', TONE[p.tone].dot)} aria-hidden />
                        <span className="truncate">{p.label}</span>
                      </span>
                      <span className="text-sm">{num(p.ids, `${s.label} · ${p.label}`, p.next)}</span>
                    </div>
                    {p.note ? <p className={cn('truncate pl-3.5 text-xs', DASH.sub)}>{p.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2" data-testid="person-informed">
          <span className="text-sm text-foreground">ได้ลงงาน (แจ้งเข้า ERP)</span>
          {informed === null ? <span className={cn('text-xs', DASH.sub)}>อ่านแจ้งเข้า ERP ไม่ได้</span> : <span className="text-lg">{num(informed, 'ได้ลงงาน (แจ้งเข้า ERP)', true)}</span>}
        </div>
      </div>

      <div className="space-y-1 pt-2">
        <p className="text-sm font-medium text-foreground">ใครโทรต่อรายชื่อที่สนใจ</p>
        <div className="overflow-x-auto" data-testid="follow-callers">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className={DASH.tableHead}>
                <TableHead className="text-xs">คนที่เก็บไปหน้าการติดต่อ</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">สนใจ</TableHead>
                <TableHead className={cn('whitespace-nowrap text-right text-xs', TONE.warn.value)}>ยังไม่โทร</TableHead>
                <TableHead className={cn('whitespace-nowrap text-right text-xs', TONE.success.value)}>โทรใน 1 วัน</TableHead>
                <TableHead className={cn('whitespace-nowrap text-right text-xs', TONE.danger.value)}>โทรเกิน 1 วัน</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ติดต่อได้</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">นัดได้</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className={cn('py-4 text-center text-sm', DASH.sub)}>
                    ไม่มีรายชื่อที่สนใจ
                  </TableCell>
                </TableRow>
              ) : null}
              {callers.map((c) => (
                <TableRow key={c.name} data-testid="follow-caller-row">
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="p-1 text-right">{num(c.all, `${c.name} · สนใจ`)}</TableCell>
                  <TableCell className="p-1 text-right">
                    {num(c.notCalled, `${c.name} · ยังไม่โทร`)}
                    {c.notCalledLate.length ? <span className={cn('block pr-2 text-xs tabular-nums', TONE.danger.value)}>รอเกิน 1 วัน {fmt(c.notCalledLate.length)}</span> : null}
                  </TableCell>
                  <TableCell className="p-1 text-right">{num(c.in1d, `${c.name} · โทรใน 1 วัน`)}</TableCell>
                  <TableCell className="p-1 text-right">{num(c.late, `${c.name} · โทรเกิน 1 วัน`)}</TableCell>
                  <TableCell className="p-1 text-right">{num(c.reached, `${c.name} · ติดต่อได้`)}</TableCell>
                  <TableCell className="p-1 text-right">{num(c.booked, `${c.name} · นัดได้`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </OverviewCard>
  );
}
