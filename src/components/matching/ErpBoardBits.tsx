import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { tagTone, thDate, type ErpBoardCard } from '@/lib/erpBoard';

/** ชิ้นที่การ์ดบนบอร์ดกับป๊อปการ์ดใช้ร่วมกัน — ขั้นตอนล่าสุด · ป้ายแท็ก */
export function ErpBoardStepLine({ card: c }: { card: Pick<ErpBoardCard, 'step' | 'outcome' | 'scheduledAt'> }) {
  if (!c.step) return <p className={DASH.sub}>ยังไม่มีสถานะ</p>;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="outline" className={cn('rounded-lg', TONE.danger.outline)}>
        {c.step}
      </Badge>
      <span className={c.outcome ? DASH.cell : TONE.warn.value}>{c.outcome ?? 'รอดำเนินการ'}</span>
      {c.scheduledAt ? <span className={DASH.sub}>· {thDate(c.scheduledAt)}</span> : null}
    </p>
  );
}

export function ErpBoardTagBadge({ label }: { label: string }) {
  const tone = TONE[tagTone(label)];
  return (
    <Badge variant="outline" className={cn('px-2 text-xs', tone.soft, tone.value)}>
      #{label}
    </Badge>
  );
}
