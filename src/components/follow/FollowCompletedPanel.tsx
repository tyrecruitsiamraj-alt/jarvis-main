import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { FollowGroup } from '@/lib/followGrouping';
import {
  COMPLETION_REASON_LABEL,
  reasonBlocksAftercare,
  completedFollowSummary,
  selectCompletedFollowPeople,
} from '@/lib/followCompletion';
import { moveToAftercare } from '@/lib/aftercareApi';
import { completeFollowEntry } from '@/lib/followApi';
import { UserCheck } from 'lucide-react';

/**
 * กล่อง **"โทรครบแล้ว"** บนหน้า Follow (Phase 7.1-7.2)
 *
 * เจ้าของสั่ง: *กล่อง "โทรครบแล้ว" (โทรครบรอบที่ตั้ง + `needs_human`) กดดูรายชื่อได้*
 * แล้วมีปุ่ม *[ย้ายไปดูแลหลังเริ่มงาน]* จากกล่องนั้น
 *
 * 🔴 **รับ `groups` จากหน้าแม่** ไม่โหลดเอง — กติกาเดิมของหน้านี้คือ *ยอดกับรายชื่อ
 * ต้องมาจากชุดเดียวกัน* (เคยมีเคสยอดมาจาก funnel ที่นับแถวคิว แล้วไม่ตรงกับชื่อที่กางออกมา)
 * 🔴 **ซ่อนตัวเองเมื่อไม่มีของ** — กล่องที่ขึ้นเลข 0 ทุกวันคือขยะ
 *    ("ของน้อยคือสัญญาณ ของเยอะคือพื้นหลัง")
 * ⚠️ ตรรกะ "ใครโทรครบ" อยู่ที่ `followCompletion.ts` (pure + เทสต์) ห้ามคิดในไฟล์นี้
 */
const PREVIEW_ROWS = 3;

const FollowCompletedPanel: React.FC<{
  groups: FollowGroup[];
  /** ย้ายเสร็จแล้วให้หน้าแม่โหลดใหม่ (คนที่ย้ายไปแล้วยังอยู่ในลิสต์ Follow ตามเดิม) */
  onMoved?: (name: string) => void;
}> = ({ groups, onMoved }) => {
  const navigate = useNavigate();
  const people = useMemo(() => selectCompletedFollowPeople(groups), [groups]);
  const [expanded, setExpanded] = useState(false);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movedKeys, setMovedKeys] = useState<string[]>([]);

  if (people.length === 0) return null;

  const shown = expanded ? people : people.slice(0, PREVIEW_ROWS);
  /** กี่คนที่ส่งต่อได้จริง — คนที่ AI ได้คำตอบว่าไม่ไปไม่นับ */
  const readyCount = people.filter((p) => !reasonBlocksAftercare(p.reason)).length;

  const move = async (
    key: string,
    name: string,
    phone: string,
    unitName: string | null,
    siteCode: string | null,
    followId: string | null,
    rounds: readonly { id: string; cancelled?: boolean; completed_at?: string | null }[],
  ) => {
    setMovingKey(key);
    setError(null);
    try {
      await moveToAftercare({
        phone,
        full_name: name,
        unit_name: unitName,
        site_code: siteCode,
        from_follow_id: followId,
        source: 'follow_done',
      });
      /**
       * 🔴 **ย้ายแล้วปิดงานติดตามให้เลย** (3 ก.ย. 2569 — เจ้าของสั่งดันทุกหน้าถึง 8 คะแนน)
       *
       * เดิมปุ่มนี้ย้ายชื่อไปหน้าดูแลอย่างเดียว งานติดตามยังค้างในกอง "กำลังตาม"
       * ⇒ แท็บ "สำเร็จ" เป็น 0 ตลอด และคนเดิมโผล่ทั้งสองหน้า (เจ้าของทักเรื่องนี้มาแล้ว)
       * ⚠️ ปิดเฉพาะ **รอบที่ยังไม่ปิด** และเงียบไว้ถ้าปิดพลาด — การย้ายสำเร็จแล้ว
       * ห้ามให้ผู้ใช้เห็น error ที่ทำให้เข้าใจว่าย้ายไม่สำเร็จ
       */
      const openRounds = rounds.filter((r) => !r.cancelled && !r.completed_at);
      for (const r of openRounds) {
        try {
          await completeFollowEntry(r.id, 'went');
        } catch {
          // ปิดไม่ได้ก็ไม่เป็นไร — ยังกดปิดเองได้ที่ป๊อปของสายนั้น
        }
      }
      setMovedKeys((prev) => [...prev, key]);
      onMoved?.(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ย้ายไม่สำเร็จ');
    } finally {
      setMovingKey(null);
    }
  };

  return (
    <section className={cn('space-y-2 rounded-2xl border px-3.5 py-3', TONE.success.soft)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {/* 🔴 หัวกล่องต้องไม่โกหก — เดิมเขียน "พร้อมส่งไปดูแลหลังเริ่มงาน" ทั้งก้อน
              ทั้งที่คนที่ AI ได้คำตอบว่า "ไม่ไป" ไม่ต้องส่งต่อ (แก้ 3 ก.ย. 2569) */}
          <p className={cn('text-sm font-semibold', TONE.success.value)}>
            โทรได้คำตอบแล้ว {people.length.toLocaleString('th-TH')} คน
            {readyCount > 0
              ? ` — ส่งไปดูแลหลังเริ่มงานได้ ${readyCount.toLocaleString('th-TH')} คน`
              : ' — ยังไม่มีใครต้องส่งต่อ'}
          </p>
          {/* 🔴 "โทรครบ" ≠ "สำเร็จ" — Haiku รอบสองงงว่าทำไมแท็บสำเร็จเป็น 0 ทั้งที่กล่องนี้มีคน
              (สำเร็จ = เจ้าหน้าที่ปิดงานว่าไปทำงานแล้ว · กล่องนี้แค่ AI โทรครบรอบที่ตั้ง) */}
          <p className={cn('text-[11px]', DASH.muted)}>
            {completedFollowSummary(people)} · โทรครบ ≠ สำเร็จ — จะขึ้นแท็บ &ldquo;สำเร็จ&rdquo;
            เมื่อเจ้าหน้าที่กดปิดงานว่าไปทำงานแล้ว
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/aftercare')}
          className="jarvis-btn-secondary shrink-0 text-xs"
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden /> เปิดหน้าดูแลหลังเริ่มงาน
        </button>
      </div>

      {error ? (
        <p className={cn('rounded-lg border px-2.5 py-1.5 text-[11px]', TONE.danger.soft, TONE.danger.value)}>
          {error}
        </p>
      ) : null}

      <ul className="space-y-1">
        {shown.map((p) => {
          const g = p.group;
          const done = movedKeys.includes(g.key);
          const lastRound = g.rounds[g.rounds.length - 1];
          return (
            <li
              key={g.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <b className={DASH.cellStrong}>{g.name}</b>
                <span className={DASH.muted}> · {g.phone}</span>
                {g.unitName ? <span className={DASH.muted}> · {g.unitName}</span> : null}
                <span className="block text-[11px]">
                  <span
                    className={
                      reasonBlocksAftercare(p.reason) ? TONE.danger.value : TONE.success.value
                    }
                  >
                    {COMPLETION_REASON_LABEL[p.reason]}
                  </span>
                  <span className={DASH.muted}> · ได้คำตอบจาก {p.roundsDone} สาย</span>
                </span>
              </span>
              {reasonBlocksAftercare(p.reason) ? (
                /* ไม่ไปแล้ว = ไม่มีอะไรให้ดูแลต่อ · ปิดงานที่ป๊อปของสายนั้นแทน */
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-semibold', TONE.neutral.chip)}>
                  ไม่ต้องส่งต่อ
                </span>
              ) : done ? (
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-semibold', TONE.success.chip)}>
                  ✓ ย้ายแล้ว
                </span>
              ) : (
                <button
                  type="button"
                  disabled={movingKey === g.key}
                  onClick={() =>
                    void move(
                      g.key,
                      g.name,
                      g.phone,
                      g.unitName,
                      g.siteCode,
                      lastRound?.id ?? null,
                      g.rounds,
                    )
                  }
                  className={cn(
                    'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 font-semibold disabled:opacity-50',
                    TONE.primary.outline,
                  )}
                >
                  {movingKey === g.key ? 'กำลังย้าย…' : 'ย้าย + ปิดงานติดตาม'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {people.length > PREVIEW_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="jarvis-btn-ghost text-[11px]"
        >
          {expanded ? 'ย่อรายการ' : `ดูอีก ${people.length - PREVIEW_ROWS} คน`}
        </button>
      ) : null}
    </section>
  );
};

export default FollowCompletedPanel;
