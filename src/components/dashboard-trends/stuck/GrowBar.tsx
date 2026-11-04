/* eslint-disable react-refresh/only-export-components -- hook + แถบสองแบบอยู่ไฟล์เดียว (ใช้คู่กันเสมอ) */
import React from 'react';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';

/**
 * แถบที่ค่อย ๆ ยืดเข้ามา (เจ้าของ 4 พ.ย. 2569 "ถ้ามีกราฟก็ต้องมี animation") — เริ่มจาก 0 แล้วยืดไปค่าจริงหลังวาด
 * ค่าเปลี่ยน (เปลี่ยนตัวกรอง) ก็ยืด/หดตาม · `motion-reduce` = ไม่ขยับ
 */
export function useGrown(): boolean {
  const [grown, setGrown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return grown;
}

/** แถบเดียว — `pct` 0–100 */
export function GrowBar({ pct, tone = 'primary', className }: { pct: number; tone?: ToneKey; className?: string }) {
  const grown = useGrown();
  return (
    <span className={cn('block h-2.5 w-full overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <span
        className={cn('block h-full rounded-full transition-all duration-700 ease-out motion-reduce:transition-none', TONE[tone].dot)}
        style={{ width: `${grown ? Math.min(100, Math.max(0, pct)) : 0}%` }}
      />
    </span>
  );
}

/** แถบซ้อนหลายส่วน — ส่วนรวมกัน 100 */
export function GrowStack({ parts, className }: { parts: ReadonlyArray<{ pct: number; tone: ToneKey; label: string }>; className?: string }) {
  const grown = useGrown();
  return (
    <span className={cn('flex h-3 w-full overflow-hidden rounded-full bg-muted', className)} role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.pct)}%`).join(' · ')}>
      {parts.map((p) => (
        <span key={p.label} className={cn('block h-full transition-all duration-700 ease-out motion-reduce:transition-none', TONE[p.tone].dot)} style={{ width: `${grown ? p.pct : 0}%` }} />
      ))}
    </span>
  );
}
