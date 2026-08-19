import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { LeadKindBreakdown } from '@/lib/dashboard/leadKindBreakdown';
import { REQUEST_LEAD_KIND_TONE, type RequestLeadKind } from '@/lib/requestLeadKind';
import { REQUEST_LEAD_KIND_HINT } from '@/lib/requestLeadKind';

/**
 * กราฟ **ทั้งหมด / ฉุกเฉิน / ล่วงหน้า** ของใบขอในช่วงที่กรองอยู่
 * (เจ้าของสั่ง 18 ส.ค. 2569: *"เพิ่มกราฟให้หน่อยเพื่อดูว่าทั้งหมดเท่าไหร่
 * ฉุกเฉิน ล่วงหน้าเท่าไหร่ · ข้อมูลต้องเปลี่ยนตาม Filter · เช็คด้วยว่าข้อมูลตรง ถูกต้องไหม"*)
 *
 * 🔴 **เลขมาจาก `throughputRecords` ชุดเดียวกับการ์ด KPI** — เปลี่ยนตามช่วงวันที่/BU เอง
 * และมี `mismatchNote` คอยเทียบกับการ์ด「เข้ามา」ให้ทุกครั้ง ไม่ตรงเมื่อไหร่ขึ้นข้อความทันที
 *
 * สีตามความเร่งด่วน: แดง = ขอย้อนหลัง · เหลือง = ฉุกเฉิน · เขียว = ล่วงหน้า (วางแผนทัน)
 */

/** ⚠️ สีย้ายไปอยู่ที่ `REQUEST_LEAD_KIND_TONE` (lib/requestLeadKind) แล้ว — ห้ามประกาศซ้ำที่นี่ */
const KIND_TONE = REQUEST_LEAD_KIND_TONE;

export type DashboardLeadKindChartProps = {
  breakdown: LeadKindBreakdown;
  /** ช่วงที่กรองอยู่ — โชว์ให้รู้ว่ากราฟนี้พูดถึงช่วงไหน */
  scopeLabel: string;
  /** ข้อความเตือนเมื่อเลขไม่ตรงกับการ์ด · null = ตรงดี */
  mismatchNote?: string | null;
  onSliceClick?: (kind: RequestLeadKind, label: string) => void;
};

const DashboardLeadKindChart: React.FC<DashboardLeadKindChartProps> = ({
  breakdown,
  scopeLabel,
  mismatchNote,
  onSliceClick,
}) => {
  const { totalPositions, totalRequests, slices, positionsWithoutRequestNo } = breakdown;
  // แท่งยาวสุด = 100% ของความกว้าง เพื่อให้เทียบกันได้เมื่อยอดรวมน้อย
  const maxPositions = slices.reduce((m, s) => Math.max(m, s.positions), 0);

  return (
    <div className={cn('rounded-2xl border p-4', DASH.card)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className={cn('text-sm font-bold', DASH.cellStrong)}>ใบขอเร่งด่วนแค่ไหน</p>
          <p className={cn('text-[11px]', DASH.muted)}>
            แบ่งตามระยะเวลาที่ให้หา — ตามช่วง {scopeLabel} · เปลี่ยนตามตัวกรองทุกตัว
          </p>
        </div>
        <p className={cn('text-[11px]', DASH.muted)}>
          ทั้งหมด{' '}
          <span className={cn('text-base font-bold tabular-nums', DASH.cellStrong)}>
            {totalPositions.toLocaleString('th-TH')}
          </span>{' '}
          อัตรา ·{' '}
          <span className="font-bold tabular-nums">{totalRequests.toLocaleString('th-TH')}</span> ใบขอ
        </p>
      </div>

      <ul className="space-y-2">
        {slices.map((s) => {
          const tone = TONE[KIND_TONE[s.kind]];
          const width = maxPositions > 0 ? Math.max(2, (s.positions / maxPositions) * 100) : 0;
          const clickable = Boolean(onSliceClick) && s.positions > 0;
          return (
            <li key={s.kind}>
              <button
                type="button"
                disabled={!clickable}
                title={REQUEST_LEAD_KIND_HINT[s.kind]}
                onClick={() => onSliceClick?.(s.kind, s.label)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  s.positions > 0 ? tone.soft : TONE.neutral.soft,
                  clickable ? cn(tone.softHover, 'cursor-pointer') : 'cursor-default',
                )}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                    <span className={cn('text-xs font-bold', tone.value)}>{s.label}</span>
                  </span>
                  <span className={cn('text-[11px]', DASH.muted)}>
                    <span className={cn('text-base font-bold tabular-nums', tone.num)}>
                      {s.positions.toLocaleString('th-TH')}
                    </span>{' '}
                    อัตรา · {s.requests.toLocaleString('th-TH')} ใบ ·{' '}
                    <span className="tabular-nums">{s.percent}%</span>
                  </span>
                </span>
                {/* แท่งกราฟ — ความยาวเทียบกับถังที่มากสุด ไม่ใช่เทียบ 100% ของยอดรวม
                    (ยอดรวมน้อย ๆ แล้วแท่งจิ๋วทั้งสามอันอ่านไม่ออกว่าอันไหนมากกว่า) */}
                <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                  <span
                    className={cn('block h-full rounded-full', tone.solid)}
                    style={{ width: `${width}%` }}
                    aria-hidden
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 🔴 ห้ามเงียบเมื่อเลขไม่ตรง — เจ้าของสั่งให้เช็คว่าข้อมูลถูกไหม
          แต่ "ถูกกรองแล้ว" ไม่ใช่ความผิดพลาด → ขึ้นเป็นหมายเหตุเฉย ๆ ไม่ใช่คำเตือน */}
      {mismatchNote ? (
        mismatchNote.startsWith('กรองตามตัวกรอง') ? (
          <p className={cn('mt-2 rounded-lg px-2.5 py-1.5 text-[11px]', TONE.info.soft, TONE.info.value)}>
            {mismatchNote}
          </p>
        ) : (
          <p className={cn('mt-2 rounded-lg px-2.5 py-1.5 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
            ⚠️ ตัวเลขไม่ตรงกัน: {mismatchNote}
          </p>
        )
      ) : (
        <p className={cn('mt-2 text-[10px]', DASH.muted)}>
          ผลรวมสามถัง = ยอด「เข้ามา」ของช่วงเดียวกันเป๊ะ · ล่วงหน้า = ให้เวลาหา 7 วันขึ้นไป
          {positionsWithoutRequestNo > 0
            ? ` · อีก ${positionsWithoutRequestNo.toLocaleString('th-TH')} อัตราไม่มีเลขที่ใบ (นับในยอดแต่ลิสต์รายใบไม่ได้)`
            : ''}
        </p>
      )}
    </div>
  );
};

export default DashboardLeadKindChart;
