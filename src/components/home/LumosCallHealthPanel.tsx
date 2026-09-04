import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import {
  lumosConnectRate,
  lumosLinkStatus,
  lumosOutcomeSlices,
  lumosOutcomeTotal,
} from '@/lib/lumosLinkHealth';
import type { FlowSummary } from '@/lib/flowSummaryApi';
import { PhoneCall, RefreshCw, TriangleAlert, Users } from 'lucide-react';

/**
 * แผง "ผลโทรจาก AI" บนหน้าหลัก (เจ้าของสั่ง 13 ส.ค. 2569: "ดูว่าเขาส่งผลลัพมาไหม
 * ส่งไปกี่คน โทรไปกี่คน ผลเป็นยังไง ฯลฯ คิดต่อเอาให้ครบ คนทำงานทำงานง่าย")
 *
 * เรียงตามคำถามที่เจ้าหน้าที่ถามจริงเวลาเปิดหน้ามาตอนเช้า:
 *   1. สายยังเดินอยู่ไหม (แถบสถานะบนสุด — ตัวเดียวที่เปลี่ยนสีเตือนได้)
 *   2. ส่งไปเท่าไหร่ / กี่คน / โทรไปกี่สาย / ค้างเท่าไหร่
 *   3. ผลออกมาเป็นยังไง แยกทุกแบบ + โทรติดกี่ %
 *   4. อะไรต้องทำต่อ (ปุ่มลัดไปที่รายชื่อ)
 *
 * ⚠️ ตัวเลขทั้งแผงจำกัด "ใบขอเปิดอยู่ของ BU ตัวเอง" ตาม flow-summary
 * (ต่างจาก /api/lumos/call-funnel ที่เป็นยอดทั้งระบบ) — จงใจไม่เอาสองเส้นมาวางคู่กัน
 * เพราะเลขจะไม่ตรงแล้วเจ้าหน้าที่จะไม่เชื่อทั้งสองตัว (เคยเกิดมาแล้ว 10 ส.ค. 2569)
 */
export default function LumosCallHealthPanel({
  flow,
  nowMs,
  onOpenWaiting,
  onOpenResults,
}: {
  flow: FlowSummary;
  /** เวลาปัจจุบัน — รับจากหน้าเพื่อให้คำนวณครั้งเดียวและเทสต์คุมได้ */
  nowMs: number;
  onOpenWaiting: () => void;
  onOpenResults: () => void;
}) {
  const l = flow.lumos;
  const waiting = l.waiting_call + l.delivered_waiting;
  const link = lumosLinkStatus({
    lastResultAt: l.last_result_at,
    lastSentAt: l.last_sent_at,
    waiting,
    nowMs,
  });
  const slices = lumosOutcomeSlices(l.outcomes_month);
  const resultTotal = lumosOutcomeTotal(l.outcomes_month);
  const connect = lumosConnectRate(l.outcomes_month);
  const stuck = (l.stale_delivered ?? 0) + (l.stale_pending ?? 0);

  const stats: { label: string; value: number; hint: string; tone?: 'warn' | 'danger' }[] = [
    { label: 'ส่งเดือนนี้', value: l.sent_month, hint: 'จำนวนสายที่เข้าคิว (คน × ใบขอ)' },
    {
      label: 'เป็นคน',
      value: l.sent_month_people ?? 0,
      hint: 'นับหัวคนจริง — คนเดียวถูกเสนอได้หลายใบ เลขนี้จึงน้อยกว่าด้านซ้ายเสมอ',
    },
    { label: 'โทรออกจริง', value: l.attempts_month ?? 0, hint: 'รวมการโทรซ้ำทุกรอบ' },
    { label: 'ได้ผลกลับ', value: resultTotal, hint: 'ผลโทรที่ Lumos ส่งกลับมาเดือนนี้ (ไม่นับที่ยกเลิก)' },
    { label: 'รออยู่', value: waiting, hint: 'ส่งไปแล้วยังไม่มีผลกลับ' },
    {
      label: 'ค้างเกิน 2 วัน',
      value: stuck,
      hint: 'ส่งไปแล้วเงียบเกิน 2 วัน — ควรเช็คกับทีม Lumos',
      tone: stuck > 0 ? 'danger' : undefined,
    },
  ];

  return (
    <section className="space-y-2.5 rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <PhoneCall className="h-4 w-4 text-primary" />
          ผลโทรจาก AI (Lumos)
        </h2>
        <span className="text-[10px] text-muted-foreground">
          เดือนนี้ · เฉพาะใบขอที่เปิดอยู่ของแผนกคุณ
        </span>
      </div>

      {/* 1. สายยังเดินอยู่ไหม — คำถามแรกที่เดิมไม่มีที่ไหนตอบได้เลย */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2',
          TONE[link.tone].soft,
        )}
      >
        {link.level === 'stalled' ? (
          <TriangleAlert className={cn('h-4 w-4 shrink-0', TONE.danger.value)} />
        ) : (
          <RefreshCw className={cn('h-4 w-4 shrink-0', TONE[link.tone].value)} />
        )}
        <span className={cn('text-[12px] font-semibold', TONE[link.tone].value)}>{link.label}</span>
        <span className="min-w-0 text-[11px] text-muted-foreground">{link.detail}</span>
        {l.last_result_at ? (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {formatDateTimeTh(l.last_result_at)}
          </span>
        ) : null}
      </div>

      {/* 2. ตัวเลขหลัก 6 ช่องคงที่ — จำนวนช่องไม่เปลี่ยนตามข้อมูล (กติกาเดียวกับการ์ดใบขอ) */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            title={s.hint}
            className="rounded-xl bg-slate-900/[0.03] px-2 py-1.5 text-center dark:bg-white/[0.06]"
          >
            <div
              className={cn(
                'text-[17px] font-semibold leading-tight tabular-nums tracking-tight',
                s.value === 0
                  ? 'text-slate-400 dark:text-slate-500'
                  : s.tone === 'danger'
                    ? TONE.danger.value
                    : 'text-foreground',
              )}
            >
              {s.value.toLocaleString('th-TH')}
            </div>
            <div className="text-[10px] leading-tight text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 3. ผลออกมาเป็นยังไง — แจกแจงครบทุกแบบที่มีค่า เลขย่อยบวกได้เท่า "ได้ผลกลับ" เสมอ */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-foreground">
            ผลที่กลับมา {resultTotal.toLocaleString('th-TH')} สาย
          </span>
          <span className="text-[11px] text-muted-foreground">
            โทรติด{' '}
            {connect.percent === null ? (
              <b className="text-muted-foreground">—</b>
            ) : (
              <b className={cn('tabular-nums', TONE.primary.value)}>{connect.percent}%</b>
            )}{' '}
            <span className="text-[10px]">
              (คุยได้ {connect.connected.toLocaleString('th-TH')} · ไม่ติด{' '}
              {connect.unreached.toLocaleString('th-TH')})
            </span>
          </span>
        </div>
        {slices.length > 0 ? (
          <>
            {/* แถบสัดส่วน — ดูปุ๊บรู้ว่าผลเทไปทางไหน โดยไม่ต้องอ่านเลข */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
              {slices.map((s) => (
                <div
                  key={s.outcome}
                  title={`${s.label} ${s.value} (${s.percent}%)`}
                  style={{ width: `${s.percent}%` }}
                  // ⚠️ ใช้ `dot` (สีอิ่มล้วน ใช้สีเดียวทั้งสองธีม) ไม่ใช่ `bar`
                  // — `bar` คือสีของ "ขีดบนการ์ด" ซึ่งเป็น border-top ไม่ใช่พื้น
                  //   ใส่ไปแล้วแถบจะโปร่งใสทั้งเส้นโดยไม่มี error อะไรเลย
                  className={cn('h-full', TONE[s.tone].dot)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {slices.map((s) => (
                <span key={s.outcome} className={cn(TONE[s.tone].chip, 'tabular-nums')}>
                  {s.label} {s.value.toLocaleString('th-TH')}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-slate-900/[0.03] px-2.5 py-2 text-[11px] text-muted-foreground dark:bg-white/[0.06]">
            ยังไม่มีผลโทรกลับมาเดือนนี้ — ส่งคนให้ AI โทรจากหน้า Matching แล้วผลจะมาโชว์ที่นี่
          </p>
        )}
      </div>

      {/* 4. ทำอะไรต่อ — ลัดไปที่รายชื่อจริง ไม่ใช่แค่ดูเลข */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 🔴 ใช้ Button ของ shadcn — คลาส `jarvis-btn-*` เป็นปุ่มที่ปั้นเองใน CSS
            ซึ่งขัดกติกา UI ของโปรเจกต์ (เจ้าของย้ำ 3 ก.ย. 2569) */}
        <Button type="button" variant="secondary" size="sm" onClick={onOpenResults}>
          ดูรายชื่อตามผลโทร
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenWaiting}>
          <Users aria-hidden /> ดูคนที่รอผล ({waiting.toLocaleString('th-TH')})
        </Button>
        {(l.retry_scheduled ?? 0) > 0 ? (
          <span className={cn(TONE.warn.chip, 'tabular-nums')}>
            ตั้งโทรซ้ำไว้ {(l.retry_scheduled ?? 0).toLocaleString('th-TH')}
          </span>
        ) : null}
        {(flow.call_boxes.needs_human?.length ?? 0) > 0 ? (
          <span className={cn(TONE.orange.chip, 'tabular-nums')}>
            ต้องคนตาม {flow.call_boxes.needs_human.length.toLocaleString('th-TH')}
          </span>
        ) : null}
      </div>
    </section>
  );
}
