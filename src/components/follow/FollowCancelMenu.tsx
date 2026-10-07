import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type FollowCancelChoice = 'call' | 'day' | 'person';

const CHOICES: Array<{ key: FollowCancelChoice; label: string; ask: string }> = [
  { key: 'call', label: 'ยกเลิกสายนี้', ask: 'ยกเลิกสายนี้สายเดียว' },
  { key: 'day', label: 'ยกเลิกทั้งวัน', ask: 'ยกเลิกทุกสายของวันนี้' },
  { key: 'person', label: 'เลิกตามคนนี้', ask: 'ยกเลิกทุกสายที่ยังไม่โทรของคนนี้' },
];

/**
 * ═══ ปุ่มยกเลิก 3 แบบ (เจ้าของ 7 ต.ค. 2569 Journey ข้อ 2) ═══
 * *"ยกเลิกแค่สายนี้สายเดียว ยกเลิกวันนั้น หรือ ยกเลิกการติดตามคนนี้เลย"*
 * ปุ่มเดียวบนแถว → Popover เลือกแบบ → ยืนยันอีกครั้ง (ย้อนไม่ได้) · ใช้ทั้งสาย AI และสายคนโทร
 */
const FollowCancelMenu: React.FC<{
  busy?: boolean;
  onCancel: (choice: FollowCancelChoice) => void | Promise<void>;
}> = ({ busy = false, onCancel }) => {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FollowCancelChoice | null>(null);
  const choice = CHOICES.find((c) => c.key === picked) ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicked(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" disabled={busy} data-testid="follow-cancel-open">
          ยกเลิก
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-60 flex-col gap-2 p-3">
        {choice ? (
          <>
            <span className="text-sm font-medium">{choice.ask}</span>
            <span className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setOpen(false);
                  setPicked(null);
                  await onCancel(choice.key);
                }}
              >
                ยกเลิกเลย
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicked(null)}>
                ไม่
              </Button>
            </span>
          </>
        ) : (
          CHOICES.map((c) => (
            <Button
              key={c.key}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setPicked(c.key)}
              className={cn('justify-start', c.key === 'person' && TONE.danger.value)}
            >
              {c.label}
            </Button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FollowCancelMenu;
