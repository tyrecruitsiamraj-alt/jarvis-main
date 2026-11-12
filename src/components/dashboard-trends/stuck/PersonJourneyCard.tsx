import React from 'react';
import { Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { buildFollowCallers, buildPersonJourney, informedOf } from '@/lib/recruitPersonJourney';
import { OverviewCard } from '../RecruitOverviewParts';

/**
 * ═══ รายชื่อหลุดตรงไหน · ใครโทรต่อ (เจ้าของ 4 พ.ย. 2569 "มีแต่ปิดไม่ได้ หรือ เพราะแบงค์ไม่ทำงาน") ═══
 * ขั้นละแถว: "กรอกเข้ามา 1,782 คน" → แยกเป็นคำที่อ่านแล้วไม่ต้องแปล (โทรแล้ว · รอ AI โทร · ยังไม่มีใครโทร …) · กดเลขเปิดรายชื่อ
 * 11 พ.ย. 2569 ถอดหลอดสี + จุดสี (เจ้าของ "ดูยากเกิน หลอดสีมันไม่ช่วยไรเลย" · "เอาคำที่คนเขาเข้าใจ … อ่านแล้วไม่ต้องแปลต่อ")
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
      <div className="divide-y divide-border rounded-xl border border-border" data-testid="person-journey">
        {stages.map((s) => (
          <div key={s.key} className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]" data-testid={`person-stage-${s.key}`}>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-medium text-foreground">{s.label}</span>
              <span className="text-base font-medium">{num(s.ids, s.label, true)}</span>
              <span className={cn('text-xs', DASH.sub)}>คน</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
              {s.parts.map((p) => (
                <span key={p.key} className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1" data-testid={`person-part-${s.key}-${p.key}`}>
                  <span className={cn('whitespace-nowrap text-sm', p.next ? 'font-medium text-foreground' : DASH.sub)}>{p.label}</span>
                  <span className="text-sm">{num(p.ids, `${s.label} · ${p.label}`, p.next)}</span>
                  {p.note ? <span className={cn('text-xs', DASH.sub)}>({p.note})</span> : null}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="grid gap-x-4 p-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]" data-testid="person-informed">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-foreground">ได้ลงงาน</span>
            {informed === null ? <span className={cn('text-xs', DASH.sub)}>อ่านแจ้งเข้า ERP ไม่ได้</span> : <span className="text-base font-medium">{num(informed, 'ได้ลงงาน (แจ้งเข้า ERP)', true)}</span>}
            {informed === null ? null : <span className={cn('text-xs', DASH.sub)}>คน</span>}
          </div>
          <span className={cn('text-xs', DASH.sub)}>นับจากใบแจ้งเข้า ERP</span>
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
