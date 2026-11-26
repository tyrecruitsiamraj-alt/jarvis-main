import React from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { formatYmdTh } from '@/lib/dateTh';
import { requestNoOf } from '@/lib/jobKeyIndex';
import type { ManualLinkRow } from '@/lib/jobPostActions';
import { linkTotalsOf, linkTreeChildren } from '@/lib/recruitTopics';

type LinkFilter = 'all' | 'posted' | 'gen';
const FILTER_LABEL: Record<Exclude<LinkFilter, 'all'>, string> = { posted: 'โพสต์', gen: 'Gen link' };
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const PAD = ['pl-2', 'pl-7', 'pl-12', 'pl-16'];
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * ═══ โพสต์เองรายลิงก์ (เจ้าของ 16 พ.ย. 2569) ═══
 * > *"ถ้าจะดูแค่ โพสต์แล้วมันว่าคลิกเท่าไหร่ กรอกเท่าไหร่ ดูแบบย้อนกลับด้วยได้ไหม"*
 * หน้าตาแบบ "รายชื่อเข้ามาไปถึงไหน" (เจ้าของ 19 พ.ย. 2569 "ทำไมไม่เอามาไว้ใน โพสต์เอง / สร้างลิงก์ แบบ รายชื่อเข้ามาไปถึงไหน" · Choice กล่อง + ตารางกดไล่ลง)
 * 3 กล่อง ลิงก์ / คลิก / กรอก แต่ละกล่องแยก โพสต์แล้ว / Gen link · กดแถว = ดูเฉพาะกองนั้นทั้งแผง (แทนปุ่มเฉพาะโพสต์แล้ว/เฉพาะ Gen link)
 * ตารางเดียวกดไล่ลง ช่องทางหลัก › ช่องทางรอง › กลุ่ม › ผู้รับผิดชอบ (`linkTreeChildren`) แทนตารางรายคน + ตารางกลุ่มแยกกัน
 * ย้อนกลับจากคนที่กรอก (ลิงก์ไหน กลุ่มไหน ใครรับผิดชอบ ใบขออะไร) คงเดิม
 */
export default function SelfLinksPanel({ rows, onOpenRequest }: { rows: readonly ManualLinkRow[]; onOpenRequest?: (jobId: string) => void }) {
  const [filter, setFilter] = React.useState<LinkFilter>('all');
  const [path, setPath] = React.useState<string[]>([]);
  const posted = rows.filter((r) => r.posted);
  const gen = rows.filter((r) => !r.posted);
  const p = linkTotalsOf(posted);
  const g = linkTotalsOf(gen);
  const shown = filter === 'posted' ? posted : filter === 'gen' ? gen : rows;
  const back = shown.filter((r) => r.applicants > 0).sort((a, b) => b.applicants - a.applicants || b.clicks - a.clicks);
  const pick = (f: LinkFilter) => setFilter((cur) => (cur === f ? 'all' : f));

  const boxes: Array<{ key: string; title: string; unit: string; total: number; parts: Array<{ f: Exclude<LinkFilter, 'all'>; label: string; n: number }> }> = [
    { key: 'links', title: 'ลิงก์ทั้งหมด', unit: 'ลิงก์', total: rows.length, parts: [{ f: 'posted', label: 'โพสต์', n: posted.length }, { f: 'gen', label: 'Gen link', n: gen.length }] },
    { key: 'clicks', title: 'คลิก', unit: 'ครั้ง', total: p.clicks + g.clicks, parts: [{ f: 'posted', label: 'จากโพสต์', n: p.clicks }, { f: 'gen', label: 'จาก Gen link', n: g.clicks }] },
    { key: 'apps', title: 'กรอก', unit: 'คน', total: p.applicants + g.applicants, parts: [{ f: 'posted', label: 'จากโพสต์', n: p.applicants }, { f: 'gen', label: 'จาก Gen link', n: g.applicants }] },
  ];

  const treeRows = (prefix: string[]): React.ReactNode[] =>
    linkTreeChildren(shown, prefix).flatMap((n) => {
      const open = !n.leaf && path.length >= n.path.length && same(path.slice(0, n.path.length), n.path);
      return [
        <TableRow
          key={n.path.join('|')}
          className={cn(!n.leaf && 'cursor-pointer', n.path.length > 1 && 'bg-muted/30', same(path, n.path) && 'ring-2 ring-inset ring-primary')}
          onClick={n.leaf ? undefined : () => setPath((cur) => (same(cur, n.path) ? n.path.slice(0, -1) : n.path))}
          data-testid={`self-tree-row-${n.path.length}`}
        >
          <TableCell className={cn('max-w-72 whitespace-normal break-words', PAD[Math.min(n.path.length - 1, PAD.length - 1)], n.path.length === 1 && 'font-medium')}>
            <span className="inline-flex items-center gap-1">
              {n.leaf ? null : open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="break-words">{n.key}</span>
            </span>
          </TableCell>
          <TableCell className="text-right tabular-nums">{fmt(n.links)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmt(n.clicks)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmt(n.applicants)}</TableCell>
          <TableCell className={cn('text-right tabular-nums', DASH.sub)}>{pct(n.applicants, n.clicks)}</TableCell>
        </TableRow>,
        ...(open ? treeRows(n.path) : []),
      ];
    });
  const all = linkTotalsOf(shown);

  return (
    <div className="min-w-0 space-y-4" data-testid="self-links">
      {/* บอกว่าดูกองไหนอยู่ — จองที่ไว้ ของข้างล่างไม่ขยับ */}
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {filter === 'all' ? (
          <span className={cn('text-sm', DASH.sub)}>ทุกลิงก์</span>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setFilter('all')} data-testid="self-filter-clear">
            เฉพาะ{FILTER_LABEL[filter]}
            <X aria-hidden />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {boxes.map((b) => (
          <div key={b.key} className="min-w-0 space-y-2 rounded-xl border border-border bg-muted/30 p-4" data-testid={`self-box-${b.key}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-medium">{b.title}</span>
              <span className="text-2xl font-medium tabular-nums">
                {fmt(b.total)} <span className={cn('text-xs font-normal', DASH.sub)}>{b.unit}</span>
              </span>
            </div>
            <ul className="space-y-2">
              {b.parts.map((r) => {
                const w = b.total ? Math.round((r.n / b.total) * 100) : 0;
                return (
                  <li key={r.f}>
                    <button
                      type="button"
                      aria-pressed={filter === r.f}
                      className={cn('w-full space-y-1 rounded-lg px-2 py-1 text-left hover:bg-muted/70', filter === r.f && 'ring-2 ring-inset ring-primary')}
                      onClick={() => pick(r.f)}
                      data-testid={`self-filter-${b.key}-${r.f}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span>{r.label}</span>
                        <span className="shrink-0 tabular-nums">
                          {fmt(r.n)} <span className={cn('text-xs', DASH.sub)}>{w}%</span>
                        </span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full', r.f === 'posted' ? TONE.success.dot : TONE.info.dot)} style={{ width: `${w}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <section className="min-w-0 space-y-1.5" data-testid="self-links-tree">
        <p className="text-sm font-medium text-foreground">แยกช่องทาง</p>
        <div className="min-w-0 max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ช่องทาง › กลุ่ม › เจ้าหน้าที่สรรหา</TableHead>
                <TableHead className="text-right">ลิงก์</TableHead>
                <TableHead className="text-right">คลิก</TableHead>
                <TableHead className="text-right">กรอก</TableHead>
                <TableHead className="text-right">กรอกต่อคลิก</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={DASH.sub}>
                    ไม่มีลิงก์
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {treeRows([])}
                  <TableRow>
                    <TableCell className="font-medium">รวม</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(all.links)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(all.clicks)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(all.applicants)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', DASH.sub)}>{pct(all.applicants, all.clicks)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          ย้อนกลับจากคนที่กรอก {fmt(back.reduce((s, r) => s + r.applicants, 0))} คน · มาจาก {fmt(back.length)} ลิงก์
        </p>
        <div className="min-w-0 max-w-full overflow-x-auto">
          <Table data-testid="self-links-back">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">กรอก</TableHead>
                <TableHead>มาจากลิงก์ (กลุ่ม / ช่องทาง)</TableHead>
                <TableHead>โพสต์</TableHead>
                <TableHead>เจ้าหน้าที่สรรหา</TableHead>
                <TableHead>ใบขอ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="text-right">คลิก</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {back.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className={DASH.sub}>
                    ยังไม่มีคนกรอกจากลิงก์ชุดนี้
                  </TableCell>
                </TableRow>
              ) : (
                back.map((r) => (
                  <TableRow key={r.linkId}>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(r.applicants)}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal break-words">{r.place}</TableCell>
                    <TableCell>{r.posted ? 'โพสต์' : 'Gen link'}</TableCell>
                    <TableCell>{r.by}</TableCell>
                    <TableCell>
                      {onOpenRequest ? (
                        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenRequest(r.jobId)}>
                          {requestNoOf(r.jobId)}
                        </Button>
                      ) : (
                        requestNoOf(r.jobId)
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatYmdTh(r.day)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.clicks)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
