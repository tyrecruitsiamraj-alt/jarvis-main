/**
 * ═══ หัวกล่องงาน — "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่" ═══
 *
 * เจ้าของสั่งรื้อ 27 ส.ค. 2569:
 * > *"ฉันอยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอเท่านี้นะ เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ
 * >  เหลืออีกเท่านี้นะ แล้วพอจะปล่อยก็ไปกดดู แล้วก็ตามขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"*
 *
 * 🔴 **5 ต.ค. 2569 — แบบ C** (เจ้าของเคาะ "การ์ดเดิมแต่กระชับ" ทุกแท็บ): การ์ดตัวเลข 3 ใบ → แถวชิปกรองแถวเดียว
 *   (เลนครบเหมือนเดิม กดกรองได้ทุกอัน) · ประวัติด้านล่างคือหน้าตาก่อนหน้า
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
import { Button } from '@/components/ui/button';
import { DASH, TONE } from '@/lib/designTokens';
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

/** ลำดับเลนหลัก 3 อัน — ใช้ตอนโชว์ขีด/โครงเปล่า */
const LANE_ORDER = ['all', 'released', 'unreleased'] as const;

/**
 * ชิปเลน — แบบ C "การ์ดเดิมแต่กระชับ" (เจ้าของเคาะ 5 ต.ค. 2569 · ทุกแท็บของหน้างานสรรหา)
 * การ์ดตัวเลขใหญ่ 3 ใบ + บรรทัดท้าย ยุบเป็นแถวชิปเดียว · 🔴 ทุกเลนยังกดกรองได้ครบเหมือนเดิม
 * เลนหลัก (ทั้งหมด/ประกาศ/ยังไม่ประกาศ) = ชิปทึบเมื่อเลือก · เลนย่อย = ชิปเบาต่อท้าย
 */
function LaneChip({
  laneKey,
  count,
  active,
  onClick,
  sub = false,
}: {
  laneKey: ReleaseLaneKey;
  count: number;
  active: boolean;
  onClick: () => void;
  sub?: boolean;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? 'default' : sub ? 'ghost' : 'outline'}
      onClick={onClick}
      aria-pressed={active}
      title={RELEASE_LANE_TEXT[laneKey].hint}
      className={cn('shrink-0', sub && !active && 'text-muted-foreground')}
    >
      {RELEASE_LANE_TEXT[laneKey].label}
      <span className="tabular-nums">{th(count)}</span>
    </Button>
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
            <Button type="button" size="xs" variant="outline" onClick={onRetry}>
              กดลองใหม่
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LANE_ORDER.map((laneKey) =>
            broken ? (
              <Button key={laneKey} type="button" size="xs" variant="outline" disabled>
                {RELEASE_LANE_TEXT[laneKey].label}
                <span className={DASH.muted}>{UNKNOWN_NUMBER}</span>
              </Button>
            ) : (
              <div key={laneKey} className="h-7 w-28 animate-pulse rounded-full bg-muted/70" />
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

      {/* 🔴 เลขชุดนี้ **ตรงกับหน้าหลัก** · ประกาศ + ยังไม่ประกาศ = ทั้งหมดเป๊ะ (เจ้าของเคาะชื่อเอง 28 ส.ค. 2569)
          แบบ C (5 ต.ค. 2569): แถวชิปแถวเดียว เลื่อนข้างได้บนมือถือ · เลนย่อยต่อท้ายเลนแม่ของมัน */}
      <div className="flex flex-wrap items-center gap-1.5">
        <LaneChip laneKey="all" count={ledger.all} active={lane === null || lane === 'all'} onClick={() => onLaneChange(null)} />
        <LaneChip laneKey="released" count={ledger.released} active={lane === 'released'} onClick={() => toggle('released')} />
        <LaneChip laneKey="unreleased" count={ledger.unreleased} active={lane === 'unreleased'} onClick={() => toggle('unreleased')} />
        <span className={cn('mx-1 hidden h-5 border-l sm:block', DASH.divider)} aria-hidden />
        <LaneChip sub laneKey="applied" count={ledger.releasedWithApplicants} active={lane === 'applied'} onClick={() => toggle('applied')} />
        <LaneChip sub laneKey="silent" count={ledger.releasedSilent} active={lane === 'silent'} onClick={() => toggle('silent')} />
        {/* 🔴 ก้อนย่อยของ "ยังไม่ปล่อย" (เจ้าของเคาะ 21 ก.ย. 2569) — ไม่ใช่ก้อนที่สี่ที่เคยถูกสั่งยุบ */}
        <LaneChip sub laneKey="sourcing" count={ledger.releasable} active={lane === 'sourcing'} onClick={() => toggle('sourcing')} />
        <LaneChip sub laneKey="started" count={ledger.startedAlready} active={lane === 'started'} onClick={() => toggle('started')} />
      </div>
    </div>
  );
};

export default BoardReleaseHeader;
