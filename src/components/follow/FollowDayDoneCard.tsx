import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PagePager } from '@/components/shared/PagePager';
import { TONE } from '@/lib/designTokens';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcomeAny } from '@/lib/followOutcome';
import {
  CALLED_AFTER_CANCEL_LABEL,
  FOLLOW_CALL_CATEGORY_LABEL,
  FOLLOW_CALL_CATEGORY_TONE,
  calledAfterCancel,
  callCategory,
  followRoundLabel,
  type FollowDayDoneKind,
  type FollowDayPerson,
} from '@/lib/followPlanning';
import { cn } from '@/lib/utils';
import { followPersonName } from '@/lib/followApi';
import { followCustomerOf } from '@/lib/followCustomer';
import { Phone } from 'lucide-react';

/** 🔴 คำ/สีเดียวกับกล่องบนแผง (7 ต.ค. 2569 — เดิม "สำเร็จ" รวมคนที่ไม่ไปด้วย) */
const KINDS: readonly FollowDayDoneKind[] = ['agreed', 'lost', 'other', 'cancelled'];
const KIND_LABEL: Record<FollowDayDoneKind, string> = {
  agreed: FOLLOW_CALL_CATEGORY_LABEL.agreed,
  lost: FOLLOW_CALL_CATEGORY_LABEL.lost,
  other: FOLLOW_CALL_CATEGORY_LABEL.other,
  cancelled: FOLLOW_CALL_CATEGORY_LABEL.cancelled,
};
const PAGE = 10;

/** ผลของคนนั้น — ผลปิดงานของสายล่าสุดที่คนปิด · ไม่มีคนปิด = ป้ายของสายที่ตัดสิน (ผลจาก AI) */
function resultOf(p: FollowDayPerson, kind: FollowDayDoneKind): string {
  const closed = p.calls
    .map((c) => c.round.entry)
    .filter((e) => e.completed_at && e.outcome_code)
    .sort((a, b) => Date.parse(b.completed_at ?? '') - Date.parse(a.completed_at ?? ''));
  const code = closed[0]?.outcome_code as FollowOutcomeAny | undefined;
  if (code) return FOLLOW_OUTCOME_LABEL[code] ?? code;
  const decisive = [...p.calls].reverse().find((c) => callCategory(c.round) === kind);
  if (decisive) return followRoundLabel(decisive.round);
  // ยกเลิกทั้งวันแต่ AI ยังโทร (12 ต.ค. 2569) — บอกให้รู้ว่าเป็นสายที่ไม่ควรโทร
  return p.calls.some((c) => calledAfterCancel(c.round)) ? `${KIND_LABEL[kind]} · ${CALLED_AFTER_CANCEL_LABEL}` : KIND_LABEL[kind];
}

/** ใครจัดการ — คนปิดงาน · ไม่มีคนปิดแต่มีผลจาก AI = "AI" · ยกเลิก = คนแก้ล่าสุด */
function whoOf(p: FollowDayPerson, kind: FollowDayDoneKind): string {
  for (const c of p.calls) {
    const e = c.round.entry;
    const who = followPersonName(e.completed_by_display, e.completed_by_name);
    if (who) return who;
  }
  if (kind !== 'cancelled') {
    for (const c of p.calls) {
      const e = c.round.entry;
      const who = followPersonName(e.staff_called_by_display, e.staff_called_by_name);
      if (who) return who;
    }
    return 'AI';
  }
  for (const c of p.calls) {
    const e = c.round.entry;
    const who = followPersonName(e.updated_by_display, e.updated_by_name);
    if (who) return who;
  }
  return '—';
}

/**
 * 🔴 7 ต.ค. 2569: แท็บตามกล่อง ตอบว่าไป / ตอบว่าไม่ไป / สรุปไม่ได้ (คนปิดแล้ว) / ยกเลิก — จบเองจากผล AI ได้ (`followDayPersonDone`)
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
  const [kind, setKind] = React.useState<FollowDayDoneKind>('agreed');
  /** วันที่จบเยอะ (วัดจริง 6 ต.ค.: 39 คน) — หน้าละ 10 คน */
  const [page, setPage] = React.useState(1);
  const counts: Record<FollowDayDoneKind, number> = { agreed: 0, lost: 0, other: 0, cancelled: 0 };
  for (const p of people) counts[p.kind] += 1;
  const ofKind = people.filter((p) => p.kind === kind);
  const pageCount = Math.max(1, Math.ceil(ofKind.length / PAGE));
  const safePage = Math.min(page, pageCount);
  const shown = ofKind.slice((safePage - 1) * PAGE, safePage * PAGE);
  /** ลูกค้า + ปุ่มโทร เฉพาะแท็บตอบว่าไป (เจ้าของ 19 ต.ค. 2569 Choice) — เจ้าของแผนโทรบอกลูกค้าตอนพนักงานเริ่มงานครั้งแรก */
  const withCustomer = kind === 'agreed';
  const cols = withCustomer ? 6 : 5;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm" data-testid="follow-day-done">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 md:px-5">
        <h3 className="mr-2 text-xs font-medium text-foreground">จบแล้ว</h3>
        {KINDS.map((k) => (
          <Button
            key={k}
            type="button"
            size="xs"
            variant={kind === k ? 'default' : 'outline'}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setPage(1);
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
              {withCustomer ? <th className="px-3 py-2 font-medium">ลูกค้า</th> : null}
              <th className="px-3 py-2 font-medium">ผล</th>
              <th className="px-3 py-2 font-medium">ใครจัดการ</th>
              <th className="px-4 py-2 md:px-5" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={cols} className="px-4 py-6 text-center text-muted-foreground md:px-5">
                  ยังไม่มีใคร
                </td>
              </tr>
            ) : (
              shown.map(({ person }) => (
                <tr key={person.row.group.key} className="border-b border-border/50 last:border-0">
                  {/* ชื่อไม่ตัดกลางคำ — จอแคบเลื่อนตารางแทน (QA รอบ 3 ข้อ 19 เดิมชื่อแตก 4–5 บรรทัด) */}
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground md:px-5">{person.row.group.name}</td>
                  <td className="min-w-32 px-3 py-2.5 text-muted-foreground">{person.row.group.unitName || '—'}</td>
                  {withCustomer ? <CustomerCell rounds={person.row.group.rounds} /> : null}
                  <td className={cn('whitespace-nowrap px-3 py-2.5', TONE[FOLLOW_CALL_CATEGORY_TONE[kind]].value)}>{resultOf(person, kind)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{whoOf(person, kind)}</td>
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
      {/* ตัวแบ่งหน้าแบบเดียวทั้งระบบ (`PagePager` · 12 ต.ค. 2569 — เดิมปุ่ม "ดูทั้งหมด") · หน้าเดียวก็ยังอยู่ */}
      <PagePager
        className="border-t border-border/70 px-4 py-2 md:px-5"
        testId="follow-day-done-pager"
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`${ofKind.length.toLocaleString('th-TH')} คน`}
      />
    </Card>
  );
}

function CustomerCell({ rounds }: { rounds: Parameters<typeof followCustomerOf>[0] }) {
  const c = followCustomerOf(rounds);
  if (!c) return <td className="px-3 py-2.5 text-muted-foreground">—</td>;
  return (
    <td className="min-w-40 px-3 py-2.5" data-testid="follow-done-customer">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-foreground">
          {c.name ?? c.contact ?? '—'}
          {c.name && c.contact ? <span className="text-muted-foreground"> · {c.contact}</span> : null}
        </span>
        {c.tel ? (
          <Button asChild size="xs" variant="outline">
            <a href={`tel:${c.tel}`} aria-label={`โทรหาลูกค้า ${c.phone}`}>
              <Phone aria-hidden />
              โทร
            </a>
          </Button>
        ) : null}
      </span>
    </td>
  );
}
