import React from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { STUCK_PHASES, stuckByPlace, type StuckPlaceRow, type StuckRequest } from '@/lib/recruitStuck';
import { OverviewCard } from '../RecruitOverviewParts';
import { GrowStack } from './GrowBar';

/**
 * ═══ ส่วนที่ 4: พื้นที่ที่ยังต้องหา — จังหวัด → อำเภอ (เจ้าของ 4 พ.ย. 2569 "งานค้างที่จังหวัดไหน อำเภอไหน") ═══
 * แถวจังหวัดกดกางอำเภอ · แถบ 4 สีบอกติดช่วงไหน · กดเลขเปิดรายการใบ
 */
export default function StuckAreaTable({ rows, onPick }: { rows: readonly StuckRequest[]; onPick: (title: string, list: StuckRequest[]) => void }) {
  const places = React.useMemo(() => stuckByPlace(rows), [rows]);
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const toggle = (name: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const cell = (list: StuckRequest[], title: string) =>
    list.length ? (
      <Button type="button" variant="ghost" size="xs" className="-mr-2 h-7 px-2 tabular-nums" onClick={() => onPick(title, list)}>
        {fmt(list.length)}
      </Button>
    ) : (
      <span className={cn('px-2 tabular-nums', DASH.sub)}>0</span>
    );
  const line = (p: StuckPlaceRow, title: string, level: 0 | 1) => (
    <TableRow key={title} className={cn(level === 1 && 'bg-muted/30')} data-testid={level === 0 ? 'stuck-area-province' : 'stuck-area-district'}>
      <TableCell className={cn('text-sm', level === 1 && 'pl-8')}>
        {level === 0 ? (
          <Button type="button" variant="ghost" size="xs" className="-ml-2 h-7 gap-1 px-2 font-medium" aria-expanded={open.has(p.name)} onClick={() => toggle(p.name)}>
            <ChevronDown className={cn('size-4 transition-transform', !open.has(p.name) && '-rotate-90')} aria-hidden />
            {p.name}
          </Button>
        ) : (
          p.name
        )}
      </TableCell>
      <TableCell className="p-1 text-right">{cell(p.rows, title)}</TableCell>
      <TableCell className="text-right text-sm tabular-nums">{fmt(p.need)}</TableCell>
      <TableCell className="min-w-32">
        <GrowStack className="h-2" parts={STUCK_PHASES.map((ph) => ({ label: ph.label, tone: ph.tone, pct: p.rows.length ? (p.byPhase[ph.key].length / p.rows.length) * 100 : 0 }))} />
      </TableCell>
      {STUCK_PHASES.map((ph) => (
        <TableCell key={ph.key} className="p-1 text-right">
          {cell(p.byPhase[ph.key], `${title} · ${ph.label}`)}
        </TableCell>
      ))}
    </TableRow>
  );
  return (
    <OverviewCard icon={MapPin} title="พื้นที่ที่ยังต้องหา" sub="กดจังหวัดดูอำเภอ · กดเลขดูใบ">
      <div className="overflow-x-auto" data-testid="stuck-area">
        <Table className="min-w-[48rem]">
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">จังหวัด / อำเภอ</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">ใบที่ต้องหา</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">เหลือหา (อัตรา)</TableHead>
              <TableHead className="text-xs">ติดตรงไหน</TableHead>
              {STUCK_PHASES.map((p) => (
                <TableHead key={p.key} className={cn('whitespace-nowrap text-right text-xs', TONE[p.tone].value)}>
                  {p.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {places.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  ไม่มีใบที่ต้องหา
                </TableCell>
              </TableRow>
            ) : null}
            {places.map((p) => (
              <React.Fragment key={p.name}>
                {line(p, p.name, 0)}
                {open.has(p.name) ? p.children.map((d) => line(d, `${p.name} · ${d.name}`, 1)) : null}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </OverviewCard>
  );
}
