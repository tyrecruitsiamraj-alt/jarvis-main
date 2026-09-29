/**
 * แท็บล่างของหน้าทีม Online — แต่ละแท็บจบในตัว: กราฟแท่งเทียบ BU ต่อช่วงย่อย + เส้นแนวโน้ม แล้วตามด้วยตาราง
 *
 * เจ้าของสั่ง 29 ก.ย. 2569 (รอบ 2):
 * - คนใช้งาน = % ของบัญชีใน BU + *"แยกบอกด้วยว่า หัวหน้า Opl ฯลฯ อย่างละเท่าไหร่"*
 * - ใบขอเข้า = อัตรา · Lumos = ทุกเลน แยกสีตามเลน (ส่งไป · รอโทร · โทรแล้ว · สำเร็จ · ไม่สำเร็จ · Success rate)
 * - ติดตรงไหน ต่อ BU · Success ประกาศ (ตารางตามภาพต้นแบบ) · ความคุ้มค่า = เว้นไว้ก่อน (แท็บกดไม่ได้)
 *
 * กราฟเทียบทุก BU เสมอ (BU ที่เลือกเด่น ที่เหลือจาง) · ตารางตามตัวกรอง BU (ป้าย BU บนหัว) · ค่าที่อ่านไม่ได้ = "—"
 */
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import {
  FUNNEL_STAGES,
  TEAM_LANES,
  countDelta,
  emptyLumosStats,
  fmtPct,
  rateDelta,
  ratio,
  successRate,
  type TeamLumosSeriesKey,
  type TeamLumosStats,
  type TeamOnlineResponse,
} from '@/lib/teamOnline';
import { TREND_GRAIN_LABEL } from '@/lib/trends/timeBuckets';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import BuTrendChart, { type BuTrendSeries } from './BuTrendChart';
import { LANE_TONE } from './teamOnlineTones';

const NUM = new Intl.NumberFormat('th-TH');
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : NUM.format(v));

function Head({ metric, suffix, className }: { metric: MetricKey; suffix?: string; className?: string }) {
  return (
    <TableHead className={cn('text-right text-xs', className)} title={metricHelp(metric)}>
      {METRICS[metric].label}
      {suffix ?? ` (${METRICS[metric].unit})`}
    </TableHead>
  );
}

function Num({ children, strong, className }: { children: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <TableCell className={cn('text-right text-sm tabular-nums', strong ? DASH.cellStrong : DASH.cell, className)}>{children}</TableCell>
  );
}

function BuCell({ label, bu, indent }: { label: string; bu: string | null; indent?: React.ReactNode }) {
  return (
    <TableCell className="text-sm">
      {bu === null ? (
        <span className="font-medium text-foreground">รวม</span>
      ) : indent ? (
        <span className={cn('inline-flex items-center gap-1.5 pl-3 text-xs', DASH.muted)}>{indent}</span>
      ) : (
        <span className="text-foreground" title={label}>
          {bu || label}
        </span>
      )}
    </TableCell>
  );
}

function Section({
  title,
  buBadge,
  right,
  children,
  foot,
}: {
  title: string;
  buBadge: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <Badge variant="secondary" className="text-xs">
            {buBadge}
          </Badge>
        </div>
        {right}
      </div>
      {children}
      {foot ? <p className={cn('text-xs', DASH.muted)}>{foot}</p> : null}
    </Card>
  );
}

const LUMOS_METRICS: ReadonlyArray<{ key: TeamLumosSeriesKey; metric: MetricKey }> = [
  { key: 'sent', metric: 'teamOnline.lumosSent' },
  { key: 'called', metric: 'teamOnline.lumosCalled' },
  { key: 'success', metric: 'teamOnline.lumosSuccess' },
  { key: 'rate', metric: 'teamOnline.successRate' },
];

function addLumos(a: TeamLumosStats, b: TeamLumosStats): TeamLumosStats {
  return {
    sent: a.sent + b.sent,
    waiting: a.waiting + b.waiting,
    called: a.called + b.called,
    success: a.success + b.success,
    fail: a.fail + b.fail,
    talked: a.talked + b.talked,
  };
}

function LumosCells({ s, strong }: { s: TeamLumosStats; strong?: boolean }) {
  return (
    <>
      <Num strong={strong}>{n(s.waiting)}</Num>
      <Num strong={strong}>{n(s.called)}</Num>
      <Num strong={strong}>{n(s.success)}</Num>
      <Num strong={strong}>{n(s.fail)}</Num>
      <Num strong>{fmtPct(successRate(s))}</Num>
    </>
  );
}

/** แท่งเล็กแยกสีตามเลน — ส่งไปของ BU นี้เป็นงานแบบไหน */
function LaneBar({ lanes, total }: { lanes: Record<string, TeamLumosStats>; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="ml-auto flex h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
      {TEAM_LANES.map((l) =>
        lanes[l.key]?.sent ? (
          <div key={l.key} className={cn('h-full', TONE[LANE_TONE[l.key]].dot)} style={{ width: `${(lanes[l.key].sent / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}

const TeamOnlineTabs: React.FC<{ data: TeamOnlineResponse | null; loading: boolean }> = ({ data, loading }) => {
  const [lumosKey, setLumosKey] = useState<TeamLumosSeriesKey>('sent');
  const w = data?.window ?? null;
  const bu = data?.bu ?? null;
  const buBadge = bu ?? 'ทุก BU';
  const pick = <T extends { bu: string }>(rows: ReadonlyArray<T> | null | undefined): T[] =>
    (rows ?? []).filter((r) => !bu || r.bu === bu);
  const chartOf = <T extends { bu: string; label: string }>(rows: ReadonlyArray<T> | null | undefined, values: (r: T) => ReadonlyArray<number | null>): BuTrendSeries[] =>
    (rows ?? []).filter((r) => r.bu !== '').map((r) => ({ bu: r.bu, label: r.label, values: values(r) }));
  const grainText = w ? `ราย${TREND_GRAIN_LABEL[w.grain]}` : '';
  const chartFoot = w
    ? `${grainText} · แท่ง = แต่ละ BU · เส้นประ = แนวโน้ม${w.lastBucketOpen && w.buckets.length > 1 ? ' · ช่วงสุดท้ายยังไม่จบ ไม่นับในเส้นแนวโน้ม' : ''}`
    : null;
  const empty = (msg: string) => <p className={cn('py-6 text-center text-sm', DASH.muted)}>{msg}</p>;
  const waiting = loading && !data;

  /* ── คนใช้งาน ── */
  const users = pick(data?.users?.byBu);
  const usersTotal = users.reduce((s, r) => ({ accounts: s.accounts + r.accounts, users: s.users + r.users }), { accounts: 0, users: 0 });

  /* ── ใบขอเข้า (อัตรา) + ใบเปิดตอนนี้ ── */
  const reqs = pick(data?.requests?.byBu);
  const openBy = new Map((data?.byBu ?? []).map((r) => [r.bu, r]));
  const reqBus = [...new Set([...reqs.map((r) => r.bu), ...pick(data?.byBu).map((r) => r.bu)])];

  /* ── Lumos ── */
  const lumos = pick(data?.lumos?.byBu);
  const lumosTotal = lumos.reduce((s, r) => addLumos(s, r.total), emptyLumosStats());
  const lumosMetric = LUMOS_METRICS.find((m) => m.key === lumosKey) ?? LUMOS_METRICS[0];

  /* ── ติดตรงไหน ── */
  const funnel = pick(data?.funnel);

  /* ── Success ประกาศ ── */
  const posts = pick(data?.byBu);
  const postTotal = posts.reduce(
    (s, r) => ({ published: s.published + r.published, withApplicants: s.withApplicants + r.withApplicants, applicants: s.applicants + r.applicants }),
    { published: 0, withApplicants: 0, applicants: 0 },
  );

  return (
    <Tabs defaultValue="users" className="space-y-3">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        <TabsTrigger value="users" className="text-xs">
          คนใช้งาน
        </TabsTrigger>
        <TabsTrigger value="requests" className="text-xs">
          ใบขอเข้า
        </TabsTrigger>
        <TabsTrigger value="lumos" className="text-xs">
          Lumos
        </TabsTrigger>
        <TabsTrigger value="funnel" className="text-xs">
          ติดตรงไหน
        </TabsTrigger>
        <TabsTrigger value="success" className="text-xs">
          Success ประกาศ
        </TabsTrigger>
        <TabsTrigger value="value" className="text-xs" disabled title="ยังไม่มีข้อมูลต้นทุน">
          ความคุ้มค่า
        </TabsTrigger>
      </TabsList>

      {/* ── คนใช้งาน: % ของบัญชีใน BU + แยกบทบาท ── */}
      <TabsContent value="users">
        <Section title="คนใช้งานต่อ BU · % ของบัญชีใน BU" buBadge={buBadge} foot={chartFoot}>
          {w ? (
            <BuTrendChart
              buckets={w.buckets}
              series={chartOf(data?.users?.byBu, (r) => r.series)}
              lastOpen={w.lastBucketOpen}
              format={(v) => fmtPct(v)}
              asPct
              selected={bu}
              ariaLabel="คนใช้งานต่อ BU เป็นเปอร์เซ็นต์ของบัญชี"
            />
          ) : null}
          {!data?.users ? (
            empty(data?.errors.users ?? (waiting ? 'กำลังโหลด…' : '—'))
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.accounts" />
                  <Head metric="teamOnline.users" />
                  <Head metric="teamOnline.usersPct" suffix=" (%)" />
                  <TableHead className="text-right text-xs">เทียบช่วงก่อน</TableHead>
                  <TableHead className="text-xs">แยกบทบาท (ใช้ / บัญชี)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell label={r.label} bu={r.bu} />
                    <Num>{n(r.accounts)}</Num>
                    <Num>{n(r.users)}</Num>
                    <Num strong>{r.accounts === 0 ? '—' : fmtPct(r.pct)}</Num>
                    <Num className={DASH.muted}>{r.accounts === 0 ? '—' : rateDelta(r.pct, r.prevPct).text}</Num>
                    <TableCell className={cn('text-xs', DASH.muted)}>
                      {r.accounts === 0 ? (
                        <span className={TONE.danger.value}>ยังไม่มีบัญชีในระบบ</span>
                      ) : (
                        r.roles.map((x) => `${x.label} ${NUM.format(x.users)}/${NUM.format(x.accounts)}`).join(' · ')
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length > 1 ? (
                  <TableRow>
                    <BuCell label="รวม" bu={null} />
                    <Num strong>{n(usersTotal.accounts)}</Num>
                    <Num strong>{n(usersTotal.users)}</Num>
                    <Num strong>{fmtPct(ratio(usersTotal.users, usersTotal.accounts))}</Num>
                    <Num>{''}</Num>
                    <TableCell />
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </Section>
      </TabsContent>

      {/* ── ใบขอเข้า: อัตรา ── */}
      <TabsContent value="requests">
        <Section title="อัตราที่ขอเข้าต่อ BU" buBadge={buBadge} foot={chartFoot}>
          {w ? (
            <BuTrendChart
              buckets={w.buckets}
              series={chartOf(data?.requests?.byBu, (r) => r.series)}
              lastOpen={w.lastBucketOpen}
              format={(v) => NUM.format(Math.round(v))}
              selected={bu}
              ariaLabel="อัตราที่ขอเข้าต่อ BU"
            />
          ) : null}
          {!data?.requests ? (
            empty(data?.errors.requests ?? (waiting ? 'กำลังโหลด…' : '—'))
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.positionsIn" />
                  <Head metric="teamOnline.requestsIn" />
                  <TableHead className="text-right text-xs">เทียบช่วงก่อน</TableHead>
                  <Head metric="teamOnline.openNow" />
                  <Head metric="teamOnline.remaining" />
                  <Head metric="teamOnline.openWithoutLink" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqBus.map((b) => {
                  const r = reqs.find((x) => x.bu === b);
                  const o = openBy.get(b);
                  return (
                    <TableRow key={b || 'unknown'}>
                      <BuCell label={r?.label ?? o?.label ?? b} bu={b} />
                      <Num strong>{n(r?.positions.cur ?? 0)}</Num>
                      <Num>{n(r?.requests.cur ?? 0)}</Num>
                      <Num className={DASH.muted}>{r ? countDelta(r.positions.cur, r.positions.prev, 'อัตรา').text : '—'}</Num>
                      <Num>{n(o?.openNow)}</Num>
                      <Num>{n(o?.remaining)}</Num>
                      <Num>{n(o?.openWithoutLink)}</Num>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Section>
      </TabsContent>

      {/* ── Lumos: ทุกเลน แยกสีตามเลน ── */}
      <TabsContent value="lumos">
        <Section
          title="Lumos ต่อ BU · ทุกเลน"
          buBadge={buBadge}
          foot={chartFoot ? `${chartFoot} · นับสาย กลุ่มตามวันที่ส่งเข้าคิว` : null}
          right={
            <div className="w-40 shrink-0">
              <Select value={lumosKey} onValueChange={(v) => setLumosKey(v as TeamLumosSeriesKey)}>
                <SelectTrigger className="text-xs" aria-label="ดูเรื่อง">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LUMOS_METRICS.map((m) => (
                    <SelectItem key={m.key} value={m.key} className="text-xs">
                      {METRICS[m.metric].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          {w ? (
            <BuTrendChart
              buckets={w.buckets}
              series={chartOf(data?.lumos?.byBu, (r) => r.series[lumosKey])}
              lastOpen={w.lastBucketOpen}
              format={(v) => (lumosKey === 'rate' ? fmtPct(v) : NUM.format(Math.round(v)))}
              asPct={lumosKey === 'rate'}
              selected={bu}
              ariaLabel={`Lumos ${METRICS[lumosMetric.metric].label} ต่อ BU`}
            />
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {TEAM_LANES.filter((l) => l.key !== 'other' || (data?.lumos?.lanes.other.sent ?? 0) > 0).map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5 text-foreground">
                <span className={cn('inline-block h-2.5 w-2.5 rounded-full', TONE[LANE_TONE[l.key]].dot)} aria-hidden />
                {l.label}
              </span>
            ))}
          </div>
          {!data?.lumos ? (
            empty(data?.errors.lumos ?? (waiting ? 'กำลังโหลด…' : '—'))
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  <Head metric="teamOnline.lumosSent" />
                  <Head metric="teamOnline.lumosWaiting" />
                  <Head metric="teamOnline.lumosCalled" />
                  <Head metric="teamOnline.lumosSuccess" />
                  <Head metric="teamOnline.lumosFail" />
                  <Head metric="teamOnline.successRate" suffix="" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lumos.map((r) => (
                  <React.Fragment key={r.bu || 'unknown'}>
                    <TableRow>
                      <BuCell label={r.label} bu={r.bu} />
                      <TableCell className="text-right text-sm tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <LaneBar lanes={r.lanes} total={r.total.sent} />
                          <span className={DASH.cell}>{n(r.total.sent)}</span>
                        </div>
                      </TableCell>
                      <LumosCells s={r.total} />
                    </TableRow>
                    {TEAM_LANES.filter((l) => r.lanes[l.key].sent > 0).map((l) => (
                      <TableRow key={`${r.bu}-${l.key}`}>
                        <BuCell
                          label={l.label}
                          bu={r.bu}
                          indent={
                            <>
                              <span className={cn('inline-block h-2 w-2 rounded-full', TONE[LANE_TONE[l.key]].dot)} aria-hidden />
                              {l.label}
                            </>
                          }
                        />
                        <Num className={DASH.muted}>{n(r.lanes[l.key].sent)}</Num>
                        <LumosCells s={r.lanes[l.key]} />
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
                {lumos.length > 1 ? (
                  <TableRow>
                    <BuCell label="รวม" bu={null} />
                    <Num strong>{n(lumosTotal.sent)}</Num>
                    <LumosCells s={lumosTotal} strong />
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </Section>
      </TabsContent>

      {/* ── ติดตรงไหน ต่อ BU ── */}
      <TabsContent value="funnel">
        <Section
          title="ติดตรงไหน · ใบขอที่เข้ามาในช่วงนี้ ตอนนี้ไปถึงขั้นไหน"
          buBadge={buBadge}
          foot={`นับใบที่มีอย่างน้อยหนึ่งคนถึงขั้นนั้น (ถึงตอนนี้) · ช่องสีแดง = ขั้นที่หายมากสุด · ใบที่เพิ่งเข้ายังมีเวลาเดินน้อยกว่า${
            funnel.length > 0 && funnel.every((r) => r.counts.showed === null) ? ' · มาตามนัด “—” = ระบบยังไม่มีการบันทึกผลมาตามนัด' : ''
          }`}
        >
          {!data?.funnel ? (
            empty(data?.errors.funnel ?? (waiting ? 'กำลังโหลด…' : '—'))
          ) : funnel.length === 0 ? (
            empty('ยังไม่มีใบขอเข้าในช่วงนี้')
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BU</TableHead>
                  {FUNNEL_STAGES.map((s) => (
                    <TableHead key={s.key} className="text-right text-xs">
                      {s.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs">ติดที่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnel.map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell label={r.label} bu={r.bu} />
                    {FUNNEL_STAGES.map((s) => {
                      const stuck = r.stuckAt === s.key;
                      const count = r.counts[s.key];
                      const base = r.counts.requests ?? 0;
                      return (
                        <Num key={s.key} strong={stuck} className={stuck ? TONE.danger.wash : undefined}>
                          {n(count)}
                          {s.key !== 'requests' && base > 0 && count !== null ? (
                            <span className={cn('block text-xs', DASH.muted)}>{fmtPct(ratio(count, base))}</span>
                          ) : null}
                        </Num>
                      );
                    })}
                    <TableCell className={cn('text-xs', r.stuckAt ? TONE.danger.value : DASH.muted)}>
                      {r.stuckAt ? FUNNEL_STAGES.find((s) => s.key === r.stuckAt)?.label : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </TabsContent>

      {/* ── Success ประกาศ (ตามภาพต้นแบบ) ── */}
      <TabsContent value="success">
        <Section
          title="Success ประกาศ · มีผู้สมัครอย่างน้อย 1 คน"
          buBadge={buBadge}
          foot="Success ประกาศ = ใบที่ Gen link แล้วมีผู้สมัคร ÷ ใบที่ Gen link ทั้งหมดในกลุ่มใบขอที่เลือก · ประกาศใหม่ยังมีเวลารับสมัครน้อยกว่า · “ไม่มีผู้สมัคร” ยังไม่ใช่ข้อสรุปว่าล้มเหลว"
        >
          {!data?.byBu ? (
            empty(data?.errors.byBu ?? (waiting ? 'กำลังโหลด…' : '—'))
          ) : (
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
                {posts.map((r) => (
                  <TableRow key={r.bu || 'unknown'}>
                    <BuCell label={r.label} bu={r.bu} />
                    <Num>{n(r.published)}</Num>
                    <Num>{n(r.withApplicants)}</Num>
                    <Num>{n(r.published - r.withApplicants)}</Num>
                    <Num>{n(r.applicants)}</Num>
                    <Num strong>{fmtPct(ratio(r.withApplicants, r.published))}</Num>
                  </TableRow>
                ))}
                {posts.length > 1 ? (
                  <TableRow>
                    <BuCell label="รวม" bu={null} />
                    <Num strong>{n(postTotal.published)}</Num>
                    <Num strong>{n(postTotal.withApplicants)}</Num>
                    <Num strong>{n(postTotal.published - postTotal.withApplicants)}</Num>
                    <Num strong>{n(postTotal.applicants)}</Num>
                    <Num strong>{fmtPct(ratio(postTotal.withApplicants, postTotal.published))}</Num>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </Section>
      </TabsContent>
    </Tabs>
  );
};

export default TeamOnlineTabs;
