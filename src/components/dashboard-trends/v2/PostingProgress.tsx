/**
 * ═══ ไส้ในของ "การประกาศรับสมัคร" (เจ้าของ 17 พ.ย. 2569) ═══
 * > *"ใครต้องทำอะไร เอาไปไว้เป็นไส้ในของ การประกาศรับสมัคร … พอกด ยังไม่เริ่มหาก็เห็นเลยว่าเป็นใครบ้าง
 * > กดเริ่มหาแล้วจะได้รู้ว่าเริ่มหาไปแล้วนะใบไหนมีชื่อ ไม่มีชื่อ ใบที่มีชื่อปิดไม่ได้เพราะติดที่ไหน"*
 * 18 พ.ย. 2569 "ยอดมันไม่ตรงกับหน้าภาพรวมหรอ" → ใช้ช่องชุดเดียวกับหัวหน้าโพสต์ประกาศ (`RELEASE_LANE_TEXT`)
 *   ประกาศแล้ว = มีคนกรอก + ยังไม่มีคนกรอก (คนกรอก = `applications` ตัวเดียวกับหัวหน้าโพสต์ประกาศ) → รายใบที่มีคนกรอก × 8 ขั้นหลัก
 *   ยังไม่ประกาศ = ยังต้องหาคน + เริ่มงานแล้ว (`sourcing`) → ใบต่อเจ้าหน้าที่สรรหา
 * กดเลข = รายชื่อพร้อมสถานะละเอียด (`PERSON_STAGE_LABEL`)
 * 18 พ.ย. 2569 "ไม่มีกราฟบอกว่าแต่ละ Bu เท่าไหร่" → กราฟแท่ง BU ของช่องที่กดอยู่บนสุด · กด BU = สมการและตารางข้างล่างเหลือ BU นั้น
 *   แกน BU เรียงตามใบที่ยังเปิดทั้งหมด (สลับช่องแล้วแท่งไม่สลับที่)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { recruiterLabelOf, type StuckRequest } from '@/lib/recruitStuck';
import { PERSON_GROUPS, PERSON_GROUP_LABEL, PERSON_GROUP_OF, PERSON_STAGE_LABEL, type PersonGroupKey, type PersonStageKey } from '@/lib/personStage';
import { BU_UNKNOWN, pageOf } from '@/lib/recruitAudience';
import { RELEASE_LANE_TEXT } from '@/lib/boardRelease';
import { Pager, fmt } from './V2Parts';
import { MonthCompareBars } from './MonthCompareBars';

type Props = {
  view: 'released' | 'unreleased';
  /** ใบที่ยังเปิด — แบ่งประกาศแล้ว/ยังไม่ประกาศในนี้ */
  open: readonly StuckRequest[];
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

const L = (k: keyof typeof RELEASE_LANE_TEXT) => RELEASE_LANE_TEXT[k].label;
const buOf = (r: StuckRequest) => r.bu?.trim() || BU_UNKNOWN;

export default function PostingProgress({ view, open, onRequests, onNames, resetKey }: Props) {
  const [bu, setBu] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setBu(null), [resetKey, view]);
  React.useEffect(() => setPage(1), [resetKey, view, bu]);

  const lane = (r: StuckRequest) => (view === 'released' ? Boolean(r.released) : !r.released);
  const buCount = new Map<string, number>();
  for (const r of open) buCount.set(buOf(r), (buCount.get(buOf(r)) ?? 0) + 1);
  const buKeys = [...buCount.keys()].sort((a, b) => (buCount.get(b) ?? 0) - (buCount.get(a) ?? 0) || a.localeCompare(b));
  const laneRows = open.filter(lane);
  // อัตราเป็นเลขหลัก ใบเป็นบรรทัดรอง (เจ้าของ 19 พ.ย. 2569 "งั้นเปลี่ยนเป็นอัตราเด่นกว่า" — ให้เทียบกับเหลือหาของก้อนใบขอได้)
  const rateOf = (rows: readonly StuckRequest[]) => rows.reduce((n, r) => n + (r.remaining ?? 0), 0);
  const groups = buKeys.map((k) => ({ key: k, byMonth: { all: rateOf(laneRows.filter((r) => buOf(r) === k)) } }));
  const pick = (k: string | null) => setBu((cur) => (k === null || cur === k ? null : k));
  const buBar = (
    <div className="space-y-2" data-testid="v2-post-bu">
      <h3 className="text-sm font-medium">
        {L(view)} {fmt(rateOf(laneRows))} อัตรา · {fmt(laneRows.length)} ใบ · แยกตาม BU
      </h3>
      <MonthCompareBars groups={groups} months={['all']} unit="อัตรา" seriesName={() => L(view)} onPick={(k) => pick(k)} height={160} testId="v2-post-bu-chart" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="xs" variant={bu === null ? 'default' : 'outline'} onClick={() => pick(null)}>
          ทุก BU {fmt(rateOf(laneRows))}
        </Button>
        {groups.map((g) => (
          <Button key={g.key} type="button" size="xs" variant={bu === g.key ? 'default' : 'outline'} aria-pressed={bu === g.key} onClick={() => pick(g.key)}>
            {g.key} {fmt(g.byMonth.all)}
          </Button>
        ))}
      </div>
    </div>
  );

  const scoped = bu ? open.filter((r) => buOf(r) === bu) : open;
  const released = scoped.filter((r) => r.released);
  const unreleased = scoped.filter((r) => !r.released);
  const tag = bu ? ` · ${bu}` : '';

  if (view === 'unreleased') {
    const sourcing = unreleased.filter((r) => r.sourcing !== false);
    const startedWork = unreleased.filter((r) => r.sourcing === false);
    const m = new Map<string, StuckRequest[]>();
    for (const r of unreleased) m.set(recruiterLabelOf(r), [...(m.get(recruiterLabelOf(r)) ?? []), r]);
    const owners = [...m.entries()].map(([name, rows]) => ({ name, rows })).sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'th'));
    const pg = pageOf(owners, page);
    return (
      <section className="min-w-0 space-y-3" data-testid="v2-not-started">
        {buBar}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            {L('unreleased')}{tag} {fmt(unreleased.length)} ใบ
          </span>
          <span className={DASH.sub}>=</span>
          <Button type="button" size="xs" variant="outline" onClick={() => onRequests(`${L('sourcing')}${tag}`, sourcing)}>
            {L('sourcing')} {fmt(sourcing.length)} ใบ
          </Button>
          <span className={DASH.sub}>+</span>
          <Button type="button" size="xs" variant="outline" onClick={() => onRequests(`${L('started')}${tag}`, startedWork)}>
            {L('started')} {fmt(startedWork.length)} ใบ
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-sm [&_td]:py-1.5 [&_th]:h-9">
            <TableHeader>
              <TableRow>
                <TableHead>เจ้าหน้าที่สรรหา</TableHead>
                <TableHead className="text-right">{L('unreleased')}</TableHead>
                <TableHead className="text-right">{L('sourcing')}</TableHead>
                <TableHead className="text-right">{L('started')}</TableHead>
                <TableHead className="text-right">อัตราที่ยังต้องหา</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((o) => (
                <TableRow key={o.name}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="xs" variant="ghost" className="font-medium tabular-nums" onClick={() => onRequests(`${o.name} · ${L('unreleased')}`, o.rows)}>
                      {fmt(o.rows.length)} ใบ
                    </Button>
                  </TableCell>
                  {([true, false] as const).map((src) => {
                    const list = o.rows.filter((r) => (r.sourcing !== false) === src);
                    const label = src ? L('sourcing') : L('started');
                    return (
                      <TableCell key={String(src)} className="text-right">
                        {list.length ? (
                          <Button type="button" size="xs" variant="ghost" className="tabular-nums" onClick={() => onRequests(`${o.name} · ${label}`, list)}>
                            {fmt(list.length)} ใบ
                          </Button>
                        ) : (
                          <span className="px-2 tabular-nums text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    );
                  })}
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

  // คนกรอก = applications ตัวเดียวกับหัวหน้าโพสต์ประกาศ (มีคนกรอก 150 ใบ · 2,547 คน ต้องเท่ากัน)
  const withNames = released.filter((r) => (r.applications ?? 0) > 0);
  const noNames = released.filter((r) => (r.applications ?? 0) === 0);
  const heads = withNames.reduce((n, r) => n + (r.applications ?? 0), 0);
  const all = groupsOf(withNames);
  const sorted = [...withNames].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo));
  const pg = pageOf(sorted, page);
  return (
    <section className="min-w-0 space-y-3" data-testid="v2-started">
      {buBar}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {L('released')}{tag} {fmt(released.length)} ใบ
        </span>
        <span className={DASH.sub}>=</span>
        <Button type="button" size="xs" variant="outline" onClick={() => onRequests(`${L('applied')}${tag}`, withNames)}>
          {L('applied')} {fmt(withNames.length)} ใบ · {fmt(heads)} คน
        </Button>
        <span className={DASH.sub}>+</span>
        <Button type="button" size="xs" variant="outline" onClick={() => onRequests(`${L('silent')}${tag}`, noNames)}>
          {L('silent')} {fmt(noNames.length)} ใบ
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-max text-sm [&_td]:py-1.5 [&_th]:h-9">
          <TableHeader>
            <TableRow>
              <TableHead>{L('applied')}</TableHead>
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
                  <Button type="button" size="xs" variant="ghost" className="font-medium tabular-nums" disabled={!all.ids[g].length} onClick={() => onNames(`${L('applied')} · ${PERSON_GROUP_LABEL[g]}`, all.ids[g], all.labels)}>
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
