import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck,
  Filter,
  Info,
  Link2,
  Megaphone,
  PhoneCall,
  PhoneOutgoing,
  RefreshCw,
  ThumbsUp,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { rangeText } from '@/lib/teamOnline';
import { shortTime } from '@/lib/dateTh';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import { monthLabel, monthOptions, shiftMonth } from '@/lib/recruitOverviewWindow';
import {
  channelRows,
  cohortOf,
  dailyRows,
  delayRows,
  funnelSteps,
  positionRows,
  reasonGroups,
  totalsOf,
} from '@/lib/recruitOverview';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { BoardPublishedTotals } from '@/lib/boardRelease';
import {
  BacklogBody,
  ChannelTable,
  DailyCard,
  DelayList,
  EmptyNote,
  FunnelList,
  OverviewCard,
  OverviewKpi,
  PositionList,
  ReasonColumns,
  SectionError,
  StaffTable,
} from './RecruitOverviewParts';

/**
 * ═══ แท็บ "ภาพรวม" ของกล่องงาน = ภาพรวมงานสรรหาแบบ iRecruit (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * > *"ทำหน้าภาพรวมให้เหมือน iRecruit ต่อเลย"* → Choice **"ทั้งหน้าเป็น iRecruit"** (ถอดส่วนเดิมออก) ·
 * > **"เลือกเดือนแบบ iRecruit"** · นับโทร/ติดต่อสำเร็จ **AI + คน** แยกบรรทัดล่าง · *"บอกว่า มีกี่ใบที่ประกาศไป แล้วมีรายชื่อมา
 * > เท่าไหร่ Ai โทรไปให้ทั้งหมดเท่าไหร่ เหลือสนใจแล้วคนมาโทรอีกเท่าไหร่ … ต้องบอกด้วยว่า กรอกมาวันนี้โดนโทรวันไหน
 * > จะนับเป็นวันต้องครบ 24 ชม นะถึงจะนับเป็น 1 วัน"*
 *
 * วางตามภาพ iRecruit: การ์ด 6 ใบ · เส้นทาง (ของเราคือเส้นทางของรายชื่อ) + งานค้างตอนนี้ · รายวัน · ช่องทาง + ตำแหน่ง ·
 * เหตุผลที่ไม่สำเร็จ · ผลงานรายคน · "วิธีอ่าน" ย้ายไปอยู่หลังปุ่ม (ไม่มีประโยคอธิบายบนหน้า)
 * 🔴 ตัวเลขทุกตัวมาจาก `src/lib/recruitOverview.ts` (มีเทสต์) · แผงเดิม (`BoardDashboard`) ยังเปิดได้ที่ `?dash=classic` (ทางถอย)
 */

type Load = { data: RecruitOverviewResponse | null; loading: boolean; error: string | null };

function HowToRead() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="xs" variant="outline">
          <Info aria-hidden /> วิธีอ่าน
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-4 text-xs">
        <ul className={cn('list-disc space-y-1.5 pl-4', DASH.muted)}>
          <li>ตัวเลขเป็นของรายชื่อที่กรอกเข้ามาในเดือนที่เลือก ว่าตอนนี้ไปถึงขั้นไหนแล้ว</li>
          <li>ยกเว้น "ใบที่ประกาศ" กับ "งานค้างตอนนี้" เป็นสถานะวันนี้ (ใบที่ประกาศ = เลขเดียวกับหน้างานสรรหา) · "ผลงานรายคน" นับงานที่ลงผลในเดือน</li>
          <li>เขียวเพิ่ม แดงลด เทียบเดือนก่อนช่วงวันเดียวกัน</li>
          <li>นับวันแบบครบ 24 ชม. ถึงเป็น 1 วัน</li>
        </ul>
        <dl className="space-y-1.5">
          {[
            ['โทรแล้ว', 'AI หรือเจ้าหน้าที่โทรแล้วมีผล'],
            ['ติดต่อสำเร็จ', 'ผลล่าสุดคุยถึงตัว รวมคนที่ปฏิเสธ'],
            ['ตอบ AI ว่าสนใจ', 'คำตอบล่าสุดที่ให้ AI (ตัวเดียวกับคอลัมน์คำตอบกับ AI)'],
            ['คนโทรต่อแล้ว', 'ตอบ AI ว่าสนใจ แล้วเจ้าหน้าที่โทรหรือบันทึกผลหลังจากนั้น'],
            ['นัดได้', 'มีวันนัดจากบันทึกผลติดต่อหรือผลโทรของเจ้าหน้าที่'],
            ['ได้ใบสมัคร', 'ชื่อขึ้นบอร์ด ERP แล้ว (จับคู่ด้วยเบอร์)'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-medium text-foreground">{k}</dt>
              <dd className={DASH.muted}>{v}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

const RecruitOverview: React.FC<{
  /**
   * 🔴 ยอด "ประกาศ" จากหัวกล่องงาน (เจ้าของ 1 ต.ค. 2569: *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*) — หน้าแม่ส่งมา
   * สถานะตอนนี้ ไม่ขึ้นกับเดือน · `null`/ไม่ส่ง = ยังบอกไม่ได้ ("—")
   */
  published?: BoardPublishedTotals | null;
}> = ({ published = null }) => {
  /** null = เดือนนี้ (ให้เส้นตัดสินจากวันไทยของ server) */
  const [month, setMonth] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [state, setState] = useState<Load>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRecruitOverview(month)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'โหลดไม่สำเร็จ' })));
    return () => {
      cancelled = true;
    };
  }, [month, rev]);

  const data = state.data;
  const win = data?.window ?? null;
  const apps = data?.apps ?? null;

  const view = useMemo(() => {
    if (!data || !win) return null;
    const list = apps ?? [];
    const cur = totalsOf(list, win.from, win.to);
    /**
     * 🔴 เทียบเดือนก่อน **เฉพาะตอนข้อมูลมีครบทั้งช่วงก่อน** (กับดักเดียวกับหน้าทีม Online: เคยขึ้น "เพิ่ม 1,400%"
     * เพราะข้อมูลเพิ่งเริ่มกลางช่วงก่อน) — ข้อมูลเริ่มกลางเดือนก่อน/ยังไม่มีเลย = ไม่เทียบ แล้วบอกเหตุบนหัว
     */
    const prevFull = !!data.firstDay && data.firstDay <= win.prevFrom;
    const prev = prevFull ? totalsOf(list, win.prevFrom, win.prevTo) : null;
    const cohort = cohortOf(list, win.from, win.to);
    return {
      cur,
      prev,
      /** ข้อมูลเริ่มกลางช่วงก่อน (ไม่ใช่ไม่มีเลย) */
      prevPartial: !prevFull && !!data.firstDay && data.firstDay <= win.prevTo,
      steps: funnelSteps(cur, { attendanceEverRecorded: data.attendanceEverRecorded }),
      delay: delayRows(cohort),
      daily: dailyRows(cohort, win.from, win.to),
      channels: channelRows(cohort),
      positions: positionRows(cohort),
      reasons: reasonGroups(cohort),
    };
  }, [data, win, apps]);

  if (!data || !win || !view) {
    if (state.error) return <SectionError message={state.error} />;
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const { cur, prev } = view;
  const current = data.today.slice(0, 7);
  const options = monthOptions(data.firstDay ? data.firstDay.slice(0, 7) : null, current);
  const canPrev = options.includes(shiftMonth(win.month, -1));
  const canNext = win.month < current;
  const appsError = data.errors.apps ?? null;

  const compareNote = [
    view.prev
      ? `เทียบกับ ${rangeText({ from: win.prevFrom, to: win.prevTo })}`
      : view.prevPartial && data.firstDay
        ? `ไม่เทียบเดือนก่อน ข้อมูลเพิ่งเริ่ม ${rangeText({ from: data.firstDay, to: data.firstDay })}`
        : 'เดือนก่อนยังไม่มีข้อมูล',
    `ข้อมูล ณ ${shortTime(data.generatedAt)} น.`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn('space-y-4', state.loading && 'opacity-70')}>
      {/* ─── หัว: ชื่อ + เลือกเดือน (แบบ iRecruit) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">ภาพรวมงานสรรหา</h2>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="iconXs"
            variant="outline"
            aria-label="เดือนก่อน"
            disabled={!canPrev}
            onClick={() => setMonth(shiftMonth(win.month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <ChoiceDropdown
            value={win.month}
            options={options.map((m) => ({ value: m, label: monthLabel(m) }))}
            onChange={(m) => setMonth(m)}
            ariaLabel="เลือกเดือน"
          />
          <Button
            type="button"
            size="iconXs"
            variant="outline"
            aria-label="เดือนถัดไป"
            disabled={!canNext}
            onClick={() => setMonth(shiftMonth(win.month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button type="button" size="iconXs" variant="outline" aria-label="โหลดใหม่" onClick={() => setRev((n) => n + 1)}>
            <RefreshCw className={cn(state.loading && 'animate-spin')} aria-hidden />
          </Button>
          <HowToRead />
        </div>
      </div>

      <div className={cn('flex flex-wrap items-center justify-between gap-2 text-xs', DASH.sub)}>
        <span>{data.bu ? `เฉพาะ BU ${data.bu}` : 'ทุก BU'}</span>
        <span className="tabular-nums">{compareNote}</span>
      </div>

      {state.error ? <SectionError message={state.error} /> : null}
      {appsError ? <SectionError message={appsError} /> : null}

      {/* ─── การ์ด 6 ใบ ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <OverviewKpi
          icon={Link2}
          label="ใบที่ประกาศ"
          value={published ? published.published : null}
          previous={null}
          foot={published ? `ตอนนี้ · มีคนสมัครแล้ว ${fmt(published.withApplicants)} ใบ` : null}
        />
        <OverviewKpi
          icon={UserPlus}
          label="รายชื่อเข้ามา"
          value={apps ? cur.names : null}
          previous={apps ? (prev?.names ?? null) : null}
          foot={apps ? `จาก ${fmt(cur.jobs)} ใบขอ` : null}
        />
        <OverviewKpi
          icon={PhoneOutgoing}
          label="โทรแล้ว"
          value={apps ? cur.called : null}
          previous={apps ? (prev?.called ?? null) : null}
          foot={apps ? `AI ${fmt(cur.calledByAi)} · คน ${fmt(cur.calledByStaff)}` : null}
        />
        <OverviewKpi
          icon={PhoneCall}
          label="ติดต่อสำเร็จ"
          value={apps ? cur.reached : null}
          previous={apps ? (prev?.reached ?? null) : null}
          foot={apps ? `AI ${fmt(cur.reachedByAi)} · คน ${fmt(cur.reachedByStaff)}` : null}
        />
        <OverviewKpi
          icon={ThumbsUp}
          label="ตอบ AI ว่าสนใจ"
          value={apps ? cur.aiSaidYes : null}
          previous={apps ? (prev?.aiSaidYes ?? null) : null}
          foot={apps ? `คนโทรต่อแล้ว ${fmt(cur.staffFollowed)}` : null}
        />
        <OverviewKpi
          icon={FileCheck}
          label="ได้ใบสมัคร"
          value={apps ? cur.onBoard : null}
          previous={apps && prev?.onBoard != null && cur.onBoard !== null ? prev.onBoard : null}
          foot={apps ? `นัดได้ ${fmt(cur.appointed)}` : null}
        />
      </div>

      {/* ─── เส้นทางของรายชื่อ + งานค้างตอนนี้ ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OverviewCard
          icon={Filter}
          title="เส้นทางของรายชื่อ"
          sub="รายชื่อที่เข้ามาเดือนนี้ ไปถึงขั้นไหนแล้ว"
          className="lg:col-span-2"
        >
          {/* 🔴 เดือนที่ยังไม่มีรายชื่อ = ขั้นครบเป็น 0 (เจ้าของสั่ง 1 ต.ค. 2569 — สลับเดือนแล้วการ์ดห้ามย่อ/ขยายเอง) */}
          {apps ? <FunnelList steps={view.steps} /> : <EmptyNote>ยังไม่มีรายชื่อในเดือนนี้</EmptyNote>}
          {data.errors.board ? <p className={cn('text-xs', TONE.warn.value)}>{data.errors.board}</p> : null}
        </OverviewCard>
        <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="สถานะวันนี้ ไม่ขึ้นกับเดือนที่เลือก">
          {data.backlog ? <BacklogBody backlog={data.backlog} /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
        </OverviewCard>
      </div>

      {/* ─── กรอกแล้วโทรวันไหน + รายวัน ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OverviewCard icon={Timer} title="กรอกแล้วโทรวันไหน" sub="นับครบ 24 ชม. เป็น 1 วัน">
          {apps ? <DelayList rows={view.delay} /> : <EmptyNote>ยังไม่มีรายชื่อในเดือนนี้</EmptyNote>}
        </OverviewCard>
        <div className="min-w-0 lg:col-span-2">
          <DailyCard rows={view.daily} icon={BarChart3} />
        </div>
      </div>

      {/* ─── ช่องทาง + ตำแหน่ง ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OverviewCard icon={Megaphone} title="ช่องทางการสมัคร" sub="รายชื่อเดือนนี้มาจากช่องทางไหน" className="lg:col-span-2">
          <ChannelTable rows={view.channels.rows} total={view.channels.total} />
        </OverviewCard>
        <OverviewCard icon={Briefcase} title="ตำแหน่งที่สมัคร" sub="10 อันดับแรกของเดือน">
          <PositionList rows={view.positions} />
        </OverviewCard>
      </div>

      {/* ─── เหตุผลที่ไม่สำเร็จ ─── */}
      <OverviewCard icon={AlertCircle} title="เหตุผลที่ไม่สำเร็จ" sub="ผลล่าสุดของรายชื่อเดือนนี้ แยกตามขั้น">
        <ReasonColumns groups={view.reasons} />
      </OverviewCard>

      {/* ─── ผลงานรายคน ─── */}
      <OverviewCard icon={Users} title="ผลงานรายคน" sub="งานที่ลงผลในเดือนนี้ · กดหัวคอลัมน์เพื่อเรียง">
        {data.staff ? <StaffTable staff={data.staff} ai={data.ai} /> : <SectionError message={data.errors.staff ?? 'อ่านผลงานรายคนไม่ได้'} />}
      </OverviewCard>
    </div>
  );
};

export default RecruitOverview;
