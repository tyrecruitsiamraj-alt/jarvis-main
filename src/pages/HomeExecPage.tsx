/**
 * ═══ หน้าหลักผู้บริหาร — หน้าเดียวเลื่อนลง (เจ้าของ 24 ต.ค. 2569 · Choice "หน้าเดียวเลื่อนลง") ═══
 *
 * เจ้าของ: *"หน้าหลักต้องบอกได้ประมาณนี้"* — ใบขอเข้า/ปิด/เหลือ · ค้างนาน 5 ช่วง + ปิดกี่วัน · ค่าปรับ/ลดมูลค่า รายใบ ·
 * ประกาศ/ไม่ประกาศ · มีคนกรอก/ไม่มี · AI สนใจแต่คนยังไม่โทรต่อ · ช่องทาง · ติดตาม · ดูแลหลังเริ่มงาน · AI กับคนเท่าไหร่
 * *"ต้องมี visual control · Interactive graph เวลาเปลี่ยนกราฟวิ่งตาม"*
 *
 * ลำดับ (24 ต.ค. 2569 รอบ 2 "ผู้บริหารมีเวลา 30 วิ" — เจ้าของ "ทำเลย · คำอย่าเป็นภาษา AI"):
 *   4 กล่องบน → ต้องรีบ → ใครค้างเท่าไหร่ → ใบขอในช่วงนี้ → (พับไว้) ใบขอค้าง/ช่องทาง · เงินรายวัน/รายใบ → ติดตาม
 *   ค่าตั้งต้น = เดือนนี้ · กล่องเงินโชว์ "ลูกค้าหักจริง" กับ "ตามสัญญา (สูงสุด)" ขนาดเท่ากัน
 * ข้อมูล: `/api/home-money` (เงิน · นาฬิกา · สมการใบขอ) · `/api/request-pipeline` (ใบขอเปิด) · `/api/home-ai-share` (AI/คน)
 * 🔴 ชั้นคู่ขนาน: หน้านี้คือค่าตั้งต้นของ `/` · หน้าแท็บเดิมยังเปิดได้ที่ `?home=new` (ทางถอย · ปุ่มบนหัว)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlarmClock, Bot, Clock3, HandCoins, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PeriodPicker from '@/components/shared/PeriodPicker';
import { KpiTile } from '@/components/home-ai-share/HomeKpis';
import { HomeSection } from '@/components/home-ai-share/HomeSections';
import HomeRequestsTab from '@/components/home-ai-share/HomeRequestsTab';
import HomeMoneySection from '@/components/home-exec/HomeMoneySection';
import { useLiveTick } from '@/hooks/useLiveTick';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { PREQUEST_ID_PREFIX } from '@/lib/siamrajUnitRequestsApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fetchHomeMoney, previousWindow, type HomeMoneyPayload } from '@/lib/homeMoneyApi';
import { fetchHomeAiShare } from '@/lib/homeAiShareApi';
import { sharesOfCalled, type AiShareResponse, type AiShareWindow } from '@/lib/homeAiShare';
import { byOwner, costliest, dueSoon, thisMonthWindow, type UrgentRow } from '@/lib/homeExec';
import { thaiDate } from '@/lib/periodPick';
import { SITE_BU_TO_DEPT, trendBuLabel } from '@/lib/trends/bu';
import { toYmdBangkok } from '@/lib/dateTh';
import { countPill } from '@/lib/teamOnline';
import { TONE } from '@/lib/designTokens';
import { friendlyErrorText } from '@/lib/friendlyError';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const BU_OPTIONS = [...new Set(Object.values(SITE_BU_TO_DEPT))];
const LIVE_MS = 60_000;
/** ช่วง "ทั้งหมด" ของปฏิทิน (start null) = นับตั้งแต่ข้อมูลเก่าสุดของสมุด */
const ALL_FROM = '2024-01-01';

/** AI ทำแทนกี่ % (ของที่โทรแล้ว) — หัวข้อที่เจ้าของระบุ 24 ต.ค. 2569 */
function aiRows(d: AiShareResponse | null): Array<{ key: string; label: string; pct: number | null; called: number }> {
  if (!d) return [];
  const f = d.follow;
  const out: Array<{ key: string; label: string; pct: number | null; called: number }> = [];
  if (f) {
    const repTotal = f.teamReplacement ?? 0;
    const repAi = f.teamReplacementAi ?? 0;
    const mainTotal = f.total - repTotal;
    const mainAi = f.ai - repAi;
    out.push({ key: 'start', label: 'ติดตามคนเริ่มงาน', pct: mainTotal > 0 ? Math.round((mainAi / mainTotal) * 100) : null, called: mainTotal });
    out.push({ key: 'replace', label: 'ติดตามส่งคนแทน', pct: repTotal > 0 ? Math.round((repAi / repTotal) * 100) : null, called: repTotal });
  }
  for (const [key, label, c] of [
    ['applicants', 'งานสรรหา', d.applicants],
    ['matching', 'จับคู่งาน', d.matching],
  ] as const) {
    const s = c ? sharesOfCalled(c) : null;
    out.push({ key, label, pct: s ? s.ai : null, called: c ? c.ai + c.staff + c.both : 0 });
  }
  return out;
}

/** การ์ด "ต้องรีบ" — 5 ใบแรก + บอกว่ามีทั้งหมดกี่ใบ */
function UrgentCard({
  icon: Icon,
  title,
  total,
  rows,
  loading,
  right,
  testId,
}: {
  icon: typeof HandCoins;
  title: string;
  total: number;
  rows: UrgentRow[];
  loading: boolean;
  right: (r: UrgentRow) => string;
  testId: string;
}) {
  return (
    <Card variant="solid" className="space-y-3 p-4" data-testid={testId}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          {title}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">{loading ? '—' : `${NUM.format(total)} ใบ`}</span>
      </span>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{loading ? '—' : 'ไม่มี'}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.requestNo} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{[r.unit, r.position].filter(Boolean).join(' · ')}</span>
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {r.requestNo} · ขาด {NUM.format(r.missing)} คน
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">{right(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** ส่วนที่พับไว้ — กดหัวแล้วกาง (ของข้างในโหลดตอนกาง) */
function Folded({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={testId}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between rounded-xl" aria-expanded={open}>
          {title}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">{open ? children : null}</CollapsibleContent>
    </Collapsible>
  );
}

const HomeExecPage: React.FC = () => {
  usePageTitle('หน้าหลัก');
  const [win, setWin] = useState<AiShareWindow>(() => thisMonthWindow(toYmdBangkok(new Date())));
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [bu, setBu] = useState<string | null>(null);
  const [money, setMoney] = useState<HomeMoneyPayload | null>(null);
  const [prevMoney, setPrevMoney] = useState<HomeMoneyPayload | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiShareResponse | null>(null);
  const tick = useLiveTick(true, LIVE_MS);
  /** ใบขอล่วงหน้าที่กล่องงานนับรวม — อยู่นอกสมการ (ใบล่วงหน้ากลายเป็นใบจริงจะถูกนับว่ายกเลิกผิด) แสดงต่อท้ายให้ยอดเท่ากล่องงาน */
  const feed = useUnitRequestsFeed();
  const preCount = feed.jobs.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX)).length;
  const feedReady = feed.feedState !== 'loading' && feed.feedState !== 'failed' && feed.feedState !== 'forbidden';

  const today = toYmdBangkok(new Date());
  const range = useMemo(() => ({ from: win.from ?? ALL_FROM, to: win.to ?? today }), [win, today]);

  useEffect(() => {
    let alive = true;
    setMoneyError(null);
    fetchHomeMoney({ ...range, bu })
      .then((m) => alive && setMoney(m))
      .catch((e: unknown) => alive && setMoneyError(friendlyErrorText(e, 'โหลดยอดเงินไม่ขึ้น')));
    fetchHomeMoney({ ...previousWindow(range), bu })
      .then((m) => alive && setPrevMoney(m))
      .catch(() => alive && setPrevMoney(null));
    fetchHomeAiShare({ ...win, bu })
      .then((d) => alive && setAi(d))
      .catch(() => alive && setAi(null));
    return () => {
      alive = false;
    };
  }, [range, win, bu, tick]);

  // เปลี่ยนช่วง/BU แล้วเลขเก่าห้ามค้าง
  const moneyNow = money && money.window.from === range.from && money.window.to === range.to && (money.forcedBu || money.bu === bu) ? money : null;
  const prevNow = moneyNow ? prevMoney : null;
  const flow = moneyNow?.flow ?? null;
  const total = moneyNow ? moneyNow.totals.need.fine + moneyNow.totals.need.deduct : 0;
  const prevTotal = prevNow ? prevNow.totals.need.fine + prevNow.totals.need.deduct : undefined;
  const speed = moneyNow?.clocks.speed ?? null;
  const late = moneyNow?.clocks.late ?? null;
  const liveKey = `${range.from}|${range.to}|${bu ?? ''}`;
  const rows = aiRows(ai);
  const openReqs = useMemo(() => moneyNow?.requests ?? [], [moneyNow]);
  const costly = useMemo(() => costliest(openReqs, today), [openReqs, today]);
  const soon = useMemo(() => dueSoon(openReqs, today), [openReqs, today]);
  const ownerByNo = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of feed.jobs) {
      const no = String(j.request_no ?? '').trim().toUpperCase();
      if (no && j.recruiter_name?.trim()) m.set(no, j.recruiter_name.trim());
    }
    return m;
  }, [feed.jobs]);
  const owners = useMemo(() => byOwner(openReqs, today, (no) => ownerByNo.get(no.trim().toUpperCase()) ?? null), [openReqs, today, ownerByNo]);

  return (
    <div className="space-y-6" data-testid="home-exec">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium text-foreground">หน้าหลัก</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={win} onChange={setWin} />
          {moneyNow?.forcedBu && moneyNow.bu ? (
            <span className="text-sm text-muted-foreground">{trendBuLabel(moneyNow.bu)}</span>
          ) : (
            <Select value={bu ?? 'all'} onValueChange={(v) => setBu(v === 'all' ? null : v)}>
              <SelectTrigger className="h-10 w-44 bg-card" aria-label="เลือก BU">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก BU</SelectItem>
                {BU_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {trendBuLabel(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button asChild variant="outline" size="sm">
            <a href="/?home=new">แบบแท็บเดิม</a>
          </Button>
        </div>
      </div>

      {/* ── 4 กล่องบนสุด (Visual control · เทียบช่วงก่อนหน้าเท่ากัน) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="exec-kpis">
        {/* เสียเงิน: ลูกค้าหักจริง กับ ตามสัญญา (สูงสุด) ตัวเท่ากัน — ไม่ให้ผู้บริหารจำแต่เลขเพดาน */}
        <Card variant="solid" className="space-y-3 p-4" data-testid="exec-money-tile">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <HandCoins className="h-4 w-4" aria-hidden />
            เสียเงิน
          </span>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['ลูกค้าหักจริง', moneyNow ? moneyNow.customerFines.total : null, prevNow ? prevNow.customerFines.total : undefined, 'exec-money-actual'],
                ['ตามสัญญา (สูงสุด)', moneyNow ? total : null, prevTotal, 'exec-money-contract'],
              ] as const
            ).map(([label, v, before, id]) => {
              const pill = v != null && before !== undefined ? countPill(v, before, false) : null;
              return (
                <div key={id} className="space-y-1" data-testid={id}>
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="block text-2xl font-medium tabular-nums text-foreground">{v == null ? '—' : BAHT.format(v)}</span>
                  <span
                    className={cn(
                      'block text-xs tabular-nums',
                      pill?.tone === 'bad' ? TONE.danger.value : pill?.tone === 'good' ? TONE.success.value : 'text-muted-foreground',
                    )}
                  >
                    {pill ? `${pill.dir === 'up' ? '▲' : pill.dir === 'down' ? '▼' : ''} ${pill.text}` : 'บาท'}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="block text-xs text-muted-foreground">เทียบช่วงก่อนหน้าที่ยาวเท่ากัน</span>
        </Card>
        <KpiTile
          tone="warn"
          icon={Layers}
          label="เหลือหา (ใบขอจริง)"
          unit="ใบ"
          value={flow?.remainingRequests ?? 0}
          loading={!flow}
          liveKey={liveKey}
          pill={flow && prevNow ? countPill(flow.remainingRequests, prevNow.flow.remainingRequests, false) : null}
          foot={flow ? `${NUM.format(flow.remaining)} คน · ล่วงหน้าอีก ${feedReady ? NUM.format(preCount) : '—'} ใบ` : null}
        />
        <KpiTile
          tone="info"
          icon={Clock3}
          label="หาคนครบเฉลี่ย (นับจากวันคีย์)"
          unit="วัน"
          value={speed?.avg ?? 0}
          loading={!moneyNow}
          liveKey={liveKey}
          pill={speed?.avg != null && prevNow?.clocks.speed.avg != null ? countPill(speed.avg, prevNow.clocks.speed.avg, false) : null}
          foot={
            moneyNow
              ? `คิดจาก ${NUM.format(speed?.n ?? 0)} ใบที่หาครบในช่วงนี้ · ช้ากว่าที่ลูกค้าต้องการ ${late?.avg == null ? '—' : NUM.format(late.avg)} วัน`
              : null
          }
        />
        <Card variant="solid" className="space-y-3 p-4" data-testid="exec-ai-share">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" aria-hidden />
            AI ทำแทน (ของที่โทรแล้ว)
          </span>
          {rows.length === 0
            ? ['ติดตามคนเริ่มงาน', 'ติดตามส่งคนแทน', 'งานสรรหา', 'จับคู่งาน'].map((l) => (
                <div key={l} className="space-y-1">
                  <span className="flex justify-between text-xs text-muted-foreground">
                    {l}
                    <span>—</span>
                  </span>
                  <Progress value={0} className="h-1.5" />
                </div>
              ))
            : rows.map((r) => (
                <div key={r.key} className="space-y-1" data-testid={`exec-ai-${r.key}`}>
                  <span className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className={cn('font-medium tabular-nums', r.pct == null ? 'text-muted-foreground' : r.pct >= 100 ? TONE.success.value : 'text-foreground')}>
                      {r.pct == null ? '—' : `${r.pct}%`}
                    </span>
                  </span>
                  <Progress value={r.pct ?? 0} className="h-1.5" aria-label={`${r.label} AI ${r.pct ?? 0}%`} />
                </div>
              ))}
          <span className="block text-xs text-muted-foreground">เป้า 100%</span>
        </Card>
      </div>


      {/* ── ต้องรีบ ── */}
      <HomeSection title="ต้องรีบ" testId="exec-urgent">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <UrgentCard
            icon={HandCoins}
            title="เสียวันละมากสุด"
            total={costly.total}
            rows={costly.rows}
            loading={!moneyNow}
            right={(r) => `${BAHT.format(r.perDay)} บาท/วัน`}
            testId="exec-urgent-costly"
          />
          <UrgentCard
            icon={AlarmClock}
            title="ถึงวันที่ต้องการใน 3 วัน ยังขาดคน"
            total={soon.total}
            rows={soon.rows}
            loading={!moneyNow}
            right={(r) => (r.needYmd ? thaiDate(r.needYmd) : '—')}
            testId="exec-urgent-soon"
          />
        </div>
      </HomeSection>

      {/* ── ใครค้างเท่าไหร่ (เจ้าหน้าที่สรรหาของใบขอ) ── */}
      <HomeSection title="ใครค้างเท่าไหร่" sub="ใบที่ยังต้องหา ณ วันนี้" testId="exec-owners">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    เจ้าหน้าที่
                  </span>
                </TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ค้าง (ใบ)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">เลยวันที่ต้องการ (ใบ)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ยังขาด (คน)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">เสียวันละ (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                    {moneyNow ? 'ไม่มีใบค้าง' : '—'}
                  </TableCell>
                </TableRow>
              ) : (
                (showAllOwners ? owners : owners.slice(0, 8)).map((o) => (
                  <TableRow key={o.name} data-testid="exec-owner-row">
                    <TableCell className="text-sm text-foreground">{o.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{NUM.format(o.requests)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', o.overdue > 0 ? TONE.danger.value : 'text-muted-foreground')}>
                      {NUM.format(o.overdue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{NUM.format(o.missing)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{BAHT.format(o.perDay)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {owners.length > 8 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAllOwners((v) => !v)} data-testid="exec-owners-more">
            {showAllOwners ? 'ซ่อน' : `ดูทั้งหมด ${NUM.format(owners.length)} คน`}
          </Button>
        ) : null}
      </HomeSection>

      {/* ── ใบขอเข้ามา · ปิด · เหลือ — สมการลงตัวทั้งหน่วยใบและหน่วยคน (เจ้าของ "บวกลบกันแล้วต้องเท่ากัน") ── */}
      <HomeSection title="ใบขอในช่วงนี้" sub="ใบขอจริงใน ERP" testId="exec-flow">
        {(
          [
            {
              unit: 'ใบ',
              id: 'req',
              cells: [
                ['ยกมา', flow?.carryInRequests, null],
                ['ขอใหม่', flow?.newRequests, 'info'],
                ['ปิดครบ', flow?.closedRequests, 'success'],
                ['ยกเลิก', flow?.cancelledRequests, 'neutral'],
                ['เหลือหา', flow?.remainingRequests, 'warn'],
              ],
              sum: flow
                ? `ยกมา ${NUM.format(flow.carryInRequests)} + ขอใหม่ ${NUM.format(flow.newRequests)} − ปิดครบ ${NUM.format(flow.closedRequests)} − ยกเลิก ${NUM.format(flow.cancelledRequests)} = เหลือหา ${NUM.format(flow.remainingRequests)} ใบ`
                : '—',
            },
            {
              unit: 'คน',
              id: 'pos',
              cells: [
                ['ยกมา', flow?.carryIn, null],
                ['ขอใหม่', flow?.newPositions, 'info'],
                ['หาได้', flow?.filled, 'success'],
                ['ยกเลิก', flow?.cancelled, 'neutral'],
                ['เหลือหา', flow?.remaining, 'warn'],
              ],
              sum: flow
                ? `ยกมา ${NUM.format(flow.carryIn)} + ขอใหม่ ${NUM.format(flow.newPositions)} − หาได้ ${NUM.format(flow.filled)} − ยกเลิก ${NUM.format(flow.cancelled)} = เหลือหา ${NUM.format(flow.remaining)} คน`
                : '—',
            },
          ] as const
        ).map((g) => (
          <div key={g.id} className="space-y-2" data-testid={`exec-flow-${g.id}`}>
            <p className="text-xs font-medium text-muted-foreground">จำนวน{g.unit}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {g.cells.map(([label, v, tone]) => (
                <Card key={label} variant="solid" className="space-y-1 rounded-xl p-3">
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className={cn('block text-2xl font-medium tabular-nums', tone ? TONE[tone].value : 'text-foreground')}>
                    {v == null ? '—' : NUM.format(v)}
                  </span>
                </Card>
              ))}
            </div>
            <p className="text-xs tabular-nums text-muted-foreground" data-testid={`exec-flow-${g.id}-sum`}>
              {g.sum}
            </p>
          </div>
        ))}
        {/* เทียบกล่องงานได้เฉพาะช่วงที่จบวันนี้ (กล่องงานคือ ณ วันนี้) */}
        {range.to >= today ? (
          <p className="text-xs tabular-nums text-muted-foreground" data-testid="exec-flow-board">
            {flow && feedReady
              ? `เหลือหา ${NUM.format(flow.remainingRequests)} + ใบขอล่วงหน้า ${NUM.format(preCount)} = ${NUM.format(flow.remainingRequests + preCount)} ใบ (เท่ากล่องงาน)`
              : '—'}
          </p>
        ) : null}
      </HomeSection>

      {/* ── พับไว้ (ผู้บริหารไม่ต้องเลื่อนผ่าน) — กดแล้วกาง ── */}
      <Folded title="ใบขอค้าง · ประกาศ · ช่องทาง" testId="exec-fold-requests">
        <HomeRequestsTab win={win} tick={tick} />
      </Folded>
      <Folded title="เงินรายวัน · รายใบ" testId="exec-fold-money">
        <HomeMoneySection money={moneyNow} prev={prevNow} error={moneyError} />
      </Folded>

      {/* ── ติดตาม · ดูแลหลังเริ่มงาน (AI / คน / ยังไม่โทร) ── */}
      <HomeSection
        title="ติดตาม · ดูแลหลังเริ่มงาน"
        sub="หน่วย: รายชื่อ"
        testId="exec-follow"
        right={
          <Button asChild variant="outline" size="sm">
            <a href="/?home=new">ดูรายชื่อ</a>
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(
            [
              ['ติดตามคนเริ่มงาน · ส่งคนแทน', ai?.follow ?? null],
              ['ดูแลหลังเริ่มงาน', ai?.aftercare ?? null],
            ] as const
          ).map(([title, c]) => (
            <Card key={title} variant="solid" className="space-y-3 p-4">
              <span className="block text-sm font-medium text-foreground">{title}</span>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['ทั้งหมด', c?.total, null],
                    ['AI โทร', c?.ai, 'primary'],
                    ['คนโทร', c?.staff, 'violet'],
                    ['ยังไม่โทร', c?.notCalled, 'neutral'],
                  ] as const
                ).map(([label, v, tone]) => (
                  <div key={label} className="space-y-0.5">
                    <span className="block text-xs text-muted-foreground">{label}</span>
                    <span className={cn('block text-xl font-medium tabular-nums', tone ? TONE[tone].value : 'text-foreground')}>
                      {v == null ? '—' : NUM.format(v)}
                    </span>
                  </div>
                ))}
              </div>
              {c && c.total > 0 ? (
                <Progress value={Math.round((c.ai / c.total) * 100)} className="h-1.5" aria-label={`${title} AI ${Math.round((c.ai / c.total) * 100)}%`} />
              ) : (
                <Progress value={0} className="h-1.5" />
              )}
            </Card>
          ))}
        </div>
      </HomeSection>
    </div>
  );
};

export default HomeExecPage;
