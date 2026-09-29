/**
 * แท็บล่างของหน้าทีม Online — ผลลัพธ์ / Success · ใบขอและงานค้าง · Lumos · งานต้องทำ · ความคุ้มค่า
 *
 * แท็บแรกทำตามภาพต้นแบบของเจ้าของ (ตาราง Success ประกาศ) · แท็บ 2–4 เป็นร่างแรกจากข้อมูลชุดเดียวกัน
 * (ภาพต้นแบบเห็นแค่แท็บแรก) · ความคุ้มค่า = เจ้าของสั่ง **"เว้นไว้ก่อน"** ⇒ แท็บกดไม่ได้
 *
 * ตารางตามตัวกรอง BU (ป้าย BU บนหัว) — ไม่เลือก BU = ทุกแถว + แถวรวม · แถวรวมของเลขที่นับคนไม่ซ้ำ
 * ใช้ยอดจากเซิร์ฟเวอร์ (คนเดียวอยู่สอง BU ห้ามบวกซ้ำ) · ค่าที่อ่านไม่ได้ = "—"
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import { fmtPct, ratio, type TeamBuRow, type TeamOnlineResponse } from '@/lib/teamOnline';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : NUM.format(v));

function Head({ metric, suffix }: { metric: MetricKey; suffix?: string }) {
  return (
    <TableHead className="text-right text-xs" title={metricHelp(metric)}>
      {METRICS[metric].label}
      {suffix ?? ` (${METRICS[metric].unit})`}
    </TableHead>
  );
}

function Num({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <TableCell className={cn('text-right text-sm tabular-nums', strong ? DASH.cellStrong : DASH.cell)}>{children}</TableCell>;
}

type Sum = Omit<TeamBuRow, 'bu' | 'label'>;

function sumRows(rows: ReadonlyArray<TeamBuRow>): Sum {
  const add = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
  return rows.reduce<Sum>(
    (s, r) => ({
      requestsIn: add(s.requestsIn, r.requestsIn),
      published: s.published + r.published,
      withApplicants: s.withApplicants + r.withApplicants,
      applicants: s.applicants + r.applicants,
      called: add(s.called, r.called),
      reached: add(s.reached, r.reached),
      interested: add(s.interested, r.interested),
      noAnswer: add(s.noAnswer, r.noAnswer),
      openNow: s.openNow + r.openNow,
      openWithoutLink: s.openWithoutLink + r.openWithoutLink,
      remaining: s.remaining + r.remaining,
      staleNoApplicants: s.staleNoApplicants + r.staleNoApplicants,
    }),
    {
      requestsIn: 0,
      published: 0,
      withApplicants: 0,
      applicants: 0,
      called: 0,
      reached: 0,
      interested: 0,
      noAnswer: 0,
      openNow: 0,
      openWithoutLink: 0,
      remaining: 0,
      staleNoApplicants: 0,
    },
  );
}

function BuCell({ row }: { row: { bu: string; label: string } | null }) {
  return (
    <TableCell className="text-sm">
      {row ? (
        <span className="text-foreground" title={row.label}>
          {row.bu || row.label}
        </span>
      ) : (
        <span className="font-medium text-foreground">รวม</span>
      )}
    </TableCell>
  );
}

const TeamOnlineTabs: React.FC<{
  data: TeamOnlineResponse | null;
  /** สายที่รอผลอยู่ตอนนี้ (ตัวเดียวกับป๊อป "ส่ง AI โทร") · null = ยังโหลดไม่มา */
  queueWaiting: number | null;
  onOpenQueue: () => void;
}> = ({ data, queueWaiting, onOpenQueue }) => {
  const all = data?.byBu ?? null;
  const rows = all ? all.filter((r) => !data?.bu || r.bu === data.bu) : null;
  const showTotal = !!rows && rows.length > 1;
  const total = rows ? sumRows(rows) : null;
  const buBadge = data?.bu ?? 'ทุก BU';
  // แถวรวมของเลขที่นับคนไม่ซ้ำ = ยอดจากเซิร์ฟเวอร์ (ไม่ใช่ผลบวกรายแถว)
  const lumosTotal = data?.lumos ?? null;
  const empty = (msg: string) => <p className={cn('py-6 text-center text-sm', DASH.muted)}>{msg}</p>;
  const noRows = !rows ? empty(data?.errors.byBu ?? 'กำลังโหลด…') : rows.length === 0 ? empty('ยังไม่มีข้อมูลในช่วงนี้') : null;

  return (
    <Tabs defaultValue="success" className="space-y-3">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        <TabsTrigger value="success" className="text-xs">
          ผลลัพธ์ / Success
        </TabsTrigger>
        <TabsTrigger value="requests" className="text-xs">
          ใบขอและงานค้าง
        </TabsTrigger>
        <TabsTrigger value="lumos" className="text-xs">
          Lumos
        </TabsTrigger>
        <TabsTrigger value="todo" className="text-xs">
          งานต้องทำ
        </TabsTrigger>
        <TabsTrigger value="value" className="text-xs" disabled title="ยังไม่มีข้อมูลต้นทุน">
          ความคุ้มค่า
        </TabsTrigger>
      </TabsList>

      <TabsContent value="success">
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Success ประกาศ · มีผู้สมัครอย่างน้อย 1 คน</p>
            <Badge variant="secondary" className="text-xs">
              {buBadge}
            </Badge>
          </div>
          {noRows ?? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.published" />
                  <Head metric="teamOnline.withApplicants" />
                  <TableHead className="text-right text-xs">ไม่มีผู้สมัคร (ใบ)</TableHead>
                  <Head metric="teamOnline.applicants" />
                  <Head metric="teamOnline.postingSuccess" suffix="" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell row={r} />
                    <Num>{n(r.published)}</Num>
                    <Num>{n(r.withApplicants)}</Num>
                    <Num>{n(r.published - r.withApplicants)}</Num>
                    <Num>{n(r.applicants)}</Num>
                    <Num strong>{fmtPct(ratio(r.withApplicants, r.published))}</Num>
                  </TableRow>
                ))}
                {showTotal && total ? (
                  <TableRow>
                    <BuCell row={null} />
                    <Num strong>{n(total.published)}</Num>
                    <Num strong>{n(total.withApplicants)}</Num>
                    <Num strong>{n(total.published - total.withApplicants)}</Num>
                    <Num strong>{n(total.applicants)}</Num>
                    <Num strong>{fmtPct(ratio(total.withApplicants, total.published))}</Num>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
          <p className={cn('text-xs', DASH.muted)}>
            Success ประกาศ = ใบที่ Gen link แล้วมีผู้สมัคร ÷ ใบที่ Gen link ทั้งหมดในกลุ่มใบขอที่เลือก · ประกาศใหม่ยังมีเวลารับสมัครน้อยกว่า ·
            “ไม่มีผู้สมัคร” ยังไม่ใช่ข้อสรุปว่าล้มเหลว
          </p>
        </Card>
      </TabsContent>

      <TabsContent value="requests">
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">ใบขอเข้า และใบที่เปิดอยู่ตอนนี้</p>
            <Badge variant="secondary" className="text-xs">
              {buBadge}
            </Badge>
          </div>
          {noRows ?? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.requestsIn" />
                  <Head metric="teamOnline.openNow" />
                  <Head metric="teamOnline.remaining" />
                  <Head metric="teamOnline.openWithoutLink" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell row={r} />
                    <Num>{n(r.requestsIn)}</Num>
                    <Num>{n(r.openNow)}</Num>
                    <Num>{n(r.remaining)}</Num>
                    <Num>{n(r.openWithoutLink)}</Num>
                  </TableRow>
                ))}
                {showTotal && total ? (
                  <TableRow>
                    <BuCell row={null} />
                    <Num strong>{n(total.requestsIn)}</Num>
                    <Num strong>{n(total.openNow)}</Num>
                    <Num strong>{n(total.remaining)}</Num>
                    <Num strong>{n(total.openWithoutLink)}</Num>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
          <p className={cn('text-xs', DASH.muted)}>ใบขอเข้า = ช่วงที่เลือก · เปิดอยู่ / เหลือหา / ยังไม่ Gen link = ตอนนี้</p>
        </Card>
      </TabsContent>

      <TabsContent value="lumos">
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Lumos โทรผู้สมัครจากหน้าสมัครงาน</p>
            <Badge variant="secondary" className="text-xs">
              {buBadge}
            </Badge>
          </div>
          {noRows ?? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.called" />
                  <Head metric="teamOnline.reached" />
                  <Head metric="teamOnline.interested" />
                  <Head metric="teamOnline.noAnswer" />
                  <Head metric="teamOnline.callSuccess" suffix="" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell row={r} />
                    <Num>{n(r.called)}</Num>
                    <Num>{n(r.reached)}</Num>
                    <Num>{n(r.interested)}</Num>
                    <Num>{n(r.noAnswer)}</Num>
                    <Num strong>{r.reached === null || r.interested === null ? '—' : fmtPct(ratio(r.interested, r.reached))}</Num>
                  </TableRow>
                ))}
                {showTotal && lumosTotal ? (
                  <TableRow>
                    <BuCell row={null} />
                    <Num strong>{n(lumosTotal.called.cur)}</Num>
                    <Num strong>{n(lumosTotal.reached.cur)}</Num>
                    <Num strong>{n(lumosTotal.interested.cur)}</Num>
                    <Num strong>{n(lumosTotal.noAnswer.cur)}</Num>
                    <Num strong>{fmtPct(ratio(lumosTotal.interested.cur, lumosTotal.reached.cur))}</Num>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
          <p className={cn('text-xs', DASH.muted)}>นับเป็นคน (คนเดียวหลายสาย = 1) · ติดต่อได้ / สนใจ / ไม่รับสาย ดูจากสายล่าสุด</p>
        </Card>
      </TabsContent>

      <TabsContent value="todo">
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">งานที่ต้องทำตอนนี้</p>
            <Badge variant="secondary" className="text-xs">
              {buBadge}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TodoTile metric="teamOnline.openWithoutLink" value={total ? total.openWithoutLink : null} tone="warn" />
            <TodoTile metric="teamOnline.staleNoApplicants" value={total ? total.staleNoApplicants : null} tone="danger" />
            <div className={cn('flex flex-col gap-2 rounded-xl border p-3', TONE.primary.soft)}>
              <p className="text-xs text-foreground" title={metricHelp('teamOnline.queueWaiting')}>
                สายที่รอผลจาก AI
              </p>
              <p className={cn('text-2xl font-medium tabular-nums', TONE.primary.num)}>
                {n(queueWaiting)} <span className={cn('text-sm', DASH.sub)}>สาย</span>
              </p>
              <Button type="button" size="xs" variant="outline" className="self-start" onClick={onOpenQueue} disabled={queueWaiting === null}>
                {METRICS['teamOnline.queueWaiting'].label}
              </Button>
            </div>
          </div>
          {noRows ?? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.openWithoutLink" />
                  <Head metric="teamOnline.staleNoApplicants" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell row={r} />
                    <Num>{n(r.openWithoutLink)}</Num>
                    <Num>{n(r.staleNoApplicants)}</Num>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Button asChild size="xs" variant="outline" className="self-start">
            <Link to="/jobs/board">เปิดกล่องงาน</Link>
          </Button>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

function TodoTile({ metric, value, tone }: { metric: MetricKey; value: number | null; tone: 'warn' | 'danger' }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border p-3', TONE[tone].soft)}>
      <p className="text-xs text-foreground" title={metricHelp(metric)}>
        {METRICS[metric].label}
      </p>
      <p className={cn('text-2xl font-medium tabular-nums', TONE[tone].num)}>
        {n(value)} <span className={cn('text-sm', DASH.sub)}>{METRICS[metric].unit}</span>
      </p>
    </div>
  );
}

export default TeamOnlineTabs;
