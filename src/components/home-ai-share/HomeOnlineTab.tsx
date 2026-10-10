/**
 * ═══ หน้าหลัก แท็บ "ทีม Online" (เจ้าของ 8 ต.ค. 2569) ═══
 * ใบขอ → ส่งไปประกาศ → ผลประกาศ → งานอะไรเยอะ (3 มุม) → แต่ละ BU · ทุกก้อนรวมได้เท่าใบขอเข้า (`onlineReportAddsUp`)
 * ตัวคิด `src/lib/homeOnline.ts` · ตัวโหลด `api/_lib/homeOnlineSql.ts` (โหมด `?online=1` ของ `/api/home-ai-share`)
 * 🔴 shadcn + Tailwind · สีจาก TONE (เขียว = ปิดครบ · เหลือง = เปิดอยู่/เหลือหา) · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HomeSection, StatStrip, type StatItem } from '@/components/home-ai-share/HomeSections';
import { fetchHomeOnline } from '@/lib/homeAiShareApi';
import { homeQueryKey, type AiShareWindow } from '@/lib/homeAiShare';
import {
  ONLINE_AI_CALLED,
  ONLINE_REQUEST_STATES,
  onlineApplicantsAddUp,
  onlineReportAddsUp,
  type OnlineApplicantsReport,
  type OnlineCount,
  type OnlineReport,
  type OnlineReportResponse,
  type OnlineRequestState,
} from '@/lib/homeOnline';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const FULL_DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** สีที่มีความหมาย: ปิดครบ = เขียว · เปิดอยู่ (เหลือหา) = เหลือง · ยกเลิก = เทา · หาได้บางส่วนแล้วยกเลิก = ส้ม */
const STATE_TONE: Record<OnlineRequestState, ToneKey> = {
  open: 'warn',
  fullyClosed: 'success',
  cancelledAll: 'neutral',
  partialCancelled: 'orange',
};

function useHomeOnline(q: AiShareWindow & { bu: string | null }, tick: number) {
  /** ข้อมูล/ข้อผิดพลาดผูกกับคีย์คำขอ (ช่วงวัน + BU) — ใช้เฉพาะเมื่อตรงกับที่เลือกอยู่ (`homeQueryKey` · QA 10 ต.ค. 2569) */
  const [data, setData] = useState<{ key: string; d: OnlineReportResponse } | null>(null);
  const [error, setError] = useState<{ key: string; msg: string } | null>(null);
  const qRef = useRef(q);
  qRef.current = q;
  useEffect(() => {
    let alive = true;
    const key = homeQueryKey(q);
    fetchHomeOnline(q)
      .then((d) => alive && setData({ key, d }))
      .catch((e: unknown) => alive && setError({ key, msg: e instanceof Error && e.message ? e.message : 'โหลดไม่ขึ้น ลองรีเฟรชอีกครั้ง' }));
    return () => {
      alive = false;
    };
  }, [q]);
  useEffect(() => {
    if (tick === 0) return;
    let alive = true;
    const key = homeQueryKey(qRef.current);
    fetchHomeOnline(qRef.current)
      .then((d) => {
        // รอบสดสำเร็จ = ล้างแถบล้มด้วย · มาถึงหลังเปลี่ยน BU/ช่วง = ทิ้ง
        if (alive && homeQueryKey(qRef.current) === key) {
          setData({ key, d });
          setError(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);
  const key = homeQueryKey(q);
  const current = data?.key === key ? data.d : null;
  return { data: current, error: (error?.key === key ? error.msg : null) ?? current?.error ?? null };
}

const stateItems = (s: Record<OnlineRequestState, number>): StatItem[] =>
  ONLINE_REQUEST_STATES.map((x) => ({ key: x.key, label: x.label, value: s[x.key], tone: STATE_TONE[x.key] }));

function CountBars({ title, rows, total, testId }: { title: string; rows: OnlineCount[]; total: number; testId: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="min-w-0 space-y-2" data-testid={testId}>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-sm">
            <span className={cn('truncate', r.key === 'ไม่ระบุ' ? 'text-muted-foreground' : 'text-foreground')} title={r.label}>
              {r.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={cn('block h-full rounded-full', TONE.primary.dot)} style={{ width: `${(r.n / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-foreground">{NUM.format(r.n)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs tabular-nums text-muted-foreground">รวม {NUM.format(rows.reduce((n, r) => n + r.n, 0))} = ใบขอ {NUM.format(total)}</p>
    </div>
  );
}

function DailyBars({ report }: { report: OnlineReport }) {
  const days = report.requests.daily;
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="space-y-2" data-testid="online-daily">
      <h3 className="text-sm font-medium text-foreground">เข้ารายวัน</h3>
      <ul className="space-y-1">
        {days.map((d) => (
          <li key={d.day} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="tabular-nums text-muted-foreground">{DAY.format(new Date(`${d.day}T00:00:00Z`))}</span>
            <span className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              {ONLINE_REQUEST_STATES.map((s) =>
                d.byState[s.key] > 0 ? (
                  <span key={s.key} className={cn('h-full', TONE[STATE_TONE[s.key]].dot)} style={{ width: `${(d.byState[s.key] / max) * 100}%` }} />
                ) : null,
              )}
            </span>
            <span className="text-right tabular-nums text-foreground">{NUM.format(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ใบสมัคร → AI คัดกรอง → คนโทรเอง (ข้อ 7–9) — ทุกแถวบวกลบลงตัว (`onlineApplicantsAddUp`) */
function ApplicantSections({ apps, sub }: { apps: OnlineApplicantsReport; sub: string | null }) {
  const a = apps.ai;
  return (
    <>
      <HomeSection title="ใบสมัคร" sub={sub} testId="online-apps">
        <StatStrip
          testId="online-apps-strip"
          items={[
            { key: 'total', label: 'ใบสมัครเข้า', value: apps.total },
            { key: 'sent', label: 'ส่งให้ AI', value: apps.sent, tone: 'primary' },
            { key: 'overAge', label: 'อายุเกิน (ไม่ส่ง AI)', value: apps.overAge, tone: 'danger' },
            { key: 'notSent', label: 'ไม่ได้ส่ง AI', value: apps.notSent, tone: 'neutral' },
          ]}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <CountBars title="BU" rows={apps.bu} total={apps.total} testId="online-apps-bu" />
          <CountBars title="ตำแหน่ง" rows={apps.position} total={apps.total} testId="online-apps-position" />
        </div>
      </HomeSection>

      <HomeSection title="AI คัดกรอง" sub={sub} testId="online-ai">
        <StatStrip
          testId="online-ai-sent"
          items={[
            { key: 'sent', label: 'AI ต้องโทร', value: apps.sent },
            { key: 'called', label: 'โทรแล้ว', value: a.called, tone: 'primary' },
            { key: 'cancelled', label: 'ยกเลิก', value: a.cancelled, tone: 'neutral' },
            { key: 'waiting', label: 'รอโทร', value: a.waiting, tone: 'info' },
          ]}
        />
        <StatStrip
          testId="online-ai-called"
          items={[
            { key: 'called', label: 'โทรแล้ว', value: a.called },
            ...ONLINE_AI_CALLED.map((c) => ({
              key: c.key,
              label: c.label,
              value: a[c.key],
              tone: (c.key === 'interested' ? 'success' : c.key === 'notInterested' ? 'danger' : c.key === 'unclear' ? 'violet' : 'warn') as ToneKey,
            })),
          ]}
        />
      </HomeSection>

      <HomeSection title="คนโทรเอง" sub={sub} testId="online-staff">
        <StatStrip
          testId="online-staff-strip"
          items={[
            { key: 'total', label: 'คนโทร', value: apps.staff.total },
            { key: 'afterAi', label: 'หลัง AI โทร', value: apps.staff.afterAi, tone: 'primary' },
            { key: 'staffOnly', label: 'คนโทรอย่างเดียว', value: apps.staff.staffOnly, tone: 'neutral' },
          ]}
        />
      </HomeSection>
    </>
  );
}

const HomeOnlineTab: React.FC<{ q: AiShareWindow & { bu: string | null }; tick: number }> = ({ q, tick }) => {
  const { data, error } = useHomeOnline(q, tick);
  const report = data?.report ?? null;
  const thDay = (ymd: string) => FULL_DAY.format(new Date(`${ymd}T00:00:00Z`));
  const sub = data
    ? `${data.from === data.to ? thDay(data.from) : `${thDay(data.from)} – ${thDay(data.to)}`} · นับตามวันที่ใบส่งเข้ามา${data.bu ? ` · ${trendBuLabel(data.bu)}` : ' · ทุก BU'}`
    : null;
  if (error) return <p className={cn('text-sm', TONE.danger.value)}>{error}</p>;
  if (!report) return <Skeleton className="h-96 w-full rounded-2xl" />;
  const apps = data?.applicants ?? null;
  const ok = onlineReportAddsUp(report) && (!apps || onlineApplicantsAddUp(apps));
  const r = report.requests;
  const appSub = sub ? sub.replace('นับตามวันที่ใบส่งเข้ามา', 'นับตามวันสมัคร') : null;
  return (
    <div className="space-y-5" data-testid="home-online">
      {!ok ? (
        <p className={cn('text-xs', TONE.danger.value)} data-testid="online-mismatch">
          เลขบางก้อนรวมไม่เท่าใบขอเข้ามา
        </p>
      ) : null}

      <HomeSection title="ใบขอ" sub={sub} testId="online-requests">
        <StatStrip
          testId="online-request-states"
          items={[{ key: 'total', label: 'ใบขอเข้ามา', value: r.total, unit: `ใบ · ${NUM.format(r.positions)} อัตรา` }, ...stateItems(r.byState)]}
        />
        <DailyBars report={report} />
      </HomeSection>

      <HomeSection title="ส่งไปประกาศ" sub={sub} testId="online-posting">
        <StatStrip
          testId="online-posting-strip"
          items={[
            { key: 'total', label: 'ใบขอเข้ามา', value: report.posting.total },
            { key: 'released', label: 'ประกาศแล้ว', value: report.posting.released, tone: 'success' },
            { key: 'notReleasedOpen', label: 'ยังไม่ประกาศ (ใบยังเปิด)', value: report.posting.notReleasedOpen, tone: 'warn' },
            { key: 'notReleasedEnded', label: 'ไม่ได้ประกาศ (จบไปแล้ว)', value: report.posting.notReleasedEnded, tone: 'neutral' },
          ]}
        />
      </HomeSection>

      <HomeSection title="ผลประกาศ" sub={sub} testId="online-results">
        <StatStrip
          testId="online-results-strip"
          items={[
            { key: 'released', label: 'ประกาศแล้ว', value: report.results.released },
            { key: 'with', label: 'มีคนสมัคร', value: report.results.withApplications, tone: 'success' },
            { key: 'without', label: 'ยังไม่มีคนสมัคร', value: report.results.withoutApplications, tone: 'warn' },
            { key: 'apps', label: 'ใบสมัครรวม', value: report.results.applications, unit: 'ใบ' },
          ]}
        />
        <div className="overflow-x-auto">
          <Table data-testid="online-top">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ใบขอ</TableHead>
                <TableHead className="text-xs">หน่วยงาน · ตำแหน่ง</TableHead>
                <TableHead className="text-xs">BU</TableHead>
                <TableHead className="text-right text-xs">คนสมัคร</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.results.top.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    ไม่มีใบที่ประกาศในช่วงนี้
                  </TableCell>
                </TableRow>
              ) : (
                report.results.top.map((t) => (
                  <TableRow key={t.requestNo}>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">{t.requestNo}</TableCell>
                    <TableCell className="text-sm">{[t.unitName, t.position].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="text-sm">{t.bu ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(t.applications)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </HomeSection>

      <HomeSection title="งานอะไรเยอะ" sub={sub} testId="online-types">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CountBars title="อุตสาหกรรมลูกค้า" rows={report.types.industry} total={r.total} testId="online-type-industry" />
          <CountBars title="ราชการ / เอกชน" rows={report.types.sector} total={r.total} testId="online-type-sector" />
          <CountBars title="ตำแหน่ง" rows={report.types.position} total={r.total} testId="online-type-position" />
        </div>
      </HomeSection>

      <HomeSection title="แต่ละ BU" sub={sub} testId="online-bu">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">BU</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ใบขอเข้ามา</TableHead>
                {ONLINE_REQUEST_STATES.map((s) => (
                  <TableHead key={s.key} className="whitespace-nowrap text-right text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', TONE[STATE_TONE[s.key]].dot)} aria-hidden />
                      {s.label}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.bu.map((b) => (
                <TableRow key={b.bu ?? 'none'} data-testid={`online-bu-${b.bu ?? 'none'}`}>
                  <TableCell className="text-sm">{b.bu ?? 'ไม่ระบุ BU'}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(b.total)}</TableCell>
                  {ONLINE_REQUEST_STATES.map((s) => (
                    <TableCell key={s.key} className="text-right text-sm tabular-nums">
                      {NUM.format(b.byState[s.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-medium">
                <TableCell className="text-sm">รวม</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{NUM.format(r.total)}</TableCell>
                {ONLINE_REQUEST_STATES.map((s) => (
                  <TableCell key={s.key} className="text-right text-sm tabular-nums">
                    {NUM.format(r.byState[s.key])}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </HomeSection>

      {apps ? <ApplicantSections apps={apps} sub={appSub} /> : null}
    </div>
  );
};

export default HomeOnlineTab;
