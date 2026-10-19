import React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatYmdTh } from '@/lib/dateTh';
import {
  MOVE_DAY_PRESETS,
  MOVE_MAX_ROUNDS,
  MOVE_MODE_LABEL,
  isMoveDayPast,
  moveRoundDays,
  nextMoveRound,
  type MoveRoundDraft,
  type MoveRoundMode,
} from '@/lib/followAftercareMove';

/**
 * ═══ ฟอร์มรอบถามความเป็นอยู่ — วันเริ่มงาน + รอบ (อีกกี่วัน · เวลา · AI/คนโทร) + เพิ่มรอบ ═══
 * แยกออกจากป๊อป "ย้ายไปดูแลหลังเริ่มงาน" (19 ต.ค. 2569) ให้ป๊อปตั้งรอบของหน้าดูแลหลังเริ่มงานใช้ตัวเดียวกัน
 * (เจ้าของ: *"ต้องการหน้าต่างเหมือนก่อนกดย้ายไปดูแลหลังเริ่มงาน"*) · วาดอย่างเดียว state อยู่ที่ป๊อป
 */
export default function MoveRoundsEditor({
  startYmd,
  onStartChange,
  fromErp,
  rounds,
  onRoundsChange,
  busy,
  now,
}: {
  startYmd: string;
  onStartChange: (v: string) => void;
  /** วันเริ่มงานเติมจากวันแจ้งเข้า ERP */
  fromErp?: boolean;
  rounds: MoveRoundDraft[];
  onRoundsChange: (next: MoveRoundDraft[]) => void;
  busy: boolean;
  now: Date;
}) {
  const roundDays = startYmd ? moveRoundDays(rounds, startYmd) : rounds.map(() => null);
  const patch = (i: number, next: Partial<MoveRoundDraft>) =>
    onRoundsChange(rounds.map((r, idx) => (idx === i ? { ...r, ...next } : r)));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid="move-base-day">
        <span className="text-xs font-medium text-muted-foreground">นับจากวันเริ่มงาน</span>
        <DateSelectDmyBe
          value={startYmd}
          onChange={onStartChange}
          allowEmpty
          withWeekday={false}
          disabled={busy}
          ariaLabel="วันเริ่มงาน"
        />
        {fromErp ? <span className="text-[11px] text-muted-foreground">วันแจ้งเข้าจาก ERP</span> : null}
      </div>

      <ol className="space-y-2" aria-label="รอบโทร">
        {rounds.map((r, i) => {
          const day = roundDays[i];
          return (
            <li key={r.id ?? `new-${i}`} className="space-y-2 rounded-xl border border-border/70 p-3" data-testid="move-round">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">รอบที่ {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  disabled={rounds.length <= 1 || busy}
                  onClick={() => onRoundsChange(rounds.filter((_, idx) => idx !== i))}
                  aria-label={`เอารอบที่ ${i + 1} ออก`}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* รอบแรกนับจากวันเริ่มงาน ⇒ "ครบ N วัน" (QA 17 ต.ค. 2569) */}
                <span className="text-xs text-muted-foreground">{i === 0 ? 'ครบ' : 'ต่ออีก'}</span>
                {MOVE_DAY_PRESETS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="xs"
                    variant={r.days.trim() === String(d) ? 'default' : 'outline'}
                    aria-pressed={r.days.trim() === String(d)}
                    disabled={busy}
                    onClick={() => patch(i, { days: String(d) })}
                  >
                    {d}
                  </Button>
                ))}
                {/* ช่องกรอกของระบบกว้างเต็มเสมอ — ครอบให้กว้างตายตัวแทนการแก้คลาสของช่อง */}
                <div className="w-20">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    value={r.days}
                    disabled={busy}
                    onChange={(e) => patch(i, { days: e.target.value })}
                    aria-label={`จำนวนวันของรอบที่ ${i + 1}`}
                    className="h-9 text-xs tabular-nums"
                  />
                </div>
                <span className="text-xs text-muted-foreground">วัน</span>
                <span className="text-xs tabular-nums text-foreground" data-testid="move-round-day">
                  {day ? formatYmdTh(day) : '—'}
                </span>
                {isMoveDayPast(day, r.time, now) ? (
                  <span className={cn('text-xs font-medium', TONE.warn.value)}>ผ่านมาแล้ว</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TimeSelect24
                  value={r.time}
                  onChange={(v) => patch(i, { time: v })}
                  disabled={busy}
                  label={`เวลาของรอบที่ ${i + 1}`}
                  className="min-h-9"
                />
                <span className="flex items-center gap-1" role="group" aria-label={`ใครโทรรอบที่ ${i + 1}`}>
                  {(Object.keys(MOVE_MODE_LABEL) as MoveRoundMode[]).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="xs"
                      variant={r.mode === m ? 'default' : 'outline'}
                      aria-pressed={r.mode === m}
                      disabled={busy}
                      onClick={() => patch(i, { mode: m })}
                    >
                      {MOVE_MODE_LABEL[m]}
                    </Button>
                  ))}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <Button
        type="button"
        size="xs"
        variant="outline"
        className="w-fit"
        disabled={rounds.length >= MOVE_MAX_ROUNDS || busy}
        onClick={() => onRoundsChange([...rounds, nextMoveRound(rounds)])}
      >
        <Plus aria-hidden /> เพิ่มรอบ
      </Button>
    </>
  );
}
