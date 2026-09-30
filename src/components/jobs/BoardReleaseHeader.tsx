/**
 * ═══ หัวกล่องงาน — "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่" ═══
 *
 * เจ้าของสั่งรื้อ 27 ส.ค. 2569:
 * > *"ฉันอยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอเท่านี้นะ เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ
 * >  เหลืออีกเท่านี้นะ แล้วพอจะปล่อยก็ไปกดดู แล้วก็ตามขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"*
 *
 * 🔴 **รื้อหน้าตารอบ 27 ก.ย. 2569 — แบบ A** (เจ้าของ: *"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"*)
 * - ตัวเลข 3 ก้อน = **การ์ดตัวเลขทรงเดียวกับหน้าติดตาม** (ป้าย · ตราไอคอนมุมขวา · เลขใหญ่ · บรรทัดท้ายคั่นเส้น)
 * - ก้อนย่อยของ "ยังไม่ปล่อย" / "ปล่อยแล้ว" ย้ายเข้าบรรทัดท้ายของการ์ดใบนั้น (เดิมเป็นกล่องแยกอีก 2 ก้อน)
 * - % ปล่อยประกาศย้ายขึ้นคำอธิบายใต้ชื่อหน้า (PageHeader) · แถบ % ถูกถอด
 * - 🔴 แถว "ติดขั้น 1–4" **ถอดแล้ว 30 ก.ย. 2569** (เจ้าของ: *"ติดขั้น เอาไปไว้ในแต่ละกล่อง แล้วไปทำ Filter"*) —
 *   การ์ดใบขอแต่ละใบบอก "ติดขั้น N" เอง · จำนวนต่อขั้นอยู่หัวข้อ "ติดขั้น" ในปุ่มตัวกรอง (`boardFilters`)
 * - ⛔ ห้ามเติมประโยคอธิบาย ("ต้องทำ:", "บวกกันได้ … ใบพอดี" ฯลฯ) กลับมาโดยไม่ได้สั่ง
 *
 * 🔴 **ทุกเลขกดได้และกดแล้วการ์ดข้างล่างตรงกับเลขนั้นเป๊ะ** ตรรกะการนับอยู่
 * `src/lib/boardRelease.ts` (มีเทสต์คุมว่าบวกกันลงตัว) ไฟล์นี้แค่วาด · ป้ายทุกคำมาจาก `RELEASE_LANE_TEXT`
 */
import * as React from 'react';
import { ClipboardList, Hourglass, Megaphone } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { RELEASE_LANE_TEXT, type ReleaseLaneKey, type ReleaseLedger } from '@/lib/boardRelease';
import { cn } from '@/lib/utils';
import { ledgerStateText, UNKNOWN_NUMBER, type LedgerState } from '@/lib/boardDataState';

export type BoardReleaseHeaderProps = {
  /**
   * 🔴 สภาพของตัวเลข — **โชว์เลขได้เฉพาะตอน `ready`**
   * (เจอตอนให้โมเดลมาลองเล่น: กดแล้วเลขกลายเป็น 0 ทั้งแถว เพราะหน้าถูกสร้างใหม่
   * แล้วยังโหลดไม่เสร็จ · เลขปลอมที่ "ดูเหมือนจริง" อันตรายกว่า 0 ด้วย)
   *
   * 31 ส.ค. 2569: เปลี่ยนจาก `ready: boolean` เป็นสภาพเต็ม เพราะ "กำลังโหลด" กับ "พัง"
   * กับ "ไม่มีสิทธิ์" ต้องบอกคนละอย่าง — เดิมทั้งสามอันหน้าตาเหมือนกันหมด
   */
  state: LedgerState;
  /** กดลองอ่านใหม่ — โชว์เฉพาะตอนพังแบบที่ลองใหม่แล้วมีโอกาสสำเร็จ */
  onRetry?: () => void;
  /** ป้ายบอกอายุข้อมูล (จาก `dataAgeLabel`) — `null` = สดพอจนไม่ต้องบอก */
  ageLabel?: string | null;
  ledger: ReleaseLedger;
  /** เลนที่เลือก — `null` = ดูทุกใบเปิด */
  lane: ReleaseLaneKey | null;
  onLaneChange: (lane: ReleaseLaneKey | null) => void;
  className?: string;
};

const th = (n: number) => n.toLocaleString('th-TH');

/** ลำดับการ์ด 3 ใบ — ใช้ทั้งตอนมีเลขจริงและตอนโชว์ขีด/โครงเปล่า */
const LANE_ORDER = ['all', 'released', 'unreleased'] as const;

/** ลิงก์เลขย่อยในบรรทัดท้ายการ์ด (ก้อนย่อยเดิม) — กดแล้วกรองการ์ดข้างล่างเหมือนเดิม */
function FootLink({
  laneKey,
  count,
  active,
  onClick,
  pill = false,
}: {
  laneKey: ReleaseLaneKey;
  count: number;
  active: boolean;
  onClick: () => void;
  /** มือถือ: เป็นเม็ดในแถวใต้การ์ด (ในการ์ดแคบเกินจะอ่านออก) */
  pill?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={RELEASE_LANE_TEXT[laneKey].hint}
      className={cn(
        'text-xs transition-colors hover:bg-secondary hover:text-foreground',
        pill ? 'shrink-0 whitespace-nowrap rounded-full border px-3 py-1' : 'rounded-md px-1 py-0.5 sm:text-sm',
        active
          ? cn('bg-primary/10 font-medium text-primary', pill && 'border-primary')
          : cn('text-muted-foreground', pill && TONE.neutral.outline),
      )}
    >
      {RELEASE_LANE_TEXT[laneKey].label} <span className="tabular-nums">{th(count)}</span>
    </button>
  );
}

/**
 * การ์ดตัวเลข — ทรงเดียวกับการ์ดบนหน้าติดตาม (`FollowPlanningCalendar` · StatCard)
 * ⚠️ บรรทัดท้ายมีปุ่มของตัวเอง ⇒ ตัวการ์ดเป็น div ส่วนที่กดเลือกเลนเป็นปุ่มแยก (ห้ามปุ่มซ้อนปุ่ม)
 */
function KpiCard({
  laneKey,
  count,
  tone,
  icon,
  active,
  onClick,
  foot,
}: {
  laneKey: ReleaseLaneKey;
  count: number;
  tone: ToneKey;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  foot: React.ReactNode;
}) {
  const t = RELEASE_LANE_TEXT[laneKey];
  return (
    <Card
      className={cn(
        'flex flex-col justify-between rounded-2xl p-3 shadow-sm transition-colors sm:p-4',
        active ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/30',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={t.hint}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium text-muted-foreground sm:text-sm">{t.label}</span>
          <span className={cn('mt-2 block text-2xl font-medium leading-none tabular-nums sm:text-4xl', TONE[tone].value)}>
            {th(count)}
          </span>
        </span>
        <span
          className={cn('hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex', TONE[tone].soft, TONE[tone].value)}
          aria-hidden
        >
          {icon}
        </span>
      </button>
      <div className="mt-3 hidden flex-wrap items-center gap-x-1 gap-y-1 border-t border-border/70 pt-2 text-sm text-muted-foreground sm:flex">
        {foot}
      </div>
    </Card>
  );
}

const BoardReleaseHeader: React.FC<BoardReleaseHeaderProps> = ({
  state,
  onRetry,
  ageLabel,
  ledger,
  lane,
  onLaneChange,
  className,
}) => {
  /**
   * ยังบอกเลขไม่ได้ — 🔴 **ห้ามโชว์ 0** ให้โชว์ขีดกับบอกตรง ๆ ว่าทำไม
   * กำลังโหลด = โครงเปล่ากะพริบ · พัง = ขีด + ปุ่มลองใหม่ · ไม่มีสิทธิ์ = ขีด + บอกว่าต้องขอสิทธิ์
   */
  const stateText = ledgerStateText(state);
  if (stateText) {
    const broken = state.status === 'broken';
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn('text-xs font-medium', broken ? TONE.warn.value : DASH.muted)}>
            {stateText.title} · {stateText.hint}
          </p>
          {stateText.canRetry && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors', TONE.warn.outline)}
            >
              กดลองใหม่
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {LANE_ORDER.map((laneKey) =>
            broken ? (
              <Card key={laneKey} className="rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">{RELEASE_LANE_TEXT[laneKey].label}</p>
                <p className={cn('mt-2 text-4xl font-medium leading-none', DASH.muted)}>{UNKNOWN_NUMBER}</p>
              </Card>
            ) : (
              <div key={laneKey} className="h-28 animate-pulse rounded-2xl bg-muted/70" />
            ),
          )}
        </div>
      </div>
    );
  }

  const toggle = (key: ReleaseLaneKey) => onLaneChange(lane === key ? null : key);

  return (
    <div className={cn('space-y-3', className)}>
      {/* อายุข้อมูล — โชว์เฉพาะตอนเก่าพอจะทำให้ตัดสินใจผิด หรือกำลังดูสำเนาเพราะต่อไม่ติด */}
      {ageLabel ? <p className={cn('text-xs', DASH.muted)}>{ageLabel}</p> : null}

      {/* 🔴 เลขชุดนี้ **ตรงกับหน้าหลัก** · สองใบหลังบวกกันได้ใบแรกเป๊ะ (เจ้าของเคาะชื่อเอง 28 ส.ค. 2569)
          มือถือยังอยู่แถวเดียว 3 ใบ (ย่อเลข · ซ่อนตราไอคอน) — เรียงลงทีละใบกินจอเกือบครึ่ง */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <KpiCard
          laneKey="all"
          count={ledger.all}
          tone="neutral"
          icon={<ClipboardList className="h-5 w-5" />}
          active={lane === null || lane === 'all'}
          onClick={() => onLaneChange(null)}
          foot={<span className="px-1 py-0.5">ใบขอที่เปิดอยู่</span>}
        />
        <KpiCard
          laneKey="released"
          count={ledger.released}
          tone="success"
          icon={<Megaphone className="h-5 w-5" />}
          active={lane === 'released'}
          onClick={() => toggle('released')}
          foot={
            <>
              <FootLink
                laneKey="applied"
                count={ledger.releasedWithApplicants}
                active={lane === 'applied'}
                onClick={() => toggle('applied')}
              />
              <span aria-hidden>·</span>
              <FootLink laneKey="silent" count={ledger.releasedSilent} active={lane === 'silent'} onClick={() => toggle('silent')} />
            </>
          }
        />
        <KpiCard
          laneKey="unreleased"
          count={ledger.unreleased}
          tone="warn"
          icon={<Hourglass className="h-5 w-5" />}
          active={lane === 'unreleased'}
          onClick={() => toggle('unreleased')}
          foot={
            <>
              {/* 🔴 ก้อนย่อยของ "ยังไม่ปล่อย" (เจ้าของเคาะ 21 ก.ย. 2569) — ไม่ใช่ก้อนที่สี่ที่เคยถูกสั่งยุบ */}
              <FootLink laneKey="sourcing" count={ledger.releasable} active={lane === 'sourcing'} onClick={() => toggle('sourcing')} />
              <span aria-hidden>·</span>
              <FootLink laneKey="started" count={ledger.startedAlready} active={lane === 'started'} onClick={() => toggle('started')} />
            </>
          }
        />
      </div>

      {/* มือถือ: เลขย่อยของ "ปล่อยแล้ว/ยังไม่ปล่อย" เป็นแถวเม็ดใต้การ์ด (ในการ์ดกว้าง ~100px คำตกบรรทัดกลางคำ)
          เลื่อนซ้าย-ขวาได้ แถวเดียว · จอ sm ขึ้นไปอยู่บรรทัดท้ายในการ์ดตามเดิม */}
      <div className="flex gap-2 overflow-x-auto sm:hidden">
        <FootLink pill laneKey="sourcing" count={ledger.releasable} active={lane === 'sourcing'} onClick={() => toggle('sourcing')} />
        <FootLink pill laneKey="started" count={ledger.startedAlready} active={lane === 'started'} onClick={() => toggle('started')} />
        <FootLink pill laneKey="applied" count={ledger.releasedWithApplicants} active={lane === 'applied'} onClick={() => toggle('applied')} />
        <FootLink pill laneKey="silent" count={ledger.releasedSilent} active={lane === 'silent'} onClick={() => toggle('silent')} />
      </div>
    </div>
  );
};

export default BoardReleaseHeader;
