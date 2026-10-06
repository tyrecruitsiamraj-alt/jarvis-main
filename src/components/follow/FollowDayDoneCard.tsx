import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TONE } from '@/lib/designTokens';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcomeAny } from '@/lib/followOutcome';
import type { FollowDayDoneKind, FollowDayPerson } from '@/lib/followPlanning';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<FollowDayDoneKind, string> = { success: 'สำเร็จ', cancelled: 'ยกเลิก' };
const PAGE = 10;

/** ผลของคนนั้น — ผลปิดงานของสายล่าสุดที่ปิด · ยกเลิกทุกสาย = "ยกเลิก" */
function resultOf(p: FollowDayPerson): string {
  const closed = p.calls
    .map((c) => c.round.entry)
    .filter((e) => e.completed_at && e.outcome_code)
    .sort((a, b) => Date.parse(b.completed_at ?? '') - Date.parse(a.completed_at ?? ''));
  const code = closed[0]?.outcome_code as FollowOutcomeAny | undefined;
  return code ? (FOLLOW_OUTCOME_LABEL[code] ?? code) : 'ยกเลิก';
}

/** ใครจัดการ — คนปิดงาน ไม่งั้นคนแก้ล่าสุด (ยกเลิก) */
function whoOf(p: FollowDayPerson): string {
  for (const c of p.calls) {
    const e = c.round.entry;
    if (e.completed_by_name) return e.completed_by_name;
  }
  for (const c of p.calls) {
    const e = c.round.entry;
    if (e.updated_by_name) return e.updated_by_name;
  }
  return '—';
}

/**
 * ═══ การ์ด "สำเร็จ / ยกเลิก" ใต้ตารางรายวัน (เจ้าของ 6 ต.ค. 2569 · Choice "การ์ดแยกใต้ตาราง") ═══
 * คนที่กดจัดการจบแล้ว (`followDayPersonDone`) ย้ายออกจากตาราง "สายที่ต้องตาม" มาอยู่ที่นี่
 * ปุ่มสลับ สำเร็จ / ยกเลิก (มีตัวเลข) · แถว = ชื่อ · หน่วยงาน · ผล · ใครจัดการ · "จัดการ" เปิดป๊อปเดิม (แก้/เปิดงานใหม่ได้)
 * 🔴 ว่าง = การ์ดยังอยู่ + 0 + แถว "ไม่มี…" (กติกาว่างแล้วห้ามหาย)
 */
export default function FollowDayDoneCard({
  people,
  onOpen,
}: {
  people: ReadonlyArray<{ person: FollowDayPerson; kind: FollowDayDoneKind }>;
  onOpen: (person: FollowDayPerson) => void;
}) {
  const [kind, setKind] = React.useState<FollowDayDoneKind>('success');
  /** วันที่จบเยอะ (วัดจริง 6 ต.ค.: 39 คน) — โชว์ 10 คนแรก กดดูทั้งหมดได้ */
  const [all, setAll] = React.useState(false);
  const counts = { success: 0, cancelled: 0 };
  for (const p of people) counts[p.kind] += 1;
  const ofKind = people.filter((p) => p.kind === kind);
  const shown = all ? ofKind : ofKind.slice(0, PAGE);

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm" data-testid="follow-day-done">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 md:px-5">
        <h3 className="mr-2 text-[13px] font-medium text-foreground">สำเร็จ / ยกเลิก</h3>
        {(['success', 'cancelled'] as const).map((k) => (
          <Button
            key={k}
            type="button"
            size="xs"
            variant={kind === k ? 'default' : 'outline'}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setAll(false);
            }}
          >
            {KIND_LABEL[k]} <span className="tabular-nums">{counts[k].toLocaleString('th-TH')}</span>
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/70 text-left text-[11px] text-muted-foreground">
              <th className="px-4 py-2 font-medium md:px-5">ชื่อ</th>
              <th className="px-3 py-2 font-medium">หน่วยงาน</th>
              <th className="px-3 py-2 font-medium">ผล</th>
              <th className="px-3 py-2 font-medium">ใครจัดการ</th>
              <th className="px-4 py-2 md:px-5" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground md:px-5">
                  ไม่มีคนที่{KIND_LABEL[kind]}
                </td>
              </tr>
            ) : (
              shown.map(({ person }) => (
                <tr key={person.row.group.key} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground md:px-5">{person.row.group.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{person.row.group.unitName || '—'}</td>
                  <td className={cn('whitespace-nowrap px-3 py-2.5', kind === 'success' ? TONE.success.value : TONE.neutral.value)}>{resultOf(person)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{whoOf(person)}</td>
                  <td className="px-4 py-2.5 text-right md:px-5">
                    <Button type="button" size="xs" variant="outline" onClick={() => onOpen(person)}>
                      จัดการ
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {ofKind.length > PAGE ? (
        <div className="border-t border-border/70 px-4 py-2 md:px-5">
          <Button type="button" size="xs" variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? 'ย่อ' : `ดูทั้งหมด ${ofKind.length.toLocaleString('th-TH')} คน`}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
