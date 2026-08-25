/**
 * สามแผงล่างของหน้าหลัก (Phase 10.2 — ตามภาพอ้างอิงที่เจ้าของส่งมา 24 ส.ค. 2569)
 *
 * อัปเดตล่าสุด · ผลงานเด่นประจำวัน · ผลโทรเดือนนี้
 *
 * 🔴 แผงที่ไม่มีของต้องบอกด้วย **คำ** ว่าว่าง ไม่ใช่แถวเลข 0 เรียงกัน
 * (anti-pattern ข้อ 3 ของแผงบอร์ด) · ตรรกะจัดเรียง/นับอยู่ใน `src/lib/homeDigest.ts`
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import HudPanel from '@/components/hud/HudPanel';
import { HUD, HUD_HEX } from '@/lib/designTokens';
import {
  agoText,
  barPct,
  dailyLeaders,
  digestRows,
  latestUpdates,
  type DeskTodayLike,
} from '@/lib/homeDigest';
import { CALL_OUTCOME_LABEL, CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { cn } from '@/lib/utils';
import type { DeskId } from '@/lib/officeFloor';

/** ลิงก์ของแต่ละโต๊ะ — ใช้ตัวเดียวกับที่ฉากห้องทำงานใช้ ห้ามตั้งเส้นทางใหม่ */
const DESK_HREF: Record<DeskId, string> = {
  intake: '/recruit/rm',
  aiCalls: '/recruit/rm?tab=calls',
  selection: '/matching/match',
  follow: '/follow',
  content: '/jobs/board?view=postings',
  aftercare: '/aftercare',
};

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className={cn(HUD.body, 'py-6 text-center')}>{children}</p>
);

export type HomeDigestPanelsProps = {
  deskToday: Record<string, DeskTodayLike> | null;
  /** ผลโทรเดือนนี้แยกตามคำตอบ — มาจาก flow-summary ที่หน้าแรกโหลดอยู่แล้ว */
  outcomesMonth?: Record<string, number> | null;
  className?: string;
};

export const HomeDigestPanels: React.FC<HomeDigestPanelsProps> = ({
  deskToday,
  outcomesMonth,
  className,
}) => {
  const navigate = useNavigate();
  const rows = React.useMemo(() => digestRows(deskToday), [deskToday]);
  /**
   * นาฬิกาอ่าน **ครั้งเดียวต่อการเรนเดอร์** แล้วส่งต่อให้ทุกแถว
   * ⚠️ ห้ามให้แต่ละแถวเรียก `new Date()` เอง — สองแถวจะคิดเวลาต่างกันเสี้ยววินาที
   * แล้ว "3 นาทีที่แล้ว" กับ "2 นาทีที่แล้ว" โผล่คู่กันในแผงเดียวโดยไม่มีเหตุผล
   */
  const now = new Date();
  const updates = React.useMemo(() => latestUpdates(rows), [rows]);
  const leaders = React.useMemo(() => dailyLeaders(rows), [rows]);

  const outcomes = React.useMemo(() => {
    const src = outcomesMonth ?? {};
    return Object.entries(src)
      .filter(([, v]) => Number(v) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5);
  }, [outcomesMonth]);
  const outcomeMax = Math.max(...outcomes.map(([, v]) => Number(v)), 0);

  return (
    <div className={cn('grid gap-3 lg:grid-cols-3', className)}>
      {/* ── 1. อัปเดตล่าสุด ── */}
      <HudPanel eyebrow="อัปเดตล่าสุด" title="โต๊ะไหนขยับล่าสุด">
        {updates.length === 0 ? (
          <Empty>วันนี้ยังไม่มีโต๊ะไหนขยับ</Empty>
        ) : (
          <ul className="space-y-1.5">
            {updates.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => navigate(DESK_HREF[r.id])}
                  className={cn(
                    HUD.inner,
                    HUD.innerHover,
                    'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left',
                  )}
                >
                  <span className="min-w-0">
                    <span className={cn(HUD.bodyStrong, 'block truncate')}>{r.name}</span>
                    <span className={cn(HUD.unit, 'block')}>
                      วันนี้ {r.count} {r.unit}
                    </span>
                  </span>
                  <span className={cn(HUD.unit, 'shrink-0 whitespace-nowrap')}>
                    {agoText(r.lastAt, now)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </HudPanel>

      {/* ── 2. ผลงานเด่นประจำวัน ── */}
      <HudPanel eyebrow="ผลงานเด่นประจำวัน" title="ใครทำได้มากสุดวันนี้">
        {leaders.length === 0 ? (
          <Empty>วันนี้ยังไม่มีผลงานเข้ามา</Empty>
        ) : (
          <ol className="space-y-2">
            {leaders.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <span
                  className="w-4 shrink-0 font-mono text-[11px] tabular-nums"
                  style={{ color: HUD_HEX.teal }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn(HUD.body, 'truncate')}>{r.name}</span>
                    <span className="shrink-0 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold tabular-nums text-white">
                        {r.count}
                      </span>
                      <span className={cn('ml-1', HUD.unit)}>{r.unit}</span>
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${barPct(r.count, leaders)}%`,
                        background: HUD_HEX.teal,
                      }}
                    />
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </HudPanel>

      {/* ── 3. ผลโทรเดือนนี้ ── */}
      <HudPanel eyebrow="ผลโทรเดือนนี้" title="คนปลายสายตอบว่าอะไร">
        {outcomes.length === 0 ? (
          <Empty>เดือนนี้ยังไม่มีผลโทรกลับ</Empty>
        ) : (
          <ul className="space-y-2">
            {outcomes.map(([code, v]) => {
              const tone = CALL_OUTCOME_TONE[code as keyof typeof CALL_OUTCOME_TONE] ?? 'neutral';
              const color = HUD_HEX[tone];
              const pct = outcomeMax > 0 ? Math.max(4, Math.round((Number(v) / outcomeMax) * 100)) : 0;
              return (
                <li key={code}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn(HUD.body, 'truncate')}>
                      {CALL_OUTCOME_LABEL[code as keyof typeof CALL_OUTCOME_LABEL] ?? code}
                    </span>
                    <span className="shrink-0 whitespace-nowrap">
                      <span
                        className="font-mono text-sm font-semibold tabular-nums"
                        style={{ color }}
                      >
                        {Number(v)}
                      </span>
                      <span className={cn('ml-1', HUD.unit)}>สาย</span>
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </HudPanel>
    </div>
  );
};

export default HomeDigestPanels;
