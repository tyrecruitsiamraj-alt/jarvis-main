/**
 * บอร์ด 4 ทีม — เมตริกครบตามสเปกเจ้าของ + **ทุกบรรทัดกดแล้วนำทางไปหน้านั้น**
 * (เจ้าของสั่ง 26 ส.ค. 2569: *"กล่องแต่ละทีมตอนแรกบอกรายละเอียดหมดเลย และฉันโอเค
 * กะแบบนั้น เลยให้ทำเป็นกดรายละเอียดอันไหนก็นำทางไปอันนั้นสิ"*)
 *
 * 🔴 ประวัติที่ห้ามซ้ำรอย:
 * - เคยยุบเหลือการ์ดเปล่า 4 ใบ → โดนด่า *"กล่องโง่ ๆ ที่ไม่รู้อะไรแล้วก็ต้องไปไล่กดหาเอง"*
 *   ⇒ **เมตริกต้องอยู่ครบ ห้ามยุบ**
 * - ของที่ตีตกถาวร: ฉาก isometric · รายชื่อคนนั่งโต๊ะ · แถบ "ขยับล่าสุด"
 * - หลัก 4 ข้อของเจ้าของ: ทีมทำอะไร · ติดตรงไหน (⚠ แดง) · **Error ไม่เงียบ**
 *   (ทีมวัดไม่ได้ → "วัดไม่ได้ — เหตุผล") · กดแล้วนำทางไปต่อได้
 *
 * ตัวเลข: ทีม Online/สรรหา/Lumos จาก `/api/office-team` · ทีมปิดใบขอจาก office-floor
 * ที่หน้าแรกโหลดอยู่แล้ว (`floor`) — `null` = ยังไม่รู้ ⇒ "—" ห้ามเป็น 0
 */
import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OfficeTeamResponse } from '@/lib/officeTeamApi';
import type { LaneCounts } from '@/lib/officeTeam';
import type { OfficeFloorCounts } from '@/lib/officeFloor';
import { HOME_TEAM_NAV, type HomeTeamNavKey } from '@/lib/soRecruitNav';
import { METRICS, metricHelp, type MetricKey, type MetricSpec } from '@/lib/metricDictionary';
import Term from '@/components/shared/Term';

/**
 * ป้าย/คำอธิบาย/ปลายทางหัวคอลัมน์มาจาก HOME_TEAM_NAV ที่เดียว (มีเทสต์คุม
 * "หนึ่งกล่องหนึ่งปลายทาง" + "path ต้องเป็นหน้าจริง") — ห้ามพิมพ์ซ้ำในไฟล์นี้
 */
const NAV = Object.fromEntries(HOME_TEAM_NAV.map((t) => [t.key, t])) as Record<
  HomeTeamNavKey,
  (typeof HOME_TEAM_NAV)[number]
>;

const eyebrow = 'font-mono text-[10px] font-semibold uppercase tracking-[0.22em]';

/** โทนกลาง — คู่ light/dark ทุกตัว (เฉด 300 เดี่ยวจมบนพื้นขาว) */
const T = {
  mut: 'text-slate-500 dark:text-slate-500',
  faint: 'text-slate-400 dark:text-slate-600',
  num: 'font-mono font-semibold tabular-nums text-slate-900 dark:text-white',
  line: 'border-slate-900/10 dark:border-white/10',
  danger: 'text-red-700 dark:text-red-300',
  warn: 'text-amber-700 dark:text-amber-300/90',
};

type TeamKey = 'online' | 'recruit' | 'closing' | 'lumos';

/**
 * 🔴 **หัวทีมสีเดียวกันหมด** (5 ก.ย. 2569 — เจ้าของสั่งใช้จานสีเดียวกับหน้า Login)
 * ของเดิมให้สีทีมละสี (ส้ม/เขียวน้ำทะเล/ม่วง/แดง) ⇒ หน้าแรกอ่านเป็นรุ้ง ทั้งที่
 * สีพวกนั้น**ไม่ได้แปลว่าอะไร** — คนละคอลัมน์ก็แยกทีมออกอยู่แล้ว
 * สีที่เหลือบนบอร์ดจึงเหลือเฉพาะสีที่มีความหมายจริง (ด่วน/เกินกำหนด)
 */
const ACCENT: Record<TeamKey, string> = {
  online: 'text-foreground',
  recruit: 'text-foreground',
  closing: 'text-foreground',
  lumos: 'text-foreground',
};

/** ⚠️ Intl ระดับโมดูล — กติกาโปรเจกต์ (เคยทำหน้าช้า 4.7 วิ) */
const TIME_FMT = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' });
const timeText = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : TIME_FMT.format(d);
};

/**
 * แถวเมตริกที่กดได้ — หัวใจของบอร์ดนี้
 * `to` = หน้า SPA · `onPress` = เปิด dialog (สายผลโทร) · ไม่ให้ทั้งคู่ = แถวอ่านอย่างเดียว
 */
const Row: React.FC<{
  /** คีย์ในพจนานุกรมเลข — ป้าย/หน่วย/ปลายทาง/คำอธิบาย มาจากที่นั่นทั้งหมด */
  metric: MetricKey;
  value: number | null;
  alert?: boolean;
  /** ทับปลายทางของพจนานุกรมเฉพาะกรณีเปิดป๊อป (พจนานุกรมบอกได้แค่ว่า "เปิดป๊อปอะไร") */
  onPress?: () => void;
}> = ({ metric, value, alert, onPress }) => {
  const spec: MetricSpec = METRICS[metric];
  const { label, unit } = spec;
  const to = onPress ? undefined : spec.href;
  const help = metricHelp(metric);
  const body = (
    <>
      <span className={cn('min-w-0 flex-1 truncate text-xs', alert && value ? T.danger : T.mut)}>
        {label}
      </span>
      <span className={cn('text-sm', T.num, alert && value ? T.danger : undefined)}>
        {value === null ? '—' : value.toLocaleString()}
      </span>
      <span className={cn('w-8 shrink-0 text-[10px]', T.faint)}>{value === null ? '' : unit}</span>
      {/*
       * 🔴 กดได้สองแบบต้องบอกผลต่างกัน (เจ้าของ: "แถวที่กดได้แต่ไม่บอกผล")
       * `to` = นำทางออกจากหน้านี้ (ลูกศรบอกอยู่แล้วว่าไปที่อื่น) ·
       * `onPress` = เปิด dialog ค้างอยู่ในหน้านี้เหมือนเดิม (ต้องมีคำกำกับ ไม่งั้นดู
       * เหมือนนำทางเหมือนกันหมด) — คำเดียวกับปุ่ม "ผลโทรวันนี้ ... เปิดดูรายชื่อ" ท้ายคอลัมน์
       * Lumos ข้างล่างที่ใช้คำนี้อยู่แล้ว
       */}
      {onPress ? (
        <span className={cn('shrink-0 whitespace-nowrap text-[10px]', T.faint)}>กดดูรายชื่อ</span>
      ) : null}
      {to ? (
        <ArrowRight
          className="h-3 w-3 shrink-0 text-slate-300 transition-colors group-hover/row:text-slate-600 dark:text-slate-700 dark:group-hover/row:text-slate-300"
          aria-hidden
        />
      ) : null}
    </>
  );
  const rowCls =
    'group/row -mx-2 flex items-baseline gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/5';
  if (to) {
    return (
      <li>
        <Link to={to} className={rowCls} title={help}>
          {body}
        </Link>
      </li>
    );
  }
  if (onPress) {
    return (
      <li>
        <button
          type="button"
          onClick={onPress}
          className={cn(rowCls, 'w-full text-left')}
          title={help}
        >
          {body}
        </button>
      </li>
    );
  }
  return (
    <li className="-mx-2 flex items-baseline gap-2 px-2 py-1" title={help}>
      {body}
    </li>
  );
};

const GroupTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className={cn(eyebrow, 'mt-3 list-none first:mt-0', T.faint)}>{children}</li>
);

/**
 * แถวมาตรฐานของเลนคิว Lumos — "ได้ผลแล้ว" เปิด dialog ผลโทร · "รอผล" เปิดรายชื่อรอ
 *
 * 🔴 **"ส่งเข้าทั้งหมด" = เฉพาะสายที่ยังไม่ถูกยกเลิก** และเท่ากับ รอโทร+รอผลกลับ+ได้ผลแล้ว
 * เป๊ะ ๆ เสมอ (บวกได้ = คนใหม่ตรวจเองได้) · สายที่ยกเลิกแยกไปแถวของตัวเอง ไม่ใช่หายไป
 * เดิมยัดรวมใน "ทั้งหมด" ⇒ เลนหน้าสาธารณะเคยขึ้น "ทั้งหมด 1" โดยที่ทุกช่องย่อยเป็น 0
 */
const LaneRows: React.FC<{
  name: string;
  lane: LaneCounts | null;
  onResults?: () => void;
  onWaiting?: () => void;
}> = ({ name, lane, onResults, onWaiting }) => (
  <>
    <GroupTitle>{name}</GroupTitle>
    <Row metric="lumos.total" value={lane ? lane.total : null} onPress={onResults} />
    <Row metric="lumos.pending" value={lane ? lane.pending : null} onPress={onWaiting} />
    <Row metric="lumos.waiting" value={lane ? lane.waiting : null} alert onPress={onWaiting} />
    <Row metric="lumos.done" value={lane ? lane.done : null} onPress={onResults} />
    {/* ยกเลิกแล้ว: โชว์เฉพาะตอนมีจริง — 0 ทุกวันคือบรรทัดขยะ แต่ถ้ามีแล้วซ่อน = เลขหาย */}
    {lane && lane.cancelled > 0 ? (
      <Row metric="lumos.cancelled" value={lane.cancelled} />
    ) : null}
  </>
);

/** คอลัมน์ทีม — หัวกดได้ (ไปหน้าหลักของทีม) + บรรทัดติดขัด + กลุ่มเมตริก */
const TeamColumn: React.FC<{
  team: TeamKey;
  label: string;
  blurb: string;
  to?: string;
  error?: string;
  stuck?: string | null;
  children: React.ReactNode;
}> = ({ team, label, blurb, to, error, stuck, children }) => {
  const head = (
    <span className="flex items-baseline gap-2">
      {/* ชื่อทีม Lumos เป็นศัพท์ในบ้าน — ติดคำอธิบายไว้ที่ตัวชื่อเลย */}
      <span className={cn('text-sm font-semibold', ACCENT[team])}>
        {team === 'lumos' ? <Term k="lumos">{label}</Term> : label}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[10px]', T.faint)}>{blurb}</span>
      {to ? <ArrowRight className={cn('h-3.5 w-3.5 shrink-0', ACCENT[team])} aria-hidden /> : null}
    </span>
  );
  return (
    <div className="flex min-w-0 flex-col px-5 py-4">
      {to ? (
        <Link to={to} className="hover:underline">
          {head}
        </Link>
      ) : (
        head
      )}
      {stuck ? <p className={cn('mt-0.5 text-[11px]', T.danger)}>⚠ {stuck}</p> : null}
      {error ? (
        /* Error ไม่เงียบ — ทีมวัดไม่ได้ต้องบอกตรง ๆ ห้ามโชว์ 0 ปลอม */
        <p className={cn('mt-2 text-xs', T.warn)}>วัดไม่ได้ — {error}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">{children}</ul>
      )}
    </div>
  );
};

const TeamBoardPanel: React.FC<{
  team: OfficeTeamResponse | null;
  loading?: boolean;
  onRefresh?: () => void;
  /**
   * **Success Rate 7 วันล่าสุด** (เจ้าของสั่ง 4 ก.ย. 2569: *"Success rate เพิ่มไว้
   * หน้าหลักตรง Lumos"*) — `null` = ยังโหลดไม่เสร็จ/ยังไม่มีใครรับสาย
   *
   * 🔴 **ใช้เลขชุดเดียวกับแดชบอร์ดเป๊ะ** (`compareCallRate(series, 7)`) — ถ้าคำนวณเอง
   * คนละสูตร สองหน้าจะโชว์ % ไม่ตรงกัน แล้วไม่มีใครเชื่อสักหน้า
   */
  successRate?: { pct: number | null; connected: number } | null;
  /** เลขจาก office-floor ที่หน้าแรกโหลดอยู่แล้ว (คิว AI · Follow · aftercare · ใบสมัครค้าง) */
  floor: OfficeFloorCounts | null;
  /** dialog เดิมของสายโทร (มีปุ่มจองตัว — ฟีเจอร์ 12 ส.ค. ห้ามหาย) */
  onOpenCallResults?: () => void;
  onOpenActiveCalls?: () => void;
  /**
   * 🔴 **สกินของเปลือก — ข้อมูลข้างในเหมือนกันทุกตัว** (5 ก.ย. 2569)
   * `deck` = ของเดิมที่ทุกคนใช้อยู่ (ค่าตั้งต้น ห้ามเปลี่ยน) ·
   * `plain` = โฉมใหม่หลังสวิตช์ `?ui=v2` — ผืนขาวเรียบ ไม่มีพื้นไล่เฉด/กริดจุด
   * เปลี่ยนแค่ 2 บรรทัด (คลาสเปลือก + สีป้ายหัว) จึงไม่มีทางทำข้อมูลตกหล่น
   */
  skin?: 'deck' | 'plain';
  className?: string;
}> = ({
  team,
  loading,
  onRefresh,
  floor,
  onOpenCallResults,
  onOpenActiveCalls,
  successRate,
  skin = 'deck',
  className,
}) => {
  const teams = team?.teams;
  return (
    /* 🔴 เปลือกเป็น Card ของ shadcn เหมือนแผงอื่นบนหน้าหลัก (4 ก.ย. 2569)
       สกินพื้นเข้มยังเป็นคลาสเดิมที่เจ้าของเคาะไว้ · ไม่เขียน CSS ใหม่ */
    <Card
      className={cn(
        'overflow-hidden rounded-2xl',
        skin === 'deck' && 'jarvis-deck',
        className,
      )}
      aria-label="บอร์ดทีม — ใครทำอะไรอยู่"
    >
      {/* มุมวงเล็บ HUD ถูกถอดออกพร้อมกับ deck หน้าแรก (5 ก.ย. 2569) */}

      <div className={cn('relative flex items-center gap-3 border-b px-6 py-3.5', T.line)}>
        {/* โฉมใหม่: ป้ายเป็นตัวหนังสือปกติสีเบอร์กันดี ไม่ใช่ป้าย mono ช่องไฟกว้างแบบ HUD */}
        <span
          className={cn(
            skin === 'plain'
              ? 'text-[12.5px] font-medium text-primary'
              : cn(eyebrow, 'text-rose-900 dark:text-rose-300'),
          )}
        >
          ทีมปฏิบัติการ · ใครทำอะไรอยู่
        </span>
        <span className="flex-1" />
        <span
          className={cn(
            'tabular-nums',
            skin === 'plain' ? 'text-[12px] text-muted-foreground' : cn('font-mono text-[11px]', T.mut),
          )}
        >
          {team
            ? `ใบเปิด ${team.open_total} · อัปเดต ${timeText(team.generated_at)}`
            : loading
              ? skin === 'plain'
                ? 'กำลังโหลดข้อมูล…'
                : 'กำลังเชื่อมข้อมูล…'
              : 'โหลดไม่สำเร็จ'}
        </span>
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className={cn('h-8 rounded-lg px-2.5', T.mut, 'hover:bg-slate-900/5 dark:hover:bg-white/10')}
          >
            <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
            รีเฟรช
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'grid sm:grid-cols-2 xl:grid-cols-4',
          'max-sm:[&>*:not(:last-child)]:border-b sm:max-xl:[&>*:nth-child(-n+2)]:border-b sm:max-xl:[&>*:nth-child(odd)]:border-r xl:[&>*:not(:last-child)]:border-r',
          '[&>*]:border-slate-900/10 dark:[&>*]:border-white/10',
        )}
      >
        {/* ── ทีม Online — ทุกแถวชี้หน้าที่จัดการเรื่องนั้นตรง ๆ ── */}
        <TeamColumn
          team="online"
          label={NAV.online.label}
          blurb={NAV.online.blurb}
          to={NAV.online.path ?? undefined}
          error={teams?.errors.online}
          stuck={
            teams?.online && teams.online.unreleased > 0
              ? `ยังไม่ประกาศ ${teams.online.unreleased} ใบ`
              : null
          }
        >
          <Row metric="online.open_total" value={teams?.online?.open_total ?? null} />
          <Row metric="online.released" value={teams?.online?.released ?? null} />
          <Row metric="online.unreleased" value={teams?.online?.unreleased ?? null} alert />
          <GroupTitle>
            ส่งไปดูดประกาศ (<Term k="scraping" />)
          </GroupTitle>
          <Row metric="online.scraping.pending" value={teams?.online?.scraping.pending ?? null} />
          <Row metric="online.scraping.in_progress" value={teams?.online?.scraping.in_progress ?? null} />
          <Row metric="online.scraping.posted" value={teams?.online?.scraping.posted ?? null} />
          <GroupTitle>
            ส่งไปทำสื่อประกาศ (<Term k="content" />)
          </GroupTitle>
          <Row metric="online.content.pending" value={teams?.online?.content.pending ?? null} />
          <Row metric="online.content.in_progress" value={teams?.online?.content.in_progress ?? null} />
          <Row metric="online.content.posted" value={teams?.online?.content.posted ?? null} />
        </TeamColumn>

        {/* ── ทีมสรรหา ── */}
        <TeamColumn
          team="recruit"
          label={NAV.recruit.label}
          blurb={NAV.recruit.blurb}
          to={NAV.recruit.path ?? undefined}
          error={teams?.errors.recruit}
          stuck={
            floor && floor.intake.untouched > 0
              ? `ผู้สมัครค้างไม่มีใครแตะ ${floor.intake.untouched} คน`
              : null
          }
        >
          <Row metric="recruit.jobs_with_apps" value={teams?.recruit?.jobs_with_apps ?? null} />
          <Row
            metric="recruit.jobs_without_apps"
            value={teams?.recruit?.jobs_without_apps ?? null}
            alert
          />
          <GroupTitle>
            ผู้สมัครทั้งหมด {teams?.recruit ? teams.recruit.apps_total.toLocaleString() : '—'} คน
          </GroupTitle>
          <Row metric="recruit.apps_contacted" value={teams?.recruit?.apps_contacted ?? null} />
          <Row
            metric="recruit.apps_uncontacted"
            value={teams?.recruit?.apps_uncontacted ?? null}
            alert
          />
          <Row metric="recruit.untouched" value={floor ? floor.intake.untouched : null} alert />
          {/*
           * 🔴 เชิงอรรถกันบวกผิด (เจ้าของแจ้ง: คนใหม่เอา "ผู้สมัครทั้งหมด" +
           * "ยังไม่มีใครติดต่อ" + "ค้างเกิน 1 วันไม่มีใครแตะ" มาบวกกันแล้วงง)
           *
           * พิสูจน์จากนิยามจริง — ทั้งสามเลขมาจากประชากรเดียวกัน (ตาราง
           * `public_job_applications` ไม่กรอง scope) แบ่งเป็นถังซ้อนกัน ไม่ใช่ถังแยก:
           * - `apps_contacted` + `apps_uncontacted` = `apps_total` เป๊ะ (office-team.ts:159-161
           *   `apps_uncontacted = total - contactedN`) ⇒ 4 + 11 = 15 (บวกกันได้แค่คู่นี้)
           * - `recruit.untouched` (= `floor.intake.untouched`) ใช้นิยาม
           *   `OVERVIEW_BUCKETS.untouched` (applicantOverviewSql.ts) = "not called and not
           *   in_queue and not held_or_claimed" ซึ่งเป็นเงื่อนไขที่แคบกว่า "not called"
           *   (= `apps_uncontacted`) เสมอ ⇒ **ค้างเกิน 1 วันไม่มีใครแตะ นับซ้อนอยู่ใน
           *   ยังไม่มีใครติดต่อแล้ว** ไม่ใช่กองที่สี่ที่แยกออกมาบวกเพิ่มได้
           * ยืนยันด้วยข้อมูลจริงบนเครื่องนี้ 6 ก.ย. 2569: total 15 / contacted 4 /
           * uncontacted 11 / untouched 10 (10 จาก 11 คนที่ยังไม่ถูกโทร ซ้อนอยู่ในนี้พอดี)
           */}
          <li className="-mx-2 px-2 pt-0.5">
            <p className={cn('text-[10px] leading-relaxed', T.faint)}>
              "ค้างเกิน 1 วันไม่มีใครแตะ" นับซ้อนอยู่ใน "ยังไม่มีใครติดต่อ" ข้างบนแล้ว
              (ไม่ใช่กลุ่มเพิ่ม) — บวกได้แค่ ติดต่อแล้ว + ยังไม่มีใครติดต่อ = ผู้สมัครทั้งหมด
            </p>
          </li>
          <GroupTitle>นัดสัมภาษณ์</GroupTitle>
          <Row metric="recruit.appts_made" value={teams?.recruit?.appts_made ?? null} />
          <Row metric="recruit.showed" value={teams?.recruit?.attendance.showed ?? null} />
          <Row metric="recruit.no_show" value={teams?.recruit?.attendance.no_show ?? null} alert />
          <Row metric="recruit.rescheduled" value={teams?.recruit?.attendance.rescheduled ?? null} />
        </TeamColumn>

        {/* ── ทีมปิดใบขอ — เลขคิว/Follow/ดูแล มาจาก office-floor (โหลดอยู่แล้ว) ── */}
        <TeamColumn
          team="closing"
          label={NAV.closing.label}
          blurb={NAV.closing.blurb}
          to={NAV.closing.path ?? undefined}
          stuck={
            floor && floor.follow.pastDue > 0
              ? `เลยนัดโทรติดตาม ${floor.follow.pastDue} ราย`
              : floor && floor.aiCalls.staleOverDay > 0
                ? `สายเงียบเกิน 1 วัน ${floor.aiCalls.staleOverDay} สาย`
                : null
          }
        >
          <Row metric="closing.queue_pending" value={floor ? floor.aiCalls.pending : null} />
          <Row
            metric="closing.queue_waiting"
            value={floor ? floor.aiCalls.waitingResult : null}
            onPress={onOpenActiveCalls}
          />
          <Row
            metric="closing.queue_stale"
            value={floor ? floor.aiCalls.staleOverDay : null}
            alert
            onPress={onOpenActiveCalls}
          />
          <GroupTitle>
            โทรติดตามคนที่รับปากแล้ว (<Term k="follow">Follow</Term>)
          </GroupTitle>
          <Row metric="closing.follow_today" value={floor ? floor.follow.today : null} />
          <Row metric="closing.follow_past_due" value={floor ? floor.follow.pastDue : null} alert />
          <Row metric="closing.follow_upcoming" value={floor ? floor.follow.upcoming : null} />
          <GroupTitle>
            <Term k="aftercare">หลังเริ่มงาน</Term>
          </GroupTitle>
          <Row
            metric="closing.aftercare"
            value={floor?.aftercare ? floor.aftercare.count : null}
          />
        </TeamColumn>

        {/* ── ทีม Lumos — แยก 3 เส้นทางเข้า · แถวผลกดแล้วเปิด dialog เดิม ── */}
        <TeamColumn
          team="lumos"
          label={NAV.lumos.label}
          blurb={NAV.lumos.blurb}
          error={teams?.errors.lumos}
        >
          <LaneRows
            name="จากหน้าสาธารณะ"
            lane={teams?.lumos?.public ?? null}
            onResults={onOpenCallResults}
            onWaiting={onOpenActiveCalls}
          />
          <LaneRows
            name="จากหน้า Match"
            lane={teams?.lumos?.match ?? null}
            onResults={onOpenCallResults}
            onWaiting={onOpenActiveCalls}
          />
          <LaneRows
            name="จากหน้า Follow"
            lane={teams?.lumos?.follow ?? null}
            onResults={onOpenCallResults}
            onWaiting={onOpenActiveCalls}
          />
          {/* 🔴 Success Rate — ฐานคือ "คนที่รับสาย" ไม่ใช่สายทั้งหมด (เจ้าของสั่ง 4 ก.ย. 2569)
              ต้องเขียนฐานกำกับ ไม่งั้นอ่านสลับกับ % สำเร็จบนแดชบอร์ดที่ฐานกว้างกว่า
              ⚠️ ไม่มีใครรับสาย = ขีด ห้ามโชว์ 0% */}
          <li className="mt-3 list-none">
            <span className={cn(eyebrow, T.faint)}>Success Rate · 7 วันล่าสุด</span>
            <span className="mt-0.5 flex items-baseline gap-1.5">
              <span className={cn('text-lg font-bold tabular-nums', ACCENT.lumos)}>
                {successRate?.pct == null ? '—' : `${successRate.pct}%`}
              </span>
              <span className={cn('text-[11px]', T.mut)}>
                {successRate?.pct == null
                  ? 'ยังไม่มีใครรับสาย'
                  : `จากคนที่รับสาย ${successRate.connected.toLocaleString('th-TH')} สาย`}
              </span>
            </span>
          </li>
          <li className="mt-2 list-none">
            <button
              type="button"
              onClick={onOpenCallResults}
              className={cn('text-xs hover:underline', ACCENT.lumos)}
            >
              ผลโทรวันนี้ {floor ? floor.aiCalls.resultToday : '—'} สาย — เปิดดูรายชื่อ →
            </button>
          </li>
        </TeamColumn>
      </div>
    </Card>
  );
};

export default TeamBoardPanel;
