import React from 'react';
import { AlertCircle } from 'lucide-react';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { REQUEST_GAP_LABEL, requestGapsOf } from '@/lib/publishReadiness';
import type { JobRequest } from '@/types';

/**
 * "ขาด: อายุ · คุณสมบัติ" บนการ์ด/แถวหน้าใบขอ (เจ้าของ 3 พ.ย. 2569 *"บอกเลยได้ไหมว่า ใบขอขาดอะไร"*)
 * ตัวตัดสิน = `requestGapsOf` ที่เดียว · ครบแล้วไม่ขึ้นบรรทัด
 */
export default function RequestGapsLine({ job, className }: { job: JobRequest; className?: string }) {
  const gaps = requestGapsOf(job);
  if (gaps.length === 0) return null;
  return (
    <p className={cn('flex items-start gap-1 text-xs', TONE.warn.value, className)} data-testid="request-gaps">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>ขาด: {gaps.map((g) => REQUEST_GAP_LABEL[g]).join(' · ')}</span>
    </p>
  );
}
