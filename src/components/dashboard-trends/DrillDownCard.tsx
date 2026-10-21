import React from 'react';
import { ChevronRight, ListTree, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}: {
  root: DrillNode | null;
  title: string;
  onOpenNames: (title: string, ids: readonly string[]) => void;
}) {
  const [path, setPath] = React.useState<string[]>([]);
  if (!root) {
    return (
      <OverviewCard icon={ListTree} title={title}>
        <EmptyNote>อ่านข้อมูลไม่ได้</EmptyNote>
      </OverviewCard>
    );
  }
  const { node, trail } = nodeAt(root, path);
  const pct = (n: number) => (node.count > 0 ? `${Math.round((n / node.count) * 100)}%` : '');
  return (
    <OverviewCard icon={ListTree} title={title}>
      {/* แถบชั้น — กดชั้นก่อนหน้าเพื่อย้อน */}
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

      {node.children && node.children.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="drill-children">
          {node.children.map((c) => (
            <Button
              key={c.key}
              type="button"
              variant="outline"
              className="h-auto flex-col items-start justify-start gap-1 rounded-xl p-3 text-left font-normal"
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
      {!node.children && node.ids ? (
        node.count > 0 ? (
          <Button type="button" variant="outline" className="w-fit" onClick={() => onOpenNames(trail.map((t) => t.label).join(' · '), node.ids ?? [])} data-testid="drill-names">
            <Users aria-hidden /> ดูรายชื่อ {fmt(node.count)} คน
          </Button>
        ) : (
          <EmptyNote>ไม่มีรายชื่อ</EmptyNote>
        )
      ) : null}

      {/* ปลายทาง — รายการใบขอ */}
      {!node.children && node.requests ? (
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
              {node.requests.length === 0 ? (
                <tr className={cn('border-t', DASH.tableRow)}>
                  <td colSpan={3} className={cn('px-3 py-3 text-center text-xs', DASH.cellMuted)}>
                    ไม่มีใบขอ
                  </td>
                </tr>
              ) : (
                node.requests.map((r) => (
                  <tr key={`${r.requestNo}-${r.jobId}`} className={cn('border-t', DASH.tableRow)}>
                    <td className={cn('px-3 py-2', DASH.cell)}>
                      <span className="block text-foreground">{[r.unitName, r.position].filter(Boolean).join(' · ') || r.requestNo}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{r.requestNo}</span>
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
      ) : null}
    </OverviewCard>
  );
}
