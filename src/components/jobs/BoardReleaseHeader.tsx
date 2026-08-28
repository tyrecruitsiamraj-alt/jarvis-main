/**
 * ═══ หัวหน้ากล่องงาน — "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่" ═══
 *
 * เจ้าของสั่งรื้อ 27 ส.ค. 2569:
 * > *"หน้ากล่องงาน รื้อได้นะ · ฉันอยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอเท่านี้นะ
 * >  เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ เหลืออีกเท่านี้นะ แล้วพอจะปล่อยก็ไปกดดู
 * >  แล้วก็ตามขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"*
 * > เคาะเพิ่ม: *"ขอแค่เปิดมารู้ว่า อ้อทำไปแล้วนะ แล้วก็กดดูได้ว่าที่ทำไปเป็นไงบ้าง
 * >  ยังไม่ทำเท่าไหร่"*
 *
 * 🔴 **โชว์ทีละสองแถวเท่านั้น** — แถวบนคือเลนสามก้อน แถวล่างเปลี่ยนตามเลนที่เลือก
 * (ของเดิมมีแถบกรองซ้อนกัน 4 ชุดจนเจ้าของบอกว่า "เยอะแยะเละเทะไปหมด" — ห้ามกลับไปเป็นแบบนั้น)
 *
 * 🔴 **ทุกเลขกดได้และกดแล้วการ์ดข้างล่างตรงกับเลขนั้นเป๊ะ** ตรรกะการนับอยู่
 * `src/lib/boardRelease.ts` (มีเทสต์คุมว่าบวกกันลงตัว) ไฟล์นี้แค่วาด
 */
import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { DASH, TONE } from '@/lib/designTokens';
import Term from '@/components/shared/Term';
import {
  RELEASE_LANE_TEXT,
  type ReleaseLaneKey,
  type ReleaseLedger,
  type ReleaseStepKey,
} from '@/lib/boardRelease';
import { cn } from '@/lib/utils';

export type BoardReleaseHeaderProps = {
  /**
   * 🔴 `false` = ข้อมูลยังมาไม่ครบ **ห้ามโชว์เลข** โชว์ว่ากำลังอ่านแทน
   * (เจอตอนให้โมเดลมาลองเล่น: กดแล้วเลขกลายเป็น 0 ทั้งแถว เพราะหน้าถูกสร้างใหม่
   * แล้วยังโหลดไม่เสร็จ · เลขปลอมที่ "ดูเหมือนจริง" อันตรายกว่า 0 ด้วย)
   */
  ready: boolean;
  ledger: ReleaseLedger;
  /** เลนที่เลือก — `null` = ดูทุกใบเปิด */
  lane: ReleaseLaneKey | null;
  onLaneChange: (lane: ReleaseLaneKey | null) => void;
  /** ขั้นที่เลือก (ใช้ได้เฉพาะเลน "เหลือปล่อย") */
  step: ReleaseStepKey | null;
  onStepChange: (step: ReleaseStepKey | null) => void;
  /** ใบที่จบไปแล้ว (คนละ feed) */
  doneCounts: { closed: number; cancelled: number };
  doneLane: 'closed' | 'cancelled' | null;
  onDoneLaneChange: (lane: 'closed' | 'cancelled' | null) => void;
  /** ปุ่มลงมือของเลน "เหลือปล่อย" เช่น "ปล่อยทั้งหน้านี้" */
  action?: React.ReactNode;
  className?: string;
};

const th = (n: number) => n.toLocaleString('th-TH');

/** ก้อนตัวเลขใหญ่บนแถวบน */
function LaneTile({
  laneKey,
  count,
  active,
  tone,
  onClick,
}: {
  laneKey: ReleaseLaneKey;
  count: number;
  active: boolean;
  tone: 'warn' | 'success' | 'neutral';
  onClick: () => void;
}) {
  const t = RELEASE_LANE_TEXT[laneKey];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={t.hint}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
        active
          ? 'border-primary bg-primary/10'
          : cn('border-transparent', TONE[tone].soft, TONE[tone].softHover),
      )}
    >
      <span className={cn('whitespace-nowrap text-[11px] font-medium', TONE[tone].value)}>
        {t.label}
      </span>
      <span className={cn('font-mono text-2xl font-bold leading-none tabular-nums', TONE[tone].num)}>
        {th(count)}
      </span>
    </button>
  );
}

/**
 * ชิปเล็กบนแถวล่าง
 *
 * 🔴 `step` ทำให้ชิป **อ่านออกว่าเป็นขั้นตอน ไม่ใช่ป้ายสถานะ** (แก้ 27 ส.ค. 2569)
 * ทดสอบกับโมเดลอ่อนสุดสวมบทพนักงานใหม่: ของเดิม `"1. ยังไม่มีใครตรวจ 100"`
 * มันอ่านเป็น "ข้อมูลสถานะ" ⇒ เปลี่ยนเป็นเลขในวงกลม + คำกริยา + จำนวน "N ใบรอ"
 */
function Chip({
  step,
  label,
  state,
  count,
  unit = 'ใบ',
  sub,
  hint,
  active,
  tone,
  onClick,
}: {
  step?: number;
  label: string;
  state?: string;
  count: number;
  unit?: string;
  sub?: string | null;
  hint?: string;
  active: boolean;
  tone: 'warn' | 'success' | 'neutral' | 'info';
  onClick: () => void;
}) {
  /** มีงานให้ทำแต่เป็น 0 ใบ = ไม่ต้องเตือน */
  const quiet = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : cn(
              'border-transparent',
              quiet
                ? 'bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                : cn(TONE[tone].soft, TONE[tone].softHover),
            ),
      )}
    >
      {step ? (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold',
            quiet ? cn('bg-slate-200/80 dark:bg-slate-700', DASH.cellMuted) : TONE[tone].solid,
          )}
          aria-hidden
        >
          {step}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn('whitespace-nowrap font-semibold', quiet ? DASH.cellMuted : TONE[tone].value)}
          >
            {label}
          </span>
          <span
            className={cn(
              'whitespace-nowrap font-mono text-sm font-bold tabular-nums',
              quiet ? DASH.cellMuted : TONE[tone].num,
            )}
          >
            {th(count)}
          </span>
          <span className={cn('whitespace-nowrap text-[10px]', DASH.cellMuted)}>
            {unit}{count > 0 && step ? 'รอ' : ''}
          </span>
          {sub ? (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">({sub})</span>
          ) : null}
        </span>
        {state ? (
          <span className={cn('mt-0.5 block whitespace-nowrap text-[10px]', DASH.cellMuted)}>
            {state}
          </span>
        ) : null}
      </span>
    </button>
  );
}

const BoardReleaseHeader: React.FC<BoardReleaseHeaderProps> = ({
  ready,
  ledger,
  lane,
  onLaneChange,
  step,
  onStepChange,
  doneCounts,
  doneLane,
  onDoneLaneChange,
  action,
  className,
}) => {
  /** ยังอ่านเลขไม่ครบ — โชว์โครงเปล่าที่บอกตรง ๆ ว่ากำลังอ่าน ไม่โชว์เลขที่ยังไม่จริง */
  if (!ready) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-3">
          <p className={cn('text-[11px]', DASH.muted)}>กำลังอ่านตัวเลขของงานปล่อยประกาศ…</p>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
          <div className="flex flex-wrap items-stretch gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 min-w-0 flex-1 animate-pulse rounded-xl bg-slate-100/80 dark:bg-slate-800/60"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* ── แถวบน: 3 ก้อน (เจ้าของเคาะชื่อเอง 28 ส.ค. 2569) ─────────────────
          ทั้งหมด · ปล่อยแล้ว · ยังไม่ปล่อย — สองก้อนหลังบวกกันได้ก้อนแรกเป๊ะ
          🔴 เลขชุดนี้ **ตรงกับหน้าหลัก** (เดิมกล่องงานใช้นิยามของตัวเองแล้วเลขสองหน้าไม่ตรง) */}
      <div className="space-y-2 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {/* ⚠️ "ใบขอ" มีคำอธิบายติดตัว — โมเดลที่มาลองเล่นบอกว่าไม่รู้ว่าคืออะไร */}
          <p className="text-[13px] font-semibold text-foreground">
            <Term k="unit_request">ใบขอที่เปิดอยู่</Term> {th(ledger.all)} ใบ
          </p>
          {ledger.percent === null ? null : (
            <p className={cn('text-[11px]', DASH.muted)}>
              <Term k="released">ปล่อยประกาศ</Term>ไปแล้ว{' '}
              <span className="font-semibold text-foreground">{ledger.percent}%</span> —{' '}
              {th(ledger.released)} จาก {th(ledger.all)} ใบ
            </p>
          )}
        </div>

        {ledger.percent === null ? null : (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800"
            role="img"
            aria-label={`ปล่อยแล้ว ${ledger.percent}%`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 dark:bg-emerald-400"
              style={{ width: `${ledger.percent}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-stretch gap-2">
          <LaneTile
            laneKey="all"
            count={ledger.all}
            tone="neutral"
            active={lane === 'all' || lane === null}
            onClick={() => onLaneChange(null)}
          />
          <LaneTile
            laneKey="released"
            count={ledger.released}
            tone="success"
            active={lane === 'released'}
            onClick={() => onLaneChange(lane === 'released' ? null : 'released')}
          />
          <LaneTile
            laneKey="unreleased"
            count={ledger.unreleased}
            tone="warn"
            active={lane === 'unreleased'}
            onClick={() => onLaneChange(lane === 'unreleased' ? null : 'unreleased')}
          />
        </div>
      </div>

      {/* ── ยังไม่ปล่อย: ติดขั้นไหน — 🔴 โชว์ตั้งแต่เปิดหน้า ไม่ต้องกดก้อนก่อน ── */}
      {lane === null || lane === 'all' || lane === 'unreleased' ? (
        <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-foreground">
              ยังไม่ปล่อย {th(ledger.unreleased)} ใบ — ติดขั้นไหน
            </p>
            {action}
          </div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {ledger.steps.map((s, i) => (
              <React.Fragment key={s.key}>
                {i > 0 ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-700"
                    aria-hidden
                  />
                ) : null}
                <Chip
                  step={s.step}
                  label={s.label}
                  state={s.state}
                  count={s.count}
                  hint={`${s.hint} · ต้องทำ: ${s.todo}`}
                  tone={s.key === 'publish' ? 'success' : 'warn'}
                  active={step === s.key}
                  onClick={() => onStepChange(step === s.key ? null : s.key)}
                />
              </React.Fragment>
            ))}
          </div>
          <p className={cn('text-[11px]', DASH.muted)}>
            บวกทุกขั้นแล้วได้ {th(ledger.unreleased)} ใบพอดี — หนึ่งใบติดได้ขั้นเดียว ·
            <span className="font-medium text-foreground"> กดขั้นไหนก็เห็นแต่ใบในขั้นนั้น</span>{' '}
            แล้วกดใบเพื่อทำตามขั้น 1→4
          </p>
        </div>
      ) : null}

      {/* ── ปล่อยแล้ว: ได้ผลยังไง ── */}
      {lane === 'released' ? (
        <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-3">
          <p className="text-[11px] font-semibold text-foreground">
            ที่ปล่อยไปแล้ว {th(ledger.released)} ใบ — ได้ผลยังไง
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              label="มีคนสมัครเข้ามาแล้ว"
              count={ledger.releasedWithApplicants}
              sub={ledger.applicantHeads > 0 ? `${th(ledger.applicantHeads)} คน` : null}
              hint="ปล่อยแล้วมีคนกรอกใบสมัคร — ไปคัดคนต่อได้ (เลขในวงเล็บคือหัวคนรวม)"
              tone="success"
              active={false}
              onClick={() => undefined}
            />
            <Chip
              label="ยังไม่มีใครสมัคร"
              count={ledger.releasedSilent}
              hint="ปล่อยแล้วแต่ยังเงียบ — ถ้าค้างนานควรดันประกาศหรือเพิ่มช่องทาง"
              tone="warn"
              active={false}
              onClick={() => undefined}
            />
          </div>
          <p className={cn('text-[11px]', DASH.muted)}>
            สองก้อนบวกกันได้ {th(ledger.released)} ใบพอดี
          </p>
        </div>
      ) : null}

      {/* ── ใบที่จบไปแล้ว — คนละ feed จึงแยกออกมาและทำให้จาง ───────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <span className={cn('text-[11px]', DASH.muted)}>ใบที่จบไปแล้ว (30 วันล่าสุด):</span>
        <Chip
          label="ปิดแล้ว"
          count={doneCounts.closed}
          hint="ใบที่ปิดไปแล้ว ไม่รวมยกเลิก — ดูย้อนหลังได้"
          tone="neutral"
          active={doneLane === 'closed'}
          onClick={() => onDoneLaneChange(doneLane === 'closed' ? null : 'closed')}
        />
        <Chip
          label="ยกเลิก"
          count={doneCounts.cancelled}
          hint="ใบที่ถูกยกเลิก — ไม่นับเป็นงานที่ต้องหาคนแล้ว"
          tone="neutral"
          active={doneLane === 'cancelled'}
          onClick={() => onDoneLaneChange(doneLane === 'cancelled' ? null : 'cancelled')}
        />
      </div>
    </div>
  );
};

export default BoardReleaseHeader;
