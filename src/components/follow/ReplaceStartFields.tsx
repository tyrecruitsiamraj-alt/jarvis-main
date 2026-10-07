import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import DateTimeField24 from '@/components/shared/DateTimeField24';
import { TONE } from '@/lib/designTokens';
import {
  DEFAULT_REPLACE_CALL_RULE,
  leadText,
  planReplaceCallsFull,
  type ReplaceSlot,
  type ReplaceTiming,
} from '@/lib/irecruitReplaceSync';
import { cn } from '@/lib/utils';

export type ReplaceSlotModes = Record<ReplaceSlot, 'ai' | 'manual'>;
export const REPLACE_SLOT_MODES_MANUAL: ReplaceSlotModes = { confirm: 'manual', lead60: 'manual', lead15: 'manual' };

/** 🔴 `Intl` ระดับโมดูลเท่านั้น */
const WHEN = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "YYYY-MM-DDTHH:MM" → วันเวลาเข้างาน · อ่านไม่ออก = null */
export function replaceStartOf(v: string): { ymd: string; hhmm: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(v.trim());
  return m ? { ymd: m[1], hhmm: m[2] } : null;
}

/**
 * ═══ ขั้นตั้งเวลาของแท็บส่งคนแทน — ใส่แค่วันเวลาเข้างาน ระบบลง 3 สายให้ (เจ้าของ 7 ต.ค. 2569) ═══
 * *"สายที่ 1 คือ รอบที่ดึงไปโทรคือทุกๆ 16.00น. ลงหลังจาก 16.00 ต่อคิว · สายที่ 2 ก่อนเวลานัด 1 ชม. · สายที่ 3 ก่อน 15 นาที
 * ลงสายไว้แบบนี้จะได้ไม่งง"* · *"ต้องมี 3 สายนะทุกคนเลย"* · *"แต่ละสายเลือกได้ว่าคนหรือ AI โทร"*
 * สายคิดด้วย `planReplaceCalls` + เวลาที่ตั้งบนจอ (server คิดซ้ำตอนบันทึก) · สายที่เลยเวลาแล้วไม่สร้าง
 */
const ReplaceStartFields: React.FC<{
  value: string;
  onChange: (v: string) => void;
  modes: ReplaceSlotModes;
  onModesChange: (m: ReplaceSlotModes) => void;
  /** พัก AI ของแท็บนี้อยู่ = คนโทรเท่านั้น */
  aiPaused: boolean;
  timing?: ReplaceTiming;
  now?: Date;
  children?: React.ReactNode;
}> = ({ value, onChange, modes, onModesChange, aiPaused, timing = DEFAULT_REPLACE_CALL_RULE, now = new Date(), children }) => {
  const start = replaceStartOf(value);
  // 3 สายเสมอ — สายที่เลยเวลาแล้วยังลง แต่เป็นคนโทร (เจ้าของ 7 ต.ค. 2569 ลงย้อนหลัง "ขึ้น แต่ไม่โทร")
  const plans = start ? planReplaceCallsFull(start, now, timing) : [];
  const slotLabel: Record<ReplaceSlot, string> = {
    confirm: `สายที่ 1 · คอนเฟิร์ม ${timing.confirmTime}`,
    lead60: `สายที่ 2 · ${leadText(timing.leadMinutes[0])}`,
    lead15: `สายที่ 3 · ${leadText(timing.leadMinutes[1])}`,
  };
  return (
    <div className="space-y-3" data-testid="replace-start-fields">
      <div className="space-y-1.5">
        <span className="ml-1 text-xs font-medium text-muted-foreground">วันเวลาเข้างาน</span>
        <DateTimeField24 value={value} onChange={onChange} label="วันเวลาเข้างาน" className="min-h-[46px]" />
      </div>
      {children}
      <ul className="space-y-2 rounded-xl border border-border/70 p-3 text-sm" data-testid="replace-start-preview">
        {(['confirm', 'lead60', 'lead15'] as const).map((slot) => {
          const p = plans.find((x) => x.slot === slot);
          const mode = aiPaused ? 'manual' : modes[slot];
          return (
            <li key={slot} className="space-y-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{slotLabel[slot]}</span>
                <span className={cn('tabular-nums', p ? 'text-foreground' : 'text-muted-foreground')}>
                  {!start || !p ? '—' : p.asap ? 'ต่อคิวโทรทันที' : `${WHEN.format(p.at)} น.${p.past ? ' · เลยเวลาแล้ว คนโทร' : ''}`}
                </span>
              </span>
              {p && !p.past ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1" role="group" aria-label={`ใครโทร${slotLabel[slot]}`}>
                  {(
                    [
                      { value: 'ai', label: 'AI โทร', on: 'text-primary' },
                      { value: 'manual', label: 'คนโทร', on: TONE.warn.value },
                    ] as const
                  ).map((c) => (
                    <label key={c.value} className="flex cursor-pointer items-center gap-1.5">
                      <Checkbox
                        checked={mode === c.value}
                        disabled={aiPaused && c.value === 'ai'}
                        onCheckedChange={() => onModesChange({ ...modes, [slot]: c.value })}
                        aria-label={`${slotLabel[slot]} — ${c.label}`}
                      />
                      <span className={cn('text-xs font-medium', mode === c.value ? c.on : 'text-muted-foreground')}>{c.label}</span>
                    </label>
                  ))}
                  {aiPaused ? <span className="text-xs text-muted-foreground">พัก AI อยู่</span> : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ReplaceStartFields;
