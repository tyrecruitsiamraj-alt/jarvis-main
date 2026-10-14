import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  APPLICANT_BREAKDOWN,
  type ApplicantBreakdownCounts,
  type ApplicantBucket,
  type ApplicantBucketGroup,
} from '@/lib/applicantBreakdown';

/**
 * ═══ แตกยอดผู้สมัครทั้งหมด (เจ้าของสั่ง 14 ต.ค. 2569) — ตัวคิดอยู่ `src/lib/applicantBreakdown.ts` ═══
 * ทั้งหมด = AI โทรแล้ว + เจ้าหน้าที่ติดต่อเอง + รอ AI โทร + ยังไม่ได้ส่งให้ AI · แต่ละกลุ่มแตกย่อยต่อ · ทุกชั้นบวกลงตัว
 * กดกลุ่มหรือกลุ่มย่อย = กรองตาราง (`?group=`) · กดซ้ำ = ล้าง · ว่าง = 0 (กติกาว่างแล้วห้ามหาย)
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
  const n = (k: Key | 'total') => (counts ? NUM.format(counts[k]) : '…');
  const pick = (k: Key) => onChange(value === k ? null : k);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/70 px-3 py-3" data-testid="applicant-breakdown">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <Button
          type="button"
          size="xs"
          variant={value === null ? 'default' : 'outline'}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          ทั้งหมด <span className="tabular-nums">{n('total')}</span>
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground" data-testid="applicant-breakdown-sum">
          = {APPLICANT_BREAKDOWN.map((g) => `${g.label} ${n(g.group)}`).join(' + ')}
        </span>
      </div>
      <div className="space-y-1.5">
        {APPLICANT_BREAKDOWN.map((g) => (
          <div key={g.group} className="grid items-start gap-1.5 md:grid-cols-[13rem_minmax(0,1fr)]">
            <div>
              <Button
                type="button"
                size="xs"
                variant={value === g.group ? 'default' : 'outline'}
                aria-pressed={value === g.group}
                onClick={() => pick(g.group)}
                data-testid={`breakdown-${g.group}`}
              >
                {g.label} <span className="tabular-nums">{n(g.group)}</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {g.buckets.map((b) => (
                <Button
                  key={b.key}
                  type="button"
                  size="xs"
                  variant={value === b.key ? 'default' : 'ghost'}
                  aria-pressed={value === b.key}
                  onClick={() => pick(b.key)}
                  className={cn(value !== b.key && 'text-muted-foreground')}
                  data-testid={`breakdown-${b.key}`}
                >
                  {b.label} <span className="tabular-nums text-foreground">{n(b.key)}</span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
