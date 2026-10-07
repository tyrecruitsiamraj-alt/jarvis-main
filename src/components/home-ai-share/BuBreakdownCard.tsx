/**
 * ═══ แยก BU — หน้าหลัก หัวข้อติดตาม (เจ้าของ 7 ต.ค. 2569) ═══
 * *"Bu แต่ละ Bu ใช้ไปเท่าไหร่ ใช้ไปกับเรื่องอะไร อย่างละเท่าไหร่ ผล (ไป ไม่ไป ขอเลื่อน สรุปไม่ได้ รอดำเนินการ ล้มเหลว ยกเลิก)
 * ยังไง Bu ไหนใช้คนเยอะ ใช้ Ai เยอะ"*
 * - เลือกเรื่อง (รวม / ติดตามคนเริ่มงาน / ติดตามส่งคนแทน) × ใครโทร (รวม / AI โทร / คนโทร)
 * - แถว = BU (มากไปน้อย) · ทั้งหมด · AI โทร · คนโทร · แถบ AI/คน · ผล 7 ช่อง · แถวรวม = กล่องด้านบนพอดี
 * ตัวรวม `followBuTable` (pure · เทสต์ `tests/api/homeLumosSummary.test.ts`) · ข้อมูลชุดเดียวกับการ์ดผลโทร
 * 🔴 shadcn (Card · Tabs · Table) · สี BU จาก `toneOfBu` · สีผลชุดเดียวกับการ์ดผลโทร · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FOLLOW_RESULT_COLS } from '@/components/home-ai-share/AiShareLumosStats';
import { segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { TONE } from '@/lib/designTokens';
import { followBuTable, type FollowBuCell, type FollowBuRow, type FollowTeamKey } from '@/lib/homeLumosSummary';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

const TEAMS: ReadonlyArray<['all' | FollowTeamKey, string]> = [
  ['all', 'รวม'],
  ['main', 'ติดตามคนเริ่มงาน'],
  ['replacement', 'ติดตามส่งคนแทน'],
];
const CALLERS: ReadonlyArray<['all' | 'ai' | 'manual', string]> = [
  ['all', 'รวม'],
  ['ai', 'AI โทร'],
  ['manual', 'คนโทร'],
];

const PILL = 'h-8 rounded-full px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground';

const BuBreakdownCard: React.FC<{ cells: FollowBuCell[] | null; className?: string }> = ({ cells, className }) => {
  const [team, setTeam] = useState<'all' | FollowTeamKey>('all');
  const [caller, setCaller] = useState<'all' | 'ai' | 'manual'>('all');
  const table = cells ? followBuTable(cells, team, caller) : null;
  const showSplit = caller === 'all';

  const row = (r: FollowBuRow, label: React.ReactNode, key: string, strong = false) => {
    const aiPct = r.total > 0 ? Math.round((r.ai / r.total) * 100) : 0;
    return (
      <TableRow key={key} data-testid={`bu-row-${key}`} className={cn(strong && 'font-medium')}>
        <TableCell className="whitespace-nowrap text-sm text-foreground">{label}</TableCell>
        <TableCell className="text-right tabular-nums text-foreground">{NUM.format(r.total)}</TableCell>
        {showSplit ? (
          <>
            <TableCell className="text-right tabular-nums text-foreground">{NUM.format(r.ai)}</TableCell>
            <TableCell className="text-right tabular-nums text-foreground">{NUM.format(r.staff)}</TableCell>
            <TableCell className="min-w-32" title={`AI ${aiPct}% · คน ${100 - aiPct}%`}>
              <span className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className={cn('h-full bg-current', segmentFillClass('ai'))}
                  style={{ width: `${r.total > 0 ? (r.ai / r.total) * 100 : 0}%` }}
                />
                <span
                  className={cn('h-full bg-current', segmentFillClass('staff'))}
                  style={{ width: `${r.total > 0 ? (r.staff / r.total) * 100 : 0}%` }}
                />
              </span>
              <span className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>AI {NUM.format(aiPct)}%</span>
                <span>คน {NUM.format(r.total > 0 ? 100 - aiPct : 0)}%</span>
              </span>
            </TableCell>
          </>
        ) : null}
        {FOLLOW_RESULT_COLS.map((c) => (
          <TableCell
            key={c.key}
            className={cn('text-right tabular-nums', r.buckets[c.key] > 0 ? 'text-foreground' : 'text-muted-foreground')}
          >
            {NUM.format(r.buckets[c.key])}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  return (
    <Card variant="glass" className={cn('space-y-4 p-5 sm:p-6', className)} data-testid="bu-breakdown">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-base font-medium text-foreground">แยก BU</h2>
        <Tabs value={team} onValueChange={(v) => setTeam(v as typeof team)}>
          <TabsList aria-label="เลือกเรื่อง" className="h-auto flex-wrap gap-1 rounded-full bg-muted p-1">
            {TEAMS.map(([k, label]) => (
              <TabsTrigger key={k} value={k} className={PILL}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={caller} onValueChange={(v) => setCaller(v as typeof caller)}>
          <TabsList aria-label="เลือกใครโทร" className="h-auto flex-wrap gap-1 rounded-full bg-muted p-1">
            {CALLERS.map(([k, label]) => (
              <TabsTrigger key={k} value={k} className={PILL}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {!table ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">BU</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ทั้งหมด</TableHead>
                {showSplit ? (
                  <>
                    <TableHead className="whitespace-nowrap text-right text-xs">AI โทร</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-xs">คนโทร</TableHead>
                    <TableHead className="text-xs">AI / คน</TableHead>
                  </>
                ) : null}
                {FOLLOW_RESULT_COLS.map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap text-right text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', TONE[c.tone].dot)} aria-hidden />
                      {c.label}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-sm text-muted-foreground">
                    ไม่มีรายชื่อ
                  </TableCell>
                </TableRow>
              ) : (
                table.rows.map((r) =>
                  row(
                    r,
                    <span className="inline-flex items-center gap-2" title={r.bu ? trendBuLabel(r.bu) : undefined}>
                      <span
                        className={cn('h-2.5 w-2.5 rounded-full bg-current', TONE[r.bu ? toneOfBu(r.bu) : 'neutral'].value)}
                        aria-hidden
                      />
                      {r.bu ?? 'ไม่ระบุ'}
                    </span>,
                    r.bu ?? 'none',
                  ),
                )
              )}
            </TableBody>
            <TableFooter>{row(table.total, 'รวม', 'total', true)}</TableFooter>
          </Table>
        </div>
      )}
    </Card>
  );
};

export default BuBreakdownCard;
