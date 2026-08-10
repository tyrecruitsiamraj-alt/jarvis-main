import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import {
  fetchMyCallQueue,
  CALL_RESULT_DESTINATION,
  CALL_RESULT_LABEL,
  EMPTY_TALLY,
  type CallHold,
  type CallResultOutcome,
  type CallResultTally,
} from '@/lib/callHoldsApi';
import { RefreshCw, ArrowRight } from 'lucide-react';

/**
 * "Status ของงานโทร" — รอโทรกี่คน + ผลแต่ละแบบวันนี้ไปจบที่ไหน
 *
 * เดิมเป็นบล็อกหนึ่งในหน้า `/matching/my-calls` (งานโทร) · เจ้าของสั่ง 10 ส.ค. 2569
 * ให้ย้ายมาไว้หน้าหลักแล้วปิดหน้างานโทรทิ้ง — บล็อกนี้จึงถูกแยกออกมาเป็นคอมโพเนนต์
 * เพื่อย้ายได้โดยไม่ต้องก๊อปโค้ด (นิยาม/สี/ปลายทางยังมาจากที่เดิมทุกตัว)
 *
 * ⚠️ ตัวเลขเป็นของ **คนที่ล็อกอินอยู่** (`?mine=1`) ไม่ใช่ทั้งทีม — ป้ายจึงต้องบอกให้ชัด
 * ไม่งั้นซ้ำรอย "เลขถูกแต่ตอบผิดคำถาม" แบบยอด 5,307 บนหน้า Follow
 */

const OUTCOME_ORDER: CallResultOutcome[] = [
  'confirmed',
  'declined',
  'reschedule_requested',
  'no_answer',
  'wrong_person',
];

/** ใกล้คายภายใน 2 ชม. = ต้องรีบโทร */
const DUE_SOON_MS = 2 * 60 * 60 * 1000;

const CallStatusPanel: React.FC = () => {
  const [holds, setHolds] = useState<CallHold[]>([]);
  const [tally, setTally] = useState<CallResultTally>(EMPTY_TALLY);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setLoading(true);
    void fetchMyCallQueue()
      .then((data) => {
        setHolds(data.holds);
        setTally(data.tally);
      })
      .catch(() => {
        // อ่านไม่ได้ = โชว์ศูนย์ ไม่ใช่ทำหน้าหลักพัง (แผงนี้เป็นข้อมูลประกอบ ไม่ใช่หัวใจของหน้า)
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  // เดินนาฬิกาเฉพาะเมื่อมีงานค้าง — หน้าว่างไม่ต้องเปลืองรอบ
  useEffect(() => {
    if (holds.length === 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [holds.length]);

  const dueSoonCount = useMemo(
    () => holds.filter((h) => new Date(h.expiresAt).getTime() - now <= DUE_SOON_MS).length,
    [holds, now],
  );

  return (
    <div className={cn('rounded-2xl border p-4', DASH.card)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          <p className={DASH.eyebrow}>งานโทรของฉัน · รอโทร</p>
          <p className={cn('font-mono text-3xl font-extrabold tabular-nums', DASH.cellStrong)}>
            {holds.length.toLocaleString('th-TH')}
          </p>
          <p className={cn('text-xs', DASH.muted)}>
            {dueSoonCount > 0
              ? `ใกล้คาย ${dueSoonCount.toLocaleString('th-TH')} คน — รีบโทรก่อน`
              : 'ล็อกอยู่ได้ 1 วันต่อคน'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
            TONE.neutral.soft,
            TONE.neutral.value,
            TONE.neutral.softHover,
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> รีเฟรช
        </button>
      </div>

      {/* แผนผังปลายทาง — กดผลแบบไหนแล้วงานวิ่งไปไหนต่อ + ยอดที่บันทึกไปแล้ววันนี้ */}
      <div className="mt-3 grid gap-1.5">
        {OUTCOME_ORDER.map((key) => {
          const tone = TONE[CALL_OUTCOME_TONE[key]];
          const count = key === 'declined' ? tally.declinedByScope.job : (tally.byOutcome[key] ?? 0);
          const extra = key === 'declined' ? tally.declinedByScope.all : null;
          return (
            <div
              key={key}
              className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs font-semibold',
                tone.soft,
                tone.value,
              )}
            >
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              <span>{CALL_RESULT_LABEL[key]}</span>
              <span className={cn('font-normal', DASH.muted)}>→ {CALL_RESULT_DESTINATION[key]}</span>
              <span className="ml-auto font-mono tabular-nums">
                วันนี้ {count.toLocaleString('th-TH')}
                {extra != null && extra > 0
                  ? ` · ไม่หางานแล้ว ${extra.toLocaleString('th-TH')}`
                  : ''}
              </span>
            </div>
          );
        })}
      </div>

      <p className={cn('mt-2.5 text-[10px] leading-relaxed', DASH.muted)}>
        นับเฉพาะงานโทรที่ <span className="font-semibold">คุณ</span> รับไว้เอง (กด "รับไปโทรเอง"
        ที่หน้า Matching) · ยอด "วันนี้" คือผลที่คุณบันทึกวันนี้ ไม่ใช่ของทั้งทีม
      </p>
    </div>
  );
};

export default CallStatusPanel;
