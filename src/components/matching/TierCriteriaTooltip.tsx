import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TIER_CRITERIA } from '@/lib/matchTierCriteria';
import type { MatchTier } from '@/lib/boardCandidateTypes';

/** อธิบายเกณฑ์สีของ AI ให้คนที่กดดูตัดสินเองได้ — แยกจาก MatchingPage.tsx ตอนแตกไฟล์ */
export default function TierCriteriaTooltip({ tier, children }: { tier: MatchTier; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left" className="w-[min(340px,calc(100vw-24px))] space-y-2 p-3 text-left">
        <p className="text-xs font-semibold">AI ใช้เกณฑ์อะไรในการจัดสี?</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          เทียบตำแหน่งที่สมัครกับตำแหน่งในใบขอ สายงาน (Job Family) งานใกล้เคียงที่ยอมรับได้ และคุณสมบัติที่มีข้อมูล
          เช่น สกิล/ประสบการณ์ เพศ อายุ ใบขับขี่ และพื้นที่
        </p>
        <ul className="space-y-1.5">
          {(['green', 'yellow', 'red'] as const).map((candidateTier) => {
            const item = TIER_CRITERIA[candidateTier];
            return (
              <li
                key={candidateTier}
                className={cn(
                  'flex gap-2 rounded-md px-2 py-1.5 text-[11px] leading-snug',
                  tier === candidateTier ? 'bg-muted font-medium' : '',
                )}
              >
                <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', item.dot)} aria-hidden="true" />
                <span>
                  <span className="font-semibold">{item.label}</span>
                  <br />
                  {item.detail}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="border-t pt-2 text-[10px] leading-relaxed text-muted-foreground">
          สีเป็นคำแนะนำจาก AI ควรเช็คข้อมูลจริงกับผู้สมัครก่อนจองตัวหรือลงงาน
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
