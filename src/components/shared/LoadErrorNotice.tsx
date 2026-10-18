/**
 * โหลดไม่สำเร็จ + ปุ่มลองใหม่ — ตัวเดียวของหน้าในเมนู (QA 17 ต.ค. 2569 กลุ่ม "จอโหลด/ล้มแล้วบอกผิด")
 * 🔴 โหลดล้มต้องบอก ห้ามโชว์ 0 หรือ "ไม่มี…" แทน · ข้อความผ่าน `friendlyErrorText` (ไม่มีอังกฤษดิบ/รหัส HTTP)
 * หน้าตาเดียวกับ `TrendState` ของ Dashboard
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export function LoadErrorNotice({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card
      role="alert"
      className={cn('flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm', TONE.danger.soft, className)}
    >
      <span className={TONE.danger.value}>{message}</span>
      {onRetry ? (
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden /> ลองใหม่
        </Button>
      ) : null}
    </Card>
  );
}

export default LoadErrorNotice;
