import React from 'react';
import { AlertCircle, Ban, Megaphone, UserCheck } from 'lucide-react';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { readinessChipText, type PublishReadiness } from '@/lib/publishReadiness';

/**
 * ชิป "พร้อมประกาศ / ขาด: … / ประกาศแล้ว / มีคนเริ่มงานแล้ว" — ใช้ร่วมการ์ดกล่องงานกับป๊อปประกาศ (2 ต.ค. 2569)
 * 🔴 คำกับสีมาจาก `publishReadiness` + `designTokens` ที่เดียว · เขียว = พร้อม/ประกาศแล้ว · เหลือง = ขาด ·
 * เทา = ERP พาไปต่อแล้ว · แดง = ตั้งไม่ประกาศ · ไม่มีเครื่องหมายถูก (บ้านนี้ถอดติ๊กถูกไปสองรอบ)
 */
const ICON: Record<PublishReadiness['kind'], React.ComponentType<{ className?: string }>> = {
  released: Megaphone,
  ready: Megaphone,
  gaps: AlertCircle,
  moved: UserCheck,
  skipped: Ban,
};

function toneOf(kind: PublishReadiness['kind']): string {
  if (kind === 'released' || kind === 'ready') return TONE.success.chip;
  if (kind === 'gaps') return TONE.warn.chip;
  if (kind === 'skipped') return TONE.danger.chip;
  return 'bg-muted text-muted-foreground';
}

export default function PublishReadinessChip({ readiness, className }: { readiness: PublishReadiness; className?: string }) {
  const Icon = ICON[readiness.kind];
  return (
    <span
      className={cn('inline-flex w-fit max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-sm', toneOf(readiness.kind), className)}
      data-readiness={readiness.kind}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{readinessChipText(readiness)}</span>
    </span>
  );
}
