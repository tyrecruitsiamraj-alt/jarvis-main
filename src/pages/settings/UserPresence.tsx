/**
 * ═══ ใครอยู่ในระบบ ในตาราง ตั้งค่า › ผู้ใช้งาน (ย้ายมาจากท้ายหน้าหลัก 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"ใครอยู่ในระบบ ย้ายไปหน้าอื่น หน้าตั้งค่าก็ได้ เรียงผู้ใช้งานใหม่ บอกเลยใคร online"*
 * → Choice **"รวมเข้าตารางผู้ใช้งาน"**
 * - `PresenceFilterChips` — ปุ่มกรองเหนือตาราง: ทั้งหมด · Online · Offline · ยังไม่เข้าระบบ (บอกจำนวน) + เวลาอัปเดต
 * - `PresenceLine` — บรรทัดใต้ชื่อ: "Online · ใช้งาน 5 นาทีก่อน" · "Offline · เข้าล่าสุด 29 ก.ย. 2569" · "ยังไม่เข้าระบบ"
 * นิยาม/ตัวจัด/สีอยู่ `src/lib/homePresence.ts` · ป้ายจี้มาจาก `metricDictionary` (`presence.*`)
 * 🔴 ประกอบจาก shadcn (`Button`) + TONE · ไม่มีสีสด/ขนาดสุ่ม
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { TONE } from '@/lib/designTokens';
import { metricHelp, type MetricKey } from '@/lib/metricDictionary';
import {
  PRESENCE_LABEL,
  PRESENCE_STATUSES,
  PRESENCE_TONE,
  activeAgoText,
  lastLoginText,
  type PresenceCounts,
  type PresenceFilter,
  type PresencePerson,
  type PresenceStatus,
} from '@/lib/homePresence';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

const HELP: Record<PresenceStatus, MetricKey> = {
  online: 'presence.online',
  offline: 'presence.offline',
  never: 'presence.never',
};

export function PresenceFilterChips({
  counts,
  total,
  value,
  onChange,
  updatedAt,
}: {
  counts: PresenceCounts;
  /** จำนวนบัญชีทั้งหมดในตาราง (รวมบัญชีปิดใช้งาน) */
  total: number;
  value: PresenceFilter;
  onChange: (next: PresenceFilter) => void;
  /** เวลาที่ดึงสถานะล่าสุด (ISO) */
  updatedAt: string;
}) {
  const chips: Array<{ key: PresenceFilter; label: string; count: number }> = [
    { key: 'all', label: 'ทั้งหมด', count: total },
    ...PRESENCE_STATUSES.map((s) => ({ key: s, label: PRESENCE_LABEL[s], count: counts[s] })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="กรองตามสถานะ">
        {chips.map((c) => (
          <Button
            key={c.key}
            type="button"
            size="xs"
            variant={value === c.key ? 'default' : 'outline'}
            aria-pressed={value === c.key}
            title={c.key === 'all' ? undefined : metricHelp(HELP[c.key])}
            onClick={() => onChange(c.key)}
          >
            {c.key !== 'all' ? <span className={cn('inline-block h-2 w-2 rounded-full', TONE[PRESENCE_TONE[c.key]].dot)} aria-hidden /> : null}
            {c.label} {NUM.format(c.count)}
          </Button>
        ))}
      </div>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground">อัปเดต {TIME.format(new Date(updatedAt))}</span>
    </div>
  );
}

export function PresenceLine({ person, now }: { person: PresencePerson | undefined; now: Date }) {
  if (!person) return null;
  const tail =
    person.status === 'online'
      ? (() => {
          const ago = activeAgoText(person.lastActiveAt, now);
          return ago ? `ใช้งาน ${ago}` : null;
        })()
      : person.status === 'offline'
        ? `เข้าล่าสุด ${lastLoginText(person.lastLoginAt, now)}`
        : null;
  return (
    // บรรทัดเดียวเสมอ (ตารางเลื่อนแนวนอนได้อยู่แล้ว) — จอแคบเคยตัด "ใช้งาน 10 | นาทีก่อน" กลางคำ
    <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs font-normal" title={metricHelp(HELP[person.status])}>
      <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TONE[PRESENCE_TONE[person.status]].dot)} aria-hidden />
      <span className={person.status === 'never' ? TONE.danger.value : 'text-foreground'}>{PRESENCE_LABEL[person.status]}</span>
      {tail ? <span className="text-muted-foreground">· {tail}</span> : null}
    </span>
  );
}
