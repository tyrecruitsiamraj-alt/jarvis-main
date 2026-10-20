import React, { useEffect, useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { apiFetch } from '@/lib/apiFetch';

/**
 * ═══ แถบแดงบนหัวกล่องงาน: นัดที่เลยวันเกิน 24 ชม. ยังไม่ลงผลมา/ไม่มา (เจ้าของ 20 ต.ค. 2569 Choice) ═══
 * ไม่มีนัดค้าง = ไม่ขึ้น · โหลดไม่ได้ = ไม่ขึ้น (ของเตือน ไม่ใช่ตัวเลขหลักของหน้า)
 * นับที่ `GET /api/appointment-overdue` (กติกาเดียวกับตัวเตือนรายวัน `appointmentResultReminder.ts`)
 */
export default function AppointmentOverdueBar({ onOpen, refreshKey }: { onOpen: () => void; refreshKey?: number }) {
  const [counts, setCounts] = useState<{ all: number; mine: number } | null>(null);
  useEffect(() => {
    let alive = true;
    apiFetch('/api/appointment-overdue')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { all?: number; mine?: number } | null) => {
        if (alive && j) setCounts({ all: Number(j.all ?? 0), mine: Number(j.mine ?? 0) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  if (!counts || counts.all === 0) return null;
  return (
    <div
      role="alert"
      data-testid="appointment-overdue-bar"
      className={cn('mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm', TONE.danger.soft)}
    >
      <span className={cn('flex items-center gap-2 font-medium', TONE.danger.value)}>
        <CalendarX2 className="size-4" aria-hidden />
        นัดที่เลยวันเกิน 24 ชม. ยังไม่ลงผลมา/ไม่มา {counts.all.toLocaleString('th-TH')} คน
        {counts.mine > 0 ? ` · ของฉัน ${counts.mine.toLocaleString('th-TH')}` : ''}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={onOpen}>
        ไปลงผล
      </Button>
    </div>
  );
}
