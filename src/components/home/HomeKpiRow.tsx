/**
 * KPI แถวบนหน้าหลัก — ยอดคงค้าง 1 ใบ + เหตุการณ์ 8 ใบ พร้อมตัวเทียบ "วันนี้ vs เมื่อวาน"
 * (Phase 10.2 · เจ้าของเคาะ 24 ส.ค. 2569: *"ทำตัวเทียบจริงเลย"*)
 *
 * 🔴 กติกาบนจอ:
 * 1. **ไม่มีของให้เทียบ = ไม่วาดลูกศร** (`delta === null`) — ห้ามโชว์ 0 ที่คนอ่านว่า
 *    "เท่าเดิม" ทั้งที่จริงคือ "ยังไม่มีข้อมูล"
 * 2. **วันเงียบไม่แปะเลข 0 ตัวโต** — เปลี่ยนเป็นคำว่า "ยังไม่มีวันนี้" (anti-pattern ข้อ 3
 *    ของแผงบอร์ด: ห้ามตัวนับที่ขึ้น 0 แทบทุกวัน)
 * 3. ทุกใบกดได้ ไปหน้างานจริงของ KPI นั้น
 * 4. สีมาจาก token เท่านั้น (`DASH`/`TONE`) — ห้าม hex ดิบ
 *
 * 🔴 **โทนสว่าง** (เจ้าของสั่ง 27 ส.ค. 2569: *"แก้สีเป็น Tone สว่างด้วย"*)
 * เดิมใช้ชุด `HUD` ซึ่งเป็นแผงพื้นดำเข้มทั้งสองธีมโดยตั้งใจ ⇒ กลายเป็นแถบดำ
 * โดดอยู่กลางหน้าแรกที่เป็นโทนสว่างทั้งหน้า · ตอนนี้ใช้ `DASH`/`TONE` ซึ่งมีคู่
 * light/dark ครบเหมือนบอร์ดทีมข้างบน
 * ⚠️ ห้ามเติม `dark:` เข้าชุด HUD_* เพื่อแก้ปัญหานี้ — เทสต์ designTokens ห้ามไว้
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { DASH, TONE } from '@/lib/designTokens';
import {
  buildKpiCards,
  deltaIsGood,
  deltaText,
  type KpiCard,
  type KpiRaw,
  type StandingCard,
} from '@/lib/homeKpi';
import { cn } from '@/lib/utils';

/**
 * 🔴 **การ์ดเป็น `Card` ของ shadcn** (4 ก.ย. 2569 — เจ้าของสั่งปรับหน้าหลักให้เป็น
 * มาตรฐานโดยใช้ shadcn คุม) · ของเดิมประกาศชุดคลาสการ์ดเอง (กรอบ/พื้น/เงา/hover
 * พร้อมคู่ `dark:` ทุกตัว) ⇒ เป็นการ์ดคนละใบกับแผงอื่นบนหน้าเดียวกัน
 * เหลือไว้เฉพาะ **ขนาดตัวอักษร** ซึ่งเป็น utility ล้วน ไม่ใช่การปั้นเปลือกการ์ด
 */
const LABEL = 'block text-[11px] font-medium text-muted-foreground';
const FIGURE = 'text-2xl font-semibold tabular-nums';
const UNIT = 'text-[11px] text-muted-foreground';

/** การ์ด KPI ที่กดได้ — Card ของ shadcn ห่อด้วยปุ่มเพื่อให้กดทั้งใบและโฟกัสได้ */
const KpiCardShell: React.FC<{
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}> = ({ onClick, ariaLabel, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Card className="h-full min-h-[92px] transition-colors hover:bg-accent/40">
      <CardContent className="px-3 py-2.5">{children}</CardContent>
    </Card>
  </button>
);

const DeltaChip: React.FC<{ card: KpiCard }> = ({ card }) => {
  const text = deltaText(card.delta, card.isRate ? '%' : card.unit);
  if (!text) {
    // เทียบไม่ได้ — บอกตรง ๆ ว่าไม่มีของเทียบ ไม่ใช่วาดลูกศรศูนย์
    return <span className={cn(UNIT, 'opacity-70')}>ยังไม่มีของเทียบ</span>;
  }
  const good = deltaIsGood(card.delta);
  const tone = good === null ? TONE.neutral.value : good ? TONE.success.value : TONE.danger.value;
  const Icon = good === null ? Minus : good ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', tone)}>
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  );
};

export type HomeKpiRowProps = {
  kpis: KpiRaw;
  /** การ์ดยอดคงค้าง (ไม่มีตัวเทียบเมื่อวาน) — วางเป็นใบแรกของแถว */
  standing?: StandingCard | null;
  className?: string;
};

export const HomeKpiRow: React.FC<HomeKpiRowProps> = ({ kpis, standing, className }) => {
  const navigate = useNavigate();
  const cards = React.useMemo(() => buildKpiCards(kpis), [kpis]);
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:gap-3',
        // 9 ใบ (ยอดคงค้าง 1 + เหตุการณ์ 8) — แถวละ 5 บนจอกว้าง
        'xl:grid-cols-5',
        className,
      )}
    >
      {/* การ์ดยอดคงค้าง — ไม่มีลูกศรเทียบเมื่อวานโดยตั้งใจ (ดูเหตุผลใน homeKpi.ts) */}
      {standing ? (
        <KpiCardShell
          key={standing.key}
          onClick={() => navigate(standing.href)}
          ariaLabel={`${standing.label} — ${standing.value} ${standing.unit} · ${standing.sub}${standing.sla ? ` · ${standing.sla}` : ''}`}
        >
          <span className={LABEL}>{standing.label}</span>
          <span className="mt-1 flex items-baseline gap-1">
            <span className={cn(FIGURE, DASH.cellStrong)}>{standing.value}</span>
            <span className={UNIT}>{standing.unit}</span>
          </span>
          <span
            className={cn(
              'mt-1 block text-[11px] font-medium',
              standing.alert ? TONE.danger.value : DASH.muted,
            )}
          >
            {standing.sub}
          </span>
          {/* 🔴 SLA โชว์คู่กันเสมอ (หลุดแล้ว + ใกล้หลุด) — ตัวเดียวทำให้เข้าใจผิด
              ไม่รู้ตัวเลข = ไม่วาดบรรทัดนี้ ไม่ใช่วาด 0 */}
          {standing.sla ? (
            <span className={cn('mt-0.5 block text-[11px] font-medium', TONE.danger.value)}>
              {standing.sla}
            </span>
          ) : null}
          <span className={cn(UNIT, 'mt-0.5 block')}>ยอดคงค้างตอนนี้ (ไม่ใช่ของวันนี้)</span>
        </KpiCardShell>
      ) : null}

      {cards.map((c) => {
        const accent = c.quiet ? DASH.muted : DASH.cellStrong;
        return (
          <KpiCardShell
            key={c.key}
            onClick={() => navigate(c.href)}
            ariaLabel={`${c.label} — ${c.value}${c.isRate ? '%' : ` ${c.unit}`}`}
          >
            <span className={LABEL}>{c.label}</span>
            <span className="mt-1 flex items-baseline gap-1">
              {/* 🔴 วันเงียบห้ามแปะเลขตัวโต — อัตราที่ตัวอย่างไม่พอก็ห้ามโชว์ "0 %"
                  (คนอ่านว่าโทรไม่ติดเลย ทั้งที่จริงคือยังไม่มีสายให้คิด) */}
              {c.quiet ? (
                <span className={cn('py-1 text-xs font-medium', DASH.cell)}>
                  {c.isRate ? 'ยังไม่พอตัดสิน' : 'ยังไม่มีวันนี้'}
                </span>
              ) : (
                <>
                  <span className={cn(FIGURE, accent)}>{c.value}</span>
                  <span className={UNIT}>{c.isRate ? '%' : c.unit}</span>
                </>
              )}
            </span>
            <span className="mt-1 block">
              <DeltaChip card={c} />
            </span>
            <span className={cn(UNIT, 'mt-0.5 block')}>{c.sub}</span>
          </KpiCardShell>
        );
      })}
    </div>
  );
};

export default HomeKpiRow;
