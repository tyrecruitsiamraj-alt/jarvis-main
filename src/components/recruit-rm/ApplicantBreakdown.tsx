import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  APPLICANT_BREAKDOWN,
  APPLICANT_BUCKET_GROUPS,
  type ApplicantBreakdownCounts,
  type ApplicantBucket,
  type ApplicantBucketGroup,
} from '@/lib/applicantBreakdown';

/**
 * ═══ แตกยอดผู้สมัครทั้งหมด (เจ้าของสั่ง 14 ต.ค. 2569) — ตัวคิดอยู่ `src/lib/applicantBreakdown.ts` ═══
 * ปกติพับเหลือบรรทัดเดียว (เจ้าของ "รกไป" → Choice "เหลือบรรทัดเดียว กดกางดู")
 * ทั้งหมด = AI โทรแล้ว · รอ AI โทร · ยังไม่ได้ส่งให้ AI · เจ้าหน้าที่ติดต่อเอง · "ดูแยก" = กลุ่มย่อย
 * กดกลุ่ม/กลุ่มย่อย = กรองตาราง (`?group=`) · กดซ้ำ = ล้าง · ว่าง = 0
 */
type Key = ApplicantBucket | ApplicantBucketGroup;

const NUM = new Intl.NumberFormat('th-TH');

export default function ApplicantBreakdown({
  counts,
  value,
  onChange,
}: {
  /** null = ยังโหลดไม่เสร็จ */
  counts: ApplicantBreakdownCounts | null;
  value: Key | null;
  onChange: (next: Key | null) => void;
}) {
  // เลือกกลุ่มย่อยอยู่ = กางไว้ให้เห็นว่ากดอะไร
  const leafPicked = value !== null && !(APPLICANT_BUCKET_GROUPS as readonly string[]).includes(value);
  const [open, setOpen] = useState(leafPicked);
  const shown = open || leafPicked;
  const n = (k: Key | 'total') => (counts ? NUM.format(counts[k]) : '…');
  const pick = (k: Key) => onChange(value === k ? null : k);
  const chip = (k: Key, label: string, testId: string, strong = false) => (
    <Button
      key={k}
      type="button"
      size="xs"
      variant={value === k ? 'default' : 'ghost'}
      aria-pressed={value === k}
      onClick={() => pick(k)}
      className={cn(value !== k && !strong && 'text-muted-foreground')}
      data-testid={testId}
    >
      {label} <span className="tabular-nums text-foreground">{n(k)}</span>
    </Button>
  );

  return (
    <div className="mt-2 space-y-1.5" data-testid="applicant-breakdown">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="tabular-nums text-muted-foreground" data-testid="applicant-breakdown-total">
          ทั้งหมด {n('total')} =
        </span>
        {APPLICANT_BREAKDOWN.map((g) => chip(g.group, g.label, `breakdown-${g.group}`, true))}
        <Button
          type="button"
          size="xs"
          variant="ghost"
          aria-expanded={shown}
          onClick={() => setOpen((v) => !v)}
          data-testid="applicant-breakdown-toggle"
        >
          ดูแยก {shown ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
      </div>
      {shown ? (
        <div className="space-y-1 border-l border-border/70 pl-3" data-testid="applicant-breakdown-detail">
          {APPLICANT_BREAKDOWN.map((g) => (
            <div key={g.group} className="flex flex-wrap items-center gap-1 text-xs">
              <span className="w-36 shrink-0 text-muted-foreground">{g.label}</span>
              {g.buckets.map((b) => chip(b.key, b.label, `breakdown-${b.key}`))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
