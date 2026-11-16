import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { formatYmdTh } from '@/lib/dateTh';
import { requestNoOf } from '@/lib/jobKeyIndex';
import type { ManualLinkRow } from '@/lib/jobPostActions';
import { linkGroupsBy, linkTotalsOf } from '@/lib/recruitTopics';
import TopicEquation from './TopicEquation';

type LinkFilter = 'all' | 'posted' | 'gen';
const FILTERS: Array<[LinkFilter, string]> = [
  ['all', 'ทั้งหมด'],
  ['posted', 'เฉพาะโพสต์แล้ว'],
  ['gen', 'เฉพาะ Gen link'],
];
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

/**
 * ═══ โพสต์เองรายลิงก์ (เจ้าของ 16 พ.ย. 2569) ═══
 * > *"ถ้าจะดูแค่ โพสต์แล้วมันว่าคลิกเท่าไหร่ กรอกเท่าไหร่ ดูแบบย้อนกลับด้วยได้ไหม"*
 * สมการ ลิงก์ / คลิก / กรอก แยก โพสต์แล้ว + Gen link · ปุ่มดูเฉพาะกอง · แยกกลุ่ม · แยกคนสร้างลิงก์ · ย้อนกลับจากคนที่กรอก (ลิงก์ไหน กลุ่มไหน ใครสร้าง ใบขออะไร)
 */
export default function SelfLinksPanel({ rows, onOpenRequest }: { rows: readonly ManualLinkRow[]; onOpenRequest?: (jobId: string) => void }) {
  const [filter, setFilter] = React.useState<LinkFilter>('all');
  const posted = rows.filter((r) => r.posted);
  const gen = rows.filter((r) => !r.posted);
  const p = linkTotalsOf(posted);
  const g = linkTotalsOf(gen);
  const shown = filter === 'posted' ? posted : filter === 'gen' ? gen : rows;
  const groups = linkGroupsBy(shown, (r) => r.place);
  const people = linkGroupsBy(shown, (r) => r.by);
  const back = shown.filter((r) => r.applicants > 0).sort((a, b) => b.applicants - a.applicants || b.clicks - a.clicks);
  const part = (key: string, label: string, value: number, tone: 'success' | 'info') => ({ key, label, value, tone });

  const totalsTable = (title: string, list: ReturnType<typeof linkGroupsBy>, first: string) => (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{first}</TableHead>
              <TableHead className="text-right">ลิงก์</TableHead>
              <TableHead className="text-right">คลิก</TableHead>
              <TableHead className="text-right">กรอก</TableHead>
              <TableHead className="text-right">กรอกต่อคลิก</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className={DASH.sub}>
                  ไม่มีลิงก์
                </TableCell>
              </TableRow>
            ) : (
              list.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="max-w-72 whitespace-normal">{r.key}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.links)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.applicants)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', DASH.sub)}>{pct(r.applicants, r.clicks)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="self-links">
      <TopicEquation label="ลิงก์ทั้งหมด" unit="ลิงก์" total={rows.length} parts={[part('posted', 'โพสต์แล้ว', posted.length, 'success'), part('gen', 'Gen link', gen.length, 'info')]} />
      <TopicEquation label="คลิก" unit="ครั้ง" total={p.clicks + g.clicks} parts={[part('posted', 'จากโพสต์แล้ว', p.clicks, 'success'), part('gen', 'จาก Gen link', g.clicks, 'info')]} />
      <TopicEquation label="กรอก" total={p.applicants + g.applicants} parts={[part('posted', 'จากโพสต์แล้ว', p.applicants, 'success'), part('gen', 'จาก Gen link', g.applicants, 'info')]} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="ดูลิงก์">
        {FILTERS.map(([k, l]) => (
          <Button key={k} type="button" size="sm" variant={filter === k ? 'default' : 'outline'} aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`self-filter-${k}`}>
            {l}
          </Button>
        ))}
      </div>
      {totalsTable('แยกกลุ่ม / ช่องทาง', groups, 'กลุ่ม / ช่องทาง')}
      {totalsTable('แยกคนสร้างลิงก์', people, 'คนสร้างลิงก์')}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          ย้อนกลับจากคนที่กรอก {fmt(back.reduce((s, r) => s + r.applicants, 0))} คน · มาจาก {fmt(back.length)} ลิงก์
        </p>
        <div className="overflow-x-auto">
          <Table data-testid="self-links-back">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">กรอก</TableHead>
                <TableHead>มาจากลิงก์ (กลุ่ม / ช่องทาง)</TableHead>
                <TableHead>โพสต์แล้ว</TableHead>
                <TableHead>คนสร้างลิงก์</TableHead>
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
                    <TableCell className="max-w-72 whitespace-normal">{r.place}</TableCell>
                    <TableCell>{r.posted ? 'โพสต์แล้ว' : 'Gen link'}</TableCell>
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
