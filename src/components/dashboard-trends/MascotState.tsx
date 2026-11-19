/**
 * น้องใบขอกลางหน้า — กำลังโหลด = ท่า "กำลังทำ" · โหลดไม่ขึ้น = ท่า "ติดปัญหา"
 * (เจ้าของ 19 พ.ย. 2569 "เวลาโหลดมีปัญหา ขออะไรที่ดูน่ารักๆ" · "ใส่ท่ากำลังทำตอนโหลดด้วย แล้วใส่ไว้กลางหน้าเลย")
 * ภาพจากชุดน้องใบขอที่เจ้าของทำเอง (`public/mascot/`) — ห้ามวาดใหม่ · พื้นหลังโปร่ง (เจ้าของ "เอาพื้นหลังขาวออก") ใช้ได้ทั้งโหมดสว่าง/มืด
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';

const POSE = {
  working: { src: '/mascot/request-working.png', alt: 'น้องใบขอกำลังทำงาน', width: 321, height: 316 },
  trouble: { src: '/mascot/request-trouble.png', alt: 'น้องใบขอติดปัญหา', width: 272, height: 342 },
} as const;

export default function MascotState({ pose, children, testId }: { pose: keyof typeof POSE; children?: React.ReactNode; testId?: string }) {
  const p = POSE[pose];
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" aria-busy={pose === 'working' || undefined} data-testid={testId}>
      <img src={p.src} alt={p.alt} width={p.width} height={p.height} className="h-40 w-auto" />
      <div className={cn('flex flex-col items-center gap-2 text-sm', DASH.sub)}>{children}</div>
    </div>
  );
}
