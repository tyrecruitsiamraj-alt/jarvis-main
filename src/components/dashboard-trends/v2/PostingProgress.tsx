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
import { DASH, TONE } from '@/lib/designTokens';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { recruiterLabelOf, type StuckRequest } from '@/lib/recruitStuck';
import { PERSON_GROUPS, PERSON_GROUP_OF, PERSON_STAGE_LABEL, type PersonGroupKey, type PersonStageKey } from '@/lib/personStage';
import { BU_UNKNOWN, pageOf } from '@/lib/recruitAudience';
import { RELEASE_LANE_TEXT } from '@/lib/boardRelease';
import { Pager, buHex, fmt } from './V2Parts';

type Props = {
  view: 'released' | 'unreleased';
  /** ใบที่ยังเปิด — แบ่งประกาศแล้ว/ยังไม่ประกาศในนี้ */
  open: readonly StuckRequest[];
  /** สลับประกาศแล้ว/ยังไม่ประกาศ (รายการเลือกบนหัวก้อน · 19 พ.ย. 2569) */
  onView: (v: 'released' | 'unreleased') => void;
  /** เปิดใบขอ (กดเลขที่ใบในรายการขวา) */
  onOpenRequest: (jobId: string) => void;
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

const L = (k: keyof typeof RELEASE_LANE_TEXT) => RELEASE_LANE_TEXT[k].label;
/**
 * ส่วนย่อยของ "ยังไม่ประกาศ" บนหน้าภาพรวม — หัวหน้าโพสต์ประกาศถอดสองช่องนี้แล้ว 25 พ.ย. 2569 (หน้านั้นขึ้นเฉพาะใบกำลังดำเนินการสรรหา)
 * หน้าภาพรวมยังนับใบเปิดทุกสถานะ จึงยังแยกให้เห็น · คำเดิม
 */
const UNRELEASED_PART_LABEL = { sourcing: 'ยังต้องหาคน', started: 'เริ่มงานแล้ว' } as const;
const buOf = (r: StuckRequest) => r.bu?.trim() || BU_UNKNOWN;

export default function PostingProgress({ view, open, onView, onOpenRequest, onNames, resetKey }: Props) {
  const [bu, setBu] = React.useState<string | null>(null);
  const [part, setPart] = React.useState<string | null>(null);
  const [listPage, setListPage] = React.useState(1);
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    setBu(null);
    setPart(null);
  }, [resetKey, view]);
  React.useEffect(() => {
    setListPage(1);
  }, [resetKey, view, bu, part]);

  const lane = (r: StuckRequest) => (view === 'released' ? Boolean(r.released) : !r.released);
  const buCount = new Map<string, number>();
  for (const r of open) buCount.set(buOf(r), (buCount.get(buOf(r)) ?? 0) + 1);
  const buKeys = [...buCount.keys()].sort((a, b) => (buCount.get(b) ?? 0) - (buCount.get(a) ?? 0) || a.localeCompare(b));
  const laneRows = open.filter(lane);
  // อัตราเป็นเลขหลัก ใบเป็นบรรทัดรอง (เจ้าของ 19 พ.ย. 2569 "งั้นเปลี่ยนเป็นอัตราเด่นกว่า" — ให้เทียบกับเหลือหาของก้อนใบขอได้)
  const rateOf = (rows: readonly StuckRequest[]) => rows.reduce((n, r) => n + (r.remaining ?? 0), 0);
  /*
   * ═══ หัวก้อน (เจ้าของ 19 พ.ย. 2569 "ทำเป็น Dropdown กราฟแท่งอยู่ซ้ายแล้ว รายชื่อใบขอมาอยู่ขวา แล้วถ้าเลือกประกาศแล้ว
   * ในกราฟแท่งของแต่ละ Bu บอกด้วยว่ามีคนสมัคร ไม่มีคนสมัคร อย่างละกี่ใบ") ═══
   * แท่ง = ใบของ BU ซ้อน 2 ส่วน (ประกาศแล้ว: มีคนกรอก/ยังไม่มีคนกรอก · ยังไม่ประกาศ: ยังต้องหาคน/เริ่มงานแล้ว) · กดส่วนไหน = รายการขวาเหลือส่วนนั้น
   */
  const parts =
    view === 'released'
      ? [
          { key: 'applied', label: L('applied'), hex: TONE.success.hex, has: (r: StuckRequest) => (r.applications ?? 0) > 0 },
          { key: 'silent', label: L('silent'), hex: TONE.neutral.hex, has: (r: StuckRequest) => (r.applications ?? 0) === 0 },
        ]
      : [
          { key: 'sourcing', label: UNRELEASED_PART_LABEL.sourcing, hex: TONE.warn.hex, has: (r: StuckRequest) => r.sourcing !== false },
          { key: 'started', label: UNRELEASED_PART_LABEL.started, hex: TONE.info.hex, has: (r: StuckRequest) => r.sourcing === false },
        ];
  const BU_ORDER = ['LBD', 'LBA', 'LM', 'SN', 'DS', 'CR'];
  const rank = (b: string) => (b === BU_UNKNOWN ? 99 : BU_ORDER.indexOf(b) < 0 ? 50 : BU_ORDER.indexOf(b));
  // BU คงที่ เรียง LBD ซ้ายสุด ว่าง = 0 (ล็อก BU เดียว = BU นั้นอย่างเดียว)
  const buList = (buKeys.length > 1 ? [...new Set([...BU_ORDER.slice(0, 5), ...buKeys])] : buKeys).sort((x, y) => rank(x) - rank(y));
  const bars = buList.map((b) => {
    const list = laneRows.filter((r) => buOf(r) === b);
    return { bu: b, rows: list, segs: parts.map((p) => ({ ...p, n: list.filter(p.has).length })) };
  });
  const maxN = Math.max(1, ...bars.map((b) => b.rows.length));
  const lanesTotal = (v: 'released' | 'unreleased') => {
    const rows = open.filter((r) => (v === 'released' ? Boolean(r.released) : !r.released));
    return `${fmt(rateOf(rows))} อัตรา · ${fmt(rows.length)} ใบ`;
  };
  const partOf = part ? parts.find((p) => p.key === part) ?? null : null;
  const listRows = laneRows
    .filter((r) => (!bu || buOf(r) === bu) && (!partOf || partOf.has(r)))
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo));
  const lpg = pageOf(listRows, listPage);
  const pickBar = (b: string, p: string | null) => {
    if (bu === b && part === p) {
      setBu(null);
      setPart(null);
    } else {
      setBu(b);
      setPart(p);
    }
  };
  const buBar = (
    <div className="space-y-4" data-testid="v2-post-bu">
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="min-w-56 justify-between rounded-xl px-3" data-testid="v2-post-view">
              <span>{L(view)}</span>
              <span className={DASH.sub}>▾</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            {(['released', 'unreleased'] as const).map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`v2-post-${v}`}
                onClick={() => {
                  onView(v);
                  setMenuOpen(false);
                }}
                className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted', v === view && 'bg-muted')}
              >
                <span>{L(v)}</span>
                <span className={cn('text-xs tabular-nums', DASH.sub)}>{lanesTotal(v)}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <p className="text-sm">
          <span className="text-2xl font-medium tabular-nums">{fmt(rateOf(laneRows))}</span> <span className={DASH.sub}>อัตรา · {fmt(laneRows.length)} ใบ</span>
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {/* กราฟยืดเต็มความสูงของรายการขวา (เจ้าของ 19 พ.ย. 2569 "ใต้กราฟมันดูโล่งๆ") */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {parts.map((p) => (
              <span key={p.key} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                <span className="size-2.5 rounded-full" style={{ background: p.hex }} />
                {p.label} <b className="font-medium tabular-nums">{fmt(laneRows.filter(p.has).length)}</b> ใบ
              </span>
            ))}
          </div>
          {/* แท่งแนวนอน BU ละแถว (เจ้าของ 19 พ.ย. 2569 "กราฟไม่สวยเลย" — แท่งตั้งยืดสูงทั้งคอลัมน์) · แถวกระจายเต็มความสูงของรายการขวา */}
          <div className="flex flex-1 flex-col justify-evenly gap-3 py-2" data-testid="v2-post-bu-chart">
            {bars.map((b) => (
              <div key={b.bu} className={cn('grid grid-cols-[4rem_1fr_4.5rem] items-center gap-3', bu && bu !== b.bu && 'opacity-40')}>
                <button type="button" onClick={() => pickBar(b.bu, null)} disabled={!b.rows.length} data-testid={`v2-post-bu-${b.bu}`} className={cn('flex items-center gap-2 rounded-lg py-1 text-left text-sm font-medium hover:text-primary disabled:hover:text-inherit', bu === b.bu && 'text-primary')}>
                  <span className="size-2.5 rounded-full" style={{ background: buHex(b.bu) }} />
                  {b.bu}
                </button>
                <div className="h-7 rounded-full bg-muted/60">
                  <div className="flex h-full gap-0.5 overflow-hidden rounded-full" style={{ width: `${(b.rows.length / maxN) * 100}%` }}>
                    {b.segs.map((sg) =>
                      sg.n ? (
                        <button
                          key={sg.key}
                          type="button"
                          title={`${b.bu} · ${sg.label} ${fmt(sg.n)} ใบ`}
                          onClick={() => pickBar(b.bu, sg.key)}
                          data-testid={`v2-post-seg-${b.bu}-${sg.key}`}
                          className={cn('flex h-full min-w-6 items-center justify-center text-xs font-medium tabular-nums text-white transition-opacity hover:opacity-90', part && bu === b.bu && part !== sg.key && 'opacity-40')}
                          style={{ width: `${(sg.n / (b.rows.length || 1)) * 100}%`, background: sg.hex }}
                        >
                          {fmt(sg.n)}
                        </button>
                      ) : null,
                    )}
                  </div>
                </div>
                <span className="text-right tabular-nums leading-tight">
                  <b className="text-sm font-medium">{fmt(b.rows.length)}</b> <span className={cn('text-xs', DASH.sub)}>ใบ</span>
                  <span className={cn('block text-xs', DASH.sub)}>{fmt(rateOf(b.rows))} อัตรา</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-2 rounded-2xl border bg-muted/20 p-3" data-testid="v2-post-list">
          <p className="text-sm font-medium">
            {partOf ? partOf.label : L(view)} · {bu ?? 'ทุก BU'}
            {bu || part ? (
              <Button type="button" size="xs" variant="link" onClick={() => { setBu(null); setPart(null); }}>
                ดูทั้งหมด
              </Button>
            ) : null}
          </p>
          <Table className="text-sm [&_td]:py-1.5 [&_th]:h-9">
            <TableHeader>
              <TableRow>
                <TableHead>ใบขอ</TableHead>
                <TableHead>เจ้าหน้าที่สรรหา</TableHead>
                <TableHead className="text-right">{view === 'released' ? 'คนสมัคร' : 'ค้าง (วัน)'}</TableHead>
                <TableHead className="text-right">เหลือหา</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lpg.slice.map((r) => {
                const head = `${r.requestNo} · ${r.unitName || r.position || ''}`;
                const one = groupsOf([r]);
                const ids = PERSON_GROUPS.flatMap((g) => one.ids[g]);
                return (
                  <TableRow key={`${r.jobId ?? ''}:${r.requestNo}`}>
                    <TableCell className="min-w-0">
                      {r.jobId ? (
                        <button type="button" className="font-medium tabular-nums text-primary hover:underline" onClick={() => onOpenRequest(r.jobId as string)}>
                          {r.requestNo}
                        </button>
                      ) : (
                        <span className="font-medium tabular-nums">{r.requestNo}</span>
                      )}
                      <span className={cn('block max-w-64 break-words text-xs', DASH.sub)}>{r.unitName || r.position || '—'}</span>
                    </TableCell>
                    <TableCell>{recruiterLabelOf(r)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {view === 'released' ? (
                        (r.applications ?? 0) > 0 && ids.length ? (
                          <Button type="button" size="xs" variant="ghost" className="tabular-nums" onClick={() => onNames(`${head} · คนสมัคร`, ids, one.labels)}>
                            {fmt(r.applications ?? 0)} คน
                          </Button>
                        ) : (
                          <span className={cn('px-2.5', DASH.muted)}>{fmt(r.applications ?? 0)} คน</span>
                        )
                      ) : r.ageDays == null ? (
                        <span className={DASH.muted}>—</span>
                      ) : (
                        fmt(r.ageDays)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(r.remaining ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
              {lpg.slice.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className={DASH.muted}>
                    ไม่มีใบขอ
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pager {...lpg} onPage={setListPage} testId="v2-post-list-pager" />
        </div>
      </div>
    </div>
  );

  // ตารางรายละเอียดเดิมข้างล่าง (มีคนกรอก × 8 ขั้น · ยังไม่ประกาศแยกเจ้าหน้าที่) ถอดแล้ว — รายการขวาแทน (เจ้าของ 19 พ.ย. 2569 "เอาออก")
  return (
    <section className="min-w-0" data-testid={view === 'released' ? 'v2-started' : 'v2-not-started'}>
      {buBar}
    </section>
  );
}
