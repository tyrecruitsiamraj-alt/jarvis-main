import React from 'react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { DashboardRecruiterOverview, DashboardResponsibleRole } from '@/lib/dashboard/types';

type Props = {
  items: DashboardRecruiterOverview[];
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
  hideHeader?: boolean;
  /**
   * โหมด "ทั้งหมด" ไม่ดึงชุดใบปิด (ใช้ throughput แทน) — ยอด "ปิด" จึงยังไม่รู้ ไม่ใช่ศูนย์
   * false = โชว์ "—" แทนเลข 0 เพื่อไม่ให้อ่านว่าคนนั้นปิดงานไม่ได้เลย
   */
  closedTotalsAvailable?: boolean;
  /** โหมด "ทั้งหมด" กำลังดึงชุดใบปิดอยู่ — บอกให้รู้ว่ากำลังมา ไม่ใช่ไม่มี */
  closedTotalsLoading?: boolean;
};

/** ลำดับคอลัมน์ — สรรหาก่อน แล้วคัดสรร (ตามลำดับงานจริง) */
const ROLE_ORDER: DashboardResponsibleRole[] = ['recruiter', 'screener'];

const ROLE_LABELS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'สรรหา',
  screener: 'คัดสรร',
};

const ROLE_BADGE_CLASS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
  screener: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300',
};

const DashboardDriverOverview: React.FC<Props> = ({
  items,
  onRecruiterClick,
  hideHeader = false,
  closedTotalsAvailable = true,
  closedTotalsLoading = false,
}) => {
  if (items.length === 0) {
    return (
      <div className={cn(DASH.card, 'p-6 text-sm', DASH.sub)}>
        {!hideHeader ? (
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">ภาระงานตามผู้รับผิดชอบ</h3>
        ) : null}
        ยังไม่มีข้อมูลภาระงานตามผู้รับผิดชอบ
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">ภาระงานตามผู้รับผิดชอบ</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">มี · ปิด · คงเหลือ รายบุคคล (สรรหา / คัดสรร)</p>
        </div>
      ) : null}
      {closedTotalsLoading ? (
        <p className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          กำลังดึงยอด <span className="font-medium">ปิด</span> ของทั้งช่วง… (ใบปิดย้อนหลังมีหลายพันใบ ใช้เวลาสักครู่)
        </p>
      ) : !closedTotalsAvailable ? (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          ยอด <span className="font-medium">ปิด</span> ยังไม่ได้ดึง — กางแผงนี้ค้างไว้สักครู่ หรือเลือกช่วงเวลาเพื่อให้ดึงเร็วขึ้น
        </p>
      ) : null}
      {/* แยกคอลัมน์ตามหน้าที่ — เดิมการ์ดสรรหา/คัดสรรเรียงปนกันในกริดเดียว ดูรายคนของหน้าที่เดียวไม่ได้
          และ slice(0,12) รวมทั้งสองหน้าที่ ทำให้บางหน้าที่หายไปทั้งชุดถ้าอีกฝั่งคนเยอะ
          ตอนนี้ตัด 12 คนต่อคอลัมน์ และบอกจำนวนที่ไม่ได้โชว์ไว้ท้ายคอลัมน์ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ROLE_ORDER.map((role) => {
          const people = items.filter((r) => r.role === role);
          const shown = people.slice(0, 12);
          const hidden = people.length - shown.length;
          return (
            <div key={role} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold', ROLE_BADGE_CLASS[role])}>
                  {ROLE_LABELS[role]}
                </span>
                <span className={cn('text-[11px]', DASH.muted)}>
                  {people.length.toLocaleString('th-TH')} คน · คงเหลือรวม{' '}
                  {people.reduce((sum, r) => sum + r.remaining, 0).toLocaleString('th-TH')}
                </span>
              </div>
              {people.length === 0 ? (
                <p className={cn('rounded-xl border border-dashed px-3 py-4 text-center text-xs', DASH.divider, DASH.muted)}>
                  ยังไม่มีข้อมูลของ{ROLE_LABELS[role]}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {shown.map((r) => (
                    <button
                      key={`${r.role}:${r.name}`}
                      type="button"
                      onClick={() => onRecruiterClick?.(r.name, r.role)}
                      disabled={!onRecruiterClick}
                      className={cn(
                        DASH.card,
                        'w-full p-3 text-left transition-colors',
                        onRecruiterClick
                          ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/30'
                          : 'cursor-default',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('min-w-0 truncate text-sm font-semibold', DASH.cellStrong)}>{r.name}</p>
                        <span className={cn('shrink-0 text-xs font-medium', DASH.muted)}>{r.sharePercent}%</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className={cn('text-base font-semibold tabular-nums', DASH.cellStrong)}>{r.total}</p>
                          <p className={cn('text-[10px]', DASH.muted)}>มี</p>
                        </div>
                        <div>
                          {closedTotalsAvailable ? (
                            <p className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {r.completed}
                            </p>
                          ) : (
                            <p
                              className="text-base font-semibold tabular-nums text-slate-300 dark:text-slate-600"
                              title="ยังไม่รู้ — เลือกช่วงเวลาเพื่อดูยอดปิด"
                            >
                              —
                            </p>
                          )}
                          <p className={cn('text-[10px]', DASH.muted)}>ปิด</p>
                        </div>
                        <div>
                          <p
                            className={cn(
                              'text-base font-semibold tabular-nums',
                              r.remaining > 0 ? 'text-amber-600 dark:text-amber-400' : DASH.cellStrong,
                            )}
                          >
                            {r.remaining}
                          </p>
                          <p className={cn('text-[10px]', DASH.muted)}>คงเหลือ</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {hidden > 0 ? (
                <p className={cn('text-[11px]', DASH.muted)}>…และอีก {hidden.toLocaleString('th-TH')} คน</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardDriverOverview;
