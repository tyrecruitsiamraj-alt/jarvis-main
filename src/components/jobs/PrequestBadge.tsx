import React from 'react';

import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { isPrequestJob, PREQUEST_LABEL } from '@/lib/publicJobVisibility';

/**
 * ป้าย "ใบขอชั่วคราว" — ติดทุกที่ที่ใบขอจากใบพรีโผล่
 * (เจ้าของสั่ง 19 ส.ค. 2569: *"ใบขอไหนมาจากใบพรี ก็ใส่ป้ายแท็กไว้ว่าเป็นใบขอชั่วคราว"*)
 *
 * ทำไมต้องเห็นตั้งแต่แรก: ใบพรี **ยังไม่การันตีว่าจะเปิดงานจริง** — หาคนไว้ล่วงหน้าได้
 * แต่อย่าไปสัญญากับผู้สมัคร · เดิมมีป้ายนี้เฉพาะการ์ดบนบอร์ดที่เดียว
 *
 * 🔴 เช็คด้วย `isPrequestJob()` ไม่ใช่ `job.is_prequest` ตรง ๆ — บางเส้น (แดชบอร์ด/feed)
 * ส่งมาแต่ `id` ที่ขึ้นต้น `siamraj-pre:` โดยไม่มีธง ถ้าดูธงอย่างเดียวป้ายจะหายไปเงียบ ๆ
 */
const PrequestBadge: React.FC<{
  job: { id?: unknown; is_prequest?: unknown } | null | undefined;
  compact?: boolean;
  className?: string;
}> = ({ job, compact = false, className }) => {
  if (!job || !isPrequestJob(job)) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold whitespace-nowrap',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[10px]',
        TONE.violet.chip,
        className,
      )}
      title="ใบขอล่วงหน้า — ยังไม่การันตีว่าจะเปิดงานจริง"
    >
      {PREQUEST_LABEL}
    </span>
  );
};

export default PrequestBadge;
