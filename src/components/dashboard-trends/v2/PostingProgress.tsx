/**
 * ═══ ไส้ในของ "การประกาศรับสมัคร" (เจ้าของ 17 พ.ย. 2569) ═══
 * > *"ใครต้องทำอะไร เอาไปไว้เป็นไส้ในของ การประกาศรับสมัคร … พอกด ยังไม่เริ่มหาก็เห็นเลยว่าเป็นใครบ้าง
 * > กดเริ่มหาแล้วจะได้รู้ว่าเริ่มหาไปแล้วนะใบไหนมีชื่อ ไม่มีชื่อ ใบที่มีชื่อปิดไม่ได้เพราะติดที่ไหน"*
 * ยังไม่เริ่มหา = ใบต่อเจ้าหน้าที่ · เริ่มหาแล้ว = มีชื่อ/ไม่มีชื่อ + รายใบ × 8 ขั้นหลัก (`PERSON_GROUPS`) กดเลข = รายชื่อพร้อมสถานะละเอียด
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { recruiterLabelOf, type StuckRequest } from '@/lib/recruitStuck';
import { PERSON_GROUPS, PERSON_GROUP_LABEL, PERSON_GROUP_OF, PERSON_STAGE_LABEL, type PersonGroupKey, type PersonStageKey } from '@/lib/personStage';
import { pageOf } from '@/lib/recruitAudience';
import { Pager, fmt } from './V2Parts';

type Props = {
  view: 'notStarted' | 'started';
  started: readonly StuckRequest[];
  notStarted: readonly StuckRequest[];
  onRequests: (title: string, rows: StuckRequest[]) => void;
  onNames: (title: string, ids: readonly string[], labels: Record<string, string>) => void;
  resetKey: string;
};

/** id ต่อขั้นหลัก + ป้ายสถานะละเอียดต่อ id ของใบชุดหนึ่ง */
function groupsOf(rows: readonly StuckRequest[]): { ids: Record<PersonGroupKey, string[]>; labels: Record<string, string> } {
  const ids = Object.fromEntries(PERSON_GROUPS.map((g) => [g, [] as string[]])) as Record<PersonGroupKey, string[]>;
  const labels: Record<string, string> = {};
  for (const r of rows) {
    for (const [k, list] of Object.entries(r.people ?? {}) as Array<[PersonStageKey, string[]]>) {
      ids[PERSON_GROUP_OF[k]].push(...list);
      for (const id of list) labels[id] = PERSON_STAGE_LABEL[k];
    }
  }
  return { ids, labels };
}
const peopleOf = (r: StuckRequest) => Object.values(r.people ?? {}).reduce((n, l) => n + (l?.length ?? 0), 0);

export default function PostingProgress({ view, started, notStarted, onRequests, onNames, resetKey }: Props) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [resetKey, view]);

  if (view === 'notStarted') {
    const m = new Map<string, StuckRequest[]>();
    for (const r of notStarted) m.set(recruiterLabelOf(r), [...(m.get(recruiterLabelOf(r)) ?? []), r]);
    const owners = [...m.entries()].map(([name, rows]) => ({ name, rows })).sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'th'));
    const pg = pageOf(owners, page);
    return (
      <section className="min-w-0 space-y-2" data-testid="v2-not-started">
        <h3 className="text-sm font-medium">ยังไม่เริ่มหา {fmt(notStarted.length)} ใบ · แยกตามเจ้าหน้าที่สรรหา</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เจ้าหน้าที่สรรหา</TableHead>
                <TableHead className="text-right">ใบที่ยังไม่เริ่มหา</TableHead>
                <TableHead className="text-right">อัตราที่ยังต้องหา</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((o) => (
                <TableRow key={o.name}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="xs" variant="ghost" className="tabular-nums" onClick={() => onRequests(`${o.name} · ยังไม่เริ่มหา`, o.rows)}>
                      {fmt(o.rows.length)} ใบ
                    </Button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(o.rows.reduce((n, r) => n + (r.remaining ?? 0), 0))} อัตรา</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager {...pg} onPage={setPage} />
      </section>
    );
  }

  const withNames = started.filter((r) => peopleOf(r) > 0);
  const noNames = started.filter((r) => peopleOf(r) === 0);
  const all = groupsOf(withNames);
  const sorted = [...withNames].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo));
  const pg = pageOf(sorted, page);
  return (
    <section className="min-w-0 space-y-3" data-testid="v2-started">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">เริ่มหาแล้ว {fmt(started.length)} ใบ</span>
        <span className={DASH.sub}>=</span>
        <Button type="button" size="xs" variant="outline" onClick={() => onRequests('เริ่มหาแล้ว · มีชื่อ', withNames)}>
          มีชื่อ {fmt(withNames.length)} ใบ
        </Button>
        <span className={DASH.sub}>+</span>
        <Button type="button" size="xs" variant="outline" onClick={() => onRequests('เริ่มหาแล้ว · ยังไม่มีชื่อ', noNames)}>
          ยังไม่มีชื่อ {fmt(noNames.length)} ใบ
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead>ใบขอที่มีชื่อ</TableHead>
              <TableHead className="text-right">คนสมัคร</TableHead>
              {PERSON_GROUPS.map((g) => (
                <TableHead key={g} className="text-right">
                  {PERSON_GROUP_LABEL[g]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40">
              <TableCell className="font-medium">รวม {fmt(withNames.length)} ใบ</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{fmt(PERSON_GROUPS.reduce((n, g) => n + all.ids[g].length, 0))} คน</TableCell>
              {PERSON_GROUPS.map((g) => (
                <TableCell key={g} className="text-right">
                  <Button type="button" size="xs" variant="ghost" className="font-medium tabular-nums" disabled={!all.ids[g].length} onClick={() => onNames(`ใบที่มีชื่อ · ${PERSON_GROUP_LABEL[g]}`, all.ids[g], all.labels)}>
                    {fmt(all.ids[g].length)}
                  </Button>
                </TableCell>
              ))}
            </TableRow>
            {pg.slice.map((r) => {
              const one = groupsOf([r]);
              const head = `${r.requestNo} · ${r.unitName || r.position || ''}`;
              return (
                <TableRow key={`${r.jobId ?? ''}:${r.requestNo}`}>
                  <TableCell className="min-w-56">
                    <button type="button" className="text-left text-sm font-medium text-primary hover:underline" onClick={() => onRequests(head, [r])}>
                      {head}
                    </button>
                    <div className={cn('text-xs', DASH.sub)}>
                      {[recruiterLabelOf(r), r.ageDays != null ? `ค้าง ${fmt(r.ageDays)} วัน` : null, `เหลือหา ${fmt(r.remaining ?? 0)} อัตรา`].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="xs" variant="ghost" className="tabular-nums" onClick={() => onNames(`${head} · คนสมัคร`, PERSON_GROUPS.flatMap((g) => one.ids[g]), one.labels)}>
                      {fmt(peopleOf(r))} คน
                    </Button>
                  </TableCell>
                  {PERSON_GROUPS.map((g) => (
                    <TableCell key={g} className="text-right">
                      {one.ids[g].length ? (
                        <Button type="button" size="xs" variant="ghost" className="tabular-nums" onClick={() => onNames(`${head} · ${PERSON_GROUP_LABEL[g]}`, one.ids[g], one.labels)}>
                          {fmt(one.ids[g].length)}
                        </Button>
                      ) : (
                        <span className="px-2 tabular-nums text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pager {...pg} onPage={setPage} />
    </section>
  );
}
