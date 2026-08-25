/**
 * KPI แถวบนหน้าหลัก — 5 ใบ พร้อมตัวเทียบ "วันนี้ vs เมื่อวาน" ของจริง
 * (Phase 10.2 · เจ้าของเคาะ 24 ส.ค. 2569: *"ทำตัวเทียบจริงเลย"*)
 *
 * 🔴 กติกาบนจอ:
 * 1. **ไม่มีของให้เทียบ = ไม่วาดลูกศร** (`delta === null`) — ห้ามโชว์ 0 ที่คนอ่านว่า
 *    "เท่าเดิม" ทั้งที่จริงคือ "ยังไม่มีข้อมูล"
 * 2. **วันเงียบไม่แปะเลข 0 ตัวโต** — เปลี่ยนเป็นคำว่า "ยังไม่มีวันนี้" (anti-pattern ข้อ 3
 *    ของแผงบอร์ด: ห้ามตัวนับที่ขึ้น 0 แทบทุกวัน)
 * 3. ทุกใบกดได้ ไปหน้างานจริงของ KPI นั้น
 * 4. สีมาจาก token เท่านั้น (`HUD`/`HUD_HEX`) — ห้าม hex ดิบ
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { HUD, HUD_HEX } from '@/lib/designTokens';
import {
  buildKpiCards,
  deltaIsGood,
  deltaText,
  type KpiCard,
  type KpiRaw,
  type StandingCard,
} from '@/lib/homeKpi';
import { cn } from '@/lib/utils';

const DeltaChip: React.FC<{ card: KpiCard }> = ({ card }) => {
  const text = deltaText(card.delta, card.isRate ? '%' : card.unit);
  if (!text) {
    // เทียบไม่ได้ — บอกตรง ๆ ว่าไม่มีของเทียบ ไม่ใช่วาดลูกศรศูนย์
    return <span className={cn(HUD.unit, 'opacity-70')}>ยังไม่มีของเทียบ</span>;
  }
  const good = deltaIsGood(card.delta);
  const color = good === null ? HUD_HEX.neutral : good ? HUD_HEX.success : HUD_HEX.danger;
  const Icon = good === null ? Minus : good ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color }}>
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
        standing ? 'xl:grid-cols-6' : 'xl:grid-cols-5',
        className,
      )}
    >
      {/* การ์ดยอดคงค้าง — ไม่มีลูกศรเทียบเมื่อวานโดยตั้งใจ (ดูเหตุผลใน homeKpi.ts) */}
      {standing ? (
        <button
          key={standing.key}
          type="button"
          onClick={() => navigate(standing.href)}
          className={cn(
            HUD.panel,
            'group min-h-[92px] rounded-xl px-3 py-2.5 text-left transition-shadow',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60',
          )}
          aria-label={`${standing.label} — ${standing.value} ${standing.unit} · ${standing.sub}`}
        >
          <span className={cn(HUD.label, 'block normal-case')}>{standing.label}</span>
          <span className="mt-1 flex items-baseline gap-1">
            <span className={HUD.figure} style={{ color: HUD_HEX.teal }}>
              {standing.value}
            </span>
            <span className={HUD.unit}>{standing.unit}</span>
          </span>
          <span
            className="mt-1 block text-[11px] font-medium"
            style={{ color: standing.alert ? HUD_HEX.danger : HUD_HEX.neutral }}
          >
            {standing.sub}
          </span>
          <span className={cn(HUD.unit, 'mt-0.5 block opacity-80')}>ยอดคงค้างตอนนี้</span>
        </button>
      ) : null}

      {cards.map((c) => {
        const accent = HUD_HEX[c.quiet ? 'neutral' : 'teal'];
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => navigate(c.href)}
            className={cn(
              HUD.panel,
              'group min-h-[92px] rounded-xl px-3 py-2.5 text-left transition-shadow',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60',
            )}
            aria-label={`${c.label} — ${c.value}${c.isRate ? '%' : ` ${c.unit}`}`}
          >
            <span className={cn(HUD.label, 'block normal-case')}>{c.label}</span>
            <span className="mt-1 flex items-baseline gap-1">
              {/* 🔴 วันเงียบห้ามแปะเลขตัวโต — อัตราที่ตัวอย่างไม่พอก็ห้ามโชว์ "0 %"
                  (คนอ่านว่าโทรไม่ติดเลย ทั้งที่จริงคือยังไม่มีสายให้คิด) */}
              {c.quiet ? (
                <span className={cn(HUD.bodyStrong, 'py-1')}>
                  {c.isRate ? 'ยังไม่พอตัดสิน' : 'ยังไม่มีวันนี้'}
                </span>
              ) : (
                <>
                  <span className={HUD.figure} style={{ color: accent }}>
                    {c.value}
                  </span>
                  <span className={HUD.unit}>{c.isRate ? '%' : c.unit}</span>
                </>
              )}
            </span>
            <span className="mt-1 block">
              <DeltaChip card={c} />
            </span>
            <span className={cn(HUD.unit, 'mt-0.5 block opacity-80')}>{c.sub}</span>
          </button>
        );
      })}
    </div>
  );
};

export default HomeKpiRow;
