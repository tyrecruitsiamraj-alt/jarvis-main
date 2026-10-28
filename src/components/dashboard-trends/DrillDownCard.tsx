import React from 'react';
import { ChevronRight, ListTree, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { formatYmdTh } from '@/lib/dateTh';
import { nodeAt, type DrillNode } from '@/lib/recruitDrill';
import { OverviewCard, EmptyNote } from './RecruitOverviewParts';

/**
 * ═══ การ์ดกดลงลึก — ทุกแท็บของภาพรวม (เจ้าของ 21 ต.ค. 2569 · ไอเดียเพื่อนเจ้าของ "ทั้ง 4 tab ทำแบบนั้นเลย") ═══
 * ชั้นบนสุด = ยอดรวม · กดกล่องลูก = ลงไปชั้นถัดไป · แถบบนบอกว่าอยู่ชั้นไหน กดย้อนได้
 * ปลายทาง: รายชื่อ (ปุ่มเปิดรายชื่อ) หรือ รายการใบขอ (ใบที่มีคนกรอก กดดูชื่อได้)
 * ลูกทุกชั้นรวมกันเท่าแม่ (`recruitDrill.ts`) · ว่าง = 0 ไม่หาย
 */
export default function DrillDownCard({
  root,
  title,
  onOpenNames,
  bare = false,
  path: pathProp,
}: {
  root: DrillNode | null;
  title: string;
  onOpenNames: (title: string, ids: readonly string[]) => void;
  /**
   * ฝังในการ์ดแนวโน้มใบขอ (เจ้าของ 27 ต.ค. 2569 "รวมไว้") — ไม่มีกรอบการ์ด ไม่มีกล่องลูก (กล่องอยู่บนการ์ดแนวโน้มแล้ว)
   * โชว์แค่ชั้นที่ `path` ชี้: รายการใบขอ / ปุ่มรายชื่อ
   */
  bare?: boolean;
  path?: string[];
}) {
  const [pathState, setPath] = React.useState<string[]>([]);
  const path = pathProp ?? pathState;
  if (!root) {
    return (
      <OverviewCard icon={ListTree} title={title}>
        <EmptyNote>อ่านข้อมูลไม่ได้</EmptyNote>
      </OverviewCard>
    );
  }
  const { node, trail } = nodeAt(root, path);
  const pct = (n: number) => (node.count > 0 ? `${Math.round((n / node.count) * 100)}%` : '');
  const Wrap = ({ children }: { children: React.ReactNode }) =>
    bare ? (
      <div className="space-y-2" data-testid="drill-bare">
        <p className="text-sm font-medium text-foreground">
          {trail.map((t) => t.label).join(' · ')} <span className="tabular-nums">{fmt(node.count)}</span> {node.unit}
        </p>
        {children}
      </div>
    ) : (
      <OverviewCard icon={ListTree} title={title}>
        {children}
      </OverviewCard>
    );
  // ฝังแล้ว: ชั้นที่มีลูกก็เปิดรายการใบขอของชั้นนั้นตรง ๆ (กล่องลูกอยู่บนการ์ดแนวโน้มแล้ว)
  const showList = !node.children || bare;
  return (
    <Wrap>
      {/* แถบชั้น — กดชั้นก่อนหน้าเพื่อย้อน */}
      {bare ? null : (
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="ชั้นที่ดูอยู่" data-testid="drill-trail">
        {trail.map((t, i) => {
          const last = i === trail.length - 1;
          return (
            <React.Fragment key={`${t.key}-${i}`}>
              {i > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden /> : null}
              {last ? (
                <span className="font-medium text-foreground">
                  {t.label} <span className="tabular-nums">{fmt(t.count)}</span> {t.unit}
                </span>
              ) : (
                <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => setPath(path.slice(0, i))}>
                  {t.label} <span className="tabular-nums">{fmt(t.count)}</span>
                </Button>
              )}
            </React.Fragment>
          );
        })}
      </nav>
      )}

      {!bare && node.children && node.children.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="drill-children">
          {node.children.map((c) => (
            <Button
              key={c.key}
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl p-3 text-left font-normal disabled:opacity-100"
              // ข้อความยาวขึ้นบรรทัดใหม่ ไม่ล้นทับกล่องข้าง ๆ (เจ้าของส่งภาพ 25 ต.ค. 2569)
              // ใบที่จบแล้วนับอย่างเดียว ไม่เปิดรายการ (เจ้าของ "ถ้าปิดก็คือปิด")
              disabled={c.countOnly}
              onClick={() => setPath([...path, c.key])}
              data-testid={`drill-${c.key}`}
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE[c.tone].dot)} aria-hidden />
                {c.label}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-xl font-medium tabular-nums text-foreground">{fmt(c.count)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{pct(c.count)}</span>
              </span>
              {/* ชั้นถัดไปตัวเล็ก — ไม่ต้องกดทุกครั้ง */}
              {c.children && c.children.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {c.children.map((g) => `${g.label} ${fmt(g.count)}`).join(' · ')}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      ) : null}

      {/* ปลายทาง — รายชื่อ */}
      {showList && node.ids ? (
        node.count > 0 ? (
          <Button type="button" variant="outline" className="w-fit" onClick={() => onOpenNames(trail.map((t) => t.label).join(' · '), node.ids ?? [])} data-testid="drill-names">
            <Users aria-hidden /> ดูรายชื่อ {fmt(node.count)} คน
          </Button>
        ) : (
          <EmptyNote>ไม่มีรายชื่อ</EmptyNote>
        )
      ) : null}

      {/* ปลายทาง — รายการใบขอ */}
      {showList && node.requests ? (
        <DrillRequestTable key={trail.map((t) => t.label).join('|')} requests={node.requests} onOpenNames={onOpenNames} />
      ) : null}
    </Wrap>
  );
}

/** หน้าละไม่เกินกี่ใบ — เจ้าของ 28 ต.ค. 2569 "ทำเป็น pagination ไม่เกิน 10 รายการก็พอ" */
const REQUEST_PAGE = 10;

/** ตารางใบขอปลายทาง — แบ่งหน้าละ 10 ใบ · เปลี่ยนกล่อง/ชั้น = กลับหน้าแรก (key จากผู้เรียก) */
function DrillRequestTable({
  requests,
  onOpenNames,
}: {
  requests: NonNullable<DrillNode['requests']>;
  onOpenNames: (title: string, ids: readonly string[]) => void;
}) {
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(requests.length / REQUEST_PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = requests.slice(cur * REQUEST_PAGE, (cur + 1) * REQUEST_PAGE);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border/70" data-testid="drill-requests">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('text-left text-xs', DASH.tableHead)}>
              <th className="px-3 py-2 font-medium">ใบขอ</th>
              <th className="px-3 py-2 font-medium">วันที่เข้ามา</th>
              <th className="px-3 py-2 text-right font-medium">คนกรอก</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr className={cn('border-t', DASH.tableRow)}>
                <td colSpan={3} className={cn('px-3 py-3 text-center text-xs', DASH.cellMuted)}>
                  ไม่มีใบขอ
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={`${r.requestNo}-${r.jobId}`} className={cn('border-t', DASH.tableRow)}>
                  <td className={cn('px-3 py-2', DASH.cell)}>
                    <span className="block text-foreground">{[r.unitName, r.position].filter(Boolean).join(' · ') || r.requestNo}</span>
                    <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                      {r.requestNo}
                      {r.open ? null : <Badge variant="secondary">จบแล้ว</Badge>}
                    </span>
                  </td>
                  <td className={cn('whitespace-nowrap px-3 py-2 tabular-nums', DASH.cell)}>{formatYmdTh(r.day)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.applications > 0 && r.appIds.length > 0 ? (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="h-auto p-0 tabular-nums"
                        onClick={() => onOpenNames(`${r.unitName ?? r.requestNo} · คนกรอก`, r.appIds)}
                      >
                        {fmt(r.applications)} คน
                      </Button>
                    ) : (
                      <span className={cn('tabular-nums', DASH.cellMuted)}>{fmt(r.applications)}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <Pagination className="mx-0 w-auto justify-end" data-testid="drill-requests-pages">
          <PaginationContent>
            <PaginationItem>
              <Button type="button" size="xs" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
                ก่อนหน้า
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-xs tabular-nums text-muted-foreground">
                หน้า {fmt(cur + 1)} / {fmt(pages)}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button type="button" size="xs" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                ถัดไป
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
