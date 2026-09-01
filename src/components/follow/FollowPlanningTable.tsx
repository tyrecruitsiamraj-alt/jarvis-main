import React from 'react';
import { Building2, Pencil, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import NameAvatar from '@/components/shared/NameAvatar';
import FollowDispatchBadge from '@/components/follow/FollowDispatchBadge';
import FollowCompleteControls from '@/components/follow/FollowCompleteControls';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome, type FollowOutcomeAny } from '@/lib/followOutcome';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';
import type { FollowEntry } from '@/lib/followApi';
import {
  FOLLOW_ROUND_STATE_LABEL,
  type FollowPlanningRound,
  type FollowPlanningRow,
  type FollowRoundState,
} from '@/lib/followPlanning';
import { formatYmdDmyBe } from '@/lib/dateTh';

/**
 * ═══ ตาราง Planning (F3 · เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"เป็นเหมือน Planning เพื่อบอกว่ามีใครบ้าง และติดตามวันไหนบ้าง
 * >  และใน Planning ก็มีบอกว่าติดตามกี่รอบด้วย และเวลาไหนบ้าง"*
 *
 * **มาแทนรายการการ์ดเดิม** (เจ้าของเคาะ 1 ก.ย. 2569 — ไม่ใช่เพิ่มอีกมุมมอง
 * เพราะที่สั่งคือ "เปิดมาปุ๊บเจอ 3 หลัก ๆ" มีทั้งสองอย่างจะกลายเป็น 4 ก้อน)
 *
 * 🔴 **ปุ่มรายรอบต้องเห็นเลย ห้ามซ่อนหลังการกด** — เจ้าของตอบเอง:
 * *"เข้ามาหน้าการติดตามก็เห็นเลย"* ⇒ แก้ไข/เสร็จสิ้น/ยกเลิก อยู่ในแถวของรอบนั้น
 * เงื่อนไขปุ่มยกมาจากการ์ดเดิมทั้งชุด (server กันอีกชั้นอยู่แล้ว)
 */

/** สีของชิปเวลาแต่ละรอบ — ความหมายเดียวกับป้ายสถานะที่ใช้ทั้งระบบ */
const STATE_CHIP: Record<FollowRoundState, string> = {
  cancelled: TONE.neutral.chip,
  closed: TONE.success.chip,
  result: TONE.success.chip,
  overdue: TONE.danger.chip,
  sent: TONE.primary.chip,
  waiting: TONE.neutral.chip,
};

/**
 * คำไทยของผลการโทร — รหัสที่ยังไม่มีคำแปลให้โชว์รหัสไปตามตรง **ห้ามซ่อน**
 * (เดิมหน้านี้พ่นรหัสอังกฤษดิบขึ้นจอ ทั้งที่คำไทยมีอยู่แล้ว)
 */
function callOutcomeText(code: string): string {
  return CALL_OUTCOME_LABEL[code] ?? code;
}

const HEAD = 'px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground';
const CELL = 'px-3 py-2.5 align-top';

/** หนึ่งรอบ = หนึ่งบรรทัดในช่อง "รอบและเวลา" — ชิปเวลา + สภาพ + ปุ่มของรอบนั้น */
const RoundLine: React.FC<{
  round: FollowPlanningRound;
  busy: boolean;
  confirmingCancel: boolean;
  onAskCancel: (id: string | null) => void;
  onCancel: (id: string) => void;
  onEdit: (entry: FollowEntry) => void;
  onComplete: (id: string, outcome: FollowOutcome, note?: string) => void | Promise<void>;
}> = ({ round, busy, confirmingCancel, onAskCancel, onCancel, onEdit, onComplete }) => {
  const it = round.entry;
  const canWork = !it.cancelled && !it.completed_at;
  return (
    <li className={cn('rounded-xl bg-white/60 px-2.5 py-1.5 dark:bg-white/5', it.cancelled && 'opacity-60')}>
      {/* ซ้าย = เล่าว่ารอบนี้เป็นยังไง · ขวา = ปุ่มของรอบนั้น (ยึดขวาเสมอ ไม่ไหลลงบรรทัดใหม่) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn('tabular-nums', STATE_CHIP[round.state])}>
          {round.time ? `${round.time} น.` : 'ไม่ได้ตั้งเวลา'}
        </span>
        <span className="text-[11px] font-medium text-foreground">
          {FOLLOW_ROUND_STATE_LABEL[round.state]}
        </span>
        {round.ymd ? (
          <span className="text-[11px] text-muted-foreground">{formatYmdDmyBe(round.ymd)}</span>
        ) : null}
        {/* ป้าย "ไม่ได้ส่งให้ AI เพราะอะไร" — call_status เป็น null เมื่อไม่เคยเข้าคิว
            ถ้าไม่มีป้ายนี้จะกลายเป็นช่องว่างเปล่าที่คนอ่านว่าปกติ */}
        <FollowDispatchBadge entry={it} />
        {it.completed_at && it.outcome_code ? (
          <span
            title={it.outcome_note || undefined}
            className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE.success.chip)}
          >
            ปิดงาน: {FOLLOW_OUTCOME_LABEL[it.outcome_code as FollowOutcomeAny] ?? it.outcome_code}
          </span>
        ) : null}
        {it.staff_phone ? (
          <span className="text-[11px] text-muted-foreground">โทรกลับ {it.staff_phone}</span>
        ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {canWork ? (
            <button
              type="button"
              onClick={() => onEdit(it)}
              title="แก้ไขรอบนี้"
              className={cn(
                'inline-flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                TONE.neutral.outline,
              )}
            >
              <Pencil className="h-3 w-3" aria-hidden />
              แก้ไข
            </button>
          ) : null}
          {/* ปิดงาน — ไม่ผูกกับ call_status: ตามจนจบเองโดย AI ยังไม่โทรก็ปิดได้ */}
          {canWork ? <FollowCompleteControls busy={busy} onComplete={(o, n) => onComplete(it.id, o, n)} /> : null}
          {canWork && it.call_status === 'pending' ? (
            confirmingCancel ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCancel(it.id)}
                  className="inline-flex min-h-[32px] items-center rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                </button>
                <button
                  type="button"
                  onClick={() => onAskCancel(null)}
                  className={cn(
                    'inline-flex min-h-[32px] items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                    TONE.neutral.outline,
                  )}
                >
                  ไม่
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onAskCancel(it.id)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/50"
              >
                <X className="h-3 w-3" aria-hidden />
                ยกเลิก
              </button>
            )
          ) : null}
        </div>
      </div>
      {it.note ? <p className="mt-1 text-[11px] text-muted-foreground">{it.note}</p> : null}
      {it.call_outcome || it.call_summary ? (
        <p className="mt-1 rounded-lg bg-white/70 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-white/10 dark:text-slate-200">
          ผลการโทร{it.call_outcome ? ` — ${callOutcomeText(it.call_outcome)}` : ''}
          {it.call_summary ? `: ${it.call_summary}` : ''}
        </p>
      ) : null}
    </li>
  );
};

const FollowPlanningTable: React.FC<{
  /** 🔴 เรียง+แบ่งหน้ามาจากหน้าเรียกแล้ว (`buildFollowPlanningRows`) — ที่นี่วาดอย่างเดียว
      ถ้ามาเรียงในนี้ ลำดับจะถูกต้องแค่ในหน้าเดียว ข้ามหน้าแล้วเพี้ยน */
  rows: readonly FollowPlanningRow[];
  busyId: string | null;
  cancellingId: string | null;
  onAskCancel: (id: string | null) => void;
  onCancel: (id: string) => void;
  onEdit: (entry: FollowEntry) => void;
  onComplete: (id: string, outcome: FollowOutcome, note?: string) => void | Promise<void>;
}> = ({ rows, busyId, cancellingId, onAskCancel, onCancel, onEdit, onComplete }) => {
  return (
    <div className="glass-card overflow-x-auto rounded-2xl border border-white/70 dark:border-slate-700/70">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead className="border-b border-border/70">
          <tr>
            <th className={HEAD}>คนที่ต้องติดตาม</th>
            <th className={HEAD}>หน่วยงาน</th>
            <th className={HEAD}>ติดตามวันไหน</th>
            <th className={HEAD}>แต่ละรอบ · เวลา · ไปถึงไหนแล้ว</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const g = row.group;
            const urgent = g.rounds.find((r) => r.next_action?.urgency === 'urgent');
            return (
              <tr key={g.key} className="border-b border-border/50 last:border-0 align-top">
                <td className={cn(CELL, 'min-w-[210px]')}>
                  <div className="flex items-center gap-2">
                    <NameAvatar name={g.name} />
                    <span className="font-bold text-foreground">{g.name}</span>
                  </div>
                  <a
                    href={`tel:${g.phone}`}
                    className="mt-1 inline-flex min-h-[32px] items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
                  >
                    <Phone className="h-3 w-3" aria-hidden />
                    {g.phone}
                  </a>
                  <p className="mt-1 text-[11px] text-foreground">{g.topic}</p>
                  {g.createdByName ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">คนคีย์ {g.createdByName}</p>
                  ) : null}
                  {urgent ? (
                    <p
                      title={urgent.next_action?.reason || undefined}
                      className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300"
                    >
                      📞 โทรกลับด่วน
                    </p>
                  ) : null}
                </td>

                <td className={cn(CELL, 'min-w-[140px] text-[11px] text-muted-foreground')}>
                  {g.unitName || g.siteCode ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="font-medium text-foreground">{g.unitName || '—'}</span>
                      {g.siteCode ? <span className="font-mono">({g.siteCode})</span> : null}
                    </span>
                  ) : (
                    /* ⚠️ ไม่รู้ = "—" ห้าม fallback ไปค่าอื่น */
                    <span>—</span>
                  )}
                </td>

                <td className={cn(CELL, 'min-w-[150px]')}>
                  <div className="flex flex-wrap gap-1">
                    {row.days.length ? (
                      row.days.map((d) => (
                        <span key={d} className={cn('tabular-nums', TONE.info.chip)}>
                          {formatYmdDmyBe(d)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground">ยังไม่ได้ตั้งวัน</span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    ติดตาม <span className="font-bold tabular-nums text-foreground">{row.roundCount}</span> รอบ
                    {row.openCount > 0 ? ` · ยังต้องตามอีก ${row.openCount}` : ' · ตามครบแล้ว'}
                    {g.todayOrdinal != null ? ` · วันนี้คือรอบที่ ${g.todayOrdinal}` : ''}
                  </p>
                </td>

                <td className={cn(CELL, 'min-w-[380px]')}>
                  <ul className="space-y-1.5">
                    {row.rounds.map((r) => (
                      <RoundLine
                        key={r.entry.id}
                        round={r}
                        busy={busyId === r.entry.id}
                        confirmingCancel={cancellingId === r.entry.id}
                        onAskCancel={onAskCancel}
                        onCancel={onCancel}
                        onEdit={onEdit}
                        onComplete={onComplete}
                      />
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FollowPlanningTable;
